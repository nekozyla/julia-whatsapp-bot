

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, isGroup } = msgDetails;

    try {
        if (isGroup) {
            
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const mentioned = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;

            const targetJid = mentioned || quotedParticipant;

            if (targetJid) {
                await sock.sendMessage(sender, { text: `O JID do utilizador marcado é:\n\`\`\`${targetJid}\`\`\`` }, { quoted: msg });
                console.log(`[JID] JID do utilizador ${targetJid} solicitado por ${commandSenderJid} no grupo ${sender}.`);
            } else {
                
                const groupJid = sender;
                await sock.sendMessage(groupJid, { text: `O JID deste grupo é:\n\`\`\`${groupJid}\`\`\`` }, { quoted: msg });
                console.log(`[JID] JID do grupo ${groupJid} solicitado por ${commandSenderJid}.`);
            }
        } else {
            
            const userJid = commandSenderJid;
            await sock.sendMessage(userJid, { text: `O seu JID é:\n\`\`\`${userJid}\`\`\`` }, { quoted: msg });
            console.log(`[JID] JID do utilizador ${userJid} solicitado.`);
        }
    } catch (error) {
        console.error("Erro no comando /jid:", error);
    }

    return true; 
};


module.exports.commandData = {
    name: "jid",
    description: "Mostra ID do chat/usuário.",
    category: "util",
    usage: "/jid",
    aliases: ["/id","/myid"]
};
