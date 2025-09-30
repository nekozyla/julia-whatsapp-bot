// commands/pergunta.js

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config/config');

// Verifica se a chave da API do Gemini foi configurada
if (!config.GEMINI_API_KEY) {
    // Lança um erro que impedirá o bot de iniciar se a chave não estiver presente,
    // o que é bom para evitar erros durante o uso.
    throw new Error("A GEMINI_API_KEY não foi encontrada nos ficheiros de configuração (.env e config.js).");
}

// Inicializa a API do Gemini
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

// Define o modelo a ser usado. Você pediu 'gemini-2.5-pro'.
// O modelo público mais avançado atualmente é o 'gemini-1.5-pro-latest'.
// Usaremos este, mas você pode alterar a string se tiver acesso a um modelo diferente.
const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-pro" });


/**
 * Handler para o comando /pergunta
 */
module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText } = msgDetails;

    // Extrai a pergunta do texto do comando, removendo '/pergunta'
    const question = commandText.substring('/pergunta'.length).trim();

    // Validação: verifica se o usuário realmente fez uma pergunta
    if (!question) {
        const usageText = "Por favor, faça uma pergunta após o comando.\n\n*Exemplo:*\n`/pergunta Qual a capital do Brasil?`";
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return;
    }

    try {
        // Reage à mensagem para dar feedback ao usuário de que o bot está "a pensar"
        await sock.sendMessage(sender, { react: { text: '🤔', key: msg.key } });

        // Envia a pergunta para a API do Gemini e aguarda a resposta
        const result = await model.generateContent(question);
        const response = await result.response;
        const responseText = response.text();

        // Envia a resposta do Gemini para o usuário
        await sock.sendMessage(sender, { text: responseText }, { quoted: msg });

    } catch (error) {
        // Em caso de erro, informa o usuário e regista o erro na consola
        console.error("[Pergunta Command] Erro ao gerar resposta do Gemini:", error);
        await sock.sendMessage(sender, { text: "😕 Desculpe, não consegui pensar numa resposta agora. Tente novamente mais tarde." }, { quoted: msg });
    }
};
