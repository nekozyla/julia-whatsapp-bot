
const fs = require('fs').promises; 
const path = require('path');
const config = require('../../config.js');
const tempAdminManager = require('./tempAdminManager.js');

const ALLOWED_GROUPS_FILE = path.join(__dirname, '..', '..', 'data', 'allowed_groups.json');
const ALLOWED_CONTACTS_FILE = path.join(__dirname, '..', '..', 'data', 'allowed_contacts.json');

let allowedGroups = new Set();
let allowedContacts = new Set();


async function loadAllowedGroups() {
    try {
        const data = await fs.readFile(ALLOWED_GROUPS_FILE, 'utf-8');
        allowedGroups = new Set(JSON.parse(data));
        
    } catch (e) {
        if (e.code === 'ENOENT') {
            
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


async function loadAllowedContacts() {
    try {
        const data = await fs.readFile(ALLOWED_CONTACTS_FILE, 'utf-8');
        allowedContacts = new Set(JSON.parse(data));
        
    } catch (e) {
        if (e.code === 'ENOENT') {
            
        } else {
            console.error('[Auth] Erro ao carregar contactos.', e);
        }
    }

    
    let changed = false;
    if (config.ADMIN_JIDS && Array.isArray(config.ADMIN_JIDS)) {
        for (const adminJid of config.ADMIN_JIDS) {
            if (!allowedContacts.has(adminJid)) {
                allowedContacts.add(adminJid);
                changed = true;
            }
        }
    }

    
    if (changed) {
        
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

function normalizeJid(jid) {
    if (!jid || typeof jid !== 'string') return null;
    // Remove sufixo de device (ex: 5511999999999:12@s.whatsapp.net)
    return jid.replace(/:\d+(?=@)/, '');
}

function extractUserPart(jid) {
    const normalized = normalizeJid(jid);
    if (!normalized || !normalized.includes('@')) return null;
    return normalized.split('@')[0];
}

function normalizeNonoDigito(userPart) {
    if (!userPart || typeof userPart !== 'string') return userPart;
    // Se for número brasileiro com 13 dígitos (ex: 5522992667333), remove o 9º dígito (o '9' após o DDD)
    // para normalizar para o formato sem o 9º dígito (ex: 552292667333).
    if (userPart.startsWith('55') && userPart.length === 13) {
        return '55' + userPart.substring(2, 4) + userPart.substring(5);
    }
    return userPart;
}

module.exports = {
    loadAllowedGroups,
    addGroup,
    isGroupAllowed,
    loadAllowedContacts,
    addAllowedContact,
    isContactAllowed,
    isSuperAdmin
};


function isSuperAdmin(jid) {
    if (!jid) return false;

    const normalizedJid = normalizeJid(jid);
    const userPart = extractUserPart(normalizedJid);

    if (config.ADMIN_JIDS && Array.isArray(config.ADMIN_JIDS)) {
        for (const adminJid of config.ADMIN_JIDS) {
            const normalizedAdmin = normalizeJid(adminJid);
            if (!normalizedAdmin) continue;

            if (normalizedAdmin === normalizedJid || adminJid === jid) return true;

            // Aceita equivalência entre domínios diferentes (ex.: @lid e @s.whatsapp.net)
            // e faz a correspondência do nono dígito para números brasileiros
            const adminUserPart = extractUserPart(normalizedAdmin);
            if (adminUserPart && userPart) {
                const normAdminUser = normalizeNonoDigito(adminUserPart);
                const normUser = normalizeNonoDigito(userPart);
                if (normAdminUser === normUser) return true;
            }
        }
    }

    if (tempAdminManager.isTempAdmin(jid) || tempAdminManager.isTempAdmin(normalizedJid)) return true;

    return false;
}
