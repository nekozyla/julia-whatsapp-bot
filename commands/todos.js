// commands/todos.js
const { sendJuliaError } = require('../utils');

async function handleMentionAllCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText, commandSenderJid } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        
        // Verificação de Admin mais segura
        const commandSender = participants.find(p => p.id === commandSenderJid);
        
        // Verifica se o remetente foi encontrado e se ele é um admin
        if (!commandSender || !commandSender.admin) { 
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            console.log(`[Todos] Tentativa de uso negada para ${pushName} (não é admin) no grupo ${groupMetadata.subject}.`);
            return true;
        }

        const botJid = sock.user.id;
        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid);

        let messageText = "📢 *Atenção, pessoal!* 📢\n\n";
        
        const userMessage = commandText.substring(command.length).trim();
        if (userMessage) {
            messageText += `${userMessage}\n\n`;
        }

        for (const jid of mentions) {
            messageText += `@${jid.split('@')[0]} `;
        }
        
        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}.`);

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
