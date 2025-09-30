// src/commands/todos.js (Versão com auto-delete do comando)
const { ADMIN_JIDS } = require('../../config/config.js');
const { sendJuliaError } = require('../utils/utils.js');

async function handleMentionAllCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        
        const senderParticipant = participants.find(p => p.id === commandSenderJid);
        const botParticipant = participants.find(p => p.id === botJid);
        
        const isGroupAdmin = !!senderParticipant?.admin;
        const isSuperAdmin = ADMIN_JIDS.includes(commandSenderJid);

        // 1. Verifica se o autor do comando é admin
        if (!isGroupAdmin && !isSuperAdmin) { 
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            return true;
        }

        // 2. Verifica se o bot é admin (necessário para apagar a mensagem)
        if (!botParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Eu preciso ser administradora do grupo para poder apagar o seu comando após a menção." }, { quoted: msg });
            // Continua a execução para pelo menos enviar a menção
        }

        // 3. Monta a lista de JIDs para mencionar
        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        // 4. Monta o texto da mensagem
        let messageText = "";
        const userMessage = commandText.substring(command.length).trim();
        
        messageText = userMessage ? userMessage : "📢 *Atenção, pessoal!* 📢";
        
        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}.`);

        // 5. Envia a mensagem com a menção fantasma
        await sock.sendMessage(sender, {
            text: messageText,
            mentions: mentions
        });
        
        // 6. (NOVO) Apaga a mensagem original do admin, se o bot for admin
        if (botParticipant?.admin) {
            await sock.sendMessage(sender, { delete: msg.key });
        }
        
    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleMentionAllCommand;
