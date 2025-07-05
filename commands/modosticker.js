// commands/modosticker.js
const settingsManager = require('../groupSettingsManager');

async function handleStickerModeCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;
    const commandText = msgDetails.commandText || '';

    // 1. Verifica se o comando está sendo usado em um grupo
    if (sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "O `!modosticker` só pode ser ativado no meu chat privado." }, { quoted: msg });
        return true;
    }

    const argument = commandText.split(' ')[1]?.toLowerCase();

    if (argument === 'on') {
        // Usa o sender JID como chave para salvar a configuração
        await settingsManager.setSetting(sender, 'stickerMode', 'on');
        await sock.sendMessage(sender, { text: "✅ *Modo Sticker ATIVADO*.\n\nQualquer imagem ou GIF que você me enviar neste chat será convertido em figurinha automaticamente. Para desativar, use `!modosticker off`." }, { quoted: msg });
    } else if (argument === 'off') {
        await settingsManager.setSetting(sender, 'stickerMode', 'off');
        await sock.sendMessage(sender, { text: "✅ *Modo Sticker DESATIVADO*." }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { text: "Uso incorreto. Use `!modosticker on` ou `!modosticker off`." }, { quoted: msg });
    }

    return true; // Comando processado
}

module.exports = handleStickerModeCommand;
