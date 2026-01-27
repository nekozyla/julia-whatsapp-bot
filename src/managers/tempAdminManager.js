const fs = require('fs').promises;
const path = require('path');

const TEMP_ADMINS_FILE = path.join(__dirname, '..', '..', 'data', 'temp_admins.json');


let tempAdmins = {};

async function loadTempAdmins() {
    try {
        const data = await fs.readFile(TEMP_ADMINS_FILE, 'utf-8');
        tempAdmins = JSON.parse(data);
        cleanExpired(); 
    } catch (e) {
        if (e.code === 'ENOENT') {
            tempAdmins = {};
        } else {
            console.error('[TempAdmin] Erro ao carregar admins temporários:', e);
        }
    }
}

async function saveTempAdmins() {
    try {
        await fs.writeFile(TEMP_ADMINS_FILE, JSON.stringify(tempAdmins, null, 2));
    } catch (e) {
        console.error('[TempAdmin] Erro ao salvar admins temporários:', e);
    }
}

function cleanExpired() {
    const now = Date.now();
    let changed = false;
    for (const [jid, expiry] of Object.entries(tempAdmins)) {
        if (now > expiry) {
            delete tempAdmins[jid];
            changed = true;
        }
    }
    if (changed) {
        saveTempAdmins();
    }
}


async function addAdmin(jid, durationMs) {
    cleanExpired();
    tempAdmins[jid] = Date.now() + durationMs;
    await saveTempAdmins();
    return tempAdmins[jid]; 
}


function isTempAdmin(jid) {
    cleanExpired(); 
    return !!tempAdmins[jid];
}


async function removeAdmin(jid) {
    if (tempAdmins[jid]) {
        delete tempAdmins[jid];
        await saveTempAdmins();
        return true;
    }
    return false;
}


loadTempAdmins();

module.exports = {
    addAdmin,
    isTempAdmin,
    removeAdmin,
    loadTempAdmins 
};
