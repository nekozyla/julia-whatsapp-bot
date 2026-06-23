
const fs = require('fs').promises;
const path = require('path');

const BLACKLIST_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'anuncioBlacklist.json');
let blacklistCache = new Set();

async function loadBlacklist() {
    try {
        const data = await fs.readFile(BLACKLIST_FILE_PATH, 'utf-8');
        const loadedJids = JSON.parse(data);
        blacklistCache = new Set(loadedJids);

    } catch (error) {
        if (error.code === 'ENOENT') {
            blacklistCache = new Set();
        } else {
            console.error('[AnuncioManager] Erro ao carregar blacklist:', error);
        }
    }
}

async function saveBlacklist() {
    try {
        await fs.writeFile(BLACKLIST_FILE_PATH, JSON.stringify([...blacklistCache], null, 2));
    } catch (error) {
        console.error('[AnuncioManager] Erro ao salvar blacklist:', error);
    }
}

async function blockJid(jid) {
    if (!blacklistCache.has(jid)) {
        blacklistCache.add(jid);
        await saveBlacklist();
        return true;
    }
    return false;
}

async function unblockJid(jid) {
    if (blacklistCache.has(jid)) {
        blacklistCache.delete(jid);
        await saveBlacklist();
        return true;
    }
    return false;
}

function isBlocked(jid) {
    return blacklistCache.has(jid);
}

function getBlacklist() {
    return [...blacklistCache];
}

module.exports = {
    loadBlacklist,
    blockJid,
    unblockJid,
    isBlocked,
    getBlacklist
};
