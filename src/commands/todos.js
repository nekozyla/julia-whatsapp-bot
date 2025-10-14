// src/commands/todos.js
const { ADMIN_JIDS } = require('../../config/config.js');
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');

const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');

/**
 * Lê o cache para encontrar o JID do bot para um grupo específico.
 * @param {string} groupId O JID do grupo.
 * @returns {Promise<string|null>} O JID do bot no grupo ou null.
 */
async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId];
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
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        const botJid = await getBotJid(sender); // <<< LÓGICA ATUALIZADA
        
        if (!botJid) {
            await sock.sendMessage(sender, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
            return;
        }
        
        const senderParticipant = participants.find(p => p.id === commandSenderJid);
        const botParticipant = participants.find(p => p.id === botJid);
        
        const isGroupAdmin = !!senderParticipant?.admin;
        const isSuperAdmin = ADMIN_JIDS.includes(commandSenderJid);

        if (!isGroupAdmin && !isSuperAdmin) { 
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return;
        }

        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Eu preciso ser administradora do grupo para poder apagar o seu comando após a menção." }, { quoted: msg });
        }

        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        let messageText = commandText.substring(command.length).trim() || "📢 *Atenção, pessoal!* 📢";
        
        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}.`);

        await sock.sendMessage(sender, {
            text: messageText,
            mentions: mentions
        });
        
        if (botParticipant?.admin) {
            await sock.sendMessage(sender, { delete: msg.key });
        }
        
    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }
}

module.exports = handleMentionAllCommand;
