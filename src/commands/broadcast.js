// src/commands/broadcast.js (Caminhos Corrigidos)
const { ADMIN_JID } = require('../../config/config.js'); // <-- CAMINHO CORRIGIDO
const { sendJuliaError } = require('../utils/utils.js'); // <-- CAMINHO CORRIGIDO
const contactManager = require('../managers/contactManager.js'); // <-- CAMINHO CORRIGIDO

// Função para criar um atraso (sleep)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function handleBroadcastCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, commandSenderJid } = msgDetails;

    if (commandSenderJid !== ADMIN_JID) {
        return true; // Ignora silenciosamente
    }

    const args = commandText.substring(command.length).trim().split(' ');
    const broadcastType = args.shift()?.toLowerCase(); // Pega o primeiro argumento (pv, grupos, todos)
    const messageToSend = args.join(' ');

    const usageText = "Uso incorreto. Especifique o alvo da transmissão:\n\n`!broadcast pv [mensagem]` (privados)\n`!broadcast grupos [mensagem]` (grupos)\n`!broadcast todos [mensagem]` (ambos)";

    if (!['pv', 'grupos', 'todos'].includes(broadcastType) || !messageToSend) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    try {
        let contactsToBroadcast = [];
        let groupCount = 0;
        let privateCount = 0;

        // Monta a lista de destinatários com base no tipo
        if (broadcastType === 'pv' || broadcastType === 'todos') {
            const privateContacts = contactManager.getContacts().filter(jid => jid !== ADMIN_JID);
            contactsToBroadcast.push(...privateContacts);
            privateCount = privateContacts.length;
        }
        if (broadcastType === 'grupos' || broadcastType === 'todos') {
            const allGroups = await sock.groupFetchAllParticipating();
            const groupJids = Object.keys(allGroups);
            contactsToBroadcast.push(...groupJids);
            groupCount = groupJids.length;
        }

        // Remove duplicatas, caso um grupo esteja na lista de contatos
        contactsToBroadcast = [...new Set(contactsToBroadcast)];

        if (contactsToBroadcast.length === 0) {
            await sock.sendMessage(sender, { text: "Não encontrei nenhuns destinatários para enviar a transmissão." }, { quoted: msg });
            return true;
        }

        const confirmationText = `✅ Transmissão iniciada para ${privateCount} contacto(s) privado(s) e ${groupCount} grupo(s).\n\nTotal: ${contactsToBroadcast.length} destinatários.\nEste processo será lento para proteger o seu número. Avisarei quando terminar.`;
        await sock.sendMessage(sender, { text: confirmationText });

        console.log(`[Broadcast] A iniciar envio para ${contactsToBroadcast.length} destinatários. Mensagem: "${messageToSend}"`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < contactsToBroadcast.length; i++) {
            const jid = contactsToBroadcast[i];
            try {
                // Atraso aleatório curto entre cada mensagem
                const shortDelay = Math.floor(Math.random() * 20000) + 10000; // 10-30 segundos
                console.log(`[Broadcast] A aguardar ${shortDelay / 1000}s antes de enviar para ${jid} (${i + 1}/${contactsToBroadcast.length})`);
                await sleep(shortDelay);

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

    return true; 
}

module.exports = handleBroadcastCommand;

