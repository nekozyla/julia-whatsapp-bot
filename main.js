// main.js

const { makeWASocket, useMultiFileAuthState, getContentType } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
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

                // Verificação de segurança: garante que o que foi carregado é de fato uma função
                if (typeof handler === 'function') {
                    commandMap[commandName] = handler;
                    console.log(`[Comandos] Comando carregado: ${commandName}`);
                } else {
                    console.warn(`[Comandos] O arquivo ${file} não exporta uma função e será ignorado.`);
                }
            } catch (error) {
                console.error(`[Comandos] Erro ao carregar o comando do arquivo ${file}:`, error);
            }
        }
    } catch (error) {
        console.error("[Comandos] Erro ao ler a pasta de comandos:", error);
    }
    
    return commandMap;
}

let schedulerIntervalId = null; 

async function startJulia() {
    const commandMap = loadCommands();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    
    const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FILE_PATH);
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'warn' }) });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderJid = msg.key.remoteJid;
        await contactManager.addContact(senderJid);
        
        const isGroup = senderJid.endsWith('@g.us');
        const pushName = msg.pushName || 'alguém';
        const messageType = getContentType(msg.message);
        const textContent = getTextFromMsg(msg.message);
        
        // --- LÓGICA DE DETECÇÃO DE COMANDOS (com tolerância a espaços) ---
        let commandToRun = null;
        if (textContent?.startsWith('!')) {
            const spacelessInput = textContent.substring(0, 30).replace(/\s+/g, '').toLowerCase();
            for (const cmdKey of Object.keys(commandMap)) {
                if (spacelessInput.startsWith(cmdKey)) {
                    commandToRun = cmdKey;
                    break;
                }
            }
        }

        // --- ROTEADOR DE COMANDOS ---
        if (commandToRun) {
            console.log(`[Comando] Roteando para o handler: ${commandToRun} (detectado de "${textContent}")`);
            
            if (typeof commandMap[commandToRun] === 'function') {
                const msgDetails = { 
                    sender: senderJid, 
                    pushName, 
                    command: commandToRun, 
                    commandText: textContent, 
                    messageType, 
                    isGroup, 
                    quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage, 
                    commandSenderJid: msg.key.participant || msg.key.remoteJid 
                };
                
                if (await commandMap[commandToRun](sock, msg, msgDetails)) {
                    return;
                }
            } else {
                console.error(`[Erro Crítico] O comando '${commandToRun}' foi detectado, mas não é uma função executável.`);
            }
        }

        // --- LÓGICA DE INTERAÇÃO COM A IA ---
        
        // Bloqueia IA em grupos grandes
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(senderJid);
                if (groupMetadata.participants.length > 50) {
                    return;
                }
            } catch (e) {
                console.log("Não foi possível obter metadados do grupo, prosseguindo...")
            }
        }

        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (!botJid) return;
        
        const contextInfo = msg.message.extendedTextMessage?.contextInfo;
        const mentions = contextInfo?.mentionedJid || [];
        const isReplyingToBotDirectly = contextInfo?.participant === botJid;
        
        let juliaShouldRespond = false;
        if (!isGroup || mentions.includes(botJid) || isReplyingToBotDirectly) {
            juliaShouldRespond = true;
        }

        const aiMode = settingsManager.getSetting(senderJid, 'aiMode', 'off');

        if (juliaShouldRespond && aiMode !== 'on') {
            if (!isGroup) {
                await sock.sendMessage(senderJid, { text: "Minha inteligência artificial está desativada neste chat. Use `!help` para ver a lista de comandos disponíveis ou `!ia on` para me ativar." }, { quoted: msg });
            }
            return;
        }
        
        if (!juliaShouldRespond) return;
        
        const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
        
        if (isGroup && await conversationalHandlers.handleSpontaneousResponse(sock, msg, chatSession, { sender: senderJid, pushName, lastMessageText: textContent, isGroup })) {
            return;
        }

        await sock.sendPresenceUpdate('composing', senderJid);

        const quotedMsgInfo = contextInfo?.quotedMessage;
        const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, quotedMsgInfo, botJid };

        if (messageType === 'audioMessage') { if (await conversationalHandlers.handleAudioInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (messageType === 'stickerMessage') { if (await conversationalHandlers.handleStickerInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (messageType === 'imageMessage') { if (await conversationalHandlers.handleImageInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (textContent) {
            const isReplying = !!quotedMsgInfo;
            if (isReplying) {
                if (await conversationalHandlers.handleContextualReply(sock, msg, chatSession, msgDetailsForHandler)) return;
            } else {
                if (await conversationalHandlers.handleTextMessage(sock, msg, chatSession, msgDetailsForHandler, sessionManager )) return;
            }
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
            if (!schedulerIntervalId) {
                schedulerIntervalId = scheduler.initializeScheduler(sock);
            }
        }
        if (connection === 'close') {
            if (schedulerIntervalId) scheduler.stopScheduler();
            schedulerIntervalId = null; 
            const reason = lastDisconnect?.error?.output?.statusCode;
            const nonRetryableReasons = [401, 403, 440, 500];
            const shouldReconnect = !nonRetryableReasons.includes(reason);
            
            if (shouldReconnect) {
                console.log(`Tentando reconectar a Julia em 15 segundos...`);
                setTimeout(() => startJulia(), 15000);
            } else {
                console.log(`Não será tentada a reconexão automática. Motivo: ${reason}. Remova a pasta '${config.AUTH_FILE_PATH}' e tente novamente.`);
            }
        }
    });

    process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); });
    process.on('uncaughtException', (error) => { console.error('Uncaught Exception thrown:', error); });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});
