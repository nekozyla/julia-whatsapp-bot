
const fs = require('fs').promises; 
const path = require('path');
const config = require('../../config/config.js');
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

module.exports = {
    loadAllowedGroups,
    addGroup,
    isGroupAllowed,
    loadAllowedContacts,
    addAllowedContact,
    addAllowedContact,
    isContactAllowed,
    isSuperAdmin
};


function isSuperAdmin(jid) {
    if (!jid) return false;

    
    const normalizedJid = jid.split(':')[0];

    
    if (config.ADMIN_JIDS && (config.ADMIN_JIDS.includes(jid) || config.ADMIN_JIDS.includes(normalizedJid))) return true;

    
    if (tempAdminManager.isTempAdmin(jid) || tempAdminManager.isTempAdmin(normalizedJid)) return true;

    return false;
}
