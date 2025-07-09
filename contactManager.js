// contactManager.js
const fs = require('fs').promises;
const path = require('path');

const CONTACTS_FILE_PATH = path.join(__dirname, 'contacts.json');
let contactsCache = new Set(); // Usamos um Set para garantir que não haja JIDs duplicados

/**
 * Carrega a lista de contatos do arquivo para a memória.
 */
async function loadContacts() {
    try {
        const data = await fs.readFile(CONTACTS_FILE_PATH, 'utf-8');
        const loadedJids = JSON.parse(data);
        contactsCache = new Set(loadedJids);
        console.log(`[Contacts] ${contactsCache.size} contatos carregados.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Contacts] Arquivo de contatos não encontrado, iniciando um novo.');
            contactsCache = new Set();
        } else {
            console.error('[Contacts] Erro ao carregar contatos:', error);
        }
    }
}

/**
 * Salva a lista de contatos da memória para o arquivo.
 */
async function saveContacts() {
    try {
        const dataToSave = JSON.stringify([...contactsCache], null, 2);
        await fs.writeFile(CONTACTS_FILE_PATH, dataToSave);
    } catch (error) {
        console.error('[Contacts] Erro ao salvar contatos:', error);
    }
}

/**
 * Adiciona um novo JID à lista se ele for um usuário válido e ainda não existir.
 * @param {string} jid - O JID do contato a ser adicionado.
 */
async function addContact(jid) {
    // Garante que estamos salvando apenas JIDs de usuários privados e não grupos
    if (jid.endsWith('@s.whatsapp.net') && !contactsCache.has(jid)) {
        console.log(`[Contacts] Novo contato adicionado: ${jid}`);
        contactsCache.add(jid);
        await saveContacts();
    }
}

/**
 * Retorna a lista de todos os contatos salvos.
 * @returns {string[]}
 */
function getContacts() {
    return [...contactsCache];
}

module.exports = {
    loadContacts,
    addContact,
    getContacts
};
