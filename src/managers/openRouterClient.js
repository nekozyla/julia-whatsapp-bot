const axios = require('axios');
require('dotenv').config();
const systemStateManager = require('./systemStateManager.js');
const { BOT_NAME } = require('../../config.js');
const { getSystemPrompt } = require('./systemPrompt.js');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct';
const OPENROUTER_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || 'meta-llama/llama-3.2-11b-vision-instruct';
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

if (!OPENROUTER_API_KEY) {
    console.warn(`[OpenRouter] OPENROUTER_API_KEY não definida no .env. Assistente via OpenRouter não funcionará.`);
}

const customHeaders = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/emily/chatbot',
    'X-Title': BOT_NAME
};

async function chatCompletion(messages) {
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY não configurada.');

    const activeModel = systemStateManager.getCustomModel('openrouter') || OPENROUTER_MODEL;
    const payload = {
        model: activeModel,
        messages: [
            { role: 'system', content: getSystemPrompt() },
            ...messages
        ],
        max_tokens: 1024,
        temperature: 0.8,
    };

    try {
        const response = await axios.post(OPENROUTER_API_URL, payload, {
            headers: customHeaders,
            timeout: 30000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API OpenRouter.');
        }
        return choice.message.content.trim();
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            throw new Error(`Erro na API OpenRouter (${status}): ${errMsg}`);
        }
        throw error;
    }
}

async function visionCompletion(imageBase64, mimeType, userText, userName = null) {
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY não configurada.');

    const userContent = [
        {
            type: 'image_url',
            image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
            }
        },
        {
            type: 'text',
            text: userName ? `[${userName}]: ${userText || 'O que tem nessa imagem?'}` : (userText || 'O que tem nessa imagem?')
        }
    ];

    const activeVisionModel = systemStateManager.getCustomModel('openrouter') || OPENROUTER_VISION_MODEL;
    const payload = {
        model: activeVisionModel,
        messages: [
            { role: 'system', content: getSystemPrompt() },
            { role: 'user', content: userContent }
        ],
        max_tokens: 1024,
        temperature: 0.8,
    };

    try {
        const response = await axios.post(OPENROUTER_API_URL, payload, {
            headers: customHeaders,
            timeout: 45000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API OpenRouter Vision.');
        }
        return choice.message.content.trim();
    } catch (error) {
        if (error.response) {
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            throw new Error(`Erro na API OpenRouter Vision: ${errMsg}`);
        }
        throw error;
    }
}

module.exports = { chatCompletion, visionCompletion, API_KEY: OPENROUTER_API_KEY };
