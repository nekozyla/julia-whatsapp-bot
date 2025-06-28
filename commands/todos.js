// commands/todos.js
const { sendJuliaError } = require('../utils'); // Reutiliza nossa função de erro

async function handleMentionAllCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    // 1. O comando só funciona em grupos
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        // 2. Busca os metadados do grupo para obter a lista de participantes e admins
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        
        // 3. Verifica se o remetente do comando é um admin do grupo
        const commandSender = participants.find(p => p.id === (msg.key.participant || msg.key.remoteJid));
        if (!commandSender.admin) { // O admin pode ser 'admin' ou 'superadmin'
            await sock.sendMessage(sender, { text: "Desculpe, apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            console.log(`[Todos] Tentativa de uso negada para ${pushName} (não é admin) no grupo ${groupMetadata.subject}.`);
            return true;
        }

        // 4. Monta a lista de JIDs para mencionar (todos, exceto o próprio bot)
        const botJid = sock.user.id;
        const mentions = participants
            .map(p => p.id)
            .filter(id => id !== botJid); // Filtra para não se auto-mencionar

        // 5. Monta o texto da mensagem
        let messageText = "📢 *Atenção, pessoal!* 📢\n\n";
        
        // Adiciona a mensagem do admin, se houver
        const userMessage = commandText.substring(command.length).trim();
        if (userMessage) {
            messageText += `${userMessage}\n\n`;
        }

        // Adiciona as menções no texto para que apareçam como @Nome
        for (const jid of mentions) {
            messageText += `@${jid.split('@')[0]} `;
        }
        
        console.log(`[Todos] Admin ${pushName} marcou todos no grupo ${groupMetadata.subject}.`);

        // 6. Envia a mensagem com o texto e a lista de menções
        await sock.sendMessage(sender, {
            text: messageText.trim(),
            mentions: mentions // Este campo é o que realmente notifica os usuários
        });
        
    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleMentionAllCommand;
