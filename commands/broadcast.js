// commands/broadcast.js
const { ADMIN_JID } = require('../config');
const { sendJuliaError } = require('../utils');
const contactManager = require('../contactManager');

// Função para criar um atraso (sleep)
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
        const allContacts = contactManager.getContacts();
        const contactsToBroadcast = allContacts.filter(jid => jid !== ADMIN_JID);

        if (contactsToBroadcast.length === 0) {
            await sock.sendMessage(sender, { text: "Não encontrei nenhum contato para enviar a transmissão." }, { quoted: msg });
            return true;
        }

        const confirmationText = `✅ Transmissão iniciada para ${contactsToBroadcast.length} contato(s).\n\nEste processo será lento para proteger seu número. Farei pausas de 30 minutos a cada 20 envios. Avisarei quando terminar.`;
        await sock.sendMessage(sender, { text: confirmationText });

        console.log(`[Broadcast] Iniciando envio para ${contactsToBroadcast.length} contatos. Mensagem: "${messageToSend}"`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < contactsToBroadcast.length; i++) {
            const jid = contactsToBroadcast[i];
            try {
                // Atraso aleatório curto entre cada mensagem
                const shortDelay = Math.floor(Math.random() * 20000) + 10000; // 10-30 segundos
                console.log(`[Broadcast] Aguardando ${shortDelay / 1000}s antes de enviar para ${jid} (${i + 1}/${contactsToBroadcast.length})`);
                await sleep(shortDelay);
                
                await sock.sendMessage(jid, { text: messageToSend });
                successCount++;

            } catch (error) {
                console.error(`[Broadcast] Falha ao enviar para ${jid}:`, error);
                errorCount++;
            }
            
            // --- NOVA LÓGICA DE PAUSA ---
            // Verifica se já enviou 20 mensagens (e não é a última mensagem da lista)
            if ((i + 1) % 20 === 0 && i < contactsToBroadcast.length - 1) {
                const pauseMsg = `⏸️ Pausa de 30 minutos iniciada após ${successCount} envios para evitar bloqueios. O envio será retomado automaticamente.`;
                console.log(pauseMsg);
                await sock.sendMessage(sender, { text: pauseMsg });
                
                // Pausa por 30 minutos (30 * 60 * 1000 milissegundos)
                await sleep(30 * 60 * 1000); 

                const resumeMsg = `▶️ Retomando a transmissão...`;
                console.log(resumeMsg);
                await sock.sendMessage(sender, { text: resumeMsg });
            }
            // --- FIM DA LÓGICA DE PAUSA ---
        }
        
        const reportText = `🏁 Transmissão concluída!\n\n- *Enviadas com sucesso:* ${successCount}\n- *Falhas:* ${errorCount}`;
        await sock.sendMessage(sender, { text: reportText });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; 
}

module.exports = handleBroadcastCommand;
