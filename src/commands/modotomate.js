
const settingsManager = require('../managers/groupSettingsManager.js');

async function handleTomatoModeCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup, isSuperAdmin } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        
        if (!senderParticipant?.admin && !isSuperAdmin) {
            await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return true;
        }

        const argument = (commandText || '').split(' ')[1]?.toLowerCase();

        if (argument === 'on') {
            await settingsManager.setSetting(sender, 'tomatoMode', 'on');
            await sock.sendMessage(sender, { text: "✅ *Modo Tomate ATIVADO!* 🍅\n\nAgora vou ficar de olho nas mensagens duvidosas..." });
        } else if (argument === 'off') {
            await settingsManager.setSetting(sender, 'tomatoMode', 'off');
            await sock.sendMessage(sender, { text: "✅ *Modo Tomate DESATIVADO*. A paz (ou o caos) voltou ao normal." });
        } else {
            const currentMode = settingsManager.getSetting(sender, 'tomatoMode', 'off');
            await sock.sendMessage(sender, { text: `Uso incorreto. Use \`!modotomate on\` ou \`!modotomate off\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[Modo Tomate] Erro ao ativar/desativar o modo:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar configurar o Modo Tomate." });
    }

    return true;
}

module.exports = handleTomatoModeCommand;



module.exports.commandData = {
    name: "modotomate",
    description: "Reação de tomate.",
    category: "admin",
    usage: "/modotomate",
    aliases: ["/tomate","/tomato"]
};
