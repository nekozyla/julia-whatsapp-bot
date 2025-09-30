// src/commands/demote.js
const { sendJuliaError } = require('../utils/utils.js');

async function handleDemoteCommand(sock, msg, msgDetails) {
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
            await sock.sendMessage(chatJid, { text: "Apenas administradores podem rebaixar membros." }, { quoted: msg });
            return true;
        }
        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: "Eu preciso ser administradora do grupo para rebaixar alguém." }, { quoted: msg });
            return true;
        }

        const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;
        let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;

        if (!targetJid) {
            await sock.sendMessage(chatJid, { text: "Você precisa de marcar o utilizador ou responder a uma mensagem dele para rebaixar.\n\n*Exemplo:*\n`/demote @usuario`" }, { quoted: msg });
            return true;
        }

        if (targetJid === commandSenderJid) {
            await sock.sendMessage(chatJid, { text: "Você não pode rebaixar-se a si próprio." }, { quoted: msg });
            return true;
        }
        if (targetJid === groupMetadata.owner) {
            await sock.sendMessage(chatJid, { text: "Não posso alterar o status do dono do grupo." }, { quoted: msg });
            return true;
        }

        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        if (!targetParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: `O utilizador @${targetJid.split('@')[0]} já não era um administrador.`, mentions: [targetJid] }, { quoted: msg });
            return true;
        }

        await sock.groupParticipantsUpdate(chatJid, [targetJid], 'demote');
        await sock.sendMessage(chatJid, { text: `✅ @${targetJid.split('@')[0]} foi rebaixado(a) a membro comum.`, mentions: [targetJid] });

    } catch (error) {
        console.error("[Demote] Erro:", error);
        await sendJuliaError(sock, chatJid, msg, error);
    }

    return true;
}

module.exports = handleDemoteCommand;
