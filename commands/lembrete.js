// commands/lembrete.js
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { v4: uuidv4 } = require('uuid'); // Para gerar IDs únicos
const scheduler = require('../scheduler');

// Configura o Day.js para usar o fuso horário de São Paulo
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("America/Sao_Paulo");

async function handleReminderCreation(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, pushName } = msgDetails;

    // Remove o comando para pegar apenas os argumentos
    const args = commandText.substring(msgDetails.command.length).trim().split(' ');
    
    if (args.length < 2) {
        await sock.sendMessage(sender, { text: "Uso incorreto. Formato: `!lembrete [data] [hora] [mensagem]` ou `!lembrete [data] [mensagem]`\n\n*Exemplos:*\n`!lembrete 25/12 00:00 Natal!`\n`!lembrete 31/12 Fogos de artifício`" }, { quoted: msg });
        return true;
    }

    const dateStr = args[0];
    let timeStr = '';
    let messageParts;
    let reminderDateTime;
    let isRecurring = false;

    // Tenta detectar se o segundo argumento é uma hora (HH:mm)
    if (/^\d{2}:\d{2}$/.test(args[1])) {
        timeStr = args[1];
        messageParts = args.slice(2);
    } else {
        timeStr = '09:00'; // Hora padrão se não for especificada
        messageParts = args.slice(1);
    }

    const message = messageParts.join(' ');
    if (!message) {
        await sock.sendMessage(sender, { text: "Por favor, forneça uma mensagem para o lembrete." }, { quoted: msg });
        return true;
    }

    // Processa a data
    const now = dayjs().tz();
    
    if (/^\d{2}\/\d{2}$/.test(dateStr)) { // Formato DD/MM (anual)
        isRecurring = true;
        reminderDateTime = dayjs(`${dateStr}/${now.year()} ${timeStr}`, 'DD/MM/YYYY HH:mm').tz();
        // Se a data já passou este ano, agenda para o próximo ano
        if (reminderDateTime.isBefore(now)) {
            reminderDateTime = reminderDateTime.add(1, 'year');
        }
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) { // Formato DD/MM/AAAA (único)
        reminderDateTime = dayjs(`${dateStr} ${timeStr}`, 'DD/MM/YYYY HH:mm').tz();
    } else {
        await sock.sendMessage(sender, { text: "Formato de data inválido. Use `DD/MM` para lembretes anuais ou `DD/MM/AAAA` para uma data específica." }, { quoted: msg });
        return true;
    }

    // Validação final da data
    if (!reminderDateTime.isValid() || reminderDateTime.isBefore(now)) {
        await sock.sendMessage(sender, { text: "A data e hora fornecidas são inválidas ou já passaram. Verifique e tente novamente." }, { quoted: msg });
        return true;
    }

    // Cria o objeto do lembrete
    const newReminder = {
        id: uuidv4(),
        targetJid: sender,
        creatorJid: commandSenderJid,
        creatorName: pushName,
        message: message,
        triggerTimestamp: reminderDateTime.valueOf(),
        isRecurring: isRecurring,
        sent: false
    };

    try {
        await scheduler.addReminder(newReminder);
        const formattedDate = reminderDateTime.format('DD/MM/YYYY [às] HH:mm');
        await sock.sendMessage(sender, { text: `✅ Lembrete agendado com sucesso para ${formattedDate}!\n\n*Tipo:* ${isRecurring ? 'Anual' : 'Único'}` }, { quoted: msg });
        console.log(`[Lembrete] Novo lembrete criado por ${pushName}:`, newReminder);
    } catch (error) {
        console.error("[Lembrete] Erro ao criar lembrete:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao salvar seu lembrete." }, { quoted: msg });
    }

    return true;
}

module.exports = handleReminderCreation;
