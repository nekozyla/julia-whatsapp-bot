// config.js
require('dotenv').config();
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_MODELS = [
    'gemini-2.5-flash-lite-preview-06-17'
];

const JULIA_SYSTEM_PROMPT = process.env.JULIA_ROLE_PROMPT;
const JULIA_INITIAL_GREETING = "Oi! Sou a Julia, sua assistente. Pronta para ajudar e conversar. Pode me chamar ou responder minhas mensagens em grupos.";
const INITIAL_CONTEXT = [
    { role: 'user', parts: [{ text: JULIA_SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: JULIA_INITIAL_GREETING }] }
];
const SESSIONS_DIR = path.join(__dirname, 'whatsapp_julia_sessions');
const AUTH_FILE_PATH = 'auth_julia_whatsapp';

// --- ALTERAÇÃO AQUI ---
// Agora é uma lista (Array) de administradores.
// O primeiro da lista é considerado o "Super Admin".
const ADMIN_JIDS = [
    "5522992667333@s.whatsapp.net", // Admin principal
    "556584046513@s.whatsapp.net", // Adicione quantos admins quiser
    // "MAIS_UM_ADMIN@s.whatsapp.net",
];
// --- FIM DA ALTERAÇÃO ---

const SPONTANEOUS_RESPONSE_CHANCE = 0.000;
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;

module.exports = { 
    GEMINI_API_KEY, 
    GEMINI_MODELS, 
    JULIA_SYSTEM_PROMPT, 
    JULIA_INITIAL_GREETING, 
    INITIAL_CONTEXT, 
    SESSIONS_DIR, 
    AUTH_FILE_PATH, 
    ADMIN_JIDS, // Variável atualizada
    DEFAULT_MAX_OUTPUT_TOKENS,
    INSTAGRAM_USERNAME,
    INSTAGRAM_PASSWORD
};
