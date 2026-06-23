

const settingsManager = require('./managers/groupSettingsManager.js');
const contactManager = require('./managers/contactManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const userPresetManager = require('./managers/userPresetManager.js');
const anuncioManager = require('./managers/anuncioManager.js');
const chatLogManager = require('./managers/chatLogManager.js');
const rentalManager = require('./managers/rentalManager.js');
const rentalCheckoutManager = require('./managers/rentalCheckoutManager.js');
const ticketManager = require('./managers/ticketManager.js');
const viewOnceManager = require('./managers/viewOnceManager.js');
const { readdirSync, watch } = require('fs');
const path = require('path');


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
    await anuncioManager.loadBlacklist();
    await chatLogManager.loadState();
    await rentalManager.loadState();
    await rentalCheckoutManager.loadState();
    await ticketManager.loadAll();
    await viewOnceManager.loadStore();

}


function loadCommands() {
    const commandMap = new Map();
    const commandDir = path.join(__dirname, 'commands');
    const aiCommandDir = path.join(commandDir, 'ai');


    try {
        const commandFiles = readdirSync(commandDir).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const commandName = `/${path.basename(file, '.js')}`;
            try {
                const fullPath = path.join(commandDir, file);

                try { delete require.cache[require.resolve(fullPath)]; } catch (e) { }
                const commandModule = require(fullPath);
                commandMap.set(commandName, commandModule);
            } catch (err) {
                console.error(`[Loader] ERRO CRÍTICO ao carregar ${file}:`, err.message);
            }
        }

        // Carregar comandos IA da pasta ai/ (sandboxed)
        try {
            const { createSandboxedHandler } = require('./managers/commandSandbox.js');
            const aiFiles = readdirSync(aiCommandDir).filter(file => file.endsWith('.js'));
            for (const file of aiFiles) {
                const commandName = `/${path.basename(file, '.js')}`;
                try {
                    const fullPath = path.join(aiCommandDir, file);
                    const handler = createSandboxedHandler(fullPath);
                    if (handler) {
                        commandMap.set(commandName, handler);
                        console.log(`[Loader] Comando IA carregado (sandbox): ${commandName}`);
                    } else {
                        console.error(`[Loader] Comando IA rejeitado pelo sandbox: ${file}`);
                    }
                } catch (err) {
                    console.error(`[Loader] ERRO ao carregar comando IA ${file}:`, err.message);
                }
            }
        } catch (e) {
            // Pasta ai/ pode não existir ainda
        }



        // Carregar aliases declarados nos próprios arquivos de comando
        for (const [cmdName, cmdModule] of commandMap) {
            if (cmdModule.commandData && cmdModule.commandData.aliases && Array.isArray(cmdModule.commandData.aliases)) {
                for (const alias of cmdModule.commandData.aliases) {
                    const normalizedAlias = alias.startsWith('/') ? alias : `/${alias}`;
                    if (!commandMap.has(normalizedAlias)) {
                        commandMap.set(normalizedAlias, cmdModule);
                    }
                }
            }
        }

    } catch (error) {
        console.error("[Loader] Erro ao ler a pasta de comandos:", error);
    }
    return commandMap;
}


function watchCommands(onChange) {
    const commandDir = path.join(__dirname, 'commands');
    const aiCommandDir = path.join(commandDir, 'ai');
    let reloadTimer = null;

    const reloadFn = (filename) => {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
            console.log(`[Loader] Alteração detectada em comandos (${filename}). A recarregar...`);
            const newMap = loadCommands();
            try { onChange(newMap); } catch (err) { console.error('[Loader] onChange error:', err); }
        }, 300);
    };

    try {
        const watcher = watch(commandDir, { persistent: true }, (eventType, filename) => {
            if (!filename || !filename.endsWith('.js')) return;
            reloadFn(filename);
        });
        watcher.on('error', (err) => console.error('[Loader] Watcher error:', err));

        // Watcher para pasta de comandos IA
        try {
            const { mkdirSync } = require('fs');
            try { mkdirSync(aiCommandDir, { recursive: true }); } catch (e) { }
            const aiWatcher = watch(aiCommandDir, { persistent: true }, (eventType, filename) => {
                if (!filename || !filename.endsWith('.js')) return;
                reloadFn(`ai/${filename}`);
            });
            aiWatcher.on('error', (err) => console.error('[Loader] AI Watcher error:', err));
        } catch (e) {
            console.warn('[Loader] Não foi possível iniciar watcher de comandos IA.');
        }

        return watcher;
    } catch (err) {
        console.error('[Loader] Não foi possível iniciar watcher de comandos:', err);
        return null;
    }
}

module.exports = { initializeModules, loadCommands };
