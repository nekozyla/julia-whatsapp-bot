
const authManager = require('../managers/authManager.js');
const { sendGiratinaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const config = require('../../config.js');


const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');
const BOT_NAME = config.BOT_NAME || 'Bot';


async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId] || cache['global'];
    } catch (error) {
        return null;
    }
}

async function handleMentionAllCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);
        const participants = groupMetadata.participants;
        const botJid = await getBotJid(sender); 

        if (!botJid) {
            await sock.sendMessage(sender, { text: `Não consegui verificar minha identidade neste grupo. Por favor, execute o comando \`/sync @${BOT_NAME}\` primeiro.` }, { quoted: msg });
            return;
        }

        const senderParticipant = participants.find(p => p.id === commandSenderJid);
        const botParticipant = participants.find(p => p.id === botJid);

        const isGroupAdmin = !!senderParticipant?.admin;
        const isSuperAdmin = authManager.isSuperAdmin(commandSenderJid);

        if (!isGroupAdmin && !isSuperAdmin) {
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return;
        }

        if (!botParticipant?.admin) {
        }

        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        

        
        const hasSilentFlag = commandText.includes('--silent');

        
        let messageText = commandText.substring(command.length).replace('--silent', '').trim();

        
        if (!messageText) {
            messageText = "📢 *Atenção, pessoal!* 📢";
        }

        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}. Modo silent: ${hasSilentFlag}`);

        let finalText;

        if (hasSilentFlag) {
            
            finalText = messageText;
        } else {
            
            const tagsText = mentions.map(jid => `@${jid.split('@')[0]}`).join(' ');
            finalText = `${messageText}\n\n${tagsText}`;
        }

        
        const messagePayload = {
            mentions: mentions
        };

        
        const isImage = !!msg.message.imageMessage;
        const isVideo = !!msg.message.videoMessage;

        if (isImage || isVideo) {
            
            const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: undefined });

            if (isImage) {
                messagePayload.image = mediaBuffer;
            } else {
                messagePayload.video = mediaBuffer;
                
                if (msg.message.videoMessage.gifPlayback) {
                    messagePayload.gifPlayback = true;
                }
            }
            
            messagePayload.caption = finalText;

        } else {
            
            messagePayload.text = finalText;
        }

        // --- Delay programável: --delay=5s ou --delay=2m ---
        let delayMs = 0;
        const delayMatch = commandText.match(/--delay=(\d+)(s|m)?/i);
        if (delayMatch) {
            const amount = parseInt(delayMatch[1]);
            const unit = (delayMatch[2] || 's').toLowerCase();
            delayMs = unit === 'm' ? amount * 60000 : amount * 1000;
            delayMs = Math.min(delayMs, 10 * 60 * 1000); // máximo 10 minutos
        }

        if (delayMs > 0) {
            const seconds = Math.round(delayMs / 1000);
            const timeStr = seconds >= 60 ? `${Math.floor(seconds / 60)}min${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}` : `${seconds}s`;
            await sock.sendMessage(sender, { text: `⏳ Marcação agendada para daqui a *${timeStr}*...` }, { quoted: msg });
            await new Promise(r => setTimeout(r, delayMs));
        }

        await sock.sendMessage(sender, messagePayload);

        if (botParticipant?.admin) {
            await sock.sendMessage(sender, { delete: msg.key });
        }

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }
}

module.exports = handleMentionAllCommand;


module.exports.commandData = {
    name: "todos",
    description: "Marca todos.",
    category: "admin",
    usage: "/todos",
    aliases: ["/everyone","/all","/marcar","/tagall"]
};
