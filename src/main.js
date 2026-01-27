require('dotenv').config();


const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const { initializeModules, loadCommands } = require('./loader.js');
const { processMessage } = require('./messageHandler.js');



const settingsManager = require('./managers/groupSettingsManager.js');
const authManager = require('./managers/authManager.js');
const groupMetadataManager = require('./managers/groupMetadataManager.js');


const AUTH_FILE_PATH = path.join(__dirname, '..', 'auth_info');
const BOT_JID_CACHE_PATH = path.join(__dirname, '..', 'data', 'bot_jid_cache.json');
let botJidCache = {};
let sock;


const messageStore = new Map();




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

    sock = makeWASocket({ 
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: ['Julia Bot', 'Chrome', '20.0.0'],
        markOnlineOnConnect: false
    });



    sock.ev.on('creds.update', saveCreds);

    const voteManager = require('./managers/voteManager.js');

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];



        const type = Object.keys(msg.message || {})[0];

        if (type === 'reactionMessage') {
            
            voteManager.handleReaction(msg);
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
                    const MIN_MEMBERS = 10; 

                    if (authManager.isGroupAllowed(id)) {
                        console.log(`[AutoJoin] Entrando em grupo ${groupName} (whitelisted).`);
                        await sock.sendMessage(id, { text: "Olá! Obrigado por me adicionarem. Estou pronta para uso! 💖" });
                    } else if (actualCount < MIN_MEMBERS) {
                        console.log(`[AutoJoin] Grupo ${groupName} muito pequeno (${actualCount}). Iniciando timer de saída.`);
                        await sock.sendMessage(id, { text: "⚠️ *Grupo Pequeno Demais*\n\nOlá! Eu só funciono em grupos com **10 ou mais membros**.\n\nVou sair em **1 minuto**, a menos que este grupo receba mais membros ou um Super Admin me autorize usando o comando `/adicionar`." });

                        setTimeout(async () => {
                            
                            if (authManager.isGroupAllowed(id)) {
                                await sock.sendMessage(id, { text: "✅ O grupo foi autorizado! Vou ficar. 💖" });
                                return;
                            }

                            try {
                                
                                const freshMeta = await sock.groupMetadata(id);
                                if (freshMeta.participants.length >= MIN_MEMBERS) {
                                    await sock.sendMessage(id, { text: "✅ O grupo atingiu a meta de membros! Vou ficar. 💖" });
                                    return;
                                }

                                await sock.sendMessage(id, { text: "⏰ O tempo acabou e o grupo ainda não cumpre os requisitos. Saindo... 👋" });
                                await new Promise(r => setTimeout(r, 1500));
                                await sock.groupLeave(id);
                            } catch (e) {
                                console.error('[AutoLeaveTimer] Erro ao sair:', e);
                            }
                        }, 60000);
                    } else {
                        console.log(`[AutoJoin] Entrando em grupo ${groupName} (${actualCount} membros).`);
                        await sock.sendMessage(id, { text: "Olá! Obrigado por me adicionarem. Estou pronta para uso! 💖" });
                    }
                }
                

                
                const welcomeMode = settingsManager.getSetting(id, 'welcomeMode', 'off');
                if (welcomeMode !== 'on') return;

                
                let welcomeMessage = settingsManager.getSetting(id, 'welcomeMessage', 'Olá @user, bem-vindo(a) ao @group!');

                
                const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, id);
                if (!groupMetadata) return;

                const groupName = groupMetadata.subject;
                const groupDesc = groupMetadata.desc || '';

                
                welcomeMessage = welcomeMessage.replace(/@group/g, groupName);
                welcomeMessage = welcomeMessage.replace(/@desc/g, groupDesc);

                
                for (const item of participants) {
                    
                    const participantJid = typeof item === 'string' ? item : item?.id;

                    
                    if (participantJid.includes(sock.user?.id?.replace(/:[0-9]+/, ''))) continue;

                    if (!participantJid || typeof participantJid !== 'string') {
                        console.warn("[Welcome] Participante inválido encontrado:", item);
                        continue;
                    }

                    
                    const finalMessage = welcomeMessage.replace(/@user/g, `@${participantJid.split('@')[0]}`);

                    await sock.sendMessage(id, {
                        text: finalMessage,
                        mentions: [participantJid]
                    });
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
                const MIN_MEMBERS = 10;

                if (authManager.isGroupAllowed(id)) {
                    console.log(`[AutoCheck] Grupo ${groupName} (whitelisted).`);
                } else if (actualCount < MIN_MEMBERS) {
                    console.log(`[AutoCheck] Grupo ${groupName} muito pequeno (${actualCount}). Iniciando timer de saída.`);
                    await sock.sendMessage(id, { text: "⚠️ *Grupo Pequeno Demais*\n\nOlá! Eu só funciono em grupos com **10 ou mais membros**.\n\nVou sair em **1 minuto**, a menos que este grupo receba mais membros ou um Super Admin me autorize usando o comando `/adicionar`." });

                    setTimeout(async () => {
                        if (authManager.isGroupAllowed(id)) {
                            await sock.sendMessage(id, { text: "✅ O grupo foi autorizado! Vou ficar. 💖" });
                            return;
                        }

                        try {
                            const freshMeta = await sock.groupMetadata(id);
                            if (freshMeta.participants.length >= MIN_MEMBERS) {
                                await sock.sendMessage(id, { text: "✅ O grupo atingiu a meta de membros! Vou ficar. 💖" });
                                return;
                            }

                            await sock.sendMessage(id, { text: "⏰ O tempo acabou e o grupo ainda não cumpre os requisitos. Saindo... 👋" });
                            await new Promise(r => setTimeout(r, 1500));
                            await sock.groupLeave(id);
                        } catch (e) {
                            console.error('[AutoLeaveTimer] Erro ao sair:', e);
                        }
                    }, 60000);
                } else {
                    console.log(`[AutoCheck] Grupo ${groupName} OK (${actualCount} membros).`);
                }
            } catch (err) {
                console.error('[AutoLeave] Erro ao processar groups.upsert:', err);
            }
        }
    });
    

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === 'open') {
            console.log('✅ Julia conectada ao WhatsApp!');

            
            (async () => {
                try {
                    console.log('[Startup] Verificando grupos para aplicar limite mínimo de 10 membros...');
                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);

                    for (const id of groupIds) {
                        const group = groups[id];
                        
                        if (!id.endsWith('@g.us')) continue;

                        const memberCount = group.participants ? group.participants.length : 0;

                        if (memberCount < 10) {
                            if (authManager.isGroupAllowed(id)) {
                                console.log(`[Startup] Grupo ${group.subject || id} é pequeno (${memberCount}), mas está na whitelist. Mantendo.`);
                                continue;
                            }
                            console.log(`[Startup] Saindo do grupo ${group.subject || id} (Menos de 10 membros: ${memberCount})`);
                            try {
                                await sock.sendMessage(id, { text: '⚠️ *Aviso de Limite:*\n\nOlá! Para garantir a qualidade do serviço, agora eu só funciono em grupos com pelo menos *10 participantes*.\n\nComo este grupo é menor, vou sair agora. Agradeço por me usarem! 👋' });
                            } catch (msgErr) {
                                console.error(`[Startup] Erro ao enviar mensagem de saída para ${id}:`, msgErr);
                            }

                            
                            await new Promise(resolve => setTimeout(resolve, 2000));

                            try {
                                await sock.groupLeave(id);
                            } catch (leaveErr) {
                                console.error(`[Startup] Erro ao sair do grupo ${id}:`, leaveErr);
                            }
                        }
                    }
                    console.log('[Startup] Verificação de grupos concluída.');
                } catch (err) {
                    console.error('[Startup] Erro fatal durante checagem de grupos:', err);
                }
            })();
            


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


const cleanup = () => {
    console.log('A encerrar o bot de forma segura...');
    
    messageStore.clear();
    
    if (sock) {
        sock.end(new Error('Processo de encerramento iniciado.'));
    }
    
    setTimeout(() => {
        console.log('Bot encerrado.');
        process.exit(0);
    }, 1000);
};


process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
