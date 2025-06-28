// groupSettingsManager.js
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE_PATH = path.join(__dirname, 'groupSettings.json');
let settingsCache = {}; // Cache em memória para acesso rápido

// Carrega as configurações do arquivo JSON quando o bot inicia
async function loadSettings() {
    try {
        const data = await fs.readFile(SETTINGS_FILE_PATH, 'utf-8');
        settingsCache = JSON.parse(data);
        console.log('[Settings] Configurações de grupo carregadas em cache.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Settings] Arquivo de configurações não encontrado, iniciando um novo.');
            settingsCache = {};
        } else {
            console.error('[Settings] Erro ao carregar configurações:', error);
        }
    }
}

// Salva o cache de volta no arquivo JSON
async function saveSettings() {
    try {
        await fs.writeFile(SETTINGS_FILE_PATH, JSON.stringify(settingsCache, null, 2));
    } catch (error) {
        console.error('[Settings] Erro ao salvar configurações:', error);
    }
}

// Função genérica para pegar uma configuração de um chat
function getSetting(chatId, settingKey, defaultValue) {
    return settingsCache[chatId]?.[settingKey] || defaultValue;
}

// Função genérica para definir uma configuração para um chat
async function setSetting(chatId, settingKey, value) {
    if (!settingsCache[chatId]) {
        settingsCache[chatId] = {};
    }
    settingsCache[chatId][settingKey] = value;
    await saveSettings();
    console.log(`[Settings] Configuração '${settingKey}' para o chat ${chatId} definida como: ${value}`);
}

module.exports = {
    loadSettings,
    getSetting,
    setSetting
};
