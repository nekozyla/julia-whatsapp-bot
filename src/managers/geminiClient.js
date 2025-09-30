// geminiClient.js (Versão aprimorada com fallback para texto e modelo de imagem dedicado)

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODELS } = require('../../config/config.js');

// --- Validação Inicial ---
if (!GEMINI_API_KEY) {
    console.error("Erro Crítico: GEMINI_API_KEY não definida no arquivo .env ou config.js.");
    process.exit(1);
}
if (!GEMINI_MODELS || !Array.isArray(GEMINI_MODELS) || GEMINI_MODELS.length === 0) {
    console.error("Erro Crítico: GEMINI_MODELS precisa ser um array com pelo menos um modelo em config.js.");
    process.exit(1);
}

// --- Configurações de Segurança ---
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const genAI_instance = new GoogleGenerativeAI(GEMINI_API_KEY);

// =======================================================
// Lógica para Modelo de TEXTO com Fallback
// =======================================================
let currentTextModelIndex = 0;
let textModel_instance;

function initializeTextModel() {
    const modelName = GEMINI_MODELS[currentTextModelIndex];
    console.log(`[Gemini Text] Inicializando com o modelo: ${modelName} (índice: ${currentTextModelIndex})`);
    
    textModel_instance = genAI_instance.getGenerativeModel({ 
        model: modelName,
        safetySettings 
    });
}

function switchToNextTextModel() {
    if (currentTextModelIndex < GEMINI_MODELS.length - 1) {
        currentTextModelIndex++;
        console.warn(`[Gemini Text] Limite de API atingido. Trocando para o próximo modelo: ${GEMINI_MODELS[currentTextModelIndex]}`);
        initializeTextModel();
        return true;
    } else {
        console.error(`[Gemini Text] Todos os modelos de fallback atingiram o limite. Não é possível trocar mais.`);
        return false;
    }
}

// Inicializa o primeiro modelo de texto da sua lista
initializeTextModel();

// =======================================================
// Modelo Dedicado para IMAGENS
// =======================================================
const IMAGE_MODEL_NAME = "gemini-2.5-flash-image-preview";
let imageModel_instance;

try {
    console.log(`[Gemini Image] Inicializando com o modelo de imagem: ${IMAGE_MODEL_NAME}`);
    imageModel_instance = genAI_instance.getGenerativeModel({ 
        model: IMAGE_MODEL_NAME,
        safetySettings
    });
} catch (e) {
    console.error(`[Gemini Image] Falha ao inicializar o modelo de imagem ${IMAGE_MODEL_NAME}. O comando !mudar pode não funcionar. Erro: ${e.message}`);
    imageModel_instance = null; // Garante que o bot não quebre se o modelo não carregar
}


// =======================================================
// Exportação dos Módulos
// =======================================================
const modelApi = {
    // Getter para o modelo de texto atual (para chat)
    get textModel() {
        return textModel_instance;
    },
    
    // Modelo de imagem estático (para o comando !mudar)
    imageModel: imageModel_instance,
    
    // Função para trocar o modelo de texto em caso de falha
    switchToNextModel: switchToNextTextModel // Renomeado para manter compatibilidade
};

module.exports = modelApi;
