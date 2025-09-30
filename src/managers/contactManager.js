// contactManager.js
const fs = require('fs').promises;
const path = require('path');

const CONTACTS_FILE_PATH = path.join(__dirname, '..', 'data', 'contacts.json');
let contactsCache = new Set();

async function loadContacts() {
    try {
        const data = await fs.readFile(CONTACTS_FILE_PATH, 'utf-8');
        const loadedJids = JSON.parse(data);
        contactsCache = new Set(loadedJids);
        console.log(`[Contacts] ${contactsCache.size} contactos carregados.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Contacts] Arquivo de contactos não encontrado, a lista de broadcast estará vazia.');
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

/**
 * Remove um JID da lista de contatos.
 * @param {string} jid - O JID do contato a ser removido.
 */
async function removeContact(jid) {
    if (contactsCache.has(jid)) {
        contactsCache.delete(jid);
        await saveContacts();
        console.log(`[Contacts] Contacto removido: ${jid}`);
        return true;
    }
    return false;
}

function getContacts() {
    return [...contactsCache];
}

module.exports = {
    loadContacts,
    addContact,
    getContacts,
    removeContact // Exporta a nova função
};

