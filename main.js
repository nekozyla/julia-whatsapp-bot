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
const spamManager = require('./spamManager');

// --- LÓGICA DE CONTROLE DE MENSAGENS DUPLICADAS ---
const processedMessages = new Set();
// ---------------------------------------------------

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

        // --- VERIFICAÇÃO DE MENSAGEM DUPLICADA ---
        const msgId = msg.key.id;
        if (processedMessages.has(msgId)) {
            console.log(`[Deduplicate] Mensagem com ID ${msgId} já processada. Ignorando.`);
            return;
        }
        processedMessages.add(msgId);
        setTimeout(() => {
            processedMessages.delete(msgId);
        }, 2 * 60 * 1000); // Limpa o ID da memória após 2 minutos
        // ------------------------------------------

        // --- NOVO: LÓGICA ANTISPAM ---
        // É AQUI QUE VOCÊ DEVE BOTAR A LÓGICA DE ANTISPAM
        const commandSenderJidForSpam = msg.key.participant || msg.key.remoteJid;
        if (spamManager.recordRequest(commandSenderJidForSpam)) {
            console.log(`[Antispam] Bloqueando ${commandSenderJidForSpam} por excesso de solicitações.`);
            await sock.sendMessage(msg.key.remoteJid, { text: "Você foi temporariamente bloqueado por fazer muitas solicitações rapidamente." });
            await sock.updateBlockStatus(commandSenderJidForSpam, "block");
            return;
        }
        // --- FIM DA LÓGICA ANTISPAM ---

        const senderJid = msg.key.remoteJid;
        await contactManager.addContact(senderJid);
        
        const isGroup = senderJid.endsWith('@g.us');
        const pushName = msg.pushName || 'alguém';
        const messageType = getContentType(msg.message);
        let textContent = getTextFromMsg(msg.message);
        
        // --- LÓGICA DE PREFIXO ALTERNATIVO ---
        if (textContent?.startsWith('/')) {
            textContent = '!' + textContent.substring(1);
            console.log(`[Prefixo] Prefixo '/' detectado. Convertendo para: "${textContent}"`);
        }

        // --- LÓGICA DO MODO STICKER AUTOMÁTICO ---
        if (!isGroup && (messageType === 'imageMessage' || messageType === 'videoMessage') && !textContent?.startsWith('!')) {
            const stickerMode = settingsManager.getSetting(senderJid, 'stickerMode', 'on');
            if (stickerMode === 'on') {
                console.log(`[Modo Sticker] Ativado para ${senderJid}. Iniciando criação automática.`);
                const stickerHandler = commandMap['!sticker'];
                if (typeof stickerHandler === 'function') {
                    await stickerHandler(sock, msg, {
                        sender: senderJid, pushName, command: '!sticker', commandText: '!sticker',
                        messageType, isGroup, quotedMsgInfo: null, commandSenderJid: senderJid
                    });
                }
                return;
            }
        }

        // --- LÓGICA DE DETECÇÃO DE COMANDOS ---
        let commandToRun = null;
        if (textContent?.startsWith('!')) {
            const spacelessInput = textContent.substring(0, 30).replace(/\s+/g, '').toLowerCase();
            const sortedCommands = Object.keys(commandMap).sort((a, b) => b.length - a.length);
            for (const cmdKey of sortedCommands) {
                if (spacelessInput.startsWith(cmdKey)) {
                    commandToRun = cmdKey;
                    break;
                }
            }
        }

        // --- ROTEADOR DE COMANDOS ---
        if (commandToRun) {
            console.log(`[Comando] Roteando para o handler: ${commandToRun} (de "${textContent}")`);
            if (typeof commandMap[commandToRun] === 'function') {
                const msgDetails = { 
                    sender: senderJid, pushName, command: commandToRun, commandText: textContent, 
                    messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage, 
                    commandSenderJid: msg.key.participant || msg.key.remoteJid 
                };
                if (await commandMap[commandToRun](sock, msg, msgDetails)) return;
            }
        }
        
        // --- LÓGICA DE INTERAÇÃO COM A IA (CORRIGIDA) ---
        
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(senderJid);
                if (groupMetadata.participants.length > 50) return; 
            } catch (e) { /* Ignora */ }
        }

        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const contextInfo = msg.message.extendedTextMessage?.contextInfo;
        const mentions = contextInfo?.mentionedJid || [];
        const isReplyingToBot = contextInfo?.participant === botJid;
        
        let juliaShouldRespond = !isGroup || mentions.includes(botJid) || isReplyingToBot;
        const aiMode = settingsManager.getSetting(senderJid, 'aiMode', 'off');

        if (juliaShouldRespond && aiMode !== 'on') {
            if (!isGroup) {
                await sock.sendMessage(senderJid, { text: "Minha inteligência artificial está desativada. Use `!ia on` para me ativar." }, { quoted: msg });
            }
            return;
        }
        
        if (!juliaShouldRespond) return;
        
        const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
        await sock.sendPresenceUpdate('composing', senderJid);

        const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, messageType };
        
        // Chamada única para a função principal e unificada do messageHandlers.js
        await conversationalHandlers.handleAnyMessage(sock, msg, chatSession, msgDetailsForHandler, sessionManager, commandMap);
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
                scheduler.initializeScheduler(sock, commandMap);
            }
        }
        if (connection === 'close') {
            // ... (código de reconexão continua o mesmo)
        }
    });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});
