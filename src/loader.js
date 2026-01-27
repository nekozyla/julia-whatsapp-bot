

const settingsManager = require('./managers/groupSettingsManager.js');
const contactManager = require('./managers/contactManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const userPresetManager = require('./managers/userPresetManager.js');
const { readdirSync, watch } = require('fs');
const path = require('path');
const aliases = require('../config/aliases.js');


async function initializeModules() {
    
    await authManager.loadAllowedContacts();
    await authManager.loadAllowedGroups();
    await rejectionManager.loadLog();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await contactManager.loadNicknames();
    await systemStateManager.loadState();
    await profanityManager.loadProfanityList();
    await userPresetManager.loadPresets();
    
}


function loadCommands() {
    const commandMap = new Map();
    const commandDir = path.join(__dirname, 'commands');

    
    try {
        const commandFiles = readdirSync(commandDir).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const commandName = `/${path.basename(file, '.js')}`;
            try {
                const fullPath = path.join(commandDir, file);
                
                try { delete require.cache[require.resolve(fullPath)]; } catch (e) {  }
                const commandModule = require(fullPath);
                commandMap.set(commandName, commandModule);
            } catch (err) {
                console.error(`[Loader] ERRO CRÍTICO ao carregar ${file}:`, err.message);
            }
        }

        

        
        
        for (const alias in aliases) {
            const targetCmd = aliases[alias];

            
            if (commandMap.has(targetCmd)) {
                commandMap.set(alias, commandMap.get(targetCmd));
                
                if (['/familia', '/aceitaradocao', '/adotar'].includes(alias) || targetCmd === '/adotar') {
                    
                }
            } else {
                console.warn(`[Alias FALHA] O apelido '${alias}' tenta apontar para '${targetCmd}', mas '${targetCmd}' NÃO EXISTE ou não foi carregado!`);
            }
        }
        

        
    } catch (error) {
        console.error("[Loader] Erro ao ler a pasta de comandos:", error);
    }
    return commandMap;
}


function watchCommands(onChange) {
    const commandDir = path.join(__dirname, 'commands');
    let reloadTimer = null;

    try {
        const watcher = watch(commandDir, { persistent: true }, (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;

            
            if (reloadTimer) clearTimeout(reloadTimer);
            reloadTimer = setTimeout(() => {
                console.log(`[Loader] Alteração detectada em comandos (${filename}). A recarregar...`);
                const newMap = loadCommands();
                try { onChange(newMap); } catch (err) { console.error('[Loader] onChange error:', err); }
            }, 300);
        });

        watcher.on('error', (err) => console.error('[Loader] Watcher error:', err));
        return watcher;
    } catch (err) {
        console.error('[Loader] Não foi possível iniciar watcher de comandos:', err);
        return null;
    }
}

module.exports = { initializeModules, loadCommands };
