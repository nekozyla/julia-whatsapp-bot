
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');


const BOT_JID_CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'bot_jid_cache.json');


async function getBotJid(groupId) {
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        const cache = JSON.parse(data);
        return cache[groupId] || cache['global'];
    } catch (error) {
        return null;
    }
}

async function handleCabumCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, isGroup, isSuperAdmin } = msgDetails;

    
    if (!isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatJid);

        
        let botId = await getBotJid(chatJid);
        if (!botId) {
            botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        }

        const botParticipant = groupMetadata.participants.find(p => p.id === botId);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        
        
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "🚫 Eu preciso ser **administradora** do grupo para realizar um CABUM! Dê-me permissão primeiro." }, { quoted: msg });
            return true;
        }

        
        if (!senderParticipant?.admin && !isSuperAdmin) {
            await sock.sendMessage(chatJid, { text: "🚫 Apenas administradores podem usar o comando CABUM." }, { quoted: msg });
            return true;
        }

        
        
        
        
        const victims = groupMetadata.participants
            .filter(p => p.id !== botId && p.id !== commandSenderJid)
            .map(p => p.id);

        if (victims.length === 0) {
            await sock.sendMessage(chatJid, { text: "🤷‍♂️ O grupo já está vazio! Não há ninguém para remover além de nós." }, { quoted: msg });
            return true;
        }

        
        await sock.sendMessage(chatJid, { text: "💣 **CABUM!** Iniciando a detonação do grupo..." });

        
        await sock.groupParticipantsUpdate(chatJid, victims, "remove");

        await sock.sendMessage(chatJid, { text: `💥 **Destruição Completa!**\n\nForam removidos ${victims.length} participantes deste grupo.` });

    } catch (error) {
        console.error("[Cabum] Erro fatal:", error);
        await sendJuliaError(sock, chatJid, msg, error);
    }

    return true;
}

module.exports = handleCabumCommand;


module.exports.commandData = {
    name: "cabum",
    description: "Nuke no grupo.",
    category: "super",
    usage: "/cabum",
    aliases: ["/limpar","/nuke","/destruir"]
};
