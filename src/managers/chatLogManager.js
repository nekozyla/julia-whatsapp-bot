const fs = require('fs').promises;
const path = require('path');

const STATE_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'chat_logs.json');
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGS_PER_GROUP = 800;

let logCache = { groups: {} };
let saveTimer = null;

function ensureGroup(groupJid) {
    if (!logCache.groups[groupJid]) {
        logCache.groups[groupJid] = { logs: [] };
    }
    return logCache.groups[groupJid];
}

async function saveState() {
    await fs.writeFile(STATE_FILE_PATH, JSON.stringify(logCache, null, 2));
}

function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveState().catch(error => console.error('[ChatLogManager] Erro ao salvar estado:', error));
        saveTimer = null;
    }, 5000);
}

async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
        logCache = JSON.parse(data);
        if (!logCache.groups) logCache.groups = {};
    } catch (error) {
        if (error.code === 'ENOENT') {
            logCache = { groups: {} };
            await saveState();
            return;
        }
        console.error('[ChatLogManager] Erro ao carregar logs:', error);
    }
}

function sanitizeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
}

function recordMessage(groupJid, payload) {
    const group = ensureGroup(groupJid);
    const text = sanitizeText(payload.text);
    if (!text) return;

    const now = payload.timestamp || Date.now();
    group.logs.push({
        id: payload.id || `${now}-${Math.random().toString(36).slice(2, 8)}`,
        ts: now,
        authorJid: payload.authorJid,
        pushName: payload.pushName || payload.authorJid?.split('@')[0] || 'Alguém',
        text
    });

    const minTs = Date.now() - LOG_RETENTION_MS;
    group.logs = group.logs
        .filter(item => item.ts >= minTs)
        .slice(-MAX_LOGS_PER_GROUP);

    scheduleSave();
}

function getRecentLogs(groupJid, hours = 24, limit = 120) {
    const group = ensureGroup(groupJid);
    const minTs = Date.now() - (hours * 60 * 60 * 1000);
    return group.logs.filter(item => item.ts >= minTs).slice(-limit);
}

module.exports = {
    loadState,
    recordMessage,
    getRecentLogs
};
