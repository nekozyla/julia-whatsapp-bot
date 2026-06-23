const axios = require('axios');
require('dotenv').config();
const systemStateManager = require('./systemStateManager.js');
const { BOT_NAME } = require('../../config.js');
const { getSystemPrompt } = require('./systemPrompt.js');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

if (!OPENAI_API_KEY) {
    console.warn(`[OpenAI] OPENAI_API_KEY não definida no .env. Assistente via OpenAI não funcionará.`);
}

async function chatCompletion(messages) {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada.');

    const activeModel = systemStateManager.getCustomModel('openai') || OPENAI_MODEL;
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
        const response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API OpenAI.');
        }
        return choice.message.content.trim();
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            throw new Error(`Erro na API OpenAI (${status}): ${errMsg}`);
        }
        throw error;
    }
}

async function visionCompletion(imageBase64, mimeType, userText, userName = null) {
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada.');

    const userContent = [
        {
            type: 'text',
            text: userName ? `[${userName}]: ${userText || 'O que tem nessa imagem?'}` : (userText || 'O que tem nessa imagem?')
        },
        {
            type: 'image_url',
            image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
            }
        }
    ];

    const activeVisionModel = systemStateManager.getCustomModel('openai') || OPENAI_VISION_MODEL;
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
        const response = await axios.post(OPENAI_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API OpenAI Vision.');
        }
        return choice.message.content.trim();
    } catch (error) {
        if (error.response) {
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            throw new Error(`Erro na API OpenAI Vision: ${errMsg}`);
        }
        throw error;
    }
}

module.exports = { chatCompletion, visionCompletion, API_KEY: OPENAI_API_KEY };
