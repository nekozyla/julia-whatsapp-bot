// main.js (Versão com a estrutura de ficheiros atualizada)

const { makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs').promises;
const { readdirSync } = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

// --- CAMINHOS ATUALIZADOS ---
// Módulos de configuração
const config = require('../config/config.js');
const aliases = require('../config/aliases.js');

// Módulos de gestão (Managers)
const sessionManager = require('./managers/sessionManager.js');
const conversationalHandlers = require('./managers/messageHandlers.js');
const fiscalScheduler = require('./managers/fiscalScheduler.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const contactManager = require('./managers/contactManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');

// Módulos de utilidade
const { getTextFromMsg } = require('./utils/utils.js');

// Handlers de comandos especiais
let stickerCommandHandler; 
try {
    stickerCommandHandler = require('./commands/sticker.js');
} catch (e) {
    console.warn("[StickerMode] O comando 'sticker.js' não foi encontrado. O Modo Sticker não funcionará.");
    stickerCommandHandler = null;
}
const rankHandler = require('./commands/rank.js');

// --- CAMINHOS DE DADOS E AUTENTICAÇÃO ATUALIZADOS ---
const MESSAGE_STORE_PATH = path.join(__dirname, '..', 'data', 'message_store.json');
const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info'); // Aponta para a nova pasta de autenticação

let messageStore = {};

async function loadMessageStore() {
    try {
        const data = await fs.readFile(MESSAGE_STORE_PATH, 'utf-8');
        messageStore = JSON.parse(data);
        console.log('[Store] Armazenamento de mensagens persistente carregado.');
    } catch (e) {
        console.log('[Store] Arquivo de armazenamento de mensagens não encontrado, iniciando um novo.');
        messageStore = {};
    }
}

async function saveMessageStore() {
    try {
        await fs.writeFile(MESSAGE_STORE_PATH, JSON.stringify(messageStore, null, 2));
    } catch (e) {
        console.error('[Store] Falha ao salvar o armazenamento de mensagens:', e);
    }
}

function loadCommands() {
    const commandMap = {};
    // O caminho para a pasta de comandos agora parte de 'src'
    const commandDir = path.join(__dirname, 'commands');
    try {
        const commandFiles = readdirSync(commandDir).filter(file => file.endsWith('.js'));
        console.log(`[Comandos] Encontrados ${commandFiles.length} arquivos de comando...`);
        for (const file of commandFiles) {
            try {
                const commandName = `/${path.basename(file, '.js')}`;
                const handler = require(path.join(commandDir, file));
                if (typeof handler === 'function') {
                    commandMap[commandName] = handler;
                }
            } catch (error) { console.error(`[Comandos] Erro ao carregar ${file}:`, error); }
        }
        for (const alias in aliases) {
            if (commandMap[aliases[alias]]) {
                commandMap[alias] = commandMap[aliases[alias]];
            }
        }
    } catch (error) { console.error("[Comandos] Erro ao ler a pasta de comandos:", error); }
    return commandMap;
}

async function startJulia() {
    const commandMap = loadCommands();
    await loadMessageStore();
    authManager.loadAllowedContacts();
    authManager.loadAllowedGroups();
    rejectionManager.loadLog();
    
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

        if (msg.message?.protocolMessage?.type === 'REVOKE') {
            const groupJid = msg.key.remoteJid;
            const revealMode = settingsManager.getSetting(groupJid, 'revealDeletedMode', 'off');
            if (revealMode === 'on' && msg.key.participant) {
                const originalMsgId = msg.message.protocolMessage.key.id;
                const originalMsg = messageStore[originalMsgId];
                if (originalMsg) {
                    const senderName = originalMsg.pushName || 'Alguém';
                    try {
                        const responseText = `🤫 *${senderName}* apagou esta mensagem:`;
                        await sock.sendMessage(groupJid, { forward: originalMsg }, { caption: responseText, mentions: [originalMsg.key.participant] });
                    } catch (e) { console.error("[Modo Revelar] Erro ao reenviar mensagem:", e); }
                }
            }
            return;
        }
        
        if (msg.message) {
            messageStore[msg.key.id] = msg;
            await saveMessageStore();
            setTimeout(async () => {
                if (messageStore[msg.key.id]) {
                    delete messageStore[msg.key.id];
                    await saveMessageStore();
                }
            }, 3600 * 1000);
        }

        if (!msg.message || msg.key.fromMe) return;

        try {
            const senderJid = msg.key.remoteJid;
            const authorJid = msg.key.participant || senderJid;
            const isGroup = senderJid.endsWith('@g.us');
            
            const isAuthorSuperAdmin = config.ADMIN_JIDS.includes(authorJid);

            if (!isAuthorSuperAdmin) {
                if (!authManager.isGroupAllowed(senderJid) && !authManager.isContactAllowed(authorJid)) {
                    if (rejectionManager.shouldSendRejection(authorJid)) {
                        const rejectionMessage = `Olá! Sou a Julia. 😊\n\nNotei que você tentou interagir comigo, mas só tenho permissão para funcionar em grupos autorizados ou no meu canal de novidades.\n\n🔗 *Entre no nosso grupo principal para conversar e usar todos os meus comandos:*\nhttps://chat.whatsapp.com/G6yvFKyWglbCcCLZxRPPHw\n\n📢 *Siga meu canal para ficar por dentro das atualizações:*\nhttps://whatsapp.com/channel/0029Vb6C238CxoAwXrkEXe1E\n\nTe vejo lá! 😉`;
                        await sock.sendMessage(authorJid, { text: rejectionMessage });
                        rejectionManager.recordRejectionSent(authorJid);
                    }
                    return;
                }
            }
            
            const isRankingOn = settingsManager.getSetting(senderJid, 'rankingMode', 'off');
            if (isGroup && isRankingOn === 'on') {
                rankHandler.incrementCount(senderJid, authorJid);
            }
            
            let textContent = getTextFromMsg(msg.message);
            const pushName = msg.pushName || 'alguém';
            const messageType = getContentType(msg.message);

            if (systemStateManager.isMaintenanceMode() && !isAuthorSuperAdmin) return;
            
            if (isGroup && textContent) {
                const tomatoMode = settingsManager.getSetting(senderJid, 'tomatoMode', 'on');
                if (tomatoMode === 'on' && profanityManager.analyzeMessage(textContent)) {
                    sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => {});
                }
            }
            
            if (isGroup) {
                const isChatRestricted = settingsManager.getSetting(senderJid, 'chatRestricted', 'off');
                if (isChatRestricted === 'on' && textContent && !textContent.startsWith('/')) {
                    const alertMessage = `Este grupo é apenas para comandos. 🤫\n\nPara conversar, por favor, entre no nosso grupo de bate-papo:\nhttps://chat.whatsapp.com/Kls65TTEI67Jv8Xv6lpFjL`;
                    await sock.sendMessage(senderJid, { text: alertMessage });
                    return;
                }
            }
            
            let commandToRun = null;
            if (textContent?.startsWith('/')) {
                const commandKey = textContent.split(' ')[0].toLowerCase();
                if (commandMap[commandKey]) {
                    commandToRun = commandKey;
                }
            }
            
            const msgDetails = { 
                sender: senderJid, pushName, command: commandToRun, commandText: textContent, 
                messageType: messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage, 
                commandSenderJid: authorJid, 
                isSuperAdmin: isAuthorSuperAdmin 
            };

            if (commandToRun) {
                if (isGroup) {
                    const restrictedCommands = settingsManager.getSetting(senderJid, 'restrictedCommands', []);
                    if (restrictedCommands.includes(commandToRun) && !isAuthorSuperAdmin) {
                        await sock.sendMessage(senderJid, { text: `🚫 O uso do comando \`${commandToRun}\` foi desativado neste grupo.` }, { quoted: msg });
                        return;
                    }
                }
                await commandMap[commandToRun](sock, msg, msgDetails);
                return;
            }
            
            const stickerMode = settingsManager.getSetting(senderJid, 'stickerMode', 'off');
            if (stickerMode === 'on' && stickerCommandHandler && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
                console.log(`[Modo Sticker] Convertendo mídia automaticamente no chat: ${senderJid}`);
                const stickerMsgDetails = { ...msgDetails, command: '/sticker', commandText: '/sticker' };
                await stickerCommandHandler(sock, msg, stickerMsgDetails);
                return; 
            }
            
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isReplyingToBot = msg.message.extendedTextMessage?.contextInfo?.participant === botJid;
            let juliaShouldRespond = !isGroup || mentions.includes(botJid) || isReplyingToBot;
            
            const aiMode = settingsManager.getSetting(senderJid, 'aiMode', 'on');
            if (juliaShouldRespond && aiMode !== 'on') return;
            
            if (juliaShouldRespond) {
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
        if (qr) {
            console.log('📲 Escaneie o QR code abaixo para conectar:\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Julia conectada ao WhatsApp!');
            fiscalScheduler.initializeFiscalScheduler(sock);
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (reason !== DisconnectReason.loggedOut);
            if (shouldReconnect) {
                startJulia();
            }
        }
    });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});
