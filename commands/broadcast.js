// commands/broadcast.js
const fs = require('fs').promises;
const path = require('path');
const { ADMIN_JID, SESSIONS_DIR } = require('../config');
const { sendJuliaError } = require('../utils');

// Função para criar um atraso aleatório
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleBroadcastCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    // 1. Verifica se quem enviou é o admin
    if (commandSenderJid !== ADMIN_JID) {
        console.log(`[Broadcast] Tentativa de uso negada para o usuário ${commandSenderJid}.`);
        return true; // Ignora silenciosamente se não for o admin
    }

    // 2. Pega a mensagem a ser enviada
    const messageToSend = commandText.substring(command.length).trim();
    if (!messageToSend) {
        await sock.sendMessage(sender, { text: "Por favor, forneça uma mensagem para a transmissão.\nUso: `!broadcast [sua mensagem]`" }, { quoted: msg });
        return true;
    }

    try {
        // 3. Pega a lista de contatos a partir dos arquivos de sessão salvos
        const allSessionFiles = await fs.readdir(SESSIONS_DIR);
        const contactJids = allSessionFiles
            .map(file => file.replace('.json', ''))
            .filter(jid => jid.endsWith('@s.whatsapp.net') && jid !== ADMIN_JID); // Apenas contatos privados, excluindo o próprio admin

        if (contactJids.length === 0) {
            await sock.sendMessage(sender, { text: "Não encontrei nenhum contato privado para enviar a transmissão." }, { quoted: msg });
            return true;
        }

        // 4. Avisa ao admin que o processo iniciou
        const confirmationText = `✅ Transmissão iniciada para ${contactJids.length} contato(s).\n\nEste processo será lento e levará vários minutos para ser concluído, a fim de proteger seu número. Avisarei quando terminar.`;
        await sock.sendMessage(sender, { text: confirmationText });

        console.log(`[Broadcast] Iniciando envio para ${contactJids.length} contatos. Mensagem: "${messageToSend}"`);

        // 5. Loop de envio com atraso aleatório
        let successCount = 0;
        let errorCount = 0;
        for (let i = 0; i < contactJids.length; i++) {
            const jid = contactJids[i];
            try {
                // Atraso aleatório entre 10 e 30 segundos
                const delay = Math.floor(Math.random() * (20000 - 10000 + 1) + 10000);
                console.log(`[Broadcast] Aguardando ${delay / 1000}s antes de enviar para ${jid} (${i + 1}/${contactJids.length})`);
                await sleep(delay);
                
                await sock.sendMessage(jid, { text: messageToSend });
                successCount++;
            } catch (error) {
                console.error(`[Broadcast] Falha ao enviar para ${jid}:`, error);
                errorCount++;
            }
        }
        
        // 6. Envia o relatório final para o admin
        const reportText = `🏁 Transmissão concluída!\n\n- *Enviadas com sucesso:* ${successCount}\n- *Falhas:* ${errorCount}`;
        await sock.sendMessage(sender, { text: reportText });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Comando processado
}

module.exports = handleBroadcastCommand;
