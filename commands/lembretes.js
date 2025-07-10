// commands/lembretes.js
const dayjs = require('dayjs');
const scheduler = require('../scheduler');

async function handleListRemindersCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    const remindersForThisChat = scheduler.getRemindersForChat(sender);

    if (remindersForThisChat.length === 0) {
        await sock.sendMessage(sender, { text: "Não há nenhum lembrete agendado para este chat." }, { quoted: msg });
        return true;
    }

    let replyText = `*Lembretes Agendados para este Chat* 🗓️\n\n`;

    // Ordena os lembretes por data
    remindersForThisChat.sort((a, b) => a.triggerTimestamp - b.triggerTimestamp);

    remindersForThisChat.forEach((r, index) => {
        const triggerDate = dayjs(r.triggerTimestamp).format('DD/MM/YYYY [às] HH:mm');
        const recurringTag = r.isRecurring ? ' (Anual)' : '';
        replyText += `${index + 1}. *${r.message}*${recurringTag}\n   - Próximo: ${triggerDate}\n   - Criado por: ${r.creatorName}\n\n`;
    });

    await sock.sendMessage(sender, { text: replyText.trim() });
    
    return true;
}

module.exports = handleListRemindersCommand;
