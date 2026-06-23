const systemStateManager = require('./systemStateManager.js');
const groqClient = require('./groqClient.js');
const geminiClient = require('./geminiClient.js');
const openAiClient = require('./openAiClient.js');
const openRouterClient = require('./openRouterClient.js');

function getActiveClient() {
    const provider = systemStateManager.getAiProvider();
    
    switch (provider) {
        case 'gemini':
            return geminiClient;
        case 'openai':
            return openAiClient;
        case 'openrouter':
            return openRouterClient;
        case 'groq':
        default:
            return groqClient;
    }
}

async function chatCompletion(messages) {
    const client = getActiveClient();
    return await client.chatCompletion(messages);
}

async function visionCompletion(imageBase64, mimeType, userText, userName = null) {
    const client = getActiveClient();
    return await client.visionCompletion(imageBase64, mimeType, userText, userName);
}

function isAnyApiConfigured() {
    return !!(groqClient.GROQ_API_KEY || geminiClient.API_KEY || openAiClient.API_KEY || openRouterClient.API_KEY);
}

module.exports = {
    chatCompletion,
    visionCompletion,
    isAnyApiConfigured
};
