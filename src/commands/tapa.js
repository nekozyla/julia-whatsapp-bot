const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');

async function tapa(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const apiKey = process.env.Search_API_KEY;
    const engineId = process.env.Search_ENGINE_ID;

    console.log(`[TAPA] Comando iniciado por ${sender}`);
    console.log(`[TAPA] Keys loaded: API=${!!apiKey}, Engine=${!!engineId}`);

    
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

    let gifUrl;

    
    if (apiKey && engineId) {
        try {
            console.log('[TAPA] Buscando na API do Google...');
            const query = 'anime slap gif';
            
            const startIndex = (Math.floor(Math.random() * 5) * 10) + 1;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&fileType=gif&num=10&start=${startIndex}`;
            console.log(`[TAPA] Página de busca: ${startIndex}`);

            const response = await axios.get(url);

            if (response.data && response.data.items && response.data.items.length > 0) {
                const randomItem = response.data.items[Math.floor(Math.random() * response.data.items.length)];
                gifUrl = randomItem.link;
                console.log(`[TAPA] Sucesso na API. URL: ${gifUrl}`);
                
                await gifCache.save('tapa', gifUrl);
            } else {
                console.log('[TAPA] API retornou sem itens.');
            }
        } catch (error) {
            console.error('[TAPA] Erro ao buscar GIF de tapa da API do Google:', error.message);
        }
    }

    
    if (!gifUrl) {
        console.log('[TAPA] Falha na API ou sem resultados. Tentando cache...');
        gifUrl = gifCache.getRandom('tapa');
        if (gifUrl) {
            console.log(`[TAPA] Recuperado do cache: ${gifUrl}`);
        } else {
            console.log('[TAPA] Cache vazio.');
        }
    }

    
    if (!gifUrl) {
        const errorMsg = (apiKey && engineId)
            ? '❌ Erro ao buscar GIF de tapa e cache vazio.'
            : '⚠️ Chaves de Pesquisa do Google não configuradas e cache vazio.';
        await sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
        return;
    }

    try {
        let caption;
        if (targetJid === commandSenderJid) {
            caption = `🤦‍♂️ @${commandSenderJid.split('@')[0]} deu um tapa na própria cara! Acorda!`;
        } else {
            caption = `👋 @${commandSenderJid.split('@')[0]} deu um tapa em @${targetJid.split('@')[0]}! Toma essa!`;
        }

        console.log('[TAPA] Baixando mídia...');
        const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data, 'binary');
        console.log(`[TAPA] Download concluído. Tamanho: ${buffer.length} bytes`);

        const isGif = gifUrl.endsWith('.gif');

        if (isGif) {
            console.log('[TAPA] Convertendo GIF para MP4...');
            const mp4Buffer = await convertGifToMp4(buffer);
            await sock.sendMessage(sender, {
                video: mp4Buffer,
                caption: caption,
                gifPlayback: true,
                mentions: [commandSenderJid, targetJid]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                video: buffer,
                caption: caption,
                gifPlayback: true,
                mentions: [commandSenderJid, targetJid]
            }, { quoted: msg });
        }
        console.log('[TAPA] Enviado com sucesso.');

    } catch (error) {
        console.error('[TAPA] Erro ao enviar GIF de tapa:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }
}

module.exports = tapa;


module.exports.commandData = {
    name: "tapa",
    description: "Dá um tapa em alguém.",
    category: "diversao",
    usage: "/tapa",
    aliases: []
};
