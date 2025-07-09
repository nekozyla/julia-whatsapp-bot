// commands/broadcast.js
const { ADMIN_JID } = require('../config');
const { sendJuliaError } = require('../utils');
const contactManager = require('../contactManager'); // Importa o novo gerenciador

// Função para criar um atraso aleatório
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleBroadcastCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, commandSenderJid } = msgDetails;

    // 1. Verifica se quem enviou é o admin
    if (commandSenderJid !== ADMIN_JID) {
        return true; // Ignora silenciosamente
    }

    const messageToSend = commandText.substring(command.length).trim();
    if (!messageToSend) {
        await sock.sendMessage(sender, { text: "Por favor, forneça uma mensagem para a transmissão.\nUso: `!broadcast [sua mensagem]`" }, { quoted: msg });
        return true;
    }

    try {
        // 3. Pega a lista de contatos do novo gerenciador
        const allContacts = contactManager.getContacts();
        const contactsToBroadcast = allContacts.filter(jid => jid !== ADMIN_JID); // Exclui o próprio admin

        if (contactsToBroadcast.length === 0) {
            await sock.sendMessage(sender, { text: "Não encontrei nenhum contato para enviar a transmissão." }, { quoted: msg });
            return true;
        }

        const confirmationText = `✅ Transmissão iniciada para ${contactsToBroadcast.length} contato(s).\n\nEste processo será lento para proteger seu número. Avisarei quando terminar.`;
        await sock.sendMessage(sender, { text: confirmationText });

        console.log(`[Broadcast] Iniciando envio para ${contactsToBroadcast.length} contatos. Mensagem: "${messageToSend}"`);

        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < contactsToBroadcast.length; i++) {
            const jid = contactsToBroadcast[i];
            try {
                // Atraso aleatório entre 10 e 30 segundos
                const delay = Math.floor(Math.random() * 20000) + 10000;
                console.log(`[Broadcast] Aguardando ${delay / 1000}s antes de enviar para ${jid} (${i + 1}/${contactsToBroadcast.length})`);
                await sleep(delay);
                
                await sock.sendMessage(jid, { text: messageToSend });
                successCount++;
            } catch (error) {
                console.error(`[Broadcast] Falha ao enviar para ${jid}:`, error);
                errorCount++;
            }
        }
        
        const reportText = `🏁 Transmissão concluída!\n\n- *Enviadas com sucesso:* ${successCount}\n- *Falhas:* ${errorCount}`;
        await sock.sendMessage(sender, { text: reportText });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Comando processado
}

module.exports = handleBroadcastCommand;
