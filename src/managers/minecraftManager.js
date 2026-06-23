const fs = require('fs').promises;
const path = require('path');
const authManager = require('./authManager.js');

const dataDir = path.join(__dirname, '..', '..', 'data');
const settingsFile = path.join(dataDir, 'server_settings.json');
const linkedFile = path.join(dataDir, 'linked_accounts.json');

let settings = {
    chat_group_jid: null,
    enable_chat: true,
    enable_join: true,
    enable_quit: true
};

let linkedAccounts = {}; // nickname (lower case) -> JID do WhatsApp
let pendingRequests = {}; // nickname (lower case) -> JID do WhatsApp

async function init() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (e) {}

    try {
        const settingsData = await fs.readFile(settingsFile, 'utf-8');
        settings = JSON.parse(settingsData);
    } catch (e) {
        await saveSettings();
    }

    try {
        const linkedData = await fs.readFile(linkedFile, 'utf-8');
        linkedAccounts = JSON.parse(linkedData);
    } catch (e) {
        await saveLinkedAccounts();
    }
}

async function saveSettings() {
    try {
        await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (e) {
        console.error('[minecraftManager] Erro ao salvar settings:', e);
    }
}

async function saveLinkedAccounts() {
    try {
        await fs.writeFile(linkedFile, JSON.stringify(linkedAccounts, null, 2), 'utf-8');
    } catch (e) {
        console.error('[minecraftManager] Erro ao salvar contas vinculadas:', e);
    }
}

function getChatGroupJid() {
    return settings.chat_group_jid;
}

async function setChatGroupJid(jid) {
    settings.chat_group_jid = jid;
    await saveSettings();
}

function addPendingRequest(nickname, jid) {
    pendingRequests[nickname.toLowerCase()] = jid;
}

function getPendingRequest(nickname) {
    return pendingRequests[nickname.toLowerCase()];
}

function removePendingRequest(nickname) {
    delete pendingRequests[nickname.toLowerCase()];
}

async function linkAccount(nickname, jid) {
    linkedAccounts[nickname.toLowerCase()] = jid;
    await saveLinkedAccounts();
}

function getLinkedJid(nickname) {
    return linkedAccounts[nickname.toLowerCase()];
}

function getLinkedNick(jid) {
    for (const [nick, linkedJid] of Object.entries(linkedAccounts)) {
        if (linkedJid === jid) {
            return nick;
        }
    }
    return null;
}

function isChatEnabled() {
    return settings.enable_chat !== false;
}

function isJoinEnabled() {
    return settings.enable_join !== false;
}

function isQuitEnabled() {
    return settings.enable_quit !== false;
}

async function updateConfig(key, value) {
    if (key === 'chat') {
        settings.enable_chat = value;
    } else if (key === 'join') {
        settings.enable_join = value;
    } else if (key === 'quit') {
        settings.enable_quit = value;
    } else {
        return false;
    }
    await saveSettings();
    return true;
}

function getConfig() {
    return {
        chat: isChatEnabled(),
        join: isJoinEnabled(),
        quit: isQuitEnabled()
    };
}

async function setUserTag(jid, tagName, tagColor) {
    if (!settings.tags) {
        settings.tags = {};
    }
    settings.tags[jid] = { name: tagName, color: tagColor || '&f' };
    await saveSettings();
}

async function removeUserTag(jid) {
    if (settings.tags && settings.tags[jid]) {
        delete settings.tags[jid];
        await saveSettings();
        return true;
    }
    return false;
}

function getUserTag(jid) {
    if (settings.tags && settings.tags[jid]) {
        return settings.tags[jid];
    }
    if (authManager.isSuperAdmin(jid)) {
        return { name: 'Admin', color: '&4' };
    }
    return null;
}

function getAllUserTags() {
    return settings.tags || {};
}

async function setTagPreset(name, color) {
    if (!settings.tag_presets) {
        settings.tag_presets = {};
    }
    settings.tag_presets[name] = { name, color: color || '&f' };
    await saveSettings();
}

async function removeTagPreset(name) {
    if (settings.tag_presets) {
        const key = Object.keys(settings.tag_presets).find(k => k.toLowerCase() === name.toLowerCase());
        if (key) {
            delete settings.tag_presets[key];
            await saveSettings();
            return true;
        }
    }
    return false;
}

function getTagPresets() {
    return settings.tag_presets || {};
}

async function assignTagPreset(jid, presetName) {
    if (!settings.tag_presets) return false;
    const key = Object.keys(settings.tag_presets).find(k => k.toLowerCase() === presetName.toLowerCase());
    if (!key) return false;
    const preset = settings.tag_presets[key];
    await setUserTag(jid, preset.name, preset.color);
    return preset;
}

module.exports = {
    init,
    getChatGroupJid,
    setChatGroupJid,
    addPendingRequest,
    getPendingRequest,
    removePendingRequest,
    linkAccount,
    getLinkedJid,
    getLinkedNick,
    isChatEnabled,
    isJoinEnabled,
    isQuitEnabled,
    updateConfig,
    getConfig,
    setUserTag,
    removeUserTag,
    getUserTag,
    getAllUserTags,
    setTagPreset,
    removeTagPreset,
    getTagPresets,
    assignTagPreset
};
