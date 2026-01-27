
const fs = require('fs').promises;
const path = require('path');

const PROFANITY_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'bad-words.json');
let badWordsSet = new Set();


async function loadProfanityList() {
    try {
        const fileContent = await fs.readFile(PROFANITY_FILE_PATH, 'utf-8');
        
        const data = JSON.parse(fileContent);
        if (Array.isArray(data.words)) {
            badWordsSet = new Set(data.words.map(word => word.toLowerCase()));
            
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            
            
            await fs.writeFile(PROFANITY_FILE_PATH, JSON.stringify({ words: [] }, null, 2));
        } else {
            console.error("[Profanity] Erro ao carregar a lista de palavras.", error);
        }
    }
}


async function saveProfanityList() {
    try {
        const dataToSave = { words: [...badWordsSet] };
        await fs.writeFile(PROFANITY_FILE_PATH, JSON.stringify(dataToSave, null, 2));
    } catch (error) {
        console.error('[Profanity] Erro ao salvar a lista de palavras:', error);
    }
}


async function addWord(word) {
    const lowerCaseWord = word.toLowerCase();
    if (badWordsSet.has(lowerCaseWord)) {
        return false; 
    }
    badWordsSet.add(lowerCaseWord);
    await saveProfanityList();
    return true;
}


async function removeWord(word) {
    const lowerCaseWord = word.toLowerCase();
    if (!badWordsSet.has(lowerCaseWord)) {
        return false; 
    }
    badWordsSet.delete(lowerCaseWord);
    await saveProfanityList();
    return true;
}


function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
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
