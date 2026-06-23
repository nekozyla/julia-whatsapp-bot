
const fs = require('fs').promises;
const path = require('path');

const CONTACTS_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'contacts.json');
let contactsCache = new Set();

async function loadContacts() {
    try {
        const data = await fs.readFile(CONTACTS_FILE_PATH, 'utf-8');
        const loadedJids = JSON.parse(data);
        contactsCache = new Set(loadedJids);

    } catch (error) {
        if (error.code === 'ENOENT') {

        }
    }
}

async function saveContacts() {
    try {
        await fs.writeFile(CONTACTS_FILE_PATH, JSON.stringify([...contactsCache]));
    } catch (error) {
        console.error('[Contacts] Erro ao salvar contactos:', error);
    }
}

let _sock = null;

function setSock(sock) {
    _sock = sock;
}

async function addContact(jid) {
    if (jid.endsWith('@s.whatsapp.net') && !contactsCache.has(jid)) {
        contactsCache.add(jid);
        await saveContacts();
        // Subscrever presença para que o contato possa ver os status do bot (WA Business)
        await subscribePresence(jid);
    }
}

async function subscribePresence(jid) {
    if (!_sock || !jid.endsWith('@s.whatsapp.net')) return;
    try {
        await _sock.presenceSubscribe(jid);
    } catch (e) {
        // Silencioso — presenceSubscribe pode falhar para JIDs inválidos
    }
}

async function subscribeAllContacts() {
    if (!_sock) return;
    const contacts = [...contactsCache];

    let ok = 0;
    for (const jid of contacts) {
        try {
            await _sock.presenceSubscribe(jid);
            ok++;
        } catch (_) { }
        // Pequeno delay para não floodar o WhatsApp
        if (ok % 50 === 0) await new Promise(r => setTimeout(r, 1000));
    }

}


async function removeContact(jid) {
    if (contactsCache.has(jid)) {
        contactsCache.delete(jid);
        await saveContacts();

        return true;
    }
    return false;
}







const NICKNAMES_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'nicknames.json');
let nicknamesCache = {};

async function loadNicknames() {
    try {
        const data = await fs.readFile(NICKNAMES_FILE_PATH, 'utf-8');
        nicknamesCache = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') nicknamesCache = {};
    }
}

async function saveNicknames() {
    try {
        await fs.writeFile(NICKNAMES_FILE_PATH, JSON.stringify(nicknamesCache));
    } catch (error) {
        console.error('[Contacts] Erro ao salvar nicknames:', error);
    }
}

async function updateContact(jid, data) {
    if (data.notify) {
        nicknamesCache[jid] = data.notify;
        await saveNicknames();
    }
}

function getNickname(jid) {
    return nicknamesCache[jid];

}

function checkNicknameExists(nickname) {
    const lowerNick = nickname.toLowerCase();
    return Object.values(nicknamesCache).some(nick => nick.toLowerCase() === lowerNick);
}

function getJidByNickname(nickname) {
    if (!nickname) return null;
    const normalized = String(nickname).trim().replace(/^@+/, '').toLowerCase();
    if (!normalized) return null;

    for (const [jid, nick] of Object.entries(nicknamesCache)) {
        if (String(nick).toLowerCase() === normalized) {
            return jid;
        }
    }

    return null;
}

function getAllNicknames() {
    return { ...nicknamesCache };
}

function getContacts() {
    return [...contactsCache];
}

module.exports = {
    loadContacts,
    addContact,
    getContacts,
    removeContact,
    updateContact,
    getNickname,
    loadNicknames,
    checkNicknameExists,
    getJidByNickname,
    getAllNicknames,
    setSock,
    subscribeAllContacts,
    subscribePresence
};

