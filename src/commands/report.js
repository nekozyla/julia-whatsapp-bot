

module.exports = async (sock, msg, msgDetails) => {
    
    
    const REPORT_DESTINATION_JID = '5522992667333@s.whatsapp.net';

    const { commandText, commandSenderJid, pushName } = msgDetails;
    const sender = msg.key.remoteJid;

    try {
        
        const reportText = commandText.split(' ').slice(1).join(' ');

        
        if (!reportText) {
            await sock.sendMessage(sender, { text: "Por favor, escreva a sua sugestão ou o seu reporte de bug após o comando.\n\n*Exemplo:*\n/report o comando /sticker não está a funcionar." }, { quoted: msg });
            return;
        }

        
        const senderInfo = `${pushName} (${commandSenderJid})`;
        const finalReportMessage = `🚨 *Novo Reporte de Bug/Sugestão*\n\n*De:* ${senderInfo}\n*Mensagem:* ${reportText}`;

        
        await sock.sendMessage(REPORT_DESTINATION_JID, { text: finalReportMessage });

        
        await sock.sendMessage(sender, { text: "✅ Reporte enviado com sucesso! Obrigado pela sua contribuição." }, { quoted: msg });

    } catch (error) {
        console.error("[Report] Erro ao processar o reporte de bug:", error);
        
        await sock.sendMessage(sender, { text: "😕 Ocorreu um erro ao enviar o seu reporte. Por favor, tente novamente mais tarde." }, { quoted: msg });
    }
};


module.exports.commandData = {
    name: "report",
    description: "Envia report ao dev.",
    category: "util",
    usage: "/report",
    aliases: ["/reportar","/bug","/sugestao"]
};
