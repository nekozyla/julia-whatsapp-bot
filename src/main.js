// main.js (Versão com Encerramento Seguro e PM2 em mente)

const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const { initializeModules, loadCommands } = require('./loader.js');
const { processMessage } = require('./messageHandler.js');

const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', 'data', 'bot_jid_cache.json');
let botJidCache = {};
let sock; // << TORNAR O SOCKET ACESSÍVEL GLOBALMENTE NESTE FICHEIRO

async function startJulia() {
    await initializeModules();
    const commandMap = loadCommands();
    
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        botJidCache = JSON.parse(data);
    } catch (e) {
        console.log('[Main] Arquivo de cache de JIDs não encontrado, iniciando um novo.');
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FILE_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({ // << ATRIBUI À VARIÁVEL GLOBAL
        version,
        auth: state,
        logger: pino({ level: 'error' }), 
        browser: ['Julia Bot', 'Chrome', '20.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        await processMessage(sock, messages[0], commandMap, botJidCache);
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        
        if (connection === 'open') {
            console.log('✅ Julia conectada ao WhatsApp!');
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(`Conexão fechada pelo motivo ${reason}, a reconectar...`);
                startJulia();
            } else {
                console.error('[FATAL] Desconectado permanentemente (loggedOut). Apague a pasta auth_info e escaneie o QR Code novamente.');
            }
        }
    });
}

startJulia().catch(err => console.error("Erro fatal ao iniciar Julia:", err));

// --- LÓGICA DE ENCERRAMENTO SEGURO ---
const cleanup = () => {
    console.log('A encerrar o bot de forma segura...');
    if (sock) {
        sock.end(new Error('Processo de encerramento iniciado.'));
    }
    // Damos um pequeno tempo para o socket fechar antes de sair
    setTimeout(() => {
        console.log('Bot encerrado.');
        process.exit(0);
    }, 1000); 
};

// Ouve os sinais de término do processo
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
