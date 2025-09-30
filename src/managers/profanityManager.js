// profanityManager.js (Versão Unificada)
const fs = require('fs').promises;
const path = require('path');

const PROFANITY_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'bad-words.json');
let badWordsSet = new Set();

/**
 * Carrega a lista de palavras do ficheiro bad-words.json para a memória.
 */
async function loadProfanityList() {
    try {
        const fileContent = await fs.readFile(PROFANITY_FILE_PATH, 'utf-8');
        // O seu ficheiro espera um objeto com uma chave "words"
        const data = JSON.parse(fileContent);
        if (Array.isArray(data.words)) {
            badWordsSet = new Set(data.words.map(word => word.toLowerCase()));
            console.log(`[Profanity] ${badWordsSet.size} palavras problemáticas carregadas.`);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Profanity] Ficheiro bad-words.json não encontrado. A criar um novo.');
            // Cria o ficheiro com a estrutura correta
            await fs.writeFile(PROFANITY_FILE_PATH, JSON.stringify({ words: [] }, null, 2));
        } else {
            console.error("[Profanity] Erro ao carregar a lista de palavras.", error);
        }
    }
}

/**
 * Salva a lista de palavras atual para o ficheiro JSON.
 */
async function saveProfanityList() {
    try {
        const dataToSave = { words: [...badWordsSet] };
        await fs.writeFile(PROFANITY_FILE_PATH, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('[Profanity] Erro ao salvar a lista de palavras:', error);
    }
}

/**
 * Adiciona uma nova palavra à lista.
 * @param {string} word - A palavra a ser adicionada.
 * @returns {Promise<boolean>} - Retorna true se a palavra foi adicionada.
 */
async function addWord(word) {
    const lowerCaseWord = word.toLowerCase();
    if (badWordsSet.has(lowerCaseWord)) {
        return false; // Já existe
    }
    badWordsSet.add(lowerCaseWord);
    await saveProfanityList();
    return true;
}

/**
 * Remove uma palavra da lista.
 * @param {string} word - A palavra a ser removida.
 * @returns {Promise<boolean>} - Retorna true se a palavra foi removida.
 */
async function removeWord(word) {
    const lowerCaseWord = word.toLowerCase();
    if (!badWordsSet.has(lowerCaseWord)) {
        return false; // Não encontrada
    }
    badWordsSet.delete(lowerCaseWord);
    await saveProfanityList();
    return true;
}

/**
 * Normaliza o texto para uma comparação mais eficaz.
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")   // Remove pontuação
        .replace(/(.)\1{2,}/g, '$1'); // Reduz letras repetidas
}

/**
 * Analisa se uma mensagem contém palavras ou frases da lista de filtro.
 * @param {string} messageText - O texto da mensagem a ser analisada.
 * @returns {boolean}
 */
function analyzeMessage(messageText) {
    if (!messageText || badWordsSet.size === 0) {
        return false;
    }

    const normalizedMessage = normalizeText(messageText);
    const wordsInMessage = new Set(normalizedMessage.split(/\s+/));

    // Verifica palavras individuais
    for (const word of wordsInMessage) {
        if (badWordsSet.has(word)) {
            console.log(`[Profanity] Palavra problemática: "${word}"`);
            return true;
        }
    }
    
    // Verifica frases (com espaços)
    for (const badPhrase of badWordsSet) {
        if (badPhrase.includes(' ') && normalizedMessage.includes(badPhrase)) {
            console.log(`[Profanity] Frase problemática: "${badPhrase}"`);
            return true;
        }
    }

    return false;
}

function getWords() {
    return [...badWordsSet];
}

module.exports = {
    loadProfanityList,
    addWord,
    removeWord,
    analyzeMessage,
    getWords
};
