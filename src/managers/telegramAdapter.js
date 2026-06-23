/**
 * telegramAdapter.js - Adaptador que permite comandos do WhatsApp rodarem no Telegram
 * 
 * Cria um "fake sock" proxy que intercepta sock.sendMessage() e converte
 * para chamadas da API do Telegram. Também cria objetos msg e msgDetails
 * compatíveis a partir de mensagens do Telegram.
 * 
 * Sincronização global: se o username/first_name do Telegram bater com
 * um nick registrado no WhatsApp, usa o JID real do WhatsApp.
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const contactManager = require('./contactManager.js');

const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'telegram');

async function ensureTempDir() {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    return TEMP_DIR;
}

/**
 * Cria um proxy "sock" que intercepta sendMessage e manda para o Telegram
 */
function createTelegramSock(tgBot, chatId, replyToMessageId) {
    // Mapa para rastrear mensagens enviadas (para edit/react)
    const sentMessages = new Map();

    const sock = {
        // O principal: interceptar sendMessage
        sendMessage: async (targetJid, content, options = {}) => {
            try {
                const replyTo = options?.quoted ? replyToMessageId : undefined;

                // ─── Texto ───
                if (content.text && !content.edit) {
                    const tgOpts = {
                        reply_to_message_id: replyTo,
                    };

                    // Converter menções @55xxxx para @username ou texto limpo
                    let text = content.text;
                    if (content.mentions && Array.isArray(content.mentions)) {
                        for (const jid of content.mentions) {
                            const phone = jid.split('@')[0];
                            text = text.replace(`@${phone}`, `@${phone}`);
                        }
                    }

                    const sent = await tgBot.sendMessage(chatId, text, tgOpts);
                    // Guardar referência para possíveis edits
                    return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                }

                // ─── Edit de mensagem ───
                if (content.text && content.edit) {
                    const tgMsgId = content.edit._tgMsgId || content.edit.id?.replace('tg_', '');
                    if (tgMsgId) {
                        try {
                            await tgBot.editMessageText(content.text, {
                                chat_id: chatId,
                                message_id: parseInt(tgMsgId)
                            });
                        } catch (e) {
                            // Edit pode falhar se mensagem foi apagada, ignorar
                        }
                    }
                    return { key: content.edit };
                }

                // ─── React (emoji) ───
                if (content.react) {
                    const targetMsgId = content.react.key?._tgMsgId || replyToMessageId;
                    if (targetMsgId && content.react.text) {
                        try {
                            // node-telegram-bot-api não tem setMessageReaction nativo,
                            // usar chamada direta à API do Telegram
                            await tgBot._request('setMessageReaction', {
                                form: {
                                    chat_id: chatId,
                                    message_id: parseInt(targetMsgId),
                                    reaction: JSON.stringify([{ type: 'emoji', emoji: content.react.text }])
                                }
                            });
                        } catch (e) {
                            // Algumas reações podem não existir no Telegram, ignorar
                        }
                    }
                    return {};
                }

                // ─── Imagem ───
                if (content.image) {
                    let imageSource;
                    if (Buffer.isBuffer(content.image)) {
                        const tempDir = await ensureTempDir();
                        const tempPath = path.join(tempDir, `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`);
                        await fs.writeFile(tempPath, content.image);
                        imageSource = tempPath;
                        // Cleanup depois
                        setTimeout(async () => { try { await fs.unlink(tempPath); } catch (e) {} }, 30000);
                    } else if (content.image.url) {
                        imageSource = content.image.url;
                    } else if (typeof content.image === 'string') {
                        imageSource = content.image;
                    }

                    if (imageSource) {
                        const sent = await tgBot.sendPhoto(chatId, imageSource, {
                            caption: content.caption || '',
                            reply_to_message_id: replyTo
                        });
                        return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                    }
                }

                // ─── Vídeo ───
                if (content.video) {
                    let videoSource;
                    if (Buffer.isBuffer(content.video)) {
                        const tempDir = await ensureTempDir();
                        const tempPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
                        await fs.writeFile(tempPath, content.video);
                        videoSource = tempPath;
                        setTimeout(async () => { try { await fs.unlink(tempPath); } catch (e) {} }, 60000);
                    } else if (content.video.url) {
                        videoSource = content.video.url;
                    } else if (typeof content.video === 'string') {
                        videoSource = content.video;
                    }

                    if (videoSource) {
                        const sent = await tgBot.sendVideo(chatId, videoSource, {
                            caption: content.caption || '',
                            reply_to_message_id: replyTo
                        });
                        return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                    }
                }

                // ─── Áudio ───
                if (content.audio) {
                    let audioSource;
                    if (Buffer.isBuffer(content.audio)) {
                        const tempDir = await ensureTempDir();
                        const ext = content.ptt ? 'ogg' : 'mp3';
                        const tempPath = path.join(tempDir, `audio_${Date.now()}.${ext}`);
                        await fs.writeFile(tempPath, content.audio);
                        audioSource = tempPath;
                        setTimeout(async () => { try { await fs.unlink(tempPath); } catch (e) {} }, 60000);
                    } else if (content.audio.url) {
                        audioSource = content.audio.url;
                    }

                    if (audioSource) {
                        let sent;
                        if (content.ptt) {
                            sent = await tgBot.sendVoice(chatId, audioSource, {
                                reply_to_message_id: replyTo
                            });
                        } else {
                            sent = await tgBot.sendAudio(chatId, audioSource, {
                                reply_to_message_id: replyTo
                            });
                        }
                        return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                    }
                }

                // ─── Sticker ───
                if (content.sticker) {
                    let stickerSource;
                    if (Buffer.isBuffer(content.sticker)) {
                        const tempDir = await ensureTempDir();
                        const tempPath = path.join(tempDir, `stk_${Date.now()}.webp`);
                        await fs.writeFile(tempPath, content.sticker);
                        stickerSource = tempPath;
                        setTimeout(async () => { try { await fs.unlink(tempPath); } catch (e) {} }, 30000);
                    }

                    if (stickerSource) {
                        const sent = await tgBot.sendSticker(chatId, stickerSource);
                        return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                    }
                }

                // ─── Documento ───
                if (content.document) {
                    let docSource;
                    if (Buffer.isBuffer(content.document)) {
                        const tempDir = await ensureTempDir();
                        const tempPath = path.join(tempDir, content.fileName || `doc_${Date.now()}`);
                        await fs.writeFile(tempPath, content.document);
                        docSource = tempPath;
                        setTimeout(async () => { try { await fs.unlink(tempPath); } catch (e) {} }, 60000);
                    } else if (content.document.url) {
                        docSource = content.document.url;
                    }

                    if (docSource) {
                        const sent = await tgBot.sendDocument(chatId, docSource, {
                            caption: content.caption || '',
                            reply_to_message_id: replyTo
                        });
                        return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                    }
                }

                // ─── Forward (encaminhar) ───
                if (content.forward) {
                    // Não suportado diretamente, enviar como texto
                    const fwdText = content.forward?.message?.conversation || 
                                    content.forward?.message?.extendedTextMessage?.text ||
                                    '[Mensagem encaminhada]';
                    const sent = await tgBot.sendMessage(chatId, `↪️ ${fwdText}`);
                    return { key: { id: `tg_${sent.message_id}`, _tgMsgId: sent.message_id } };
                }

                // ─── Fallback: se nada bateu, tenta enviar como texto ───
                console.log('[TG-Adapter] Tipo de conteúdo não suportado:', Object.keys(content));
                return {};

            } catch (err) {
                console.error('[TG-Adapter] Erro ao enviar mensagem:', err.message);
                return {};
            }
        },

        // Stubs para métodos que comandos podem chamar
        sendPresenceUpdate: async () => {},
        profilePictureUrl: async () => 'https://telegra.ph/file/24fa902ead26340f3df2c.png',
        updateMediaMessage: async () => {},
        groupMetadata: async () => ({ participants: [], subject: 'Telegram Group' }),

        // Referência ao user (bot)
        user: { id: 'telegram@s.whatsapp.net' }
    };

    return sock;
}

// ─── Sincronização Global: Resolver nick TG → JID WhatsApp ──

/**
 * Tenta resolver o JID real do WhatsApp comparando:
 * 1. username do Telegram (ex: "Neko") com nicknames do WhatsApp
 * 2. first_name do Telegram com nicknames do WhatsApp
 * 
 * Se bater, retorna o JID real; senão, retorna um JID fake.
 */
function resolveWhatsAppJid(tgUser) {
    const telegramId = tgUser.id;
    const username = tgUser.username || '';
    const firstName = tgUser.first_name || '';

    // Tentar resolver pelo username
    if (username) {
        const jid = contactManager.getJidByNickname(username);
        if (jid) {
            console.log(`[TG-Sync] Nick "${username}" (TG @${username}) → ${jid} (WhatsApp)`);
            return { jid, matched: true, nick: username };
        }
    }

    // Tentar resolver pelo first_name
    if (firstName) {
        const jid = contactManager.getJidByNickname(firstName);
        if (jid) {
            console.log(`[TG-Sync] Nome "${firstName}" (TG) → ${jid} (WhatsApp)`);
            return { jid, matched: true, nick: firstName };
        }
    }

    // Sem match → JID fake
    return { jid: `tg_${telegramId}@s.whatsapp.net`, matched: false, nick: null };
}

/**
 * Cria um objeto msg fake compatível com o formato do Baileys
 */
function createFakeMsg(tgMsg) {
    const chatId = tgMsg.chat.id;
    const isGroup = tgMsg.chat.type === 'group' || tgMsg.chat.type === 'supergroup';
    const senderId = tgMsg.from.id;
    const senderName = tgMsg.from.first_name || tgMsg.from.username || 'Telegram User';
    
    // Resolver JID real via nick do WhatsApp
    const resolved = resolveWhatsAppJid(tgMsg.from);
    const senderJid = resolved.jid;
    const chatJid = isGroup ? `tg_${chatId}@g.us` : senderJid;

    // Texto da mensagem
    const text = tgMsg.text || tgMsg.caption || '';

    // Verificar se é reply a outra mensagem
    let quotedMessage = null;
    if (tgMsg.reply_to_message) {
        const repliedText = tgMsg.reply_to_message.text || tgMsg.reply_to_message.caption || '';
        quotedMessage = {
            conversation: repliedText
        };
    }

    const msg = {
        key: {
            remoteJid: chatJid,
            fromMe: false,
            id: `tg_msg_${tgMsg.message_id}`,
            participant: isGroup ? senderJid : undefined,
            _tgMsgId: tgMsg.message_id
        },
        pushName: senderName,
        messageTimestamp: tgMsg.date || Math.floor(Date.now() / 1000),
        message: {
            extendedTextMessage: {
                text: text,
                contextInfo: {
                    quotedMessage: quotedMessage,
                    mentionedJid: [],
                    participant: tgMsg.reply_to_message ? `tg_${tgMsg.reply_to_message.from.id}@s.whatsapp.net` : undefined,
                    stanzaId: tgMsg.reply_to_message ? `tg_msg_${tgMsg.reply_to_message.message_id}` : undefined
                }
            },
            conversation: text
        }
    };

    return msg;
}

/**
 * Cria o objeto msgDetails compatível com o messageHandler
 */
function createMsgDetails(tgMsg, commandMap) {
    const text = tgMsg.text || tgMsg.caption || '';
    const chatId = tgMsg.chat.id;
    const isGroup = tgMsg.chat.type === 'group' || tgMsg.chat.type === 'supergroup';
    const senderId = tgMsg.from.id;
    const senderName = tgMsg.from.first_name || tgMsg.from.username || 'Telegram User';

    // Resolver JID real via nick do WhatsApp
    const resolved = resolveWhatsAppJid(tgMsg.from);
    const senderJid = resolved.jid;
    const chatJid = isGroup ? `tg_${chatId}@g.us` : senderJid;

    // Parse do comando
    const parts = text.trim().split(/\s+/);
    // Remove @botusername do comando (ex: /ping@MeuBot)
    let commandKey = parts[0]?.toLowerCase().split('@')[0] || '';
    if (!commandKey.startsWith('/')) commandKey = `/${commandKey}`;
    
    const args = parts.slice(1);
    const commandName = commandKey.slice(1);

    // Verificar se é admin no Telegram
    const isAdmin = tgMsg._isAdmin || false;

    return {
        sender: chatJid,
        pushName: senderName,
        command: commandKey,
        commandText: text,
        messageType: 'extendedTextMessage',
        isGroup: isGroup,
        quotedMsgInfo: tgMsg.reply_to_message ? { conversation: tgMsg.reply_to_message.text || '' } : null,
        commandSenderJid: senderJid,
        isSuperAdmin: false,
        store: null,
        messageStore: new Map(),
        botJid: 'telegram@s.whatsapp.net',
        args: args,
        prefix: '/',
        commandName: commandName,
        mentionedJidList: [],
        commandMap: commandMap,
        // Flag especial para identificar que é do Telegram
        _isTelegram: true,
        _telegramChatId: chatId,
        _telegramMsg: tgMsg,
        _resolvedWhatsApp: resolved.matched,
        _resolvedNick: resolved.nick
    };
}

module.exports = {
    createTelegramSock,
    createFakeMsg,
    createMsgDetails
};
