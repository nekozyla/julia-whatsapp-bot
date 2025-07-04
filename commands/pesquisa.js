// commands/pesquisa.js
const axios = require('axios');
const { model } = require('../geminiClient');
const { sendJuliaError } = require('../utils');
const config = require('../config');

// Função para buscar no Google
async function searchGoogle(query) {
    try {
        // CORREÇÃO: Usando os nomes corretos das variáveis de ambiente, sem espaços.
        const apiKey = process.env.Search_API_KEY;
        const searchEngineId = process.env.Search_ENGINE_ID;

        // Verifica se as chaves foram carregadas
        if (!apiKey || !searchEngineId) {
            console.error("[GoogleSearch] Chave de API ou ID do Mecanismo de Pesquisa não encontrados no .env!");
            throw new Error("Configuração da API de busca está incompleta no servidor.");
        }

        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`;

        console.log(`[GoogleSearch] Buscando por: "${query}"`);
        const response = await axios.get(url);
        
        return response.data.items || [];
    } catch (error) {
        console.error("[GoogleSearch] Erro ao buscar no Google:", error.response ? error.response.data : error.message);
        // Propaga o erro para ser tratado no handler principal
        throw error; 
    }
}

async function handleGoogleSearchCommand(sock, msg, msgDetails) {
    // Renomeei o nome do comando para 'pesquisa' para corresponder ao nome do seu arquivo
    const { sender, pushName, command, commandText } = msgDetails;
    
    const searchQuery = commandText.substring(command.length).trim();

    if (!searchQuery) {
        await sock.sendMessage(sender, { text: "Por favor, digite o que você quer pesquisar após o comando `!pesquisa`." }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendPresenceUpdate('composing', sender);
        await sock.sendMessage(sender, { text: `Ok, ${pushName}! Pesquisando no Google por: "*${searchQuery}*".\n\nEstou reunindo as informações.` }, { quoted: msg });
        
        // 1. Faz a busca no Google
        const searchResults = await searchGoogle(searchQuery);

        if (searchResults.length === 0) {
            await sock.sendMessage(sender, { text: "Desculpe, não encontrei resultados para sua pesquisa. Tente outros termos." }, { quoted: msg });
            return true;
        }

        // 2. Prepara o contexto para o Gemini com os resultados
        let contextForGemini = "Com base nas seguintes informações encontradas na internet, formule uma resposta clara e concisa para a pergunta do usuário.\n\n";
        contextForGemini += `PERGUNTA DO USUÁRIO: "${searchQuery}"\n\n`;
        contextForGemini += "INFORMAÇÕES ENCONTRADAS:\n";
        
        searchResults.slice(0, 5).forEach((item, index) => { // Pega os 5 primeiros resultados
            contextForGemini += `--- Fonte ${index + 1}: ${item.title} ---\n${item.snippet}\n\n`;
        });

        // 3. Envia para o Gemini para ele formular a resposta final
        console.log(`[GoogleSearch] Enviando contexto da busca para o Gemini...`);
        const result = await model.generateContent(contextForGemini);
        const finalResponse = result.response.text();
        
        // 4. Envia a resposta final ao usuário
        await sock.sendMessage(sender, { text: finalResponse }, { quoted: msg });

    } catch (error) {
        // Reutiliza nossa função de erro padronizada
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleGoogleSearchCommand;
