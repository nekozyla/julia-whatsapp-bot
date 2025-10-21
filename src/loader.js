// src/loader.js

const sessionManager = require('./managers/sessionManager.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const contactManager = require('./managers/contactManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const { readdirSync } = require('fs');
const path = require('path');
const aliases = require('../config/aliases.js');

/**
 * Carrega todos os módulos e gestores necessários para o bot.
 */
async function initializeModules() {
    console.log('[Loader] A iniciar o carregamento de todos os módulos...');
    await authManager.loadAllowedContacts();
    await authManager.loadAllowedGroups();
    await rejectionManager.loadLog();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    await systemStateManager.loadState();
    await profanityManager.loadProfanityList();
    console.log('[Loader] Todos os módulos foram carregados com sucesso.');
}

/**
 * Carrega todos os ficheiros de comando da pasta /commands.
 * @returns {Map<string, function>} Um mapa com os comandos e as suas funções.
 */
function loadCommands() {
    const commandMap = new Map();
    const commandDir = path.join(__dirname, 'commands');
    try {
        const commandFiles = readdirSync(commandDir).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const commandName = `/${path.basename(file, '.js')}`;
            const commandModule = require(path.join(commandDir, file));
            commandMap.set(commandName, commandModule);
        }
        // Aplica os apelidos (aliases)
        for (const alias in aliases) {
            if (commandMap.has(aliases[alias])) {
                commandMap.set(alias, commandMap.get(aliases[alias]));
            }
        }
        console.log(`[Loader] ${commandMap.size} comandos e apelidos foram carregados.`);
    } catch (error) {
        console.error("[Loader] Erro ao ler a pasta de comandos:", error);
    }
    return commandMap;
}

module.exports = { initializeModules, loadCommands };

