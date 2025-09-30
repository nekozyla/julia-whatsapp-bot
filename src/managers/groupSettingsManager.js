// groupSettingsManager.js
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'groupSettings.json');
let settingsCache = {}; // Ex: { "groupId@g.us": { memeMode: 'on' } }

async function loadSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
        settingsCache = JSON.parse(data);
        console.log('[Settings] Configurações de grupo carregadas em cache.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Settings] Arquivo de configurações de grupo não encontrado, iniciando um novo.');
            settingsCache = {};
        } else {
            console.error('[Settings] Erro ao carregar configurações de grupo:', error);
        }
    }
}

async function saveSettings() {
    try {
        await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settingsCache, null, 2));
    } catch (error) {
        console.error('[Settings] Erro ao salvar configurações de grupo:', error);
    }
}

function getSetting(chatId, settingKey, defaultValue) {
    return settingsCache[chatId]?.[settingKey] ?? defaultValue;
}

async function setSetting(chatId, settingKey, value) {
    if (!settingsCache[chatId]) {
        settingsCache[chatId] = {};
    }
    settingsCache[chatId][settingKey] = value;
    await saveSettings();
    console.log(`[Settings] Configuração '${settingKey}' para o chat ${chatId} definida como: ${value}`);
}

/**
 * NOVA FUNÇÃO: Retorna todo o objeto de configurações.
 * Necessária para o fiscalScheduler encontrar os grupos ativos.
 * @returns {object} O cache completo das configurações.
 */
function getAllSettings() {
    return settingsCache;
}

module.exports = {
    loadSettings,
    getSetting,
    setSetting,
    getAllSettings // Exporta a nova função
};

