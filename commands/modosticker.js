// commands/modosticker.js
const settingsManager = require('../groupSettingsManager');

async function handleStickerModeCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    // O comando só pode ser ativado no chat privado
    if (msgDetails.isGroup) {
        await sock.sendMessage(sender, { text: "O `!modosticker` só pode ser ativado no meu chat privado." }, { quoted: msg });
        return true;
    }

    const argument = (msgDetails.commandText || '').split(' ')[1]?.toLowerCase();

    if (argument === 'on') {
        await settingsManager.setSetting(sender, 'stickerMode', 'on');
        await sock.sendMessage(sender, { text: "✅ *Modo Sticker ATIVADO*.\n\nQualquer imagem ou GIF que você me enviar neste chat será convertida em figurinha automaticamente." }, { quoted: msg });
    } else if (argument === 'off') {
        await settingsManager.setSetting(sender, 'stickerMode', 'off');
        await sock.sendMessage(sender, { text: "✅ *Modo Sticker DESATIVADO*." }, { quoted: msg });
    } else {
        const currentMode = settingsManager.getSetting(sender, 'stickerMode', 'on');
        await sock.sendMessage(sender, { text: `Uso incorreto. Use \`!modosticker on\` ou \`!modosticker off\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
    }

    return true;
}

module.exports = handleStickerModeCommand;
