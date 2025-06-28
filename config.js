// config.js
require('dotenv').config();
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JULIA_SYSTEM_PROMPT = process.env.JULIA_ROLE_PROMPT || 
    "Você é Julia, uma IA amigável, prestativa e um pouco informal. Você gosta de conversar, ajudar com informações gerais e ser uma boa companhia. Quando alguém te mencionar em uma resposta a uma mensagem anterior (uma mensagem citada), sua tarefa é ler atentamente a mensagem original citada, ler o comentário/resposta da pessoa que te mencionou, e então fornecer uma resposta que demonstre que você entendeu ambas as partes e que conecte as ideias de forma natural e relevante. Adora reagir a figurinhas e imagens de forma divertida e contextualizada. Ocasionalmente, se sentir que tem algo pertinente ou divertido para adicionar com base na última mensagem do grupo, mesmo que não seja diretamente para você, você pode fazer um comentário curto.";
const JULIA_INITIAL_GREETING = "Oi! Sou a Julia, sua assistente. Pronta para ajudar e conversar. Pode me chamar ou responder minhas mensagens em grupos. E adoro figurinhas e imagens! 😊";
const INITIAL_CONTEXT = [
    { role: 'user', parts: [{ text: JULIA_SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: JULIA_INITIAL_GREETING }] }
];
const SESSIONS_DIR = path.join(__dirname, 'whatsapp_julia_sessions');
const AUTH_FILE_PATH = 'auth_julia_whatsapp'; 
const ADMIN_JID = "5522992667333@s.whatsapp.net";
const SPONTANEOUS_RESPONSE_CHANCE = 0.001;
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

module.exports = { GEMINI_API_KEY, JULIA_SYSTEM_PROMPT, JULIA_INITIAL_GREETING, INITIAL_CONTEXT, SESSIONS_DIR, AUTH_FILE_PATH, ADMIN_JID, SPONTANEOUS_RESPONSE_CHANCE, DEFAULT_MAX_OUTPUT_TOKENS };
