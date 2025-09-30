// commands/jid.js

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, isGroup } = msgDetails;

    try {
        if (isGroup) {
            // Se o comando for usado num grupo, envia o JID do grupo
            const groupJid = sender;
            await sock.sendMessage(groupJid, { text: `O JID deste grupo é:\n\`\`\`${groupJid}\`\`\`` });
            console.log(`[JID] JID do grupo ${groupJid} solicitado por ${commandSenderJid}.`);
        } else {
            // Se o comando for usado em privado, envia o JID do próprio utilizador
            const userJid = commandSenderJid;
            await sock.sendMessage(userJid, { text: `O seu JID é:\n\`\`\`${userJid}\`\`\`` });
            console.log(`[JID] JID do utilizador ${userJid} solicitado.`);
        }
    } catch (error) {
        console.error("Erro no comando /jid:", error);
    }

    return true; // Indica que o comando foi processado
};
