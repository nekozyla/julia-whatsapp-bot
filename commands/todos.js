// commands/todos.js
const { ADMIN_JID } = require('../config'); // Importa o JID do superadmin
const { sendJuliaError } = require('../utils');

async function handleMentionAllCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    // 1. O comando só funciona em grupos
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        // 2. Busca os metadados do grupo
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        
        // 3. Verifica as permissões
        const senderParticipant = participants.find(p => p.id === commandSenderJid);
        
        const isGroupAdmin = !!senderParticipant?.admin; // Verifica se é admin ou superadmin do grupo
        const isSuperAdmin = commandSenderJid === ADMIN_JID; // Verifica se é o dono do bot

        // Se o usuário não for nem admin do grupo, nem o superadmin, nega o acesso.
        if (!isGroupAdmin && !isSuperAdmin) { 
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores podem usar este comando." }, { quoted: msg });
            console.log(`[Todos] Tentativa de uso negada para ${pushName} (não é admin) no grupo ${groupMetadata.subject}.`);
            return true;
        }

        // 4. Monta a lista de JIDs para mencionar
        const botJid = sock.user.id;
        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        // 5. Monta o texto da mensagem
        let messageText = "📢 *Atenção, pessoal!* 📢\n\n";
        
        const userMessage = commandText.substring(command.length).trim();
        if (userMessage) {
            messageText += `${userMessage}\n\n`;
        }

        for (const jid of mentions) {
            messageText += `@${jid.split('@')[0]} `;
        }
        
        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}.`);

        // 6. Envia a mensagem
        await sock.sendMessage(sender, {
            text: messageText.trim(),
            mentions: mentions
        });
        
    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleMentionAllCommand;
