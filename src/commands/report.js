// commands/report.js

module.exports = async (sock, msg, msgDetails) => {
    // --- DESTINATÁRIO FIXO DO REPORTE ---
    // O 55 é o código do Brasil.
    const REPORT_DESTINATION_JID = '5522992667333@s.whatsapp.net';

    const { commandText, commandSenderJid, pushName } = msgDetails;
    const sender = msg.key.remoteJid;

    try {
        // Pega a mensagem do reporte (tudo que vem depois de /report)
        const reportText = commandText.split(' ').slice(1).join(' ');

        // Verifica se o usuário escreveu uma mensagem para reportar
        if (!reportText) {
            await sock.sendMessage(sender, { text: "Por favor, escreva a sua sugestão ou o seu reporte de bug após o comando.\n\n*Exemplo:*\n/report o comando /sticker não está a funcionar." }, { quoted: msg });
            return;
        }

        // Formata a mensagem que será enviada para o administrador
        const senderInfo = `${pushName} (${commandSenderJid})`;
        const finalReportMessage = `🚨 *Novo Reporte de Bug/Sugestão*\n\n*De:* ${senderInfo}\n*Mensagem:* ${reportText}`;

        // Envia a mensagem para o destinatário fixo
        await sock.sendMessage(REPORT_DESTINATION_JID, { text: finalReportMessage });

        // Envia uma mensagem de confirmação para o usuário que fez o reporte
        await sock.sendMessage(sender, { text: "✅ Reporte enviado com sucesso! Obrigado pela sua contribuição." }, { quoted: msg });

    } catch (error) {
        console.error("[Report] Erro ao processar o reporte de bug:", error);
        // Informa ao usuário que algo deu errado
        await sock.sendMessage(sender, { text: "😕 Ocorreu um erro ao enviar o seu reporte. Por favor, tente novamente mais tarde." }, { quoted: msg });
    }
};
