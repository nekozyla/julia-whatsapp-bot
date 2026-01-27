const fs = require('fs').promises;
const path = require('path');

const SYNC_FILE = path.join(__dirname, '..', '..', 'data', 'synced_groups.json');

async function loadSyncs() {
    try {
        const data = await fs.readFile(SYNC_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {}; 
    }
}

async function saveSyncs(obj) {
    await fs.writeFile(SYNC_FILE, JSON.stringify(obj, null, 2));
}

async function addLink(a, b) {
    const obj = await loadSyncs();
    obj[a] = obj[a] || [];
    obj[b] = obj[b] || [];
    if (!obj[a].includes(b)) obj[a].push(b);
    if (!obj[b].includes(a)) obj[b].push(a);
    await saveSyncs(obj);
}

async function removeLink(a, b) {
    const obj = await loadSyncs();
    obj[a] = (obj[a] || []).filter(x => x !== b);
    obj[b] = (obj[b] || []).filter(x => x !== a);
    await saveSyncs(obj);
}

async function getLinks(a) {
    const obj = await loadSyncs();
    return obj[a] || [];
}

module.exports = { loadSyncs, saveSyncs, addLink, removeLink, getLinks };
