
const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');
const { searchDuckDuckGoImages } = require('./duckDuckGoScraper');

/**
 * Handles generic interaction commands (hug, kiss, slap, etc.)
 * @param {object} sock - The socket connection
 * @param {object} msg - The original message
 * @param {object} msgDetails - Parsed message details
 * @param {string} actionName - Name of the action for logging and cache (e.g., 'abraco', 'beijo')
 * @param {string} searchQuery - Query to search on DuckDuckGo (e.g., 'anime hug gif')
 * @param {function} captionGenerator - Function(senderName, targetName, isSelf) => string
 */
async function handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator) {
    const { sender, commandSenderJid } = msgDetails;
    const logPrefix = `[${actionName.toUpperCase()}]`;

    console.log(`${logPrefix} Comando iniciado por ${sender}`);

    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;

    let targetJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    } else if (quotedParticipant) {
        targetJid = quotedParticipant;
    } else {
        targetJid = commandSenderJid;
    }

    const isSelf = targetJid === commandSenderJid;
    const resolvedQuery = typeof searchQuery === 'function' ? searchQuery(isSelf) : searchQuery;

    const STATIC_IMAGE_EXTS = /\.(jpe?g|png|webp|bmp|svg|tiff?)(\?.*)?$/i;
    const ALLOWED_CONTENT_TYPES = ['image/gif', 'video/'];

    /**
     * Verifica se a URL aponta para um GIF/vídeo real pelo Content-Type
     * Retorna { ok, buffer, contentType } ou { ok: false }
     */
    async function tryFetchGif(url) {
        try {
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 });
            const contentType = (response.headers['content-type'] || '').toLowerCase();
            const isAllowed = ALLOWED_CONTENT_TYPES.some(t => contentType.startsWith(t));
            if (!isAllowed) {
                console.log(`${logPrefix} Ignorando URL (content-type: ${contentType}): ${url}`);
                return { ok: false };
            }
            const buffer = Buffer.from(response.data, 'binary');
            return { ok: true, buffer, contentType };
        } catch (e) {
            console.log(`${logPrefix} Erro ao baixar URL: ${e.message}`);
            return { ok: false };
        }
    }

    let gifUrl;
    let mediaBuffer;
    let mediaContentType;

    // 1. Try DuckDuckGo
    try {
        console.log(`${logPrefix} Buscando no DuckDuckGo...`);
        const urls = await searchDuckDuckGoImages(resolvedQuery);

        if (urls && urls.length > 0) {
            // Filtra URLs com extensões estáticas óbvias
            const candidates = urls.filter(u => !STATIC_IMAGE_EXTS.test(u.split('?')[0]));
            const pool = candidates.length > 0 ? candidates : urls;

            // Embaralha e tenta até 5 URLs
            const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 5);
            for (const url of shuffled) {
                const result = await tryFetchGif(url);
                if (result.ok) {
                    gifUrl = url;
                    mediaBuffer = result.buffer;
                    mediaContentType = result.contentType;
                    console.log(`${logPrefix} GIF válido encontrado. URL: ${gifUrl}`);
                    await gifCache.save(actionName, gifUrl);
                    break;
                }
            }
            if (!gifUrl) console.log(`${logPrefix} Nenhuma URL válida entre as candidatas do DDG.`);
        } else {
            console.log(`${logPrefix} DDG retornou sem itens.`);
        }
    } catch (error) {
        console.error(`${logPrefix} Erro ao buscar GIF no DDG:`, error.message);
    }

    // 2. Fallback to Cache
    if (!gifUrl) {
        console.log(`${logPrefix} Falha na busca ou sem resultados. Tentando cache...`);
        const cachedUrl = gifCache.getRandom(actionName);
        if (cachedUrl) {
            console.log(`${logPrefix} Recuperado do cache: ${cachedUrl}`);
            const result = await tryFetchGif(cachedUrl);
            if (result.ok) {
                gifUrl = cachedUrl;
                mediaBuffer = result.buffer;
                mediaContentType = result.contentType;
            }
        } else {
            console.log(`${logPrefix} Cache vazio.`);
        }
    }

    if (!gifUrl || !mediaBuffer) {
        await sock.sendMessage(sender, { text: `❌ Não encontrei nenhum GIF de ${actionName} no momento.` }, { quoted: msg });
        return;
    }

    try {
        console.log(`${logPrefix} Mídia baixada. Tamanho: ${mediaBuffer.length} bytes | Tipo: ${mediaContentType}`);

        const isGif = mediaContentType.startsWith('image/gif') || gifUrl.endsWith('.gif');
        let finalBuffer = mediaBuffer;

        if (isGif) {
            console.log(`${logPrefix} Convertendo GIF para MP4...`);
            finalBuffer = await convertGifToMp4(mediaBuffer);
        }

        const senderName = `@${commandSenderJid.split('@')[0]}`;
        const targetName = `@${targetJid.split('@')[0]}`;

        const caption = captionGenerator(senderName, targetName, isSelf);

        await sock.sendMessage(sender, {
            video: finalBuffer,
            caption: caption,
            gifPlayback: true,
            mentions: [commandSenderJid, targetJid]
        }, { quoted: msg });

        console.log(`${logPrefix} Enviado com sucesso.`);

    } catch (error) {
        console.error(`${logPrefix} Erro ao enviar GIF:`, error);
        await sock.sendMessage(sender, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }
}

module.exports = { handleInteraction };
