

const { getContentType, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const config = require('../config.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const { getTextFromMsg, normalizeText } = require('./utils/utils.js');

const rankManager = require('./managers/rankManager.js');
const syncManager = require('./managers/syncManager.js');
const afkManager = require('./managers/afkManager.js');

const groupMetadataManager = require('./managers/groupMetadataManager.js');
const joinDateManager = require('./managers/joinDateManager.js');

const llmManager = require('./managers/llmManager.js');
const chatMemoryManager = require('./managers/chatMemoryManager.js');
const { textModel } = require('./managers/geminiClient.js');
const chatLogManager = require('./managers/chatLogManager.js');
const rentalManager = require('./managers/rentalManager.js');
const ticketManager = require('./managers/ticketManager.js');
const perguntaManager = require('./managers/perguntaManager.js');
const { generateSummary } = require('./commands/perdihoje.js');
const lottieCollector = require('./managers/lottieCollector.js');
const minecraftManager = require('./managers/minecraftManager.js');
const viewOnceManager = require('./managers/viewOnceManager.js');

const stickerBatchStore = new Map();

let stickerCommandHandler = null;
try {
    stickerCommandHandler = require('./commands/sticker.js');
} catch (e) {
    console.warn("[MessageHandler] O comando de sticker não foi encontrado, o modo sticker automático está desativado.");
}


function resolveMediaTypeFromWrappedMessage(message) {
    if (!message) return null;

    let current = message;
    const wrapperTypes = new Set(['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);

    while (current) {
        const type = getContentType(current);
        if (!type) return null;
        if (!wrapperTypes.has(type)) return type;

        const nested = current[type]?.message;
        if (!nested) return type;
        current = nested;
    }

    return null;
}

function getMediaAndTypeFromQuoted(message) {
    if (!message) return null;

    let current = message;
    const wrapperTypes = new Set(['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']);

    while (current) {
        const type = getContentType(current);
        if (!type) return null;
        
        if (!wrapperTypes.has(type)) {
            if (['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) {
                return { type, mediaMessage: current[type] };
            }
            return null;
        }

        const nested = current[type]?.message;
        if (!nested) return null;
        current = nested;
    }

    return null;
}

    function escapeRegExp(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }


async function processMessage(sock, msg, commandMap, botJidCache, messageStore, store) {
    if (!msg.message || msg.key.fromMe) return;

    // Coleta Lottie Stickers com trust token valido
    let stickerMsgObj = msg.message?.stickerMessage;
    if (!stickerMsgObj && msg.message?.lottieStickerMessage?.message?.stickerMessage) {
        stickerMsgObj = msg.message.lottieStickerMessage.message.stickerMessage;
    }
    
    if (stickerMsgObj?.isLottie) {
        // Passa a msg inteira e o obj da sticker resolvido
        lottieCollector.collectLottie(sock, msg, stickerMsgObj, { commandSenderJid: msg.key.participant || msg.key.remoteJid, pushName: msg.pushName || 'alguém' }).catch(() => {});
    }



    if (msg.key.id) {

        msg.pushName = msg.pushName || 'Alguém';
        messageStore.set(msg.key.id, msg);
        
        const resolvedType = resolveMediaTypeFromWrappedMessage(msg.message) || getContentType(msg.message);
        const hasViewOnce = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].includes(getContentType(msg.message))
            || Boolean(msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension)
            || Boolean(msg.message?.ephemeralMessage?.message?.viewOnceMessage || msg.message?.ephemeralMessage?.message?.viewOnceMessageV2 || msg.message?.ephemeralMessage?.message?.viewOnceMessageV2Extension);
        
        if (hasViewOnce) {
            console.log(`[Store Debug] Mensagem de Visualização Única salva no messageStore. ID: ${msg.key.id}, Tipo Resolvido: ${resolvedType}`);
            viewOnceManager.addMessage(msg).catch(err => console.error('[Store Debug] Erro ao persistir mensagem de visualização única:', err));
        }

        if (messageStore.size > 200) {
            const firstKey = messageStore.keys().next().value;
            messageStore.delete(firstKey);
        }
    }


    try {
        let senderJid = msg.key.remoteJid;
        let authorJid = msg.key.participant || senderJid;

        // --- Fix para @lid no PV ---
        if (senderJid && senderJid.endsWith('@lid')) {
            // No Baileys recente, a resolução do JID real em PVs @lid às vezes 
            // vem na propriedade participant ou precisa ser forçada no auth
            if (msg.key.participant && msg.key.participant.endsWith('@s.whatsapp.net')) {
                senderJid = msg.key.participant;
            } else if (msg.message?.senderKeyDistributionMessage?.groupId) {
                // Tenta puxar de outras propriedades nativas
                const possibleJid = msg.message.senderKeyDistributionMessage.groupId;
                if (possibleJid.endsWith('@s.whatsapp.net')) senderJid = possibleJid;
            }
        }

        if (authorJid && authorJid.endsWith('@lid') && senderJid.endsWith('@s.whatsapp.net')) {
            authorJid = senderJid;
        }
        // ---------------------------

        const isGroup = senderJid.endsWith('@g.us');
        const isAuthorSuperAdmin = authManager.isSuperAdmin(authorJid);

        const pushName = msg.pushName || 'alguém';
        const messageType = getContentType(msg.message);
        const originalText = getTextFromMsg(msg.message);

        // ── Log completo de mensagens de Super Admins ──
        if (isAuthorSuperAdmin) {
            const logTimestamp = new Date().toISOString();
            console.log(`\n${'═'.repeat(60)}`);
            console.log(`[SUPER ADMIN LOG] ${logTimestamp}`);
            console.log(`${'─'.repeat(60)}`);
            console.log(`  Autor JID  : ${authorJid}`);
            console.log(`  Push Name  : ${pushName}`);
            console.log(`  Chat JID   : ${senderJid} (${isGroup ? 'grupo' : 'privado'})`);
            console.log(`  Tipo msg   : ${messageType}`);
            console.log(`  Texto      : ${originalText || '(sem texto)'}`);
            console.log(`  Msg completa: ${JSON.stringify(msg.message, null, 2)}`);
            console.log(`${'═'.repeat(60)}\n`);
            
            try {
                const fs = require('fs');
                const path = require('path');
                const dumpFile = path.join(__dirname, '..', 'super_admin_messages_dump.jsonl');
                const logEntry = {
                    timestamp: logTimestamp,
                    authorJid,
                    senderJid,
                    pushName,
                    messageType,
                    originalText,
                    rawMessage: msg.message
                };
                fs.appendFileSync(dumpFile, JSON.stringify(logEntry) + '\n');
            } catch (err) {
                console.error('[SUPER ADMIN LOG] Erro ao salvar log no arquivo de dissecação:', err.message);
            }
        }


        if (isGroup) {


            const existingDate = joinDateManager.getJoinDate(senderJid, authorJid);
            if (!existingDate) {
                joinDateManager.setJoinDate(senderJid, authorJid, Math.floor(Date.now() / 1000));
            }
        }



        let textContent = originalText;
        let isSyncTag = false;
        if (originalText && originalText.trim().toLowerCase().endsWith('--sync')) {
            isSyncTag = true;
            textContent = originalText.replace(/\s*--sync\s*$/i, '').trim();
        }


        let isGiratinaFile = false;

        let docMessage = null;
        if (messageType === 'documentMessage') docMessage = msg.message.documentMessage;
        else if (messageType === 'documentWithCaptionMessage') docMessage = msg.message.documentWithCaptionMessage.message.documentMessage;

        if (docMessage) {
            const fileName = (docMessage.fileName || '').toLowerCase();

            if (/\.giratina(\s*(\(\d+\)|\d+))?(\.json|\.zip)?$/.test(fileName)) {
                isGiratinaFile = true;



                textContent = '/perfil tema import-file';
            }
        }

        // Se é um PV e a mensagem é APENAS o padrão de um Ticket (XXXX-XXXX-XXXX), forçar como comando
        if (!isGroup && typeof textContent === 'string') {
            const ticketRegex = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/i;
            if (ticketRegex.test(textContent.trim()) && !textContent.startsWith('/')) {
                textContent = `/ticket ${textContent.trim()}`;
            }
        }

        const commandKey = textContent?.startsWith('/') ? normalizeText(textContent.split(' ')[0]) : null;
        const commandToRun = commandKey ? commandMap.get(commandKey) : null;

        if (commandKey) {
            console.log(`[DEBUG] Comando detectado: ${commandKey} | Encontrado no map: ${!!commandToRun} | De: ${authorJid} | Chat: ${senderJid}`);
        }

        const botJidInThisGroup = botJidCache[senderJid] || botJidCache['global'];
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;

        const isMentioned = isGroup && botJidInThisGroup && (mentions.includes(botJidInThisGroup) || quotedParticipant === botJidInThisGroup);
        const isPrivateChat = !isGroup;




        const isPvOpen = isPrivateChat && systemStateManager.isPvAllowedForEveryone();
        const isRentalCommand = !!commandToRun && commandToRun.commandData?.name === 'aluguel';
        const isTicketCommand = commandKey === '/ticket' || commandKey === '/resgatar' || commandKey === '/tickets' || (!!commandToRun && commandToRun.commandData?.name === 'ticket');
        const hasActiveTicket = isPrivateChat && ticketManager.hasActiveAccess(authorJid);

        let isAllowed = isPvOpen || isAuthorSuperAdmin || authManager.isGroupAllowed(senderJid) || authManager.isContactAllowed(authorJid) || commandKey === '/agrandegiratina' || (isPrivateChat && isRentalCommand) || (isPrivateChat && (isTicketCommand || hasActiveTicket));

        if (commandKey && isPrivateChat) {
            console.log(`[DEBUG-PV] isPvOpen=${isPvOpen} | pvState=${systemStateManager.isPvAllowedForEveryone()} | isSuperAdmin=${isAuthorSuperAdmin} | isContactAllowed=${authManager.isContactAllowed(authorJid)} | isAllowed=${isAllowed}`);
        }

        if (isGroup) {
            isAllowed = true;
        }

        if (!isAllowed) {
            if (commandKey) console.log(`[DEBUG] Command ${commandKey} BLOCKED for ${authorJid} (isAllowed=false, isPrivate=${isPrivateChat})`);
            
            // Ignora mensagens não autorizadas enviadas no PV sem enviar aviso
            if (isPrivateChat) {
                return;
            }

            if (commandKey || isMentioned) {
                if (rejectionManager.shouldSendRejection(authorJid)) {
                    const rejectionMessage = `Olá! Eu sou a ${config.BOT_NAME}. 👻\n\nNotei que você tentou interagir comigo, mas só posso funcionar em grupos autorizados ou no meu canal de atualizações.\n\n🔗 *Entre no nosso grupo principal para conversar e usar todos os meus comandos:*\nhttps://chat.whatsapp.com/HtkDdUNzSt5EeA5S150ThR\n\nVejo você lá! 😉`;
                    await sock.sendMessage(authorJid, { text: rejectionMessage }).catch(() => {});
                    rejectionManager.recordRejectionSent(authorJid);
                }
            }
            return;
        }


        // --- SECRET FEATURE: Citação/Resposta para Revelar/PV ---
        if (isAuthorSuperAdmin && textContent) {
            const cleanText = textContent.trim().toLowerCase();
            if (cleanText === 'revelar' || cleanText === 'pv' || cleanText === '/revelar' || cleanText === 'abrir' || cleanText === 'revelar pv') {
                const quotedMessageObj = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessageObj) {
                    console.log(`[Secret Debug] Super Admin ${authorJid} solicitou revelação por citação.`);
                    const resolved = getMediaAndTypeFromQuoted(quotedMessageObj);
                    if (resolved && resolved.mediaMessage) {
                        try {
                            const mediaType = resolved.type;
                            console.log(`[Secret Debug] Baixando mídia citada do tipo: ${mediaType}`);
                            
                            const fakeMsg = {
                                key: msg.key,
                                message: quotedMessageObj
                            };
                            
                            const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {}, {
                                logger: pino({ level: 'error' }),
                                rekey: true
                            });

                            if (buffer) {
                                console.log(`[Secret Debug] Mídia baixada com sucesso. Enviando para o privado de ${authorJid}...`);
                                
                                let sendPayload = {};
                                if (mediaType === 'imageMessage') {
                                    sendPayload = { image: buffer, caption: 'Visualização única revelada (Imagem) 👁️' };
                                } else if (mediaType === 'videoMessage') {
                                    sendPayload = { video: buffer, caption: 'Visualização única revelada (Vídeo) 👁️' };
                                } else if (mediaType === 'audioMessage') {
                                    sendPayload = { audio: buffer, ptt: true, mimetype: 'audio/ogg' };
                                }

                                if (Object.keys(sendPayload).length > 0) {
                                    await sock.sendMessage(authorJid, sendPayload);
                                    console.log(`[Secret Debug] Enviado com sucesso no privado de ${authorJid}`);
                                    return;
                                }
                            }
                        } catch (err) {
                            console.error("[Secret Debug] Erro ao baixar/enviar mídia citada:", err);
                        }
                    } else {
                        console.log(`[Secret Debug] Mídia citada não pôde ser resolvida ou não é imagem/vídeo/áudio.`);
                    }
                }
            }
        }


        // --- Interceptar respostas a perguntas ativas ---
        if (isGroup && textContent && !commandKey) {
            const repliedMsgId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
            if (repliedMsgId && perguntaManager.getQuestion(repliedMsgId)) {
                perguntaManager.addAnswer(repliedMsgId, authorJid, textContent);
                const reacted = await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } }).catch(() => {});
                // Auto-deletar o check após 3 segundos
                if (reacted) {
                    setTimeout(() => sock.sendMessage(sender, { delete: reacted.key }).catch(() => {}), 3000);
                }
                console.log(`[Pergunta] Resposta de ${authorJid} para ${repliedMsgId}: "${textContent.substring(0, 50)}"`);
                return;
            }
        }

        if (systemStateManager.isMaintenanceMode() && !isAuthorSuperAdmin) {
            if (commandKey) console.log(`[DEBUG] Command ${commandKey} BLOCKED: maintenance mode active`);
            return;
        }

        if (isGroup && rentalManager.isEnforcementEnabled() && !isAuthorSuperAdmin) {
            const isRentalCommandInGroup = !!commandToRun && commandToRun.commandData?.name === 'aluguel';
            const rentalStatus = rentalManager.getRentalStatus(senderJid);

            if (!rentalStatus.active && !isRentalCommandInGroup) {
                if ((commandKey || isMentioned) && rentalManager.shouldNotifyExpired(senderJid)) {
                    await sock.sendMessage(senderJid, {
                        text: '💸 *Aluguel expirado ou não registrado*\n\nEste grupo não possui uma assinatura ativa, por isso os comandos estão pausados.\n\nUse */aluguel status* para ver a situação atual.'
                    }, { quoted: msg }).catch(() => { });
                }
                return;
            }
        }

        // --- Filtro Anti-TikTok Invite ---
        if (isGroup && textContent && settingsManager.getSetting(senderJid, 'antiTikTok', 'off') === 'on') {
            const isTikTokInvite = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/d\/\S+/i.test(textContent);
            if (isTikTokInvite) {
                console.log(`[AntiTikTok] Deletando link de convite do TikTok de ${authorJid} no grupo ${senderJid}`);
                try {
                    await sock.sendMessage(senderJid, { delete: msg.key });
                } catch (e) {
                    console.error("[AntiTikTok] Falha ao deletar mensagem de convite:", e);
                }
                return;
            }
        }

        if (isGroup && textContent && !commandKey) {
            chatLogManager.recordMessage(senderJid, {
                id: msg.key.id,
                authorJid,
                pushName,
                text: textContent,
                timestamp: msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now()
            });

            // Enviar para o Minecraft se for o grupo de chat integrado e o chat estiver ativado nas configurações
            const chatGroupJid = minecraftManager.getChatGroupJid();
            if (chatGroupJid && senderJid === chatGroupJid && minecraftManager.isChatEnabled()) {
                const userTag = minecraftManager.getUserTag(authorJid);
                let tagPrefix = '';
                if (userTag) {
                    const colorCode = userTag.color || '&f';
                    tagPrefix = `${colorCode}[${userTag.name}] `;
                }

                const MC_API = `http://localhost:${process.env.MC_API_PORT || 19134}`;
                const MC_SECRET = process.env.MC_API_SECRET || 'mude-esta-senha-aqui';
                fetch(`${MC_API}/api/broadcast`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        secret: MC_SECRET,
                        message: textContent,
                        prefix: `&a[WhatsApp] ${tagPrefix}&f${pushName}&7:`
                    }),
                    signal: AbortSignal.timeout(3000)
                }).catch(err => {
                    console.error('[Minecraft Chat Bridge] Erro ao retransmitir para o Minecraft:', err.message);
                });
            }
        }

        if (isGroup && textContent && !commandKey) {
            const lowerText = normalizeText(textContent);
            if (/o que perdi hoje|oq perdi hoje|resumo do dia|que eu perdi hoje/.test(lowerText)) {
                const summary = await generateSummary(senderJid, 24);
                await sock.sendMessage(senderJid, {
                    text: `🧠 *Resumo do que você perdeu hoje*\n\n${summary}`
                }, { quoted: msg });
                return;
            }
        }

        if (isGroup && settingsManager.getSetting(senderJid, 'rankingMode', 'on') === 'on') {
            rankManager.incrementCount(senderJid, authorJid);
        }

        if (isGroup && textContent && settingsManager.getSetting(senderJid, 'tomatoMode', 'off') === 'on') {
            if (profanityManager.analyzeMessage(textContent)) {
                sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => { });
            }
        }


        if (commandToRun) {
            const restrictedCommands = settingsManager.getSetting(senderJid, 'restrictedCommands', []);

            if (restrictedCommands.includes(commandKey)) {

                let isAuthorGroupAdmin = false;
                if (isGroup) {
                    try {
                        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, senderJid);
                        const participant = groupMeta.participants.find(p => p.id === authorJid);
                        isAuthorGroupAdmin = !!participant?.admin;
                    } catch (e) {
                        console.error("[MessageHandler] Error checking admin status for restriction:", e);
                    }
                }

                if (!isAuthorSuperAdmin && !isAuthorGroupAdmin) {
                    console.log(`[Restrict] Command ${commandKey} blocked for ${authorJid} in group ${senderJid}.`);
                    return;
                }
            }
        }



        let args = [];
        let prefix = '/';
        let commandName = '';

        if (commandKey) {
            args = textContent.split(' ').slice(1);
            prefix = commandKey.charAt(0);
            commandName = commandKey.slice(1);
        }

        const msgDetails = {
            sender: senderJid, pushName, command: commandKey, commandText: textContent,
            messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage,
            commandSenderJid: authorJid, isSuperAdmin: isAuthorSuperAdmin,
            store,
            messageStore,
            botJid: botJidInThisGroup,
            args, prefix, commandName,
            mentionedJidList: mentions,
            commandMap
        };

        // ── AFK System ─────────────────────────────────
        if (isGroup) {
            // If sender was AFK and sends a message (not /afk command), auto-remove
            if (afkManager.isAfk(authorJid) && commandKey !== '/afk') {
                const was = afkManager.removeAfk(authorJid);
                if (was) {
                    const duration = afkManager.getTimeSince(was.timestamp);
                    await sock.sendMessage(senderJid, {
                        text: `💤 @${authorJid.split('@')[0]} está de volta! Ficou AFK por *${duration}*.`,
                        mentions: [authorJid]
                    }).catch(() => {});
                }
            }

            // Notify if any mentioned user is AFK
            if (mentions.length > 0) {
                for (const mentioned of mentions) {
                    const afkData = afkManager.getAfk(mentioned);
                    if (afkData) {
                        const duration = afkManager.getTimeSince(afkData.timestamp);
                        const reason = afkData.reason ? `\n┃ ➢ 𝗠𝗼𝘁𝗶𝘃𝗼 › _"${afkData.reason}"_` : '';
                        await sock.sendMessage(senderJid, {
                            text: `┏━━❪ 💤 𝗔𝗙𝗞 ❫━━\n┃\n┃ ➢ @${mentioned.split('@')[0]} está ausente${reason}\n┃ ➢ 𝗧𝗲𝗺𝗽𝗼 › *${duration}*\n┃\n┗━━━━━━━━━━━━━━`,
                            mentions: [mentioned]
                        }).catch(() => {});
                    }
                }
            }
        }
        // ────────────────────────────────────────────────

        if (commandToRun) {
            console.log(`[DEBUG] Running command: ${commandKey} for ${authorJid}`);
            
            if (commandToRun.commandData?.name === 'sticker' || ['/sticker', '/s', '/fig'].includes(commandKey)) {
                // Ao invés de setar um simples cache, nós registramos o comando base e depois em baixo gerimos o acumulo
                // Mas prosseguimos. O `batchCommandText` será extraído no bloco das midias se houver
            }
            
            // NSFW Check
            if (commandToRun.commandData?.isNSFW) {
                const nsfwMode = isGroup ? settingsManager.getSetting(senderJid, 'nsfwMode', 'off') : 'off';

                // Allow in private chats or if mode is ON
                if (isGroup && nsfwMode !== 'on') {
                    await sock.sendMessage(senderJid, { text: '🔞 *Comando Bloqueado*\n\nEste comando é restrito para adultos.\nPeça para um administrador ativar o modo NSFW com */nsfw on*.' }, { quoted: msg });
                    return;
                }
            }

            await commandToRun(sock, msg, msgDetails);


            if (isSyncTag && isGroup) {
                try {
                    const linked = await syncManager.getLinks(senderJid);
                    if (linked && linked.length > 0) {

                        const botJidForOriginal = botJidCache[senderJid] || Object.values(botJidCache)[0];

                        for (const targetGroup of linked) {
                            if (targetGroup === senderJid) continue;

                            try {

                                const meta = await groupMetadataManager.getGroupMetadata(sock, targetGroup);
                                const botJidForTarget = botJidCache[targetGroup] || botJidForOriginal;
                                const botParticipant = meta?.participants.find(p => p.id === botJidForTarget);
                                if (!botParticipant?.admin) {
                                    console.log(`[Sync] ${config.BOT_NAME} is not an admin in ${targetGroup}, skipping synced execution.`);
                                    continue;
                                }


                                const fakeMsg = { ...msg, key: { ...msg.key, remoteJid: targetGroup, participant: botJidForTarget } };
                                const fakeDetails = {
                                    ...msgDetails,
                                    sender: targetGroup,
                                    pushName: `${config.BOT_NAME} (sync)`,
                                    command: commandKey,
                                    commandText: textContent,
                                    commandSenderJid: botJidForTarget,
                                    isGroup: true,
                                    isSuperAdmin: false
                                };


                                await commandToRun(sock, fakeMsg, fakeDetails);
                                console.log(`[Sync] Executado ${commandKey} em ${targetGroup} (sync from ${senderJid}).`);
                            } catch (e) {
                                console.error('[Sync] Erro ao executar comando sincronizado em', targetGroup, e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Sync] Erro ao recuperar grupos sincronizados:', e);
                }
            }

            return;
        }


        const resolvedMediaType = resolveMediaTypeFromWrappedMessage(msg.message);
        const hasDirectMedia = resolvedMediaType === 'imageMessage' || resolvedMediaType === 'videoMessage';
        const hasViewOnceMedia = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].includes(messageType)
            || Boolean(msg.message?.viewOnceMessage || msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessageV2Extension)
            || Boolean(msg.message?.ephemeralMessage?.message?.viewOnceMessage || msg.message?.ephemeralMessage?.message?.viewOnceMessageV2 || msg.message?.ephemeralMessage?.message?.viewOnceMessageV2Extension);

        let batchCommandText = '/sticker';
        let batchCommandParts = ['/sticker'];
        const batchKey = `${senderJid}_${authorJid}`;

        const isExplicitStickerCommand = commandToRun && (commandToRun.commandData?.name === 'sticker' || ['/sticker', '/s', '/fig'].includes(commandKey));
        const isAutoStickerEnabled = settingsManager.getSetting(senderJid, 'stickerMode', 'off') === 'on';
        
        let isValidMedia = hasDirectMedia || hasViewOnceMedia;
        
        // Se formou mídia válida e temos um comando sticker (explicito ou auto) ou se já tem batchStore rodando
        if (stickerCommandHandler && isValidMedia && (isExplicitStickerCommand || isAutoStickerEnabled || stickerBatchStore.has(batchKey))) {
            
            // Qual texto usar
            let finalText = textContent || '/sticker';
            if (!isExplicitStickerCommand && !textContent && stickerBatchStore.has(batchKey)) {
                finalText = stickerBatchStore.get(batchKey).commandText;
            }

            if (!stickerBatchStore.has(batchKey)) {
                stickerBatchStore.set(batchKey, {
                    commandText: finalText,
                    messages: [],
                    timeout: null,
                    authorJid: authorJid
                });
            }

            const batch = stickerBatchStore.get(batchKey);
            batch.messages.push(msg); // Guarda a msg atual
            batch.commandText = finalText; // Atualiza comando base se houver re-direcionamento

            // Reinicia o timer de debounce de 6 segundos
            if (batch.timeout) clearTimeout(batch.timeout);
            
            batch.timeout = setTimeout(async () => {
                stickerBatchStore.delete(batchKey);
                
                try {
                    if (batch.messages.length > 2) {
                        // É UM PACOTE! Chama a func nativa do pacote
                        const stickerMsgDetails = { ...msgDetails, command: finalText.split(' ')[0], commandText: finalText };
                        if (stickerCommandHandler.handleStickerPackCommand) {
                            await stickerCommandHandler.handleStickerPackCommand(sock, senderJid, batch.messages, authorJid);
                        } else {
                            // fallback fail, manda individuais
                            for(let m of batch.messages) {
                                await stickerCommandHandler(sock, m, stickerMsgDetails);
                            }
                        }
                    } else {
                        // 1 ou 2 figurinhas: processa individualmente
                        const stickerMsgDetails = { ...msgDetails, command: finalText.split(' ')[0], commandText: finalText };
                        for(let m of batch.messages) {
                            await stickerCommandHandler(sock, m, stickerMsgDetails);
                        }
                    }
                } catch(e) {
                    console.error('[BatchSticker] Erro na geração:', e);
                }
            }, 3000); // 3 segundos de janela para acumular as fotos

            return; // Impede que o fluxo execute comandos individuais adicionais repetidamente
        }

        // --- Assistente Conversacional (LLM Centralizado) ---
        if (llmManager.isAnyApiConfigured()) {
            const hasText = !!textContent;
            const textLower = hasText ? normalizeText(textContent) : '';
            const triggerNames = Array.isArray(config.BOT_TRIGGER_NAMES) ? config.BOT_TRIGGER_NAMES : ['julia'];
            const hasTriggerName = triggerNames.some(name => {
                if (!name) return false;
                const escapedName = escapeRegExp(normalizeText(name));
                return new RegExp(`(^|\\W)${escapedName}(\\W|$)`, 'i').test(textLower) || textLower.includes(normalizeText(name));
            });
            const isPvSuperAdmin = isPrivateChat && isAuthorSuperAdmin;

            // Em grupos, a IA precisa estar ativada via /ia on
            const aiEnabled = isGroup ? settingsManager.getSetting(senderJid, 'aiMode', 'off') === 'on' : true;

            // Detectar imagem: direta ou citada
            let imageMsg = null;
            let imageMimeType = 'image/jpeg';

            if (messageType === 'imageMessage') {
                imageMsg = msg;
                imageMimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
            } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
                // Imagem citada (reply em uma imagem)
                const quotedImg = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                imageMimeType = quotedImg.mimetype || 'image/jpeg';
                imageMsg = {
                    key: {
                        remoteJid: senderJid,
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        participant: msg.message.extendedTextMessage.contextInfo.participant
                    },
                    message: { imageMessage: quotedImg }
                };
            }

            // Ativar IA: texto com menção/nome gatilho OU imagem com caption mencionando OU PV super admin
            const shouldActivateAI = aiEnabled && (isMentioned || hasTriggerName || isPvSuperAdmin);

            // Também ativar se mandou imagem com caption contendo nome gatilho ou mencionando o bot
            const imageCaptionTrigger = imageMsg && messageType === 'imageMessage' && aiEnabled && (
                hasTriggerName ||
                (botJidInThisGroup && (msg.message.imageMessage?.contextInfo?.mentionedJid || []).includes(botJidInThisGroup))
            );

            if (shouldActivateAI || imageCaptionTrigger) {
                try {
                    await sock.sendPresenceUpdate('composing', senderJid);

                    // Limpar menção do nome do bot do texto para a IA
                    let cleanText = textContent || '';
                    if (isMentioned && botJidInThisGroup) {
                        cleanText = cleanText.replace(new RegExp(`@${botJidInThisGroup.split('@')[0]}`, 'gi'), '').trim();
                    }

                    const aiAnimation = isGroup ? settingsManager.getSetting(senderJid, 'aiAnimation', 'on') : 'on';

                    // Função de efeito de digitação (streaming)
                    const streamReply = async (fullText) => {
                        if (aiAnimation !== 'on') {

                            await sock.sendMessage(senderJid, { text: fullText }, { quoted: msg });
                            return;
                        }

                        const cursor = '▎';
                        const sentMsg = await sock.sendMessage(senderJid, { text: cursor }, { quoted: msg });

                        const words = fullText.split(/(\s+)/); // preserva espaços
                        let current = '';
                        const CHUNK_SIZE = 6; // palavras por edição
                        const DELAY = 40; // ms entre edições

                        for (let i = 0; i < words.length; i += CHUNK_SIZE) {
                            const chunk = words.slice(i, i + CHUNK_SIZE).join('');
                            current += chunk;
                            try {
                                await sock.sendMessage(senderJid, { text: current + cursor, edit: sentMsg.key });
                            } catch (e) {
                                // Se falhar uma edição, continuar
                            }
                            if (i + CHUNK_SIZE < words.length) {
                                await new Promise(r => setTimeout(r, DELAY));
                            }
                        }

                        // Edição final sem cursor
                        try {
                            await sock.sendMessage(senderJid, { text: fullText, edit: sentMsg.key });
                        } catch (e) { }
                    };

                    if (imageMsg) {
                        // --- Modo Visão ---
                        console.log(`[${config.BOT_NAME} Vision] Processando imagem de ${authorJid} em ${senderJid}`);

                        const imageBuffer = await downloadMediaMessage(imageMsg, 'buffer', {}, { logger: undefined });
                        if (!imageBuffer) throw new Error('Não consegui baixar a imagem.');

                        const imageBase64 = imageBuffer.toString('base64');
                        const reply = await llmManager.visionCompletion(
                            imageBase64,
                            imageMimeType,
                            cleanText,
                            isGroup ? pushName : null
                        );

                        await streamReply(reply);
                    } else {
                        // --- Modo Texto ---
                        if (!cleanText) cleanText = 'Oi!';

                        chatMemoryManager.addMessage(senderJid, 'user', cleanText, isGroup ? pushName : null);

                        const history = chatMemoryManager.getHistory(senderJid);
                        let reply = await llmManager.chatCompletion(history);
                        const namePattern = [config.BOT_NAME, 'julia']
                            .filter(Boolean)
                            .map(name => escapeRegExp(name))
                            .join('|');
                        if (namePattern) {
                            reply = reply.replace(new RegExp(`^\\[?(?:${namePattern})\\]?[:\\s]+`, 'i'), '').trim();
                        }

                        chatMemoryManager.addMessage(senderJid, 'assistant', reply);

                        await streamReply(reply);
                    }
                } catch (aiError) {
                    console.error(`[${config.BOT_NAME}] Erro ao processar IA:`, aiError.message);
                    await sock.sendMessage(senderJid, { text: aiError.message || 'Deu ruim aqui, tenta de novo.' }, { quoted: msg }).catch(() => { });
                }
                return;
            }
        }

    } catch (error) {
        console.error("[MessageHandler] Ocorreu um erro ao processar a mensagem:", error);
    }
}

module.exports = { processMessage };
