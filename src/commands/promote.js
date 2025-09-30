// src/commands/promote.js
const { sendJuliaError } = require('../utils/utils.js');

async function handlePromoteCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(chatJid);
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botId);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores podem promover membros." }, { quoted: msg });
            return true;
        }
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para promover alguém." }, { quoted: msg });
            return true;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa de marcar o utilizador ou responder a uma mensagem dele para promover.\n\n*Exemplo:*\n`/promote @usuario`" }, { quoted: msg });
            return true;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (targetParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `O utilizador @${targetJid.split('@')[0]} já é um administrador.`, mentions: [targetJid] }, { quoted: msg });
            return true;
        }

        await sock.groupParticipantsUpdate(chatJid, [targetJid], 'promote');
        await sock.sendMessage(chatJid, { text: `✅ @${targetJid.split('@')[0]} foi promovido(a) a administrador!`, mentions: [targetJid] });

    } catch (error) {
        console.error("[Promote] Erro:", error);
        await sendJuliaError(sock, chatJid, msg, error);
    }

    return true;
}

module.exports = handlePromoteCommand;
