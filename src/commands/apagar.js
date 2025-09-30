// commands/apagar.js

/**
 * Função para verificar se o autor do comando é admin do grupo.
 */
async function isGroupAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return !!participant?.admin; // Retorna true se for 'admin' ou 'superadmin'
    } catch (e) {
        console.error("[Apagar Command] Erro ao verificar status de admin:", e);
        return false;
    }
}

/**
 * Handler para o comando /apagar
 */
async function handleDeleteCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, isGroup, quotedMsgInfo } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    // Verifica se quem usou o comando é admin do grupo
    const isAuthorAdmin = await isGroupAdmin(sock, chatJid, commandSenderJid);
    if (!isAuthorAdmin) {
        await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem apagar mensagens." }, { quoted: msg });
        return;
    }

    // Verifica se o comando foi usado em resposta a uma mensagem
    if (!quotedMsgInfo) {
        await sock.sendMessage(chatJid, { text: "Para apagar uma mensagem, você precisa de a responder com o comando `/apagar`." }, { quoted: msg });
        return;
    }

    try {
        // Constrói a chave da mensagem que será apagada
        const keyToDelete = {
            remoteJid: chatJid,
            fromMe: false,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            participant: msg.message.extendedTextMessage.contextInfo.participant
        };

        // Envia a ordem para apagar a mensagem
        await sock.sendMessage(chatJid, { delete: keyToDelete });

    } catch (error) {
        console.error("[Apagar Command] Erro ao tentar apagar a mensagem:", error);
        // Envia uma mensagem de erro, pois a causa mais comum é o bot não ser admin
        await sock.sendMessage(chatJid, { text: "Não consegui apagar a mensagem. Verifique se eu tenho permissões de administrador neste grupo." }, { quoted: msg });
    }

    return true;
}

module.exports = handleDeleteCommand;
