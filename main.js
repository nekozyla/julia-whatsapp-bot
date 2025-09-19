// main.js (Versão final com múltiplos admins e aviso para não autorizados)

const { makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Módulos locais
const config = require('./config');
const sessionManager = require('./sessionManager');
const conversationalHandlers = require('./messageHandlers');
const fiscalScheduler = require('./fiscalScheduler');
const { getTextFromMsg } = require('./utils');
const settingsManager = require('./groupSettingsManager');
const contactManager = require('./contactManager');
const authManager = require('./authManager');
const systemStateManager = require('./systemStateManager');
const profanityManager = require('./profanityManager');
const rejectionManager = require('./rejectionManager');

const processedMessages = new Set();

function loadCommands() {
    const commandMap = {};
    const commandDir = path.join(__dirname, 'commands');
    try {
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));
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
    } catch (error) { console.error("[Comandos] Erro ao ler a pasta de comandos:", error); }
    try {
        const aliases = require('./aliases.js');
        for (const alias in aliases) {
            if (commandMap[aliases[alias]]) {
                commandMap[alias] = commandMap[aliases[alias]];
            }
        }
    } catch (error) { console.log("[Alias] aliases.js não encontrado."); }
    return commandMap;
}

async function startJulia() {
    const commandMap = loadCommands();
    authManager.loadAllowedContacts();
    authManager.loadAllowedGroups();
    rejectionManager.loadLog();
    
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    await systemStateManager.loadState();
    await profanityManager.loadProfanityList();
    
    const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FILE_PATH);
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'warn' }), browser: ['Julia Bot', 'Chrome', '20.0.0'] });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        try {
            const senderJid = msg.key.remoteJid;
            const authorJid = msg.key.participant || senderJid;
            const isGroup = senderJid.endsWith('@g.us');
            
            const isAllowedGroup = isGroup && authManager.isGroupAllowed(senderJid);
            const isAllowedContact = authManager.isContactAllowed(authorJid);

            if (!isAllowedGroup && !isAllowedContact) {
                if (!isGroup) {
                    if (rejectionManager.shouldSendRejection(authorJid)) {
                        const rejectionMessage = "Olá! Devido a um grande número de banimentos, a Julia agora opera exclusivamente no nosso grupo oficial para garantir a segurança e a qualidade do serviço. Por favor, junte-se a nós para continuar a usar todas as funcionalidades!\n\n🔗 Link do Grupo: https://chat.whatsapp.com/Kls65TTEI67Jv8Xv6lpFjL?mode=ems_copy_t";
                        
                        await sock.sendMessage(authorJid, { text: rejectionMessage });
                        rejectionManager.recordRejectionSent(authorJid);
                        console.log(`[RejectionManager] Aviso de acesso restrito enviado para ${authorJid}.`);
                    }
                }
                return;
            }

            let textContent = getTextFromMsg(msg.message);
            const pushName = msg.pushName || 'alguém';

            // ATUALIZADO: Verifica se o autor está na lista de admins
            if (systemStateManager.isMaintenanceMode() && !config.ADMIN_JIDS.includes(authorJid)) {
                return;
            }
            
            if (isGroup && textContent) {
                const tomatoMode = settingsManager.getSetting(senderJid, 'tomatoMode', 'on');
                if (tomatoMode === 'on') {
                    const isProblematic = profanityManager.analyzeMessage(textContent);
                    if (isProblematic) {
                        sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => {});
                    }
                }
            }

            if (isGroup) {
                const memeMode = settingsManager.getSetting(senderJid, 'memeMode', 'off');
                if (memeMode === 'on' && !textContent?.startsWith('/')) {
                    const { memeEmojis } = require('./commands/modomeme.js');
                    const randomEmoji = memeEmojis[Math.floor(Math.random() * memeEmojis.length)];
                    sock.sendMessage(senderJid, { react: { text: randomEmoji, key: msg.key } }).catch(e => {});
                }
            }
            
            const msgId = msg.key.id;
            if (processedMessages.has(msgId)) return;
            processedMessages.add(msgId);
            setTimeout(() => { processedMessages.delete(msgId); }, 2 * 60 * 1000);

            const messageType = getContentType(msg.message);
            
            await contactManager.addContact(senderJid);
            
            if (!isGroup && (messageType === 'imageMessage' || messageType === 'videoMessage') && !textContent?.startsWith('/')) {
                const stickerMode = settingsManager.getSetting(senderJid, 'stickerMode', 'on');
                if (stickerMode === 'on') {
                    const stickerHandler = commandMap['/sticker'];
                    if (typeof stickerHandler === 'function') {
                        await stickerHandler(sock, msg, {
                            sender: senderJid, pushName, command: '/sticker', commandText: '/sticker',
                            messageType, isGroup, quotedMsgInfo: null, commandSenderJid: senderJid
                        });
                    }
                    return;
                }
            }

            let commandToRun = null;
            if (textContent?.startsWith('/')) {
                const spacelessInput = textContent.substring(0, 30).replace(/\s+/g, '').toLowerCase();
                const sortedCommands = Object.keys(commandMap).sort((a, b) => b.length - a.length);
                for (const cmdKey of sortedCommands) {
                    if (spacelessInput.startsWith(cmdKey)) {
                        commandToRun = cmdKey;
                        break;
                    }
                }
            }

            if (commandToRun) {
                console.log(`[Comando] Roteando para o handler: ${commandToRun}`);
                const msgDetails = { 
                    sender: senderJid, pushName, command: commandToRun, commandText: textContent, 
                    messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage, 
                    commandSenderJid: authorJid, 
                    // ATUALIZADO: Verifica se o autor está na lista de admins
                    isSuperAdmin: config.ADMIN_JIDS.includes(authorJid) 
                };
                await commandMap[commandToRun](sock, msg, msgDetails);
                return;
            }
            
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const contextInfo = msg.message.extendedTextMessage?.contextInfo;
            const mentions = contextInfo?.mentionedJid || [];
            const isReplyingToBot = contextInfo?.participant === botJid;
            
            let juliaShouldRespond = !isGroup || mentions.includes(botJid) || isReplyingToBot;
            const aiMode = settingsManager.getSetting(senderJid, 'aiMode', 'off');

            if (juliaShouldRespond && aiMode !== 'on') {
                if (!isGroup) {
                    await sock.sendMessage(senderJid, { text: "Minha inteligência artificial está desativada. Use `/help` para ver a lista de comandos ou `/ia on` para conversar com a IA." }, { quoted: msg });
                }
                return;
            }
            
            if (!juliaShouldRespond) return;
            
            const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
            await sock.sendPresenceUpdate('composing', senderJid);
            const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, messageType };
            await conversationalHandlers.handleAnyMessage(sock, msg, chatSession, msgDetailsForHandler, sessionManager, commandMap);
            
        } catch (error) {
            console.error("[Erro Final] A ação falhou:", error);
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('📲 Escaneie o QR code abaixo para conectar:\n');
            require('qrcode-terminal').generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Julia conectada ao WhatsApp!');
        }
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (reason !== DisconnectReason.loggedOut);
            if (shouldReconnect) { startJulia(); }
        }
    });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});
