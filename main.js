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

/**
 * Carrega dinamicamente todos os arquivos de comando da pasta /commands
 * e os mapeia para um objeto. O nome do comando é derivado do nome do arquivo.
 */
function loadCommands() {
    const commandMap = {};
    const commandDir = path.join(__dirname, 'commands');

    try {
        const commandFiles = fs.readdirSync(commandDir).filter(file => file.endsWith('.js'));
        console.log(`[Comandos] Encontrados ${commandFiles.length} arquivos de comando...`);

        for (const file of commandFiles) {
            try {
                const commandName = `!${path.basename(file, '.js')}`; // Ex: 'sticker.js' -> '!sticker'
                const handler = require(path.join(commandDir, file));

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

// Variável para controlar o intervalo do scheduler
let schedulerIntervalId = null; 

async function startJulia() {
    // Carrega os comandos e as sessões na inicialização
    const commandMap = loadCommands();
    await settingsManager.loadSettings();
    await sessionManager.loadAllPersistedSessions();
    
    const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FILE_PATH);
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'warn' }) });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const senderJid = msg.key.remoteJid; 
        const isGroup = senderJid.endsWith('@g.us');
        const pushName = msg.pushName || 'alguém';
        const messageType = getContentType(msg.message);
        
        // --- VERIFICAÇÃO DE MODO DE TRANSCRIÇÃO (tem prioridade sobre tudo) ---
        if (messageType === 'audioMessage') {
            const transcriptionMode = settingsManager.getSetting(senderJid, 'transcriptionMode', 'off');
            if (transcriptionMode === 'on') {
                console.log(`[Modo Transcrição] Ativado para ${senderJid}. Transcrevendo áudio automaticamente...`);
                // A função 'transcribeAudio' está atrelada ao módulo do comando para organização
                const commandTranscrever = require('./commands/transcrever');
                await commandTranscrever.transcribeAudio(sock, msg, msg);
                return; 
            }
        }

        const textContent = getTextFromMsg(msg.message);
        const command = textContent?.split(' ')[0].toLowerCase();
        
        // 1. Roteador de Comandos de Utilidade (agora dinâmico)
        if (command && commandMap[command]) {
            console.log(`[Comando] Roteando para o handler do comando: ${command}`);
            const msgDetails = { 
                sender: senderJid, 
                pushName, 
                command, 
                commandText: textContent, 
                messageType, 
                quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage,
                commandSenderJid: msg.key.participant || msg.key.remoteJid
            };
            if (await commandMap[command](sock, msg, msgDetails)) {
                return;
            }
        }
        
        // 2. Lógica de Interação Conversacional com Julia
        const botJid = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
        if (!botJid) return;
        
        const contextInfo = msg.message.stickerMessage?.contextInfo || msg.message.imageMessage?.contextInfo || msg.message.videoMessage?.contextInfo || msg.message.audioMessage?.contextInfo || msg.message.extendedTextMessage?.contextInfo;
        const mentions = contextInfo?.mentionedJid || [];
        const isReplyingToBotDirectly = contextInfo?.participant === botJid;
        const isQuotedMessageFromBot = contextInfo?.quotedMessage?.key?.fromMe;
        
        let juliaShouldRespond = false;
        if (isGroup) {
            if (mentions.includes(botJid) || isReplyingToBotDirectly || isQuotedMessageFromBot) {
                juliaShouldRespond = true;
            }
            if (!juliaShouldRespond && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
                if (textContent && textContent.includes(`@${botJid.split('@')[0]}`)) { 
                    juliaShouldRespond = true;
                }
            }
        } else { 
            juliaShouldRespond = true; 
        }
        
        const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
        
        if (isGroup && !juliaShouldRespond) {
            if (await conversationalHandlers.handleSpontaneousResponse(sock, msg, chatSession, { sender: senderJid, pushName, lastMessageText: textContent, isGroup })) return; 
        }

        if (!juliaShouldRespond) return;
        
        await sock.sendPresenceUpdate('composing', senderJid);

        const quotedMsgInfo = contextInfo?.quotedMessage;
        const isReplying = !!quotedMsgInfo;
        const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, quotedMsgInfo, botJid };

        // Ordem de processamento conversacional
        if (messageType === 'audioMessage') { if (await conversationalHandlers.handleAudioInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (messageType === 'stickerMessage') { if (await conversationalHandlers.handleStickerInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (messageType === 'imageMessage') { if (await conversationalHandlers.handleImageInterpretation(sock, msg, chatSession, msgDetailsForHandler)) return; }
        if (textContent) {
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
