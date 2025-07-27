// main.js (MODO DE DIAGNÓSTICO)

// Importa a biblioteca inteira primeiro para podermos inspecioná-la
const baileys = require('@whiskeysockets/baileys');
const { makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = baileys;

// --- DIAGNÓSTICO ---
// Vamos verificar o que a biblioteca Baileys está realmente a exportar no seu ambiente.
console.log('[Diagnóstico] Funções disponíveis na biblioteca Baileys:', Object.keys(baileys));

// Verifica se a função 'makeInMemoryStore' existe. Se não, o bot não pode continuar.
if (typeof baileys.makeInMemoryStore !== 'function') {
    console.error('-------------------------------------------------------------------');
    console.error('[ERRO CRÍTICO] A função "makeInMemoryStore" não foi encontrada na biblioteca Baileys.');
    console.error('Isto indica um problema grave na sua instalação do node_modules ou uma incompatibilidade de versão.');
    console.error('Por favor, envie este log de erro completo para obter ajuda.');
    console.error('-------------------------------------------------------------------');
    process.exit(1); // Para a execução para evitar mais erros.
}
// --- FIM DO DIAGNÓSTICO ---

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Módulos locais
const config = require('./config');
const sessionManager = require('./sessionManager');
const conversationalHandlers = require('./messageHandlers');
const scheduler = require('./scheduler');
const { getTextFromMsg } = require('./utils');
const settingsManager = require('./groupSettingsManager');
const contactManager = require('./contactManager');
const strikeManager = require('./strikeManager');
const agreementManager = require('./agreementManager');

const processedMessages = new Set();
const imageSpamTracker = new Map();
const STRIKE_IMAGE_COUNT = 10;
const STRIKE_TIME_WINDOW_MS = 10 * 1000;

const store = baileys.makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

function loadCommands() {
    const commandMap = {};
    const commandDir = path.join(__dirname, 'commands');
    try {
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));
        console.log(`[Comandos] Encontrados ${commandFiles.length} arquivos de comando...`);
        for (const file of commandFiles) {
            try {
                const commandName = `!${path.basename(file, '.js')}`;
                const handler = require(path.join(commandDir, file));
                if (typeof handler === 'function') {
                    commandMap[commandName] = handler;
                }
            } catch (error) {
                console.error(`[Comandos] Erro ao carregar o comando do arquivo ${file}:`, error);
            }
        }
    } catch (error) {
        console.error("[Comandos] Erro ao ler a pasta de comandos:", error);
    }

    try {
        const aliases = require('./aliases.js');
        let aliasCount = 0;
        for (const alias in aliases) {
            const originalCommand = aliases[alias];
            if (commandMap[originalCommand]) {
                commandMap[alias] = commandMap[originalCommand];
                aliasCount++;
            }
        }
        console.log(`[Alias] ${aliasCount} apelidos carregados com sucesso.`);
    } catch (error) {
        console.log("[Alias] Arquivo de apelidos (aliases.js) não encontrado.");
    }
    
    return commandMap;
}

let schedulerIntervalId = null; 

async function startJulia() {
    const commandMap = loadCommands();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    await agreementManager.loadAgreements();
    
    const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FILE_PATH);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
        browser: ['Julia Bot', 'Chrome', '20.0.0'],
        getMessage: async key => {
            return (store.get(key.remoteJid)?.messages?.[key.id] || {}).message;
        }
    });

    store.bind(sock.ev);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        // ... (o resto do seu código de messages.upsert continua aqui)
    });

    sock.ev.on('connection.update', (update) => {
        // ... (o resto do seu código de connection.update continua aqui)
    });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});
