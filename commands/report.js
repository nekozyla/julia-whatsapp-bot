// commands/report.js
const { ADMIN_JID } = require('../config');
const { sendJuliaError } = require('../utils');

async function handleReportCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    // Extrai a descrição do bug (tudo que vem depois de '!report ')
    const bugDescription = commandText.substring(command.length).trim();

    // Verifica se o usuário escreveu uma descrição
    if (!bugDescription) {
        await sock.sendMessage(sender, { 
            text: "Para reportar um bug, por favor, descreva o problema após o comando.\n\n*Exemplo:*\n`!report o comando !sticker não está funcionando com GIFs`" 
        }, { quoted: msg });
        return true;
    }

    console.log(`[Report] Novo reporte de bug recebido de ${pushName} em ${sender}.`);

    try {
        // 1. Montar a notificação para o Admin
        let groupName = "Chat Privado";
        if (sender.endsWith('@g.us')) {
            const groupMetadata = await sock.groupMetadata(sender);
            groupName = groupMetadata.subject;
        }

        const adminNotification = `
🚨 *NOVO REPORTE DE BUG* 🚨

*De:* ${pushName}
*JID do Usuário:* ${msg.key.participant || sender}
*No Chat:* ${groupName} (${sender})
*Horário:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}

*Mensagem:*
${bugDescription}
        `;

        // 2. Enviar a notificação para o seu número privado
        await sock.sendMessage(ADMIN_JID, { text: adminNotification.trim() });
        console.log(`[Report] Notificação de bug enviada para o admin ${ADMIN_JID}.`);

        // 3. Enviar a confirmação para o usuário que reportou
        const userConfirmation = `Obrigado pelo seu feedback, ${pushName}! ✨\n\nSeu reporte foi enviado com sucesso para o meu desenvolvedor. Ele vai analisar o mais breve possível.`;
        await sock.sendMessage(sender, { text: userConfirmation }, { quoted: msg });

    } catch (error) {
        console.error("[Report] Erro ao processar o reporte de bug:", error);
        // Envia um erro apenas para o usuário que tentou reportar, não para o admin
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleReportCommand;
