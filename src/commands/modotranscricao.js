// commands/modotranscricao.js
const { ADMIN_JID } = require('../../config/config.js');
const settingsManager = require('../managers/groupSettingsManager.js');

async function handleTranscriptionModeCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, commandText } = msgDetails;
    
    // 1. Verifica se quem enviou é o admin
    if (commandSenderJid !== ADMIN_JID) {
        return true; // Ignora silenciosamente se não for o admin
    }

    const argument = commandText.split(' ')[1]?.toLowerCase(); // Pega o argumento 'on' ou 'off'

    if (argument === 'on') {
        await settingsManager.setSetting(sender, 'transcriptionMode', 'on');
        await sock.sendMessage(sender, { text: "✅ Modo de transcrição automática de áudio *ATIVADO* para este chat." }, { quoted: msg });
    } else if (argument === 'off') {
        await settingsManager.setSetting(sender, 'transcriptionMode', 'off');
        await sock.sendMessage(sender, { text: "✅ Modo de transcrição automática de áudio *DESATIVADO* para este chat." }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { text: "Uso incorreto. Use `!modotranscricao on` ou `!modotranscricao off`." }, { quoted: msg });
    }

    return true; // Comando processado
}

module.exports = handleTranscriptionModeCommand;
