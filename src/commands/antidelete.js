
const settingsManager = require('../managers/groupSettingsManager.js');

async function handleAntiDeleteCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        
        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return true;
        }

        const argument = (commandText || '').split(' ')[1]?.toLowerCase();

        if (argument === 'on') {
            await settingsManager.setSetting(sender, 'antiDeleteMode', 'on');
            await sock.sendMessage(sender, { text: "✅ *Modo Anti-Delete ATIVADO!* 🚫\n\nEu vou reenviar qualquer mensagem que for apagada neste grupo." });
        } else if (argument === 'off') {
            await settingsManager.setSetting(sender, 'antiDeleteMode', 'off');
            await sock.sendMessage(sender, { text: "✅ *Modo Anti-Delete DESATIVADO*. As mensagens podem ser apagadas." });
        } else {
            const currentMode = settingsManager.getSetting(sender, 'antiDeleteMode', 'off');
            await sock.sendMessage(sender, { text: `Uso incorreto. Use \`/antidelete on\` ou \`/antidelete off\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[AntiDelete] Erro ao ativar/desativar o modo:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar configurar o Modo Anti-Delete." });
    }

    return true;
}

module.exports = handleAntiDeleteCommand;


module.exports.commandData = {
    name: "antidelete",
    description: "Reenvia msg apagadas.",
    category: "admin",
    usage: "/antidelete",
    aliases: ["/antidelete","/ad"]
};
