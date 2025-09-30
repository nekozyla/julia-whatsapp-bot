// commands/ia.js
const settingsManager = require('../managers/groupSettingsManager.js');
const sessionManager = require('../managers/sessionManager.js');

async function handleIaToggleCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;

    const argument = commandText.split(' ')[1]?.toLowerCase();

    if (argument === 'on') {
        await settingsManager.setSetting(sender, 'aiMode', 'on');
        await sock.sendMessage(sender, { text: `✅ Olá! Eu sou a Julia, sua assistente de IA. A partir de agora, vou participar da nossa conversa.\n\nPara desativar, use \`!ia off\`.` }, { quoted: msg });
        console.log(`[IA Toggle] IA ativada para o chat: ${sender}`);
    } else if (argument === 'off') {
        await settingsManager.setSetting(sender, 'aiMode', 'off');
        // Limpa o histórico da sessão para a IA "esquecer" a conversa
        await sessionManager.clearSession(sender);
        await sock.sendMessage(sender, { text: `✅ IA desativada. Minhas funções de conversa e inteligência artificial não estarão mais ativas aqui.` }, { quoted: msg });
        console.log(`[IA Toggle] IA desativada e sessão limpa para o chat: ${sender}`);
    } else {
        await sock.sendMessage(sender, { text: "Uso incorreto. Use `!ia on` para ativar minha IA ou `!ia off` para desativar." }, { quoted: msg });
    }

    return true; // Comando processado
}

module.exports = handleIaToggleCommand;
