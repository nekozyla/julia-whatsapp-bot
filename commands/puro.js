// commands/puro.js
const { model } = require('../geminiClient'); // Importa o modelo Gemini principal
const { sendJuliaError } = require('../utils'); // Reutiliza nossa função de erro

async function handlePuroCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    // Pega o prompt do usuário (tudo que vem depois de '!puro ')
    const prompt = commandText.substring(command.length).trim();

    if (!prompt) {
        await sock.sendMessage(sender, { 
            text: "Para usar o modo 'puro', envie o comando `!puro` seguido da sua solicitação.\n\n*Exemplo:*\n`!puro resuma a teoria da relatividade em um parágrafo`" 
        }, { quoted: msg });
        return true;
    }

    console.log(`[Puro] Usuário ${pushName} solicitou uma resposta direta para: "${prompt.substring(0, 80)}..."`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        await sock.sendMessage(sender, { text: `Ok, processando sua solicitação pura... 👨‍💻` }, { quoted: msg });

        // Chama o modelo Gemini de forma direta (stateless)
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const pureText = response.text();

        console.log(`[Puro] Resposta pura do Gemini gerada.`);
        
        // Envia a resposta pura de volta
        // O WhatsApp formata bem textos longos com quebras de linha, então podemos enviar diretamente.
        await sock.sendMessage(sender, { text: pureText }, { quoted: msg });

    } catch (error) {
        // Usa nossa função de erro padronizada
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handlePuroCommand;
