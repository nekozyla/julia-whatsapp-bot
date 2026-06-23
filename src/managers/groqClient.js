
const axios = require('axios');
require('dotenv').config();
const { BOT_NAME } = require('../../config.js');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const systemStateManager = require('./systemStateManager.js');
const { getSystemPrompt } = require('./systemPrompt.js');

if (!GROQ_API_KEY) {
    console.warn(`[Groq] GROQ_API_KEY não definida no .env. O assistente ${BOT_NAME} não funcionará.`);
}

/**
 * Envia uma requisição de chat completion para a API do Groq.
 * @param {Array<{role: string, content: string, name?: string}>} messages - Histórico de mensagens
 * @returns {Promise<string>} - Texto da resposta do modelo
 */
async function chatCompletion(messages) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não configurada.');
    }

    const activeModel = systemStateManager.getCustomModel('groq') || GROQ_MODEL;
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
        const response = await axios.post(GROQ_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API Groq.');
        }

        return choice.message.content.trim();

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            console.error(`[Groq] Erro API (${status}): ${errMsg}`);

            if (status === 429) {
                throw new Error('Estou sobrecarregada agora, tenta de novo daqui a pouco! 😵');
            }
            throw new Error(`Erro na API Groq: ${errMsg}`);
        }

        if (error.code === 'ECONNABORTED') {
            throw new Error('A API demorou demais para responder. Tente novamente.');
        }

        throw error;
    }
}

/**
 * Envia uma requisição de vision completion para a API do Groq.
 * @param {string} imageBase64 - Imagem em base64
 * @param {string} mimeType - Tipo MIME da imagem (image/jpeg, image/png, etc)
 * @param {string} userText - Texto do usuário sobre a imagem
 * @param {string} [userName] - Nome do remetente (para contexto)
 * @returns {Promise<string>} - Texto da resposta do modelo
 */
async function visionCompletion(imageBase64, mimeType, userText, userName = null) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY não configurada.');
    }

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

    const activeVisionModel = systemStateManager.getCustomModel('groq') || GROQ_VISION_MODEL;
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
        const response = await axios.post(GROQ_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 45000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) {
            throw new Error('Resposta inesperada da API Groq Vision.');
        }

        return choice.message.content.trim();

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            console.error(`[Groq Vision] Erro API (${status}): ${errMsg}`);

            if (status === 429) {
                throw new Error('Estou sobrecarregada agora, tenta de novo daqui a pouco! 😵');
            }
            throw new Error(`Erro na API Groq Vision: ${errMsg}`);
        }

        if (error.code === 'ECONNABORTED') {
            throw new Error('A API demorou demais para responder. Tente novamente.');
        }

        throw error;
    }
}

/**
 * Chat completion com system prompt customizado.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt - System prompt customizado
 * @returns {Promise<string>}
 */
async function rawCompletion(messages, systemPrompt) {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY não configurada.');

    const activeModel = systemStateManager.getCustomModel('groq') || GROQ_MODEL;
    const payload = {
        model: activeModel,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        max_tokens: 4096,
        temperature: 0.6,
    };

    try {
        const response = await axios.post(GROQ_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });

        const choice = response.data?.choices?.[0];
        if (!choice || !choice.message?.content) throw new Error('Resposta inesperada da API Groq.');
        return choice.message.content.trim();
    } catch (error) {
        if (error.response) {
            const errMsg = error.response.data?.error?.message || 'Erro desconhecido';
            throw new Error(`Erro Groq: ${errMsg}`);
        }
        throw error;
    }
}

module.exports = { chatCompletion, visionCompletion, rawCompletion, GROQ_API_KEY };
