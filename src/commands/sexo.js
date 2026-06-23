const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');
const { scrapeGoogleImages } = require('../helpers/googleScraper'); // Keep for now if used elsewhere, but actually we replaced usage. safely remove if unused in this file.
const { searchDuckDuckGoImages } = require('../helpers/duckDuckGoScraper');

async function sexo(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args } = msgDetails;
    // const apiKey = process.env.Search_API_KEY;
    // const engineId = process.env.Search_ENGINE_ID;

    // console.log(`[SEXO] Comando iniciado por ${sender}`);

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

    const isSolo = targetJid === commandSenderJid;

    // Extract custom tags by removing mentions from args
    // Heuristic: Remove args starting with '@'
    const customTags = args ? args.filter(arg => !arg.startsWith('@')).join(' ') : '';

    let candidates = [];
    let apiSuccess = false;

    // 1. Try to get candidates from API
    // 1. Try to get candidates from DuckDuckGo
    try {
        // console.log('[SEXO] Buscando no DuckDuckGo...');
        let terms;

        if (customTags && customTags.length > 0) {
            // Custom Search: Use exactly what the user typed + 'gif'
            terms = [`${customTags} gif`];
        } else if (isSolo) {
            // Solo / Masturbation search
            terms = ['hentai masturbation gif', 'anime masturbation gif', 'hentai solo gif', 'girl masturbation hentai gif'];
        } else {
            // Duo / Sex search
            terms = ['hentai gif', 'anime ecchi gif', 'yuri kiss gif', 'yaoi kiss gif', 'hentai sex gif'];
        }

        const query = terms[Math.floor(Math.random() * terms.length)];
        const urls = await searchDuckDuckGoImages(query);

        if (urls && urls.length > 0) {
            // Shuffle items
            const shuffled = urls.sort(() => 0.5 - Math.random());
            candidates = shuffled.map(url => ({ link: url, fromCache: false }));
            apiSuccess = true;
            console.log(`[SEXO] Sucesso no DDG. Encontrados: ${urls.length}`);
        } else {
            console.log('[SEXO] DDG retornou sem itens.');
        }
    } catch (error) {
        console.error('[SEXO] Erro no DDG:', error.message);
    }

    // 2. Add cache fallback candidates
    const cacheKey = customTags ? 'sexo' : (isSolo ? 'sexo_solo' : 'sexo');
    const cachedUrl = gifCache.getRandom(cacheKey);
    if (cachedUrl) {
        candidates.push({ link: cachedUrl, fromCache: true });
    }
    // Cross-cache fallback
    if (candidates.length === 0 && isSolo) {
        const anyCache = gifCache.getRandom('sexo');
        if (anyCache) candidates.push({ link: anyCache, fromCache: true });
    }

    // 2.5 Hardcoded Last Resort Fallback (Lightweight GIFs)
    if (candidates.length === 0) {
        const hardcoded = [
            'https://media1.tenor.com/m/Z6mG8o4XwSAAAAAC/anime-kiss.gif',
            'https://media1.tenor.com/m/F02m7h_tD-AAAAAC/anime-kiss-love.gif',
            'https://media1.tenor.com/m/dn_KuOESm4QAAAAC/engage-kiss-anime-kiss.gif',
            'https://media1.tenor.com/m/9u1fio3RjzkAAAAC/anime-kiss.gif'
        ];
        // Only use if we really have nothing
        const randomBackup = hardcoded[Math.floor(Math.random() * hardcoded.length)];
        candidates.push({ link: randomBackup, fromCache: true });
    }

    if (candidates.length === 0) {
        const errorMsg = '❌ Não encontrei nada... Tente novamente.';
        await sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
        return;
    }

    // 3. Define caption logic
    let caption;
    if (customTags && customTags.length > 0) {
        caption = `🧐 @${commandSenderJid.split('@')[0]} pediu por: *${customTags}*... 👇`;
    } else if (isSolo) {
        const phrases = [
            `😳 @${commandSenderJid.split('@')[0]} está curtindo um momento a sós...`,
            `🔥 @${commandSenderJid.split('@')[0]} precisava aliviar a tensão...`,
            `👀 @${commandSenderJid.split('@')[0]} está se tocando...`,
            `🥵 @${commandSenderJid.split('@')[0]} está brincando consigo mesmo(a)...`
        ];
        caption = phrases[Math.floor(Math.random() * phrases.length)];
    } else {
        const phrases = [
            `🔥 @${commandSenderJid.split('@')[0]} e @${targetJid.split('@')[0]} foram para o quarto...`,
            `😈 O clima esquentou entre @${commandSenderJid.split('@')[0]} e @${targetJid.split('@')[0]}!`,
            `👉👌 @${commandSenderJid.split('@')[0]} pegou @${targetJid.split('@')[0]} de jeito!`
        ];
        caption = phrases[Math.floor(Math.random() * phrases.length)];
    }

    // 4. Iterate candidates and check size
    let sent = false;
    for (const item of candidates) {
        const gifUrl = item.link;
        // console.log(`[SEXO] Tentando: ${gifUrl}`);

        try {
            // Check metadata if available from API (Google API uses 'byteSize' in 'image' object)
            // But we might not have 'image' property if it's from cache or simplified object
            // Just proceed to download for reliability, but use stream/head if possible.
            // For simplicity, download buffer but limit max download size?

            const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(mediaResponse.data, 'binary');

            // Heuristic: If source GIF > 5MB, it's too big to process efficiently
            if (buffer.length > 5 * 1024 * 1024) {
                // console.log(`[SEXO] GIF muito grande (${buffer.length} bytes). Pulando.`);
                continue;
            }

            let finalBuffer = buffer;
            let isVideo = false;

            if (gifUrl.endsWith('.gif') || buffer.slice(0, 3).toString() === 'GIF') {
                finalBuffer = await convertGifToMp4(buffer);
                isVideo = true;
            }

            // CHECK FINAL SIZE < 256KB (262144 bytes)
            if (finalBuffer.length > 262144) {
                console.log(`[SEXO] Resultado > 256KB (${finalBuffer.length} bytes). Pulando este.`);
                continue;
            }

            // If we are here, it's good!
            // Save to cache if it was from API
            if (!item.fromCache) {
                await gifCache.save(cacheKey, gifUrl);
            }

            await sock.sendMessage(sender, {
                video: finalBuffer,
                caption: caption,
                gifPlayback: true,
                mentions: [commandSenderJid, targetJid]
            }, { quoted: msg });

            sent = true;
            break; // Stop loop

        } catch (err) {
            console.error(`[SEXO] Erro ao processar ${gifUrl}:`, err.message);
            // Continue to next candidate
        }
    }

    if (!sent) {
        await sock.sendMessage(sender, { text: '❌ Não consegui encontrar um vídeo leve (<256KB) no momento. Tente novamente.' }, { quoted: msg });
    }
}

module.exports = sexo;

module.exports.commandData = {
    name: "sexo",
    description: "Envia um GIF NSFW (+18).",
    category: "nsfw",
    usage: "/sexo [@usuario] [tags]",
    isNSFW: true
};
