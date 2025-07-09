// commands/remover.js
const { sendJuliaError } = require('../utils');

async function handleRemoveCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, pushName } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo;

    // 1. O comando só funciona em grupos
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    // Identifica o alvo a ser removido
    let targetJid = quotedMsgInfo?.mentionedJid?.[0] || quotedMsgInfo?.participant;
    if (!targetJid && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        // Fallback se for uma resposta a uma mensagem normal
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }

    if (!targetJid) {
        await sock.sendMessage(sender, { text: "Você precisa marcar o usuário ou responder a uma mensagem dele para removê-lo.\n\n*Exemplo:* `!remover @usuario`" }, { quoted: msg });
        return true;
    }
    
    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        const targetParticipant = groupMetadata.participants.find(p => p.id === targetJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

        // 2. Verifica as permissões
        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Eu preciso ser administradora do grupo para conseguir remover alguém." }, { quoted: msg });
            return true;
        }
        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return true;
        }
        if (targetParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Não posso remover outro administrador." }, { quoted: msg });
            return true;
        }
        
        console.log(`[Remover] Admin ${pushName} solicitou a remoção de ${targetJid} do grupo ${groupMetadata.subject}.`);

        // 3. Executa a remoção
        await sock.groupParticipantsUpdate(
            sender,          // JID do grupo
            [targetJid],     // JID do participante em um array
            "remove"         // Ação a ser executada
        );
        
        // A confirmação é opcional, pois o próprio WhatsApp já notifica a remoção.
        // await sock.sendMessage(sender, { text: `Usuário @${targetJid.split('@')[0]} removido com sucesso.`, mentions: [targetJid] });

    } catch (error) {
        console.error("[Remover] Erro ao remover participante:", error);
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleRemoveCommand;
