/**
 * telegramBridge.js - Ponte WhatsApp ↔ Telegram completa
 * 
 * Funcionalidades:
 * - Todos os comandos do bot funcionam no Telegram (PV e grupos)
 * - Vincula WhatsApp JID ↔ Telegram Chat ID via código
 * - Exporta stickers do WhatsApp → Telegram (comando /importar)
 * - Exporta stickers do Telegram → WhatsApp (enviar sticker no PV do bot TG)
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { createTelegramSock, createFakeMsg, createMsgDetails } = require('./telegramAdapter.js');
const config = require('../../config.js');

const LINKS_PATH = path.join(__dirname, '..', '..', 'data', 'telegram_links.json');
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp', 'telegram');
const BOT_NAME = config.BOT_NAME || 'Bot';

let tgBot = null;
let waSock = null;
let commandMap = null;
let initializedToken = null;

// { whatsappJid: { telegramChatId, linkedAt } }
let links = {};

// Códigos pendentes: { code: { whatsappJid, createdAt } }
const pendingCodes = new Map();

// ─── Carregar/Salvar vínculos ──────────────────────────────

async function loadLinks() {
    try {
        const data = await fs.readFile(LINKS_PATH, 'utf-8');
        links = JSON.parse(data);
    } catch (e) {
        links = {};
    }
}

async function saveLinks() {
    await fs.writeFile(LINKS_PATH, JSON.stringify(links, null, 2));
}

// ─── Helpers ───────────────────────────────────────────────

function generateCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars como A1B2C3
}

function getWhatsAppJidByTelegramId(telegramChatId) {
    for (const [jid, data] of Object.entries(links)) {
        if (data.telegramChatId === telegramChatId) return jid;
    }
    return null;
}

function getTelegramIdByWhatsAppJid(jid) {
    return links[jid]?.telegramChatId || null;
}

async function ensureTempDir() {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    return TEMP_DIR;
}

// ─── Inicializar Bot do Telegram ─────────────────────────

async function initialize(sock, cmdMap) {
    waSock = sock;
    commandMap = cmdMap || null;
    await loadLinks();

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('[TelegramBridge] TELEGRAM_BOT_TOKEN não definido no .env!');
        return null;
    }

    if (tgBot && initializedToken === token) {

        return tgBot;
    }

    if (tgBot && initializedToken !== token) {
        try {
            await tgBot.stopPolling();
        } catch (e) { }
        tgBot = null;
    }

    tgBot = new TelegramBot(token, { polling: true });
    initializedToken = token;


    tgBot.on('polling_error', (error) => {
        const message = error?.message || 'Erro desconhecido';

        // 409 Conflict é esperado durante restart do PM2 — ignorar silenciosamente
        if (message.includes('409 Conflict')) return;

        console.error('[TelegramBridge] polling_error:', message);
    });

    // ── Comando /start ──
    tgBot.onText(/\/start(?:\s+(.+))?/, async (tgMsg, match) => {
        const chatId = tgMsg.chat.id;
        const param = match[1];

        if (param && param.startsWith('link_')) {
            // Vinculação via deep link: /start link_CODIGO
            const code = param.replace('link_', '');
            const pending = pendingCodes.get(code);

            if (!pending) {
                return tgBot.sendMessage(chatId, '┏━━❪ ❌ 𝗘𝗥𝗥𝗢 ❫━━\n┃\n┃ ➢ Código inválido ou expirado.\n┃ ➢ Gere um novo com /importar vincular\n┃   no WhatsApp.\n┃\n┗━━━━━━━━━━━━━━');
            }

            // Verificar se já existe vínculo com esse Telegram
            const existingJid = getWhatsAppJidByTelegramId(chatId);
            if (existingJid && existingJid !== pending.whatsappJid) {
                // Remover vínculo antigo
                delete links[existingJid];
            }

            // Criar vínculo
            links[pending.whatsappJid] = {
                telegramChatId: chatId,
                telegramUsername: tgMsg.from.username || tgMsg.from.first_name || 'Desconhecido',
                linkedAt: new Date().toISOString()
            };
            await saveLinks();
            pendingCodes.delete(code);

            await tgBot.sendMessage(chatId,
                `┏━━❪ ✅ 𝗩𝗜𝗡𝗖𝗨𝗟𝗔𝗗𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › Conectado!\n` +
                `┃\n` +
                `┃ Seu WhatsApp agora está\n` +
                `┃ conectado a este chat.\n` +
                `┃\n` +
                `┣━━❪ 📌 𝗖𝗢𝗠𝗢 𝗨𝗦𝗔𝗥 ❫━━\n` +
                `┃\n` +
                `┃ ➢ No WhatsApp: responda a uma\n` +
                `┃   figurinha com /importar\n` +
                `┃ ➢ Aqui: envie uma figurinha e\n` +
                `┃   ela vai pro seu WhatsApp\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );

            return;
        }

        // /start normal
        await tgBot.sendMessage(chatId,
            `┏━━❪ 👻 ${BOT_NAME.toUpperCase()} ❫━━\n` +
            `┃\n` +
            `┃ ➢ 𝗣𝗼𝗻𝘁𝗲 𝗱𝗲 𝗙𝗶𝗴𝘂𝗿𝗶𝗻𝗵𝗮𝘀\n` +
            `┃   WhatsApp ↔ Telegram\n` +
            `┃\n` +
            `┣━━❪ 📌 𝗩𝗜𝗡𝗖𝗨𝗟𝗔𝗥 ❫━━\n` +
            `┃\n` +
            `┃ ➢ No WhatsApp, envie:\n` +
            `┃   /importar vincular\n` +
            `┃ ➢ Clique no link que a\n` +
            `┃   ${BOT_NAME} te enviar\n` +
            `┃ ➢ Pronto! Conectados\n` +
            `┃\n` +
            `┣━━❪ 🛠️ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ❫━━\n` +
            `┃\n` +
            `┃ ➢ /status › Ver vínculo\n` +
            `┃ ➢ /desvincular › Remover\n` +
            `┃\n` +
            `┗━━━━━━━━━━━━━━`
        );
    });

    // ── Comando /status ──
    tgBot.onText(/\/status/, async (tgMsg) => {
        const chatId = tgMsg.chat.id;
        const jid = getWhatsAppJidByTelegramId(chatId);

        if (jid) {
            const phone = jid.split('@')[0];
            await tgBot.sendMessage(chatId,
                `┏━━❪ ✅ 𝗦𝗧𝗔𝗧𝗨𝗦 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › Vinculado\n` +
                `┃ ➢ 𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽 › +${phone}\n` +
                `┃ ➢ 𝗗𝗲𝘀𝗱𝗲 › ${links[jid].linkedAt}\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        } else {
            await tgBot.sendMessage(chatId,
                `┏━━❪ ❌ 𝗦𝗧𝗔𝗧𝗨𝗦 ❫━━\n` +
                `┃\n` +
                `┃ ➢ Nenhum WhatsApp vinculado.\n` +
                `┃ ➢ Use /importar vincular\n` +
                `┃   no WhatsApp.\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        }
    });

    // ── Comando /desvincular ──
    tgBot.onText(/\/desvincular/, async (tgMsg) => {
        const chatId = tgMsg.chat.id;
        const jid = getWhatsAppJidByTelegramId(chatId);

        if (jid) {
            delete links[jid];
            await saveLinks();
            await tgBot.sendMessage(chatId,
                `┏━━❪ ✅ 𝗗𝗘𝗦𝗩𝗜𝗡𝗖𝗨𝗟𝗔𝗗𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ Vínculo removido com sucesso.\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        } else {
            await tgBot.sendMessage(chatId,
                `┏━━❪ ❌ 𝗘𝗥𝗥𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ Não há nenhum vínculo ativo.\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        }
    });

    // ── Receber stickers do Telegram → enviar no WhatsApp ──
    tgBot.on('sticker', async (tgMsg) => {
        const chatId = tgMsg.chat.id;

        // Só funciona em chat privado
        if (tgMsg.chat.type !== 'private') return;

        const jid = getWhatsAppJidByTelegramId(chatId);
        if (!jid) {
            return tgBot.sendMessage(chatId,
                `┏━━❪ ❌ 𝗘𝗥𝗥𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ WhatsApp não vinculado!\n` +
                `┃ ➢ Use /importar vincular\n` +
                `┃   no WhatsApp primeiro.\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        }

        if (!waSock) {
            return tgBot.sendMessage(chatId,
                `┏━━❪ ❌ 𝗢𝗙𝗙𝗟𝗜𝗡𝗘 ❫━━\n` +
                `┃\n` +
                `┃ ➢ O bot do WhatsApp está\n` +
                `┃   offline no momento.\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        }

        try {
            await tgBot.sendMessage(chatId,
                `┏━━❪ ⏳ 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗥 ❫━━\n` +
                `┃\n` +
                `┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › Convertendo...\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );

            const sticker = tgMsg.sticker;
            const fileId = sticker.file_id;
            const isAnimated = sticker.is_animated || false;
            const isVideo = sticker.is_video || false;

            // Baixar o arquivo do Telegram
            const tempDir = await ensureTempDir();
            const filePath = await tgBot.downloadFile(fileId, tempDir);

            if (isAnimated) {
                // .tgs (Lottie) — não suportado diretamente, informar o usuário
                await tgBot.sendMessage(chatId,
                    `┏━━❪ ⚠️ 𝗔𝗩𝗜𝗦𝗢 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ Figurinhas animadas (.tgs)\n` +
                    `┃   não são compatíveis com o\n` +
                    `┃   WhatsApp. Envie estáticas\n` +
                    `┃   ou de vídeo.\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`
                );
                try { await fs.unlink(filePath); } catch (e) { }
                return;
            }

            let stickerBuffer;

            if (isVideo) {
                // Video sticker (.webm) → converter para .webp animado via ffmpeg
                const outputPath = path.join(tempDir, `tg_${Date.now()}.webp`);
                const { spawn } = require('child_process');
                const ffmpeg = require('ffmpeg-static');

                await new Promise((resolve, reject) => {
                    const proc = spawn(ffmpeg, [
                        '-y', '-i', filePath,
                        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
                        '-vcodec', 'libwebp',
                        '-lossless', '0',
                        '-compression_level', '3',
                        '-q:v', '50',
                        '-loop', '0',
                        '-preset', 'default',
                        '-an',
                        '-vsync', '0',
                        '-t', '5',
                        outputPath
                    ]);
                    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)));
                    proc.on('error', reject);
                });

                stickerBuffer = await fs.readFile(outputPath);
                try { await fs.unlink(outputPath); } catch (e) { }
            } else {
                // Static sticker (.webp) — reprocessar via sharp para garantir compatibilidade
                const sharp = require('sharp');
                const rawBuffer = await fs.readFile(filePath);
                stickerBuffer = await sharp(rawBuffer)
                    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 80 })
                    .toBuffer();
            }

            // Adicionar metadados EXIF ao sticker (pack name + author)
            const { Image } = require('node-webpmux');
            const img = new Image();
            await img.load(stickerBuffer);

            const exifData = {
                'sticker-pack-id': `${BOT_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-telegram-bridge`,
                'sticker-pack-name': 'Telegram → WhatsApp',
                'sticker-pack-publisher': BOT_NAME,
                'emojis': ['📨']
            };

            const exifJsonBuf = Buffer.from(JSON.stringify(exifData), 'utf-8');
            const exif = Buffer.concat([
                Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
                exifJsonBuf,
            ]);
            exif.writeUIntLE(exifJsonBuf.length, 14, 4);

            img.exif = exif;
            const finalBuffer = await img.save(null);

            // Enviar como sticker no PV do WhatsApp
            await waSock.sendMessage(jid, {
                sticker: finalBuffer
            });

            await tgBot.sendMessage(chatId,
                `┏━━❪ ✅ 𝗘𝗡𝗩𝗜𝗔𝗗𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ Figurinha enviada para\n` +
                `┃   o seu WhatsApp!\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );

            // Cleanup
            try { await fs.unlink(filePath); } catch (e) { }

        } catch (err) {
            console.error('[TelegramBridge] Erro ao converter sticker TG→WA:', err);
            await tgBot.sendMessage(chatId,
                `┏━━❪ ❌ 𝗘𝗥𝗥𝗢 ❫━━\n` +
                `┃\n` +
                `┃ ➢ ${err.message}\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
            );
        }
    });

    // ── Handler genérico: Comandos do WhatsApp no Telegram ──
    // Comandos internos do TG bridge que não devem ser roteados
    const TG_INTERNAL_COMMANDS = new Set(['/start', '/status', '/desvincular']);

    tgBot.on('message', async (tgMsg) => {
        // Ignorar se não tem texto ou se é um sticker (já tratado acima)
        if (!tgMsg.text || tgMsg.sticker) return;

        const text = tgMsg.text.trim();
        if (!text.startsWith('/')) return;

        // Extrair o comando (remover @botusername se tiver)
        const cmdRaw = text.split(/\s+/)[0].toLowerCase().split('@')[0];

        // Ignorar comandos internos do bridge
        if (TG_INTERNAL_COMMANDS.has(cmdRaw)) return;

        // Verificar se o comando existe no commandMap
        if (!commandMap || !commandMap.has(cmdRaw)) return;

        const chatId = tgMsg.chat.id;
        const isGroup = tgMsg.chat.type === 'group' || tgMsg.chat.type === 'supergroup';

        console.log(`[TG-Commands] Comando ${cmdRaw} de ${tgMsg.from.first_name || tgMsg.from.id} em ${isGroup ? 'grupo' : 'PV'} (${chatId})`);

        try {
            // Verificar se o usuário é admin do grupo (para comandos admin)
            if (isGroup) {
                try {
                    const member = await tgBot.getChatMember(chatId, tgMsg.from.id);
                    tgMsg._isAdmin = ['creator', 'administrator'].includes(member.status);
                } catch (e) {
                    tgMsg._isAdmin = false;
                }
            }

            // Criar os objetos compatíveis
            const fakeSock = createTelegramSock(tgBot, chatId, tgMsg.message_id);
            const fakeMsg = createFakeMsg(tgMsg);
            const msgDetails = createMsgDetails(tgMsg, commandMap);

            // Executar o comando
            const commandHandler = commandMap.get(cmdRaw);
            await commandHandler(fakeSock, fakeMsg, msgDetails);

        } catch (err) {
            console.error(`[TG-Commands] Erro ao executar ${cmdRaw}:`, err.message);
            try {
                await tgBot.sendMessage(chatId,
                    `┏━━❪ ❌ 𝗘𝗥𝗥𝗢 ❫━━\n` +
                    `┃\n` +
                    `┃ ➢ ${err.message.substring(0, 200)}\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`,
                    { reply_to_message_id: tgMsg.message_id }
                );
            } catch (e) {}
        }
    });


    return tgBot;
}

// ─── API para o comando /importar (WhatsApp → Telegram) ──

/**
 * Gera um código de vinculação para o WhatsApp JID
 */
function createLinkCode(whatsappJid) {
    // Limpar códigos antigos (>10 min)
    for (const [code, data] of pendingCodes.entries()) {
        if (Date.now() - data.createdAt > 10 * 60 * 1000) {
            pendingCodes.delete(code);
        }
    }

    const code = generateCode();
    pendingCodes.set(code, {
        whatsappJid,
        createdAt: Date.now()
    });
    return code;
}

/**
 * Envia um buffer de sticker (webp) para o Telegram do usuário
 */
async function sendStickerToTelegram(whatsappJid, stickerBuffer) {
    const telegramChatId = getTelegramIdByWhatsAppJid(whatsappJid);
    if (!telegramChatId) {
        return { success: false, error: 'not_linked' };
    }
    if (!tgBot) {
        return { success: false, error: 'bot_offline' };
    }

    try {
        const tempDir = await ensureTempDir();
        const tempPath = path.join(tempDir, `wa_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`);
        await fs.writeFile(tempPath, stickerBuffer);

        await tgBot.sendSticker(telegramChatId, tempPath);

        // Cleanup
        try { await fs.unlink(tempPath); } catch (e) { }

        return { success: true };
    } catch (err) {
        console.error('[TelegramBridge] Erro ao enviar sticker WA→TG:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Envia uma imagem como sticker para o Telegram
 */
async function sendImageAsStickerToTelegram(whatsappJid, imageBuffer) {
    const telegramChatId = getTelegramIdByWhatsAppJid(whatsappJid);
    if (!telegramChatId) {
        return { success: false, error: 'not_linked' };
    }
    if (!tgBot) {
        return { success: false, error: 'bot_offline' };
    }

    try {
        const sharp = require('sharp');
        const tempDir = await ensureTempDir();

        // Converter para webp 512x512
        const webpBuffer = await sharp(imageBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();

        const tempPath = path.join(tempDir, `wa_img_${Date.now()}.webp`);
        await fs.writeFile(tempPath, webpBuffer);

        await tgBot.sendSticker(telegramChatId, tempPath);

        try { await fs.unlink(tempPath); } catch (e) { }

        return { success: true };
    } catch (err) {
        console.error('[TelegramBridge] Erro ao enviar imagem como sticker WA→TG:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Verifica se um JID está vinculado
 */
function isLinked(whatsappJid) {
    return !!links[whatsappJid]?.telegramChatId;
}

/**
 * Devolve o username do Telegram
 */
function getBotUsername() {
    if (!tgBot) return null;
    return tgBot.options?._username || null;
}

/**
 * Busca o username do bot (precisa de getMe)
 */
async function getBotInfo() {
    if (!tgBot) return null;
    try {
        return await tgBot.getMe();
    } catch (e) {
        return null;
    }
}

/**
 * Remove vínculo pelo WhatsApp JID
 */
async function unlinkByWhatsApp(whatsappJid) {
    if (links[whatsappJid]) {
        delete links[whatsappJid];
        await saveLinks();
        return true;
    }
    return false;
}

/**
 * Atualiza referência do sock (caso reconecte)
 */
function updateSock(newSock) {
    waSock = newSock;
}

/**
 * Atualiza o commandMap (caso hot-reload)
 */
function updateCommandMap(newMap) {
    commandMap = newMap;
}

/**
 * Retorna a instância do bot do Telegram
 */
function getTgBot() {
    return tgBot;
}

module.exports = {
    initialize,
    createLinkCode,
    sendStickerToTelegram,
    sendImageAsStickerToTelegram,
    isLinked,
    getBotInfo,
    unlinkByWhatsApp,
    updateSock,
    updateCommandMap,
    getTelegramIdByWhatsAppJid,
    getTgBot
};
