
const { sendJuliaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

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

async function handlePromoteCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        const botId = await getBotJid(chatJid); 

        if (!botId) {
            await sock.sendMessage(chatJid, { text: "Não consegui verificar minha identidade neste grupo. Por favor, execute o comando `/sync @Julia` primeiro." }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores podem promover membros." }, { quoted: msg });
            return;
        }
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para promover alguém." }, { quoted: msg });
            return;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa de marcar o utilizador ou responder a uma mensagem dele para promover.\n\n*Exemplo:*\n`/promote @usuario`" }, { quoted: msg });
            return;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (targetParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `O utilizador @${targetJid.split('@')[0]} já é um administrador.`, mentions: [targetJid] }, { quoted: msg });
            return;
        }

        await sock.groupParticipantsUpdate(chatJid, [targetJid], 'promote');
        await sock.sendMessage(chatJid, { text: `✅ @${targetJid.split('@')[0]} foi promovido(a) a administrador!`, mentions: [targetJid] });

    } catch (error) {
        console.error("[Promote] Erro:", error);
        await sendJuliaError(sock, chatJid, msg, error);
    }
}

module.exports = handlePromoteCommand;


module.exports.commandData = {
    name: "promote",
    description: "Promove a admin.",
    category: "admin",
    usage: "/promote",
    aliases: ["/promover","/up"]
};
