require('dotenv').config();
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_MODELS = (process.env.GEMINI_MODELS || 'gemini-2.5-flash-lite')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

const IMGFLIP_USERNAME = process.env.IMGFLIP_USERNAME;
const IMGFLIP_PASSWORD = process.env.IMGFLIP_PASSWORD;

const SESSIONS_DIR = path.join(__dirname, process.env.SESSIONS_DIR || 'whatsapp_anark_sessions');
const AUTH_FILE_PATH = process.env.AUTH_FILE_PATH || 'auth_anark_whatsapp';

const ADMIN_JIDS = (process.env.ADMIN_JIDS || '')
    .split(',')
    .map(j => j.trim())
    .filter(Boolean);

const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME;
const INSTAGRAM_PASSWORD = process.env.INSTAGRAM_PASSWORD;

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_SHARED_SECRET = process.env.LASTFM_SHARED_SECRET;
const LASTFM_USERNAME = process.env.LASTFM_USERNAME;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

const REMOVE_BG_KEY = process.env.REMOVE_BG_KEY;
const BROWSERLESSAPI = process.env.BROWSERLESSAPI;

const RENTAL_PIX_KEY = process.env.RENTAL_PIX_KEY || '';
const RENTAL_PIX_RECEIVER_NAME = process.env.RENTAL_PIX_RECEIVER_NAME || (process.env.BOT_NAME || 'Julia');
const RENTAL_PIX_CITY = process.env.RENTAL_PIX_CITY || 'Sao Paulo';
const RENTAL_PIX_PRICE_PER_DAY = Number(process.env.RENTAL_PIX_PRICE_PER_DAY || '10');
const RENTAL_TICKET_EXPIRE_HOURS = Number(process.env.RENTAL_TICKET_EXPIRE_HOURS || '24');

const BOT_NAME = process.env.BOT_NAME || 'Julia';
const BOT_TRIGGER_NAMES = Array.from(new Set([
    'julia',
    BOT_NAME.toLowerCase(),
    ...(process.env.BOT_TRIGGER_NAMES || '').split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
]));

module.exports = {
    GEMINI_API_KEY,
    GEMINI_MODELS,

    SESSIONS_DIR,
    AUTH_FILE_PATH,
    ADMIN_JIDS,

    INSTAGRAM_USERNAME,
    INSTAGRAM_PASSWORD,
    IMGFLIP_USERNAME,
    LASTFM_API_KEY,
    LASTFM_SHARED_SECRET,
    IMGFLIP_PASSWORD,

    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
    REMOVE_BG_KEY,
    BROWSERLESSAPI,
    RENTAL_PIX_KEY,
    RENTAL_PIX_RECEIVER_NAME,
    RENTAL_PIX_CITY,
    RENTAL_PIX_PRICE_PER_DAY,
    RENTAL_TICKET_EXPIRE_HOURS,
    GROQ_API_KEY,
    BOT_NAME,
    BOT_TRIGGER_NAMES
};
