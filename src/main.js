// main.js (Versão final corrigida)

const { makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs').promises;
const { readdirSync } = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// --- Módulos ---
const config = require('../config/config.js');
const aliases = require('../config/aliases.js');
const sessionManager = require('./managers/sessionManager.js');
const conversationalHandlers = require('./managers/messageHandlers.js');
const fiscalScheduler = require('./managers/fiscalScheduler.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const contactManager = require('./managers/contactManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const { getTextFromMsg } = require('./utils/utils.js');
// A importação específica do syncManager foi removida, pois não é mais necessária.
let stickerCommandHandler = null;
try {
    stickerCommandHandler = require('./commands/sticker.js');
} catch (e) {
    console.warn("[StickerMode] O comando 'sticker.js' não foi encontrado.");
}
const rankHandler = require('./commands/rank.js');

// --- Caminhos e Variáveis Globais ---
const MESSAGE_STORE_PATH = path.join(__dirname, '..', 'data', 'message_store.json');
const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', 'data', 'bot_jid_cache.json');

let messageStore = {};
let botJidCache = {}; // Cache para armazenar o JID do bot por grupo

async function loadData() {
    // Carrega cache de JIDs
    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        botJidCache = JSON.parse(data);
        console.log('[Identidade] Cache de JIDs do bot carregado.');
    } catch (e) {
        console.log('[Identidade] Arquivo de cache de JIDs não encontrado, iniciando um novo.');
        botJidCache = {};
    }
    // Carrega message store
    try {
        const data = await fs.readFile(MESSAGE_STORE_PATH, 'utf-8');
        messageStore = JSON.parse(data);
        console.log('[Store] Armazenamento de mensagens persistente carregado.');
    } catch (e) {
        console.log('[Store] Arquivo de armazenamento de mensagens não encontrado, iniciando um novo.');
    }
}

async function saveData(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[Store] Falha ao salvar o arquivo ${path.basename(filePath)}:`, e);
    }
}

function loadCommands() {
    const commandMap = {};
    const commandDir = path.join(__dirname, 'commands');
    try {
        const commandFiles = readdirSync(commandDir).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            try {
                const commandName = `/${path.basename(file, '.js')}`;
                const commandModule = require(path.join(commandDir, file));
                commandMap[commandName] = commandModule;

            } catch (error) { console.error(`[Comandos] Erro ao carregar ${file}:`, error); }
        }
        for (const alias in aliases) {
            if (commandMap[aliases[alias]]) commandMap[alias] = commandMap[aliases[alias]];
        }
    } catch (error) { console.error("[Comandos] Erro ao ler a pasta de comandos:", error); }
    return commandMap;
}

async function startJulia() {
    const commandMap = loadCommands();
    await loadData();
    await authManager.loadAllowedContacts();
    await authManager.loadAllowedGroups();
    await rejectionManager.loadLog();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    await systemStateManager.loadState();
    await profanityManager.loadProfanityList();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FILE_PATH);
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'warn' }), browser: ['Julia Bot', 'Chrome', '20.0.0'] });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        if (msg.message) {
            messageStore[msg.key.id] = msg;
            await saveData(MESSAGE_STORE_PATH, messageStore);
        }
        
        if (!msg.message || msg.key.fromMe) return;

        try {
            const senderJid = msg.key.remoteJid;
            const authorJid = msg.key.participant || senderJid;
            const isGroup = senderJid.endsWith('@g.us');
            
            // --- BLOCO DA LÓGICA DE SINCRONIZAÇÃO INTERATIVA FOI REMOVIDO DAQUI ---
            // A lógica agora está 100% dentro do comando /sync

            const isAuthorSuperAdmin = config.ADMIN_JIDS.includes(authorJid);
            const pushName = msg.pushName || 'alguém';
            const messageType = getContentType(msg.message);
            let textContent = getTextFromMsg(msg.message);

            if (!isAuthorSuperAdmin && !authManager.isGroupAllowed(senderJid) && !authManager.isContactAllowed(authorJid)) {
                 if (rejectionManager.shouldSendRejection(authorJid)) {
                    const rejectionMessage = `Olá! Sou a Julia. 😊\n\nNotei que você tentou interagir comigo, mas só tenho permissão para funcionar em grupos autorizados ou no meu canal de novidades.\n\n🔗 *Entre no nosso grupo principal para conversar e usar todos os meus comandos:*\nhttps://chat.whatsapp.com/G6yvFKyWglbCcCLZxRPPHw\n\n📢 *Siga meu canal para ficar por dentro das atualizações:*\nhttps://whatsapp.com/channel/0029Vb6C238CxoAwXrkEXe1E\n\nTe vejo lá! 😉`;
                    await sock.sendMessage(authorJid, { text: rejectionMessage });
                    rejectionManager.recordRejectionSent(authorJid);
                }
                return;
            }

            if (isGroup && settingsManager.getSetting(senderJid, 'rankingMode', 'on') === 'on') {
                rankHandler.incrementCount(senderJid, authorJid);
            }
            
            if (systemStateManager.isMaintenanceMode() && !isAuthorSuperAdmin) return;
            
            if (isGroup && textContent && settingsManager.getSetting(senderJid, 'tomatoMode', 'on') === 'on') {
                if (profanityManager.analyzeMessage(textContent)) sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => {});
            }

            let commandToRun = null;
            if (textContent?.startsWith('/')) {
                const commandKey = textContent.split(' ')[0].toLowerCase();
                if (commandMap[commandKey]) commandToRun = commandKey;
            }

            const msgDetails = {
                sender: senderJid, pushName, command: commandToRun, commandText: textContent,
                messageType: messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage,
                commandSenderJid: authorJid, isSuperAdmin: isAuthorSuperAdmin
            };

            if (commandToRun) {
                await commandMap[commandToRun](sock, msg, msgDetails);
                return;
            }
            
            if (stickerCommandHandler && settingsManager.getSetting(senderJid, 'stickerMode', 'on') === 'on' && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
                 const stickerMsgDetails = { ...msgDetails, command: '/sticker', commandText: '/sticker' };
                 await stickerCommandHandler(sock, msg, stickerMsgDetails);
                 return;
            }
            
            // LÓGICA DE VERIFICAÇÃO DE MENÇÃO USANDO O CACHE
            let juliaShouldRespond = false;
            if (isGroup) {
                const botJidInThisGroup = botJidCache[senderJid];
                if (botJidInThisGroup) {
                    const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (mentions.includes(botJidInThisGroup) || quotedParticipant === botJidInThisGroup) {
                        juliaShouldRespond = true;
                    }
                }
            } else {
                juliaShouldRespond = true; // Sempre responde em chat privado
            }

            if (juliaShouldRespond && settingsManager.getSetting(senderJid, 'aiMode', 'on') === 'on') {
                const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
                await sock.sendPresenceUpdate('composing', senderJid);
                const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, messageType: getContentType(msg.message) };
                await conversationalHandlers.handleAnyMessage(sock, msg, chatSession, msgDetailsForHandler, sessionManager, commandMap);
            }

        } catch (error) {
            console.error("[Erro Final] A ação falhou:", error);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') {
            console.log('✅ Julia conectada ao WhatsApp!');
            fiscalScheduler.initializeFiscalScheduler(sock);
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startJulia();
        }
    });
}

startJulia().catch(err => console.error("Erro fatal ao iniciar Julia:", err));
