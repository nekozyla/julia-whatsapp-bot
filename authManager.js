// authManager.js (Versão Corrigida e Robusta)
const fs = require('fs').promises; // Usar a versão de promessas para consistência
const path = require('path');
const config = require('./config');

const ALLOWED_GROUPS_FILE = path.join(__dirname, 'allowed_groups.json');
const ALLOWED_CONTACTS_FILE = path.join(__dirname, 'allowed_contacts.json');

let allowedGroups = new Set();
let allowedContacts = new Set();

// Funções para Grupos (sem alterações, mas agora assíncronas)
async function loadAllowedGroups() {
    try {
        const data = await fs.readFile(ALLOWED_GROUPS_FILE, 'utf-8');
        allowedGroups = new Set(JSON.parse(data));
        console.log(`[Auth] ${allowedGroups.size} grupos autorizados carregados.`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.log('[Auth] Ficheiro allowed_groups.json não encontrado, a começar com lista vazia.');
        } else {
            console.error('[Auth] Erro ao carregar grupos.', e);
        }
    }
}

async function saveAllowedGroups() {
    try {
        await fs.writeFile(ALLOWED_GROUPS_FILE, JSON.stringify([...allowedGroups], null, 2));
    } catch (e) { console.error('[Auth] Erro ao salvar grupos.', e); }
}

async function addGroup(groupId) {
    if (allowedGroups.has(groupId)) return false;
    allowedGroups.add(groupId);
    await saveAllowedGroups();
    return true;
}

function isGroupAllowed(groupId) {
    return allowedGroups.has(groupId);
}

// Funções para Contactos (COM A CORREÇÃO)
async function loadAllowedContacts() {
    try {
        const data = await fs.readFile(ALLOWED_CONTACTS_FILE, 'utf-8');
        allowedContacts = new Set(JSON.parse(data));
        console.log(`[Auth] ${allowedContacts.size} contactos autorizados carregados.`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.log('[Auth] Ficheiro allowed_contacts.json não encontrado, a começar com lista vazia.');
        } else {
            console.error('[Auth] Erro ao carregar contactos.', e);
        }
    }
    
    // Garante que TODOS os admins da config estão na lista e salva se houver mudanças.
    let changed = false;
    if (config.ADMIN_JIDS && Array.isArray(config.ADMIN_JIDS)) {
        for (const adminJid of config.ADMIN_JIDS) {
            if (!allowedContacts.has(adminJid)) {
                allowedContacts.add(adminJid);
                changed = true;
            }
        }
    }
    
    // Se algum admin foi adicionado à lista em memória, salva o ficheiro imediatamente.
    if (changed) {
        console.log('[Auth] A adicionar administradores à lista e a sincronizar o ficheiro...');
        await saveAllowedContacts();
    }
}

async function saveAllowedContacts() {
    try {
        await fs.writeFile(ALLOWED_CONTACTS_FILE, JSON.stringify([...allowedContacts], null, 2));
    } catch (e) { console.error('[Auth] Erro ao salvar contactos.', e); }
}

async function addAllowedContact(jid) {
    if (allowedContacts.has(jid)) return false;
    allowedContacts.add(jid);
    await saveAllowedContacts();
    return true;
}

function isContactAllowed(jid) {
    return allowedContacts.has(jid);
}

module.exports = {
    loadAllowedGroups,
    addGroup,
    isGroupAllowed,
    loadAllowedContacts,
    addAllowedContact,
    isContactAllowed
};
