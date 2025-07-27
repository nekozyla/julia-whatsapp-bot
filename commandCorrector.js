// commandCorrector.js
const { model } = require('./geminiClient');
const fs = require('fs');
const path = require('path');

// Armazena o texto de ajuda em cache para não ler o arquivo toda vez
let helpTextCache = null;

/**
 * Lê o conteúdo do comando de ajuda para usar como contexto para a IA.
 * @returns {Promise<string>} O texto de ajuda.
 */
async function getHelpText() {
    if (helpTextCache) {
        return helpTextCache;
    }
    try {
        // O caminho precisa ser relativo à raiz do projeto
        const helpFilePath = path.join(__dirname, 'commands', 'help.js');
        const helpFileContent = await fs.promises.readFile(helpFilePath, 'utf-8');
        
        // Extrai apenas o texto dentro das crases da variável helpText
        const match = helpFileContent.match(/const helpText = `([\s\S]*)`;/);
        if (match && match[1]) {
            helpTextCache = match[1].trim();
            return helpTextCache;
        }
        return "Nenhuma descrição de comando encontrada.";
    } catch (error) {
        console.error("[Command Corrector] Erro ao ler o arquivo de ajuda:", error);
        return "Nenhuma descrição de comando encontrada.";
    }
}

/**
 * Usa a IA para analisar um comando incorreto e fornecer ajuda.
 * @param {string} incorrectCommand - O comando que o usuário digitou errado.
 */
async function getCommandCorrection(incorrectCommand) {
    const commandList = await getHelpText();

    const prompt = `
        Sua única função é ser um assistente de comandos de um bot do WhatsApp. Você é prestativo, direto e nunca usa a personalidade da "Julia".
        Um usuário tentou usar um comando, mas digitou errado.
        
        Comando errado do usuário: "${incorrectCommand}"

        Abaixo está a lista completa de comandos válidos e como usá-los. Analise o que o usuário provavelmente quis fazer, explique o erro de forma simples e mostre a maneira correta de usar o comando, com um exemplo.

        Se o comando não se parecer com nenhum da lista, apenas diga que o comando não existe e sugira usar !help.

        LISTA DE COMANDOS VÁLIDOS:
        ---
        ${commandList}
        ---
    `;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error("[Command Corrector] Erro na API do Gemini:", error);
        return "Desculpe, não consegui analisar o seu comando agora. Tente usar `!help` para ver a lista completa.";
    }
}

module.exports = { getCommandCorrection };
