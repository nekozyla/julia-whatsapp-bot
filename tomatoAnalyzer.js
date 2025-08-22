// tomatoAnalyzer.js
const fs = require('fs');
const path = require('path');

let badWordsSet = new Set();

/**
 * Carrega a lista de palavras do ficheiro JSON local para a memória.
 * Esta função é chamada automaticamente quando o bot arranca.
 */
function initializeFilter() {
    try {
        const jsonPath = path.join(__dirname, 'bad-words.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        const loadedWords = data.words;
        
        if (Array.isArray(loadedWords)) {
            // Usa um Set para pesquisas muito mais rápidas e eficientes
            badWordsSet = new Set(loadedWords.map(word => word.toLowerCase()));
            console.log(`[Tomato Analyzer] ${badWordsSet.size} palavras problemáticas carregadas do ficheiro local.`);
        }
    } catch (error) {
        console.error("[Tomato Analyzer] Erro ao carregar a lista de palavras do 'bad-words.json'. O modo tomate pode não funcionar.", error);
    }
}

/**
 * Normaliza o texto para uma comparação mais eficaz.
 * Remove acentos, pontuação e caracteres repetidos.
 * @param {string} text O texto de entrada.
 * @returns {string} O texto normalizado.
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")   // Remove pontuação
        .replace(/(.)\1{2,}/g, '$1'); // Reduz 3 ou mais letras repetidas para uma só (ex: "porraaaa" -> "pora")
}

/**
 * Analisa se uma mensagem contém palavras ou frases da lista de filtro.
 * @param {string} messageText - O texto da mensagem a ser analisada.
 * @returns {Promise<boolean>}
 */
async function analyzeMessage(messageText) {
    if (!messageText || badWordsSet.size === 0) {
        return false;
    }

    const normalizedMessage = normalizeText(messageText);
    const wordsInMessage = new Set(normalizedMessage.split(/\s+/));

    // 1. Verifica se alguma palavra individual da mensagem está na lista de palavras proibidas
    for (const word of wordsInMessage) {
        if (badWordsSet.has(word)) {
            console.log(`[Tomato Analyzer] Palavra problemática encontrada: "${word}" na mensagem: "${messageText}"`);
            return true;
        }
    }
    
    // 2. Verifica se alguma frase proibida (com espaços) está contida na mensagem
    for (const badWord of badWordsSet) {
        if (badWord.includes(' ') && normalizedMessage.includes(badWord)) {
            console.log(`[Tomato Analyzer] Frase problemática encontrada: "${badWord}" na mensagem: "${messageText}"`);
            return true;
        }
    }

    return false;
}

// Inicializa o filtro assim que o ficheiro é carregado pelo bot
initializeFilter();

module.exports = { analyzeMessage };

