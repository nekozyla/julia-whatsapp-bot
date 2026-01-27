
const groupMetadataManager = require('../managers/groupMetadataManager.js');


async function isGroupAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return !!participant?.admin; 
    } catch (e) {
        console.error("[Apagar Command] Erro ao verificar status de admin:", e);
        return false;
    }
}


async function handleDeleteCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, isGroup, quotedMsgInfo } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    
    const isAuthorAdmin = await isGroupAdmin(sock, chatJid, commandSenderJid);
    if (!isAuthorAdmin) {
        await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem apagar mensagens." }, { quoted: msg });
        return;
    }

    
    if (!quotedMsgInfo) {
        await sock.sendMessage(chatJid, { text: "Para apagar uma mensagem, você precisa de a responder com o comando `/apagar`." }, { quoted: msg });
        return;
    }

    try {
        
        const keyToDelete = {
            remoteJid: chatJid,
            fromMe: false,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
        };

        
        await sock.sendMessage(chatJid, { delete: keyToDelete });

    } catch (error) {
        console.error("[Apagar Command] Erro ao tentar apagar a mensagem:", error);
        
        await sock.sendMessage(chatJid, { text: "Não consegui apagar a mensagem. Verifique se eu tenho permissões de administrador neste grupo." }, { quoted: msg });
    }

    return true;
}

module.exports = handleDeleteCommand;


module.exports.commandData = {
    name: "apagar",
    description: "Apaga mensagem.",
    category: "admin",
    usage: "/apagar",
    aliases: ["/del","/delete","/apaga"]
};
