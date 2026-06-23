const { sendGiratinaError } = require('../utils/utils.js');
const fs = require('fs').promises;
const path = require('path');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

async function handleDemoteCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, botJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, chatJid);

        if (!botJid) {
            await sock.sendMessage(chatJid, { text: `Não consegui verificar minha identidade neste grupo. Execute \`/fixjid @${BOT_NAME}\`.` }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores podem rebaixar membros." }, { quoted: msg });
            return;
        }
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para rebaixar alguém." }, { quoted: msg });
            return;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa de marcar o utilizador ou responder a uma mensagem dele para rebaixar.\n\n*Exemplo:*\n`/demote @usuario`" }, { quoted: msg });
            return;
        }

        if (targetJid === commandSenderJid) {
            await sock.sendMessage(chatJid, { text: "Você não pode rebaixar-se a si próprio." }, { quoted: msg });
            return;
        }
        if (targetJid === groupMetadata.owner) {
            await sock.sendMessage(chatJid, { text: "Não posso alterar o status do dono do grupo." }, { quoted: msg });
            return;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (!targetParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `O utilizador @${targetJid.split('@')[0]} já não era um administrador.`, mentions: [targetJid] }, { quoted: msg });
            return;
        }

        await sock.groupParticipantsUpdate(chatJid, [targetJid], 'demote');
        await sock.sendMessage(chatJid, { text: `✅ @${targetJid.split('@')[0]} foi rebaixado(a) a membro comum.`, mentions: [targetJid] });

    } catch (error) {
        console.error("[Demote] Erro:", error);
        await sendGiratinaError(sock, chatJid, msg, error);
    }
}

module.exports = handleDemoteCommand;


module.exports.commandData = {
    name: "demote",
    description: "Remove admin.",
    category: "admin",
    usage: "/demote",
    aliases: ["/rebaixar", "/unadmin", "/down"]
};
