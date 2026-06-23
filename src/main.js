require('dotenv').config();


const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const { initializeModules, loadCommands } = require('./loader.js');
const { processMessage } = require('./messageHandler.js');
const { startApiServer, setApiSocket } = require('./services/apiServer.js');
const config = require('../config.js');



const settingsManager = require('./managers/groupSettingsManager.js');
const authManager = require('./managers/authManager.js');
const groupMetadataManager = require('./managers/groupMetadataManager.js');
const { generateImage } = require('./helpers/imageGenerator');
const { welcomeTemplate } = require('./helpers/htmlTemplates');
const rankManager = require('./managers/rankManager');
const telegramBridge = require('./managers/telegramBridge.js');
const contactManager = require('./managers/contactManager.js');
const { initializeCouplePetScheduler, stopCouplePetScheduler } = require('./managers/couplePetScheduler.js');

const { initializeMuchaMusicaScheduler, stopMuchaMusicaScheduler } = require('./managers/muchaMusicaScheduler.js');
const muchaMusicaManager = require('./managers/muchaMusicaManager.js');
const minecraftManager = require('./managers/minecraftManager.js');
const viewOnceManager = require('./managers/viewOnceManager.js');



const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', 'data', 'bot_jid_cache.json');
let botJidCache = {};
let sock;


const messageStore = new Map();

// Inicializar API HTTP
startApiServer();




async function startBot() {
    await initializeModules();
    await minecraftManager.init();
    const commandMap = loadCommands();

    try {
        const data = await fs.readFile(BOT_JID_CACHE_PATH, 'utf-8');
        botJidCache = JSON.parse(data);
    } catch (e) {

    }

    try {
        const fsSync = require('fs');
        if (!fsSync.existsSync(AUTH_FILE_PATH)) {
            fsSync.mkdirSync(AUTH_FILE_PATH, { recursive: true });
        }
    } catch (e) {
        console.error('Erro ao criar pasta auth_info:', e);
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FILE_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: [`${config.BOT_NAME} Bot`, 'Chrome', '20.0.0'],
        markOnlineOnConnect: false
    });
    setApiSocket(sock);



    sock.ev.on('creds.update', saveCreds);

    const voteManager = require('./managers/voteManager.js');
    const pollManager = require('./managers/pollManager.js');
    const { decryptPollVote } = require('@whiskeysockets/baileys/lib/Utils/process-message.js');
    const { jidNormalizedUser } = require('@whiskeysockets/baileys');
    const removerCommand = require('./commands/remover.js');
    await removerCommand.initGhostQuarantineRecovery?.(sock);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];



        const type = Object.keys(msg.message || {})[0];

        if (type === 'reactionMessage') {
            const reaction = msg.message.reactionMessage;
            const reactorJid = msg.key.participant || msg.key.remoteJid;

            // --- SECRET FEATURE: View Once Forwarding ---
            if (reaction.text && authManager.isSuperAdmin(reactorJid)) {
                const targetKey = reaction.key;
                let targetMsg = messageStore.get(targetKey.id);
                if (!targetMsg) {
                    targetMsg = viewOnceManager.getMessage(targetKey.id);
                }
                console.log(`[Secret Debug] Reação detectada por Super Admin: ${reactorJid}. Emoji: "${reaction.text}". Target Msg ID: ${targetKey?.id}. Encontrada no messageStore: ${!!messageStore.get(targetKey.id)}. Encontrada no viewOnceManager: ${!!viewOnceManager.getMessage(targetKey.id)}`);

                if (targetMsg) {
                    // Função auxiliar para resolver mensagens de visualização única
                    const getMediaAndType = (msgContent) => {
                        if (!msgContent) return null;
                        let current = msgContent;
                        let isViewOnce = false;
                        const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
                        
                        while (current) {
                            const type = Object.keys(current)[0];
                            if (!type) break;
                            
                            if (type === 'viewOnceMessage' || type === 'viewOnceMessageV2' || type === 'viewOnceMessageV2Extension') {
                                isViewOnce = true;
                            }
                            
                            if (wrappers.includes(type)) {
                                current = current[type].message || current[type];
                            } else {
                                break;
                            }
                        }
                        
                        const mediaType = Object.keys(current || {})[0];
                        return { mediaContent: current, mediaType, isViewOnce };
                    };

                    const resolved = getMediaAndType(targetMsg.message);
                    if (resolved && resolved.isViewOnce) {
                        const { mediaContent, mediaType } = resolved;
                        console.log(`[Secret] Super Admin ${reactorJid.split('@')[0]} pediu ViewOnce ${targetKey.id} (tipo: ${mediaType}). Baixando...`);
                        
                        try {
                            const buffer = await downloadMediaMessage(
                                targetMsg,
                                'buffer',
                                {},
                                {
                                    logger: pino({ level: 'silent' }),
                                    reuploadRequest: sock.updateMediaMessage
                                }
                            );

                            if (buffer) {
                                if (mediaType === 'imageMessage') {
                                    await sock.sendMessage(reactorJid, { image: buffer, caption: '🤫 Aqui está a imagem de visualização única.' });
                                } else if (mediaType === 'videoMessage') {
                                    await sock.sendMessage(reactorJid, { video: buffer, caption: '🤫 Aqui está o vídeo de visualização única.' });
                                } else if (mediaType === 'audioMessage') {
                                    const audioContent = mediaContent.audioMessage;
                                    await sock.sendMessage(reactorJid, { 
                                        audio: buffer, 
                                        mimetype: audioContent.mimetype || 'audio/ogg; codecs=opus', 
                                        ptt: true 
                                    });
                                } else {
                                    console.log(`[Secret] Tipo de mídia não suportado explicitamente para envio: ${mediaType}`);
                                }
                            }
                        } catch (err) {
                            console.error("[Secret] Erro ao baixar/enviar mídia viewOnce:", err);
                        }
                    }
                }
            }
            // ---------------------------------------------

            voteManager.handleReaction(msg);
            await removerCommand.handleGhostReaction?.(sock, msg);
            return;
        }

        // --- Interceptar votos de enquete (pollUpdateMessage) ---
        if (type === 'pollUpdateMessage') {
            try {
                const pollUpdate = msg.message.pollUpdateMessage;
                const creationKey = pollUpdate?.pollCreationMessageKey;
                if (creationKey?.id) {
                    const poll = pollManager.getPoll(creationKey.id);
                    if (poll) {
                        const meId = jidNormalizedUser(sock.user?.id);
                        const voterJid = msg.key.participant || msg.key.remoteJid;

                        // O encPayload e encIv podem chegar como base64 strings, precisamos converter para Buffer
                        let encPayload = pollUpdate.vote?.encPayload;
                        let encIv = pollUpdate.vote?.encIv;
                        
                        if (typeof encPayload === 'string') encPayload = Buffer.from(encPayload, 'base64');
                        if (typeof encIv === 'string') encIv = Buffer.from(encIv, 'base64');

                        // pollEncKey (messageSecret) também pode ser base64
                        let pollEncKey = poll.messageSecret;
                        if (typeof pollEncKey === 'string') pollEncKey = Buffer.from(pollEncKey, 'base64');

                        console.log(`[PollVote] Voto recebido de ${voterJid.split('@')[0]} para enquete ${creationKey.id}`);
                        console.log(`[PollVote] meId=${meId}, creatorJid=${poll.creatorJid}`);
                        console.log(`[PollVote] encPayload=${encPayload?.length}bytes, encIv=${encIv?.length}bytes, pollEncKey=${pollEncKey?.length}bytes`);

                        try {
                            const decryptedVote = decryptPollVote(
                                { encPayload, encIv },
                                {
                                    pollEncKey,
                                    pollCreatorJid: poll.creatorJid || meId,
                                    pollMsgId: creationKey.id,
                                    voterJid: voterJid
                                }
                            );

                            console.log(`[PollVote] Voto descriptografado:`, decryptedVote?.selectedOptions?.length, 'opções');
                            pollManager.processVote(creationKey.id, voterJid, decryptedVote?.selectedOptions || []);
                        } catch (decErr) {
                            console.error('[PollVote] Erro ao descriptografar voto:', decErr.message);
                        }
                    }
                }
            } catch (pollErr) {
                console.error('[PollVote] Erro geral ao processar pollUpdate:', pollErr);
            }
            return;
        }

        await processMessage(sock, msg, commandMap, botJidCache, messageStore);
    });






    sock.ev.on('messages.update', async (updates) => {



        for (const update of updates) {


            if (update.key && update.update?.message === null) {
                const msgId = update.key.id;
                const chatJid = update.key.remoteJid;


                if (settingsManager.getSetting(chatJid, 'antiDeleteMode', 'off') !== 'on') {
                    continue;
                }


                const deletedMsg = messageStore.get(msgId);
                if (deletedMsg) {
                    console.log(`[AntiDelete] Mensagem ${msgId} apagada em ${chatJid}. Reenviando...`);


                    const authorJid = deletedMsg.key.participant;
                    const authorName = deletedMsg.pushName || 'Alguém';



                    const antiDeleteHeader = `🚫 ${authorName} (@${authorJid.split('@')[0]}) apagou a mensagem:`;


                    await sock.sendMessage(chatJid, {
                        text: antiDeleteHeader,
                        mentions: [authorJid]
                    });



                    await sock.sendMessage(chatJid, {
                        forward: deletedMsg
                    });


                    messageStore.delete(msgId);
                }
            }
        }
    });


    const groupMetadataManager = require('./managers/groupMetadataManager.js');




    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;

        if (action === 'remove') {
            // Auto-remover do Mucha Música
            try {
                for (const item of participants) {
                    const pJid = typeof item === 'string' ? item : item?.id;
                    if (pJid) await muchaMusicaManager.removeMember(id, pJid);
                }
            } catch (e) { console.error('[MuchaMusica] Erro ao remover membro:', e.message); }


        }

        if (action === 'add') {
            try {

                const rawBotJid = sock.user?.id;
                const botJid = rawBotJid?.replace(/:[0-9]+/, '');

                const normalizedParticipants = participants.map(p => (typeof p === 'string' ? p : p.id));

                const isBotAdded = normalizedParticipants.some(p => p && p.includes(botJid));

                if (isBotAdded) {
                    const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, id);
                    const groupName = groupMetadata?.subject || 'Grupo';
                    const actualCount = groupMetadata?.participants?.length || 0;

                    console.log(`[AutoJoin] Entrando em grupo ${groupName} (${actualCount} membros).`);
                    await sock.sendMessage(id, { text: "Olá! Obrigado por me adicionarem. Estou pronta para uso! 💖" });
                }

                // Auto-adicionar ao Mucha Música
                try {
                    for (const item of participants) {
                        const pJid = typeof item === 'string' ? item : item?.id;
                        if (pJid && !normalizedParticipants.some(p => p?.includes(botJid) && p === pJid)) {
                            const pName = pJid.split('@')[0];
                            await muchaMusicaManager.addMember(id, pJid, pName);
                        }
                    }
                } catch (e) { console.error('[MuchaMusica] Erro ao adicionar membro:', e.message); }



                const welcomeMode = settingsManager.getSetting(id, 'welcomeMode', 'off');
                if (welcomeMode !== 'on') return;

                let welcomeMessage = settingsManager.getSetting(id, 'welcomeMessage', 'Olá @user, bem-vindo(a) ao @group!');

                const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, id);
                if (!groupMetadata) return;

                const groupName = groupMetadata.subject;
                const groupDesc = groupMetadata.desc || '';
                const memberCount = groupMetadata.participants.length;

                welcomeMessage = welcomeMessage.replace(/@group/g, groupName);
                welcomeMessage = welcomeMessage.replace(/@desc/g, groupDesc);

                for (const item of participants) {
                    const participantJid = typeof item === 'string' ? item : item?.id;

                    if (participantJid.includes(sock.user?.id?.replace(/:[0-9]+/, ''))) continue;

                    if (!participantJid || typeof participantJid !== 'string') {
                        console.warn("[Welcome] Participante inválido encontrado:", item);
                        continue;
                    }

                    // --- VISUAL WELCOME LOGIC ---
                    try {
                        let avatarUrl;
                        try {
                            avatarUrl = await sock.profilePictureUrl(participantJid, 'image');
                        } catch (e) {
                            avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
                        }

                        const username = participantJid.split('@')[0];
                        const outputPath = path.join('/tmp', `welcome_${Date.now()}_${username}.png`);

                        await generateImage(welcomeTemplate, outputPath, {
                            avatarUrl,
                            username,
                            groupName,
                            memberCount
                        }, { width: 800, height: 400 });

                        const finalMessage = welcomeMessage.replace(/@user/g, `@${username}`);

                        await sock.sendMessage(id, {
                            image: { url: outputPath },
                            caption: finalMessage,
                            mentions: [participantJid]
                        });

                        // Cleanup
                        setTimeout(() => fs.unlink(outputPath).catch(() => { }), 30000);

                    } catch (err) {
                        console.error("[Welcome] Erro ao gerar/enviar imagem de boas-vindas:", err);
                        // Fallback to text only if image fails
                        const finalMessage = welcomeMessage.replace(/@user/g, `@${participantJid.split('@')[0]}`);
                        await sock.sendMessage(id, {
                            text: finalMessage,
                            mentions: [participantJid]
                        });
                    }
                }
            } catch (e) {
                console.error("[Welcome] Erro ao enviar boas-vindas:", e);
            }
        }
    });




    sock.ev.on('groups.upsert', async (groups) => {
        for (const group of groups) {
            try {
                const id = group.id;

                const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, id);
                if (!groupMetadata) continue;

                const participantCount = groupMetadata.participants.length;

                const groupName = groupMetadata?.subject || 'Grupo';
                const actualCount = groupMetadata?.participants?.length || 0;

                console.log(`[AutoCheck] Grupo ${groupName} OK (${actualCount} membros).`);
            } catch (err) {
                console.error('[AutoLeave] Erro ao processar groups.upsert:', err);
            }
        }
    });


    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'open') {
            setApiSocket(sock);
    


            (async () => {
                try {
                    // Registrar sock no contactManager e re-inscrever presença de todos os contatos
                    contactManager.setSock(sock);
                    contactManager.subscribeAllContacts().catch(e => 
                        console.error('[Startup] Erro ao inscrever presença dos contatos:', e.message)
                    );


                    
                    // Inicializar ponte Telegram ↔ WhatsApp
                    try {
                        await telegramBridge.initialize(sock, commandMap);

                    } catch (tgErr) {
                        console.error('[Startup] Erro ao iniciar ponte Telegram:', tgErr.message);
                    }

                    initializeCouplePetScheduler(sock);
                    initializeMuchaMusicaScheduler(sock);
                } catch (err) {
                    console.error('[Startup] Erro fatal durante checagem de grupos:', err);
                }
            })();



        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(`Conexão fechada pelo motivo ${reason}, a reconectar...`);
                startBot();
            } else {
                console.error('[FATAL] Desconectado permanentemente (loggedOut). Apague a pasta auth_info e escaneie o QR Code novamente.');
            }
        }
    });
}

startBot().catch(err => console.error(`Erro fatal ao iniciar ${config.BOT_NAME}:`, err));


const cleanup = () => {
    console.log('A encerrar o bot de forma segura...');

    messageStore.clear();

    if (sock) {
        sock.end(new Error('Processo de encerramento iniciado.'));
    }

    stopCouplePetScheduler();
    stopMuchaMusicaScheduler();
    muchaMusicaManager.forceSave().catch(err => console.error('[Cleanup] Falha ao salvar MuchaMusica:', err.message));

    setTimeout(() => {
        console.log('Bot encerrado.');
        process.exit(0);
    }, 1000);
};


process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
