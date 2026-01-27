
const fs = require('fs').promises;
const path = require('path');

const PRESETS_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'userStickerPresets.json');
let presetsCache = {}; 


async function loadPresets() {
    try {
        await fs.mkdir(path.dirname(PRESETS_FILE_PATH), { recursive: true });
        const data = await fs.readFile(PRESETS_FILE_PATH, 'utf-8');
        presetsCache = JSON.parse(data);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            
            presetsCache = {};
        } else {
            console.error('[UserPreset] Erro ao carregar presets:', error);
        }
    }
}


async function savePresets() {
    try {
        await fs.writeFile(PRESETS_FILE_PATH, JSON.stringify(presetsCache, null, 2));
    } catch (error) {
        console.error('[UserPreset] Erro ao salvar presets:', error);
    }
}


function getPreset(chatId, userId) {
    return presetsCache[chatId]?.[userId] || {};
}


async function setPreset(chatId, userId, newSettings) {
    if (!presetsCache[chatId]) {
        presetsCache[chatId] = {};
    }
    if (!presetsCache[chatId][userId]) {
        presetsCache[chatId][userId] = {};
    }

    
    presetsCache[chatId][userId] = {
        ...presetsCache[chatId][userId],
        ...newSettings
    };

    await savePresets();
    console.log(`[UserPreset] Preset atualizado para ${userId} no chat ${chatId}`);
}


async function clearPreset(chatId, userId) {
    if (presetsCache[chatId]?.[userId]) {
        delete presetsCache[chatId][userId];
        await savePresets();
        console.log(`[UserPreset] Preset limpo para ${userId} no chat ${chatId}`);
        return true;
    }
    return false;
}

module.exports = {
    loadPresets,
    getPreset,
    setPreset,
    clearPreset
};
