

module.exports = async (sock, msg, msgDetails) => {
    const REPORT_DESTINATION_JID = '5522992667333@s.whatsapp.net';

    const { commandText, commandSenderJid, pushName, prefix, commandName } = msgDetails;
    const sender = msg.key.remoteJid;

    try {
        const reportText = commandText.split(' ').slice(1).join(' ');

        if (!reportText) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 𝗥𝗘𝗣𝗢𝗥𝗧 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [mensagem]\n┃\n┣━━❪ 𝗘𝗫𝗘𝗠𝗣𝗟𝗢 ❫━━\n┃\n┃ ➢ ${prefix}${commandName} o /sticker bugou\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return;
        }

        const senderInfo = `${pushName} (${commandSenderJid})`;
        const finalReportMessage = `┏━━❪ 🚨 𝗥𝗘𝗣𝗢𝗥𝗧 ❫━━\n┃\n┃ ➢ 𝗗𝗲 › ${senderInfo}\n┃ ➢ 𝗠𝘀𝗴 › ${reportText}\n┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(REPORT_DESTINATION_JID, { text: finalReportMessage });

        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Reporte enviado\n┃ ➢ 𝗜𝗻𝗳𝗼 › Obrigado pela contribuição!\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (error) {
        console.error("[Report] Erro ao processar o reporte de bug:", error);
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao enviar reporte\n┃ ➢ 𝗗𝗶𝗰𝗮 › Tente novamente\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }
};


module.exports.commandData = {
    name: "report",
    description: "Envia report ao dev.",
    category: "util",
    usage: "/report [mensagem]",
    aliases: ["/reportar", "/bug", "/sugestao"]
};
