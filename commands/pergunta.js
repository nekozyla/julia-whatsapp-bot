// commands/pergunta.js
const { extractCommandText, sendJuliaError } = require('../utils');
const { textModel } = require('../geminiClient'); // <-- ADICIONADO: Importa o modelo de texto da IA

/**
 * Lida com perguntas diretas feitas ao bot.
 */
async function handleAskCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const question = extractCommandText(commandText, '!pergunta');

    if (!question) {
        await sock.sendMessage(sender, { text: "Você precisa me fazer uma pergunta! Ex: `!pergunta qual a capital do Brasil?`" }, { quoted: msg });
        return true;
    }

    console.log(`[Ask] ${pushName} fez uma pergunta direta: "${question}"`);
    await sock.sendPresenceUpdate('composing', sender);

    try {
        // Usa o textModel importado para gerar a resposta
        const result = await textModel.generateContent(question);
        const response = await result.response;
        const text = response.text();

        await sock.sendMessage(sender, { text: text }, { quoted: msg });
    } catch (error) {
        console.error("Erro ao responder pergunta direta:", error);
        // Usa a função de erro que você já tem no utils.js
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleAskCommand;
