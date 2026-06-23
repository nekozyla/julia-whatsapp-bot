const settingsManager = require('../managers/groupSettingsManager.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

async function handleAntiTikTokCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
        if (!groupMeta || !groupMeta.participants) {
            await sock.sendMessage(sender, { text: "Não foi possível obter as informações do grupo." }, { quoted: msg });
            return true;
        }

        const senderParticipant = groupMeta.participants.find(p => p.id === commandSenderJid);

        if (!senderParticipant?.admin) {
            await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return true;
        }

        const argument = (commandText || '').split(' ')[1]?.toLowerCase();

        if (argument === 'on') {
            await settingsManager.setSetting(sender, 'antiTikTok', 'on');
            await sock.sendMessage(sender, { text: "✅ *Modo Anti-TikTok ATIVADO!* 🚫\n\nEu vou apagar qualquer link de convite ou evento de campanha do TikTok enviado neste grupo." });
        } else if (argument === 'off') {
            await settingsManager.setSetting(sender, 'antiTikTok', 'off');
            await sock.sendMessage(sender, { text: "✅ *Modo Anti-TikTok DESATIVADO*. Links de convite do TikTok agora são permitidos." });
        } else {
            const currentMode = settingsManager.getSetting(sender, 'antiTikTok', 'off');
            await sock.sendMessage(sender, { text: `Uso incorreto. Use \`/antitiktok on\` ou \`/antitiktok off\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[AntiTikTok] Erro ao ativar/desativar o modo:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar configurar o Modo Anti-TikTok." });
    }

    return true;
}

module.exports = handleAntiTikTokCommand;

module.exports.commandData = {
    name: "antitiktok",
    description: "Deleta links de convite/evento de campanha do TikTok.",
    category: "admin",
    usage: "/antitiktok [on|off]",
    aliases: ["/antitiktok", "/antitiktokinvite", "/antitt"]
};
