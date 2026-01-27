
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

async function addContact(jid) {
    if (jid.endsWith('@s.whatsapp.net') && !contactsCache.has(jid)) {
        contactsCache.add(jid);
        await saveContacts();
    }
}


async function removeContact(jid) {
    if (contactsCache.has(jid)) {
        contactsCache.delete(jid);
        await saveContacts();
        console.log(`[Contacts] Contacto removido: ${jid}`);
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
    loadNicknames
};

