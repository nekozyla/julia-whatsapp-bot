// geminiClient.js
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODELS } = require('./config');

if (!GEMINI_API_KEY) {
    console.error("Erro Crítico: GEMINI_API_KEY não definida no arquivo .env.");
    process.exit(1);
}
if (!GEMINI_MODELS || GEMINI_MODELS.length === 0) {
    console.error("Erro Crítico: Nenhuma lista de modelos foi definida no config.js.");
    process.exit(1);
}

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

let currentModelIndex = 0;
let genAI_instance = new GoogleGenerativeAI(GEMINI_API_KEY); // A instância da API é criada apenas uma vez
let model_instance;

function initializeModel() {
    const modelName = GEMINI_MODELS[currentModelIndex];
    console.log(`[Gemini] Inicializando com o modelo: ${modelName} (índice: ${currentModelIndex})`);
    
    model_instance = genAI_instance.getGenerativeModel({ 
        model: modelName,
        safetySettings 
    });
}

function switchToNextModel() {
    // Verifica se ainda há modelos na lista para tentar
    if (currentModelIndex < GEMINI_MODELS.length - 1) {
        currentModelIndex++;
        console.warn(`[Gemini] Limite de API atingido. Trocando para o próximo modelo: ${GEMINI_MODELS[currentModelIndex]}`);
        initializeModel();
        return true; // Retorna true para indicar que a troca foi bem-sucedida
    } else {
        console.error(`[Gemini] Todos os modelos de fallback atingiram o limite. Não é possível trocar mais.`);
        return false; // Retorna false se não houver mais modelos para trocar
    }
}

// Inicia o modelo com o primeiro da lista
initializeModel();

const modelApi = {
    get model() {
        return model_instance;
    },
    switchToNextModel
};

module.exports = modelApi;
