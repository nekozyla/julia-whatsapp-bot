const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');

async function soco(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const apiKey = process.env.Search_API_KEY;
    const engineId = process.env.Search_ENGINE_ID;

    console.log(`[SOCO] Comando iniciado por ${sender}`);

    
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
            console.log('[SOCO] Buscando na API do Google...');
            const query = 'anime punch gif';
            
            const startIndex = (Math.floor(Math.random() * 5) * 10) + 1;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&fileType=gif&num=10&start=${startIndex}`;
            console.log(`[SOCO] Página de busca: ${startIndex}`);

            const response = await axios.get(url);

            if (response.data && response.data.items && response.data.items.length > 0) {
                const randomItem = response.data.items[Math.floor(Math.random() * response.data.items.length)];
                gifUrl = randomItem.link;
                console.log(`[SOCO] Sucesso na API. URL: ${gifUrl}`);
                
                await gifCache.save('soco', gifUrl);
            } else {
                console.log('[SOCO] API retornou sem itens.');
            }
        } catch (error) {
            console.error('[SOCO] Erro ao buscar GIF de soco da API do Google:', error.message);
        }
    }

    
    if (!gifUrl) {
        console.log('[SOCO] Falha na API ou sem resultados. Tentando cache...');
        gifUrl = gifCache.getRandom('soco');
        if (gifUrl) {
            console.log(`[SOCO] Recuperado do cache: ${gifUrl}`);
        } else {
            console.log('[SOCO] Cache vazio.');
        }
    }

    
    if (!gifUrl) {
        const errorMsg = (apiKey && engineId)
            ? '❌ Erro ao buscar GIF de soco e cache vazio.'
            : '⚠️ Chaves de Pesquisa do Google não configuradas e cache vazio.';
        await sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
        return;
    }

    try {
        let caption;
        if (targetJid === commandSenderJid) {
            caption = `😳 @${commandSenderJid.split('@')[0]} deu um soco... em si mesmo? Que masoquismo! 👊`;
        } else {
            caption = `👊 @${commandSenderJid.split('@')[0]} deu um soco em @${targetJid.split('@')[0]}!`;
        }

        console.log('[SOCO] Baixando mídia...');
        const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data, 'binary');
        console.log(`[SOCO] Download concluído. Tamanho: ${buffer.length} bytes`);

        const isGif = gifUrl.endsWith('.gif');

        if (isGif) {
            console.log('[SOCO] Convertendo GIF para MP4...');
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
        console.log('[SOCO] Enviado com sucesso.');

    } catch (error) {
        console.error('[SOCO] Erro ao enviar GIF de soco:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }
}

module.exports = soco;


module.exports.commandData = {
    name: "soco",
    description: "Dá um soco em alguém.",
    category: "diversao",
    usage: "/soco",
    aliases: ["/punch","/socar"]
};
