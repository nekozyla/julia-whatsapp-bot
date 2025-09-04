// main.js (Versão sem "makeInMemoryStore" para contornar o erro)

const { makeWASocket, useMultiFileAuthState, getContentType, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Módulos locais
const config = require('./config');
const sessionManager = require('./sessionManager');
const conversationalHandlers = require('./messageHandlers');
const scheduler = require('./scheduler');
const fiscalScheduler = require('./fiscalScheduler');
const { getTextFromMsg } = require('./utils');
const settingsManager = require('./groupSettingsManager');
const contactManager = require('./contactManager');
const strikeManager = require('./strikeManager');
const agreementManager = require('./agreementManager');
const tomatoAnalyzer = require('./tomatoAnalyzer');
const systemStateManager = require('./systemStateManager');
const donationManager = require('./donationManager');

const processedMessages = new Set();
const imageSpamTracker = new Map();
const STRIKE_IMAGE_COUNT = 10;
const STRIKE_TIME_WINDOW_MS = 10 * 1000;

async function retry(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`[Retry] Tentativa ${i + 1} de ${retries} falhou. Erro: ${error.message}`);
            if (i === retries - 1) throw error;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

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
let fiscalSchedulerIntervalId = null;

async function startJulia() {
    const commandMap = loadCommands();
    await settingsManager.loadSettings();
    await contactManager.loadContacts();
    await sessionManager.loadAllPersistedSessions();
    await agreementManager.loadAgreements();
    await systemStateManager.loadState();
    
    const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FILE_PATH);
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'warn' }),
        browser: ['Julia Bot', 'Chrome', '20.0.0'],
        // As opções 'store' e 'getMessage' foram removidas para evitar o erro.
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        try {
            const senderJid = msg.key.remoteJid;
            const authorJid = msg.key.participant || senderJid;
            const isGroup = senderJid.endsWith('@g.us');
            let textContent = getTextFromMsg(msg.message);

            if (systemStateManager.isMaintenanceMode() && authorJid !== config.ADMIN_JID) {
                return;
            }

            if (isGroup && textContent) {
                const tomatoMode = settingsManager.getSetting(senderJid, 'tomatoMode', 'off');
                if (tomatoMode === 'on') {
                    tomatoAnalyzer.analyzeMessage(textContent).then(isProblematic => {
                        if (isProblematic) {
                            sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => {});
                        }
                    });
                }
            }

            if (isGroup) {
                const memeMode = settingsManager.getSetting(senderJid, 'memeMode', 'off');
                if (memeMode === 'on' && !textContent?.startsWith('!') && !textContent?.startsWith('/')) {
                    const { memeEmojis } = require('./commands/modomeme.js');
                    const randomEmoji = memeEmojis[Math.floor(Math.random() * memeEmojis.length)];
                    sock.sendMessage(senderJid, { react: { text: randomEmoji, key: msg.key } }).catch(e => {});
                }
            }
            
            if (!agreementManager.hasUserAgreed(authorJid)) {
                const normalizedText = (textContent || '').replace(/\s+/g, '').toLowerCase();
                if (normalizedText === '!concordo' || normalizedText === '/concordo') {
                    // Deixa o roteador de comandos lidar
                } else {
                    if (!isGroup) {
                        const agreementText = "👋 Olá! Antes de usar a Julia, você precisa concordar com os nossos termos de uso.\n\n1. Não use o bot para spam ou atividades ilegais.\n2. O bot salva seu ID de usuário para funcionalidades como lembretes e broadcast.\n3. O uso excessivo pode resultar em um bloqueio temporário.\n\nPara concordar e liberar todas as funções, digite:\n*/concordo*";
                        await sock.sendMessage(authorJid, { text: agreementText });
                    }
                    return;
                }
            }
            
            const msgId = msg.key.id;
            if (processedMessages.has(msgId)) return;
            processedMessages.add(msgId);
            setTimeout(() => { processedMessages.delete(msgId); }, 2 * 60 * 1000);

            const banStatus = strikeManager.getBanStatus(authorJid);
            if (banStatus) return;

            const messageType = getContentType(msg.message);
            if (messageType === 'imageMessage') {
                const now = Date.now();
                if (!imageSpamTracker.has(authorJid)) imageSpamTracker.set(authorJid, []);
                const timestamps = imageSpamTracker.get(authorJid).filter(ts => now - ts < STRIKE_TIME_WINDOW_MS);
                timestamps.push(now);
                if (timestamps.length >= STRIKE_IMAGE_COUNT) {
                    const penaltyMinutes = await strikeManager.addStrike(authorJid);
                    await sock.sendMessage(senderJid, { text: `🚨 Você enviou muitas imagens rapidamente e recebeu um strike! Você não poderá interagir comigo por ${penaltyMinutes} minutos.` });
                    imageSpamTracker.delete(authorJid);
                    return;
                }
            }
            
            await contactManager.addContact(senderJid);
            
            const pushName = msg.pushName || 'alguém';
            
            if (textContent?.startsWith('/')) {
                textContent = '!' + textContent.substring(1);
            }
            
            if (!isGroup && (messageType === 'imageMessage' || messageType === 'videoMessage') && !textContent?.startsWith('!')) {
                const stickerMode = settingsManager.getSetting(senderJid, 'stickerMode', 'on');
                if (stickerMode === 'on') {
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

            if (commandToRun) {
                console.log(`[Comando] Roteando para o handler: ${commandToRun}`);
                if (typeof commandMap[commandToRun] === 'function') {
                    const msgDetails = { 
                        sender: senderJid, 
                        pushName, 
                        command: commandToRun, 
                        commandText: textContent, 
                        messageType, 
                        isGroup, 
                        quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage, 
                        commandSenderJid: authorJid,
                        isSuperAdmin: authorJid === config.ADMIN_JID
                    };
                    if (await commandMap[commandToRun](sock, msg, msgDetails)) {
                        if (donationManager.shouldSendDonationMessage(authorJid)) {
                            setTimeout(async () => {
                                try {
                                    const donationMessage = "Olá! 👋 Sou a Julia, um projeto mantido com muito carinho pela Emily. Se você gosta do meu trabalho e quer ajudar a manter-me online, considere fazer uma doação. Qualquer valor ajuda a pagar os custos do servidor!\n\n✨ Chave PIX (E-mail):\n`emilymedeiros0222@gmail.com`\n\nSiga o nosso canal para novidades:\nhttps://whatsapp.com/channel/0029Vb6C238CxoAwXrkEXe1E\n\nMuito obrigada pelo seu apoio! ❤️";
                                    await sock.sendMessage(authorJid, { text: donationMessage });
                                    donationManager.recordDonationMessageSent(authorJid);
                                } catch (e) {
                                    console.error("[Donation Manager] Falha ao enviar mensagem de doação:", e);
                                }
                            }, 15 * 1000);
                        }
                        return;
                    }
                }
            }
            
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
                    await sock.sendMessage(senderJid, { text: "Minha inteligência artificial está desativada .Use `!help` para ver a lista de comandos ou `!ia on` para conversar com a IA." }, { quoted: msg });
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
            if (!schedulerIntervalId) {
                schedulerIntervalId = scheduler.initializeScheduler(sock, commandMap);
            }
            if (!fiscalSchedulerIntervalId) {
                fiscalSchedulerIntervalId = fiscalScheduler.initializeFiscalScheduler(sock);
            }
        }
        if (connection === 'close') {
            if (schedulerIntervalId) scheduler.stopScheduler();
            if (fiscalSchedulerIntervalId) fiscalScheduler.stopFiscalScheduler();
            schedulerIntervalId = null; 
            fiscalSchedulerIntervalId = null;
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = (reason !== DisconnectReason.loggedOut);
            
            if (shouldReconnect) {
                console.log(`Tentando reconectar a Julia...`);
                startJulia();
            } else {
                console.log(`Não será tentada a reconexão automática. Motivo: ${reason}.`);
            }
        }
    });
}

startJulia().catch(err => {
    console.error("Erro fatal ao iniciar Julia:", err);
    process.exit(1); 
});

