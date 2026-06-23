const fs = require('fs').promises;
const path = require('path');

const STORE_FILE = path.join(__dirname, '..', '..', 'data', 'view_once_store.json');
const MAX_ITEMS = 150;

let store = {};

// Função recursiva para restaurar buffers serializados como JSON
function restoreBuffers(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            obj[key] = restoreBuffers(obj[key]);
        }
    }
    return obj;
}

async function loadStore() {
    try {
        const data = await fs.readFile(STORE_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        store = restoreBuffers(parsed);
        console.log(`[ViewOnceManager] ${Object.keys(store).length} mensagens de visualização única carregadas do disco.`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            store = {};
        } else {
            console.error('[ViewOnceManager] Erro ao carregar mensagens persistidas:', e);
        }
    }
}

async function saveStore() {
    try {
        await fs.mkdir(path.dirname(STORE_FILE), { recursive: true }).catch(() => {});
        await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2));
    } catch (e) {
        console.error('[ViewOnceManager] Erro ao salvar mensagens persistidas:', e);
    }
}

async function addMessage(msg) {
    if (!msg || !msg.key || !msg.key.id) return;
    
    // Evita duplicatas e mantém ordem
    delete store[msg.key.id];
    store[msg.key.id] = msg;

    const keys = Object.keys(store);
    if (keys.length > MAX_ITEMS) {
        const toDeleteCount = keys.length - MAX_ITEMS;
        for (let i = 0; i < toDeleteCount; i++) {
            delete store[keys[i]];
        }
    }

    await saveStore();
}

function getMessage(msgId) {
    return store[msgId] || null;
}

module.exports = {
    loadStore,
    addMessage,
    getMessage
};
