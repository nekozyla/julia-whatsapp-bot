// commands/personalidade.js
const settingsManager = require('../managers/groupSettingsManager.js'); // <-- CAMINHO CORRIGIDO
const sessionManager = require('../managers/sessionManager.js');       // <-- CAMINHO CORRIGIDO
const personalities = require('../../config/personalities.js');        // <-- CAMINHO CORRIGIDO

async function handlePersonalityCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;

    const args = commandText.split(' ');
    const newPersonality = args[1]?.toLowerCase();

    const availablePersonalities = Object.keys(personalities);

    if (!newPersonality || !availablePersonalities.includes(newPersonality)) {
        await sock.sendMessage(sender, { text: `Humm... (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) Você precisa de escolher uma personalidade. As disponíveis são: \`${availablePersonalities.join('`, `')}\`.\n\n*Exemplo:* \`!persona emilia\`` }, { quoted: msg });
        return true;
    }

    try {
        await settingsManager.setSetting(sender, 'personality', newPersonality);
        // Limpa a sessão atual para que a nova personalidade seja carregada na próxima mensagem
        await sessionManager.clearSession(sender);

        let confirmationMessage = '';
        if (newPersonality === 'emilia') {
            confirmationMessage = `O-ok... (´｡• ᵕ •｡\`) Eu vou tentar ser a Emilia agora... E-espero que goste...`;
        } else if (newPersonality === 'julia') {
            confirmationMessage = `Papo reto, voltei a ser a Julia. Qual foi, mermão?`;
        } else {
            confirmationMessage = `✅ Personalidade alterada para ${newPersonality}.`;
        }

        await sock.sendMessage(sender, { text: confirmationMessage }, { quoted: msg });
        console.log(`[Personalidade] ${pushName} alterou a personalidade do chat ${sender} para ${newPersonality}.`);

    } catch (error) {
        console.error("[Personalidade] Erro ao alterar personalidade:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar mudar de personalidade." }, { quoted: msg });
    }

    return true;
}

module.exports = handlePersonalityCommand;
