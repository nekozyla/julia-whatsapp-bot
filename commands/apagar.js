// commands/apagar.js
const { ADMIN_JID } = require('../config');

async function handleDeleteMessageCommand(sock, msg, msgDetails) {
    const { sender, pushName, quotedMsgInfo } = msgDetails;
    const commandSenderJid = msg.key.participant || msg.key.remoteJid;

    if (commandSenderJid !== ADMIN_JID) {
        await sock.sendMessage(sender, { text: "Desculpe, apenas meu desenvolvedor pode usar este comando." }, { quoted: msg });
        return true; 
    }
    if (!quotedMsgInfo) {
        await sock.sendMessage(sender, { text: "Para apagar uma mensagem, você precisa responder à mensagem que eu enviei com o comando `!apagar`." }, { quoted: msg });
        return true; 
    }
    const keyToDelete = quotedMsgInfo.key;
    if (!keyToDelete || !keyToDelete.fromMe) {
        await sock.sendMessage(sender, { text: "Eu só posso apagar as minhas próprias mensagens! 😉" }, { quoted: msg });
        return true; 
    }
    try {
        console.log(`[Apagar] Administrador ${pushName} solicitou apagar a mensagem da Julia com ID: ${keyToDelete.id}`);
        await sock.sendMessage(sender, { delete: keyToDelete });
    } catch (error) {
        console.error("[Apagar] Erro ao tentar apagar mensagem:", error);
        await sock.sendMessage(sender, { text: "Tive um problema ao tentar apagar a mensagem." }, { quoted: msg });
    }
    return true;
}

module.exports = handleDeleteMessageCommand;
