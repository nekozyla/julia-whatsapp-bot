// commands/ask.js
const { model } = require('../geminiClient');
const { sendJuliaError } = require('../utils');

async function handleAskCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, pushName } = msgDetails;

    // 1. Extrai a pergunta do texto do comando
    const question = commandText.substring(command.length).trim();

    // 2. Valida se o usuário forneceu uma pergunta
    if (!question) {
        await sock.sendMessage(sender, { text: "Por favor, digite uma pergunta após o comando.\n\n*Exemplo:* `!ask qual é a capital da Mongólia?`" }, { quoted: msg });
        return true;
    }

    try {
        console.log(`[Ask] ${pushName} fez uma pergunta direta: "${question}"`);
        await sock.sendMessage(sender, { text: `Ok, ${pushName}. Consultando minha base de conhecimento sobre: "_${question}_"` }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);

        // 3. Cria um prompt neutro para a IA, instruindo-a a ser objetiva
        const prompt = `Responda à seguinte pergunta de forma direta, clara e objetiva, como uma enciclopédia ou um assistente de informações. Não use a personalidade da "Julia".\n\nPergunta: "${question}"`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();

        // 4. Envia a resposta pura da IA
        await sock.sendMessage(sender, { text: answer }, { quoted: msg });

    } catch (error) {
        console.error("[Ask] Erro ao responder pergunta direta:", error);
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleAskCommand;
