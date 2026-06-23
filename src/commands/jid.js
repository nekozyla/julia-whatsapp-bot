

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, isGroup } = msgDetails;

    try {
        if (isGroup) {
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const mentioned = contextInfo?.mentionedJid?.[0];
            const quotedParticipant = contextInfo?.participant;

            const targetJid = mentioned || quotedParticipant;

            if (targetJid) {
                await sock.sendMessage(sender, {
                    text: `┏━━❪ 𝗝𝗜𝗗 ❫━━\n┃\n┃ ➢ 𝗧𝗶𝗽𝗼 › Usuário\n┃ ➢ 𝗜𝗗 › \`\`\`${targetJid}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `┏━━❪ 𝗝𝗜𝗗 ❫━━\n┃\n┃ ➢ 𝗧𝗶𝗽𝗼 › Grupo\n┃ ➢ 𝗜𝗗 › \`\`\`${sender}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 𝗝𝗜𝗗 ❫━━\n┃\n┃ ➢ 𝗧𝗶𝗽𝗼 › Seu JID\n┃ ➢ 𝗜𝗗 › \`\`\`${commandSenderJid}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
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
    usage: "/jid [@user]",
    aliases: ["/id", "/myid"]
};
