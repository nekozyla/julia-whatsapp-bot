const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { GEMINI_API_KEY, GEMINI_MODELS } = require('../../config.js');
const { getSystemPrompt } = require('./systemPrompt.js');
const systemStateManager = require('./systemStateManager.js');


if (!GEMINI_API_KEY) {
    console.error("Erro Crítico: GEMINI_API_KEY não definida no arquivo .env ou config.js.");
    process.exit(1);
}
if (!GEMINI_MODELS || !Array.isArray(GEMINI_MODELS) || GEMINI_MODELS.length === 0) {
    console.error("Erro Crítico: GEMINI_MODELS precisa ser um array com pelo menos um modelo em config.js.");
    process.exit(1);
}


const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const genAI_instance = new GoogleGenerativeAI(GEMINI_API_KEY);




let currentTextModelIndex = 0;
let textModel_instance;

function getGenerativeTextModel() {
    const activeModel = systemStateManager.getCustomModel('gemini') || GEMINI_MODELS[currentTextModelIndex];
    return genAI_instance.getGenerativeModel({
        model: activeModel,
        safetySettings,
        systemInstruction: {
            role: "system",
            parts: [{ text: getSystemPrompt() }]
        }
    });
}

function switchToNextTextModel() {
    if (currentTextModelIndex < GEMINI_MODELS.length - 1) {
        currentTextModelIndex++;
        console.warn(`[Gemini Text] Limite de API atingido. Trocando para o próximo modelo: ${GEMINI_MODELS[currentTextModelIndex]}`);
        return true;
    } else {
        console.error(`[Gemini Text] Todos os modelos de fallback atingiram o limite. Não é possível trocar mais.`);
        return false;
    }
}






const IMAGE_MODEL_NAME = "gemini-2.5-flash-image-preview";
let imageModel_instance;

function getGenerativeImageModel() {
    const activeVisionModel = systemStateManager.getCustomModel('gemini') || IMAGE_MODEL_NAME;
    if (!activeVisionModel) return null;
    return genAI_instance.getGenerativeModel({
        model: activeVisionModel,
        safetySettings,
        systemInstruction: {
            role: "system",
            parts: [{ text: getSystemPrompt() }]
        }
    });
}





async function chatCompletion(messages) {
    const model = getGenerativeTextModel();
    // Converte o formato OpenAI [{role, content}] para o formato Gemini [{role, parts: [{text}]}]
    const formattedHistory = messages
        .filter(msg => msg.role !== 'system') // system prompt já foi passado no systemInstruction
        .map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

    // O último da lista tem que ser o user message atual, porque chatCompletion não possui .generateContent direto no histórico 
    // Wait, generateContent({contents: [...]}) funciona passando toda a conversa
    try {
        const result = await model.generateContent({ contents: formattedHistory });
        return result.response.text().trim();
    } catch (e) {
        if (e.status === 429) {
            console.warn('[Gemini] Rate limit hit on Model.');
            if (switchToNextTextModel()) {
                return await chatCompletion(messages); // Tenta de novo no novo modelo
            }
            throw new Error('Estou sobrecarregada agora, tenta de novo daqui a pouco! 😵');
        }
        throw new Error(`Erro na API Gemini: ${e.message}`);
    }
}

async function visionCompletion(imageBase64, mimeType, userText, userName = null) {
    const imageModel = getGenerativeImageModel();
    if (!imageModel) throw new Error('Modelo de visão do Gemini não suportado ou falhou.');

    const promptText = userName ? `[${userName}]: ${userText || 'O que tem nessa imagem?'}` : (userText || 'O que tem nessa imagem?');
    
    const inlineData = {
        data: imageBase64,
        mimeType: mimeType
    };

    try {
        const result = await imageModel.generateContent([
            promptText,
            { inlineData }
        ]);
        return result.response.text().trim();
    } catch (e) {
        if (e.status === 429) {
            throw new Error('Estou sobrecarregada agora, tenta de novo daqui a pouco! 😵');
        }
        throw new Error(`Erro na API Gemini Vision: ${e.message}`);
    }
}

const modelApi = {
    get textModel() { return getGenerativeTextModel(); },
    get imageModel() { return getGenerativeImageModel(); },
    switchToNextModel: switchToNextTextModel,
    chatCompletion,
    visionCompletion,
    API_KEY: GEMINI_API_KEY
};

module.exports = modelApi;
