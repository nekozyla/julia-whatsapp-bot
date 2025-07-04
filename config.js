// config.js
require('dotenv').config();
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JULIA_SYSTEM_PROMPT = process.env.JULIA_ROLE_PROMPT;
const JULIA_INITIAL_GREETING = "Oi! Sou a Julia, sua assistente. Pronta para ajudar e conversar. Pode me chamar ou responder minhas mensagens em grupos. E adoro figurinhas e imagens! 😊";
const INITIAL_CONTEXT = [
    { role: 'user', parts: [{ text: JULIA_SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: JULIA_INITIAL_GREETING }] }
];
const SESSIONS_DIR = path.join(__dirname, 'whatsapp_julia_sessions');
const AUTH_FILE_PATH = 'auth_julia_whatsapp'; 
const ADMIN_JID = "5522992667333@s.whatsapp.net";
const SPONTANEOUS_RESPONSE_CHANCE = 0.000;
const DEFAULT_MAX_OUTPUT_TOKENS = 400;

module.exports = { GEMINI_API_KEY, JULIA_SYSTEM_PROMPT, JULIA_INITIAL_GREETING, INITIAL_CONTEXT, SESSIONS_DIR, AUTH_FILE_PATH, ADMIN_JID, SPONTANEOUS_RESPONSE_CHANCE, DEFAULT_MAX_OUTPUT_TOKENS };
