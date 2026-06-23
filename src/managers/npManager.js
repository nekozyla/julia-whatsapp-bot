
const fs = require('fs').promises;
const path = require('path');

const nicknamesFilePath = path.join(__dirname, '..', '..', 'data', 'np_users.json');
const tokensFilePath = path.join(__dirname, '..', '..', 'data', 'spotify_tokens.json');
const settingsFilePath = path.join(__dirname, '..', '..', 'data', 'np_settings.json');
const lastfmSessionsFilePath = path.join(__dirname, '..', '..', 'data', 'lastfm_sessions.json');
const lyricsCache = {};

let userNicknames = {};
let spotifyTokens = {};
let userSettings = {};
let lastfmSessions = {};

function normalizeTheme(theme) {
    if (theme === 'default') return 'dynamic';
    return theme;
}

function normalizeSettingsObject(settings) {
    if (!settings || typeof settings !== 'object') return {};
    const normalized = { ...settings };
    if (normalized.theme) {
        normalized.theme = normalizeTheme(normalized.theme);
    }
    return normalized;
}

async function loadData() {
    try {
        await fs.mkdir(path.dirname(nicknamesFilePath), { recursive: true });
        const nickData = await fs.readFile(nicknamesFilePath, 'utf-8');
        userNicknames = JSON.parse(nickData);
    } catch (e) { userNicknames = {}; }

    try {
        const tokenData = await fs.readFile(tokensFilePath, 'utf-8');
        spotifyTokens = JSON.parse(tokenData);
    } catch (e) { spotifyTokens = {}; }

    try {
        const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
        userSettings = JSON.parse(settingsData);
        let changed = false;
        for (const jid of Object.keys(userSettings)) {
            const normalized = normalizeSettingsObject(userSettings[jid]);
            if (normalized.theme !== userSettings[jid]?.theme) {
                changed = true;
            }
            userSettings[jid] = normalized;
        }
        if (changed) {
            await saveSettings();
        }
    } catch (e) { userSettings = {}; }

    try {
        const sessionsData = await fs.readFile(lastfmSessionsFilePath, 'utf-8');
        lastfmSessions = JSON.parse(sessionsData);
    } catch (e) { lastfmSessions = {}; }
}

async function saveNicknames() {
    await fs.writeFile(nicknamesFilePath, JSON.stringify(userNicknames, null, 2));
}

async function saveTokens() {
    await fs.writeFile(tokensFilePath, JSON.stringify(spotifyTokens, null, 2));
}

async function saveSettings() {
    await fs.writeFile(settingsFilePath, JSON.stringify(userSettings, null, 2));
}

async function saveLastfmSessions() {
    await fs.writeFile(lastfmSessionsFilePath, JSON.stringify(lastfmSessions, null, 2));
}

// Inicializa carregamento
loadData();

module.exports = {
    getUserLastFm: (jid) => userNicknames[jid],
    setUserLastFm: async (jid, username) => {
        userNicknames[jid] = username;
        await saveNicknames();
    },
    removeUserLastFm: async (jid) => {
        delete userNicknames[jid];
        await saveNicknames();
    },
    getAllUsers: () => userNicknames,
    getJidByLastFm: (username) => {
        return Object.keys(userNicknames).find(key => userNicknames[key]?.toLowerCase() === username.toLowerCase());
    },

    getSpotifyToken: (jid) => spotifyTokens[jid],
    setSpotifyToken: async (jid, tokenData) => {
        spotifyTokens[jid] = tokenData;
        await saveTokens();
    },

    getUserSettings: (jid) => normalizeSettingsObject(userSettings[jid]),
    setUserSettings: async (jid, settings) => {
        userSettings[jid] = normalizeSettingsObject(settings || {});
        await saveSettings();
    },
    setUserTheme: async (jid, theme) => {
        if (!userSettings[jid]) userSettings[jid] = {};
        userSettings[jid].theme = normalizeTheme(theme);
        await saveSettings();
    },

    // Lyrics Cache (memory only)
    getLyricsCache: (jid) => lyricsCache[jid],
    setLyricsCache: (jid, data) => { lyricsCache[jid] = data; },

    // Last.fm Session Keys (for scrobbling)
    getLastfmSession: (jid) => lastfmSessions[jid],
    setLastfmSession: async (jid, sessionData) => {
        lastfmSessions[jid] = sessionData;
        await saveLastfmSessions();
    },
    removeLastfmSession: async (jid) => {
        delete lastfmSessions[jid];
        await saveLastfmSessions();
    },
    // Pending auth tokens (memory only)
    _pendingAuthTokens: {},
    setPendingAuthToken: (jid, token) => { module.exports._pendingAuthTokens[jid] = token; },
    getPendingAuthToken: (jid) => module.exports._pendingAuthTokens[jid],
    removePendingAuthToken: (jid) => { delete module.exports._pendingAuthTokens[jid]; }
};
