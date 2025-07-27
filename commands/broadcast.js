// commands/broadcast.js
const { ADMIN_JID } = require('../config');
const { sendJuliaError } = require('../utils');
const contactManager = require('../contactManager');
const agreementManager = require('../agreementManager');
const broadcastManager = require('../broadcastManager');

async function handleBroadcastCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, commandSenderJid } = msgDetails;

    if (commandSenderJid !== ADMIN_JID) return true;

    const subcommand = (commandText.split(' ')[1] || '').toLowerCase();

    // Subcomando para ver o status
    if (subcommand === 'status') {
        const status = broadcastManager.getStatus();
        let statusText = `*Status da Transmissão:*\n\n- *Estado:* ${status.status}\n`;
        if (status.status !== 'idle') {
            statusText += `- *Mensagem:* ${status.message.substring(0, 50)}...\n`;
            statusText += `- *Progresso:* ${status.currentIndex} / ${status.contacts.length}\n`;
            statusText += `- *Sucessos:* ${status.successCount}\n- *Falhas:* ${status.errorCount}`;
        }
        await sock.sendMessage(sender, { text: statusText }, { quoted: msg });
        return true;
    }

    // Subcomando para pausar
    if (subcommand === 'pausar') {
        if (await broadcastManager.pauseBroadcast()) {
            await sock.sendMessage(sender, { text: "⏸️ Transmissão pausada." }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: "Nenhuma transmissão em andamento para pausar." }, { quoted: msg });
        }
        return true;
    }

    // Subcomando para continuar
    if (subcommand === 'continuar') {
        if (await broadcastManager.resumeBroadcast()) {
            await sock.sendMessage(sender, { text: "▶️ Transmissão retomada." }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: "Nenhuma transmissão pausada para continuar." }, { quoted: msg });
        }
        return true;
    }
    
    // Subcomando para cancelar
    if (subcommand === 'cancelar') {
        if (await broadcastManager.cancelBroadcast()) {
            await sock.sendMessage(sender, { text: "❌ Transmissão cancelada e fila limpa." }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: "Nenhuma transmissão para cancelar." }, { quoted: msg });
        }
        return true;
    }

    // Lógica para iniciar uma nova transmissão
    const messageToSend = commandText.substring(command.length).trim();
    if (!messageToSend) {
        await sock.sendMessage(sender, { text: "Uso: `!broadcast [mensagem]`\nSubcomandos: `status`, `pausar`, `continuar`, `cancelar`" }, { quoted: msg });
        return true;
    }

    try {
        const allContacts = contactManager.getContacts();
        const agreedContacts = allContacts.filter(jid => agreementManager.hasUserAgreed(jid) && jid !== ADMIN_JID);

        if (agreedContacts.length === 0) {
            await sock.sendMessage(sender, { text: "Nenhum contato que concordou com os termos foi encontrado para a transmissão." }, { quoted: msg });
            return true;
        }

        const total = await broadcastManager.startBroadcast(messageToSend, agreedContacts);
        const confirmationText = `✅ Nova transmissão iniciada para ${total} contato(s).\n\nO envio começará em breve. Use \`!broadcast status\` para ver o progresso.`;
        await sock.sendMessage(sender, { text: confirmationText }, { quoted: msg });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; 
}

module.exports = handleBroadcastCommand;
