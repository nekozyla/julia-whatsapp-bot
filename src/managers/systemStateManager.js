
const fs = require('fs').promises;
const path = require('path');

const STATE_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'systemState.json');
let stateCache = {
    maintenanceMode: false,
    pvAllowedForEveryone: false,
    aiProvider: 'groq',
    customPersonality: null,
    customModels: {}
};

async function loadState() {
    try {
        const data = await fs.readFile(STATE_FILE_PATH, 'utf-8');
        stateCache = JSON.parse(data);
        if (!stateCache.customModels) stateCache.customModels = {};
    } catch (error) {
        if (error.code === 'ENOENT') {

            await saveState();
        } else {
            console.error('[System State] Erro ao carregar estado:', error);
        }
    }
}

async function saveState() {
    try {
        await fs.writeFile(STATE_FILE_PATH, JSON.stringify(stateCache, null, 2));
    } catch (error) {
        console.error('[System State] Erro ao salvar estado:', error);
    }
}

function isMaintenanceMode() {
    return stateCache.maintenanceMode === true;
}

async function setMaintenanceMode(isActive) {
    stateCache.maintenanceMode = isActive;
    await saveState();
    console.log(`[System State] Modo de Manutenção definido como: ${isActive}`);
}

module.exports = {
    loadState,
    isMaintenanceMode,
    setMaintenanceMode,
    isPvAllowedForEveryone: () => stateCache.pvAllowedForEveryone === true,
    setPvAllowedForEveryone: async (isActive) => {
        stateCache.pvAllowedForEveryone = isActive;
        await saveState();
        console.log(`[System State] PV liberado para todos: ${isActive}`);
    },
    getAiProvider: () => stateCache.aiProvider || 'groq',
    setAiProvider: async (provider) => {
        if (!['groq', 'gemini', 'openai', 'openrouter'].includes(provider)) return false;
        stateCache.aiProvider = provider;
        await saveState();
        return true;
    },
    getCustomPersonality: () => stateCache.customPersonality || null,
    setCustomPersonality: async (text) => {
        stateCache.customPersonality = text;
        await saveState();
        return true;
    },
    getCustomModel: (provider) => stateCache.customModels[provider] || null,
    setCustomModel: async (provider, modelName) => {
        if (!modelName) {
            delete stateCache.customModels[provider];
        } else {
            stateCache.customModels[provider] = modelName;
        }
        await saveState();
        return true;
    }
};

