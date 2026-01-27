const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');

async function beijo(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const apiKey = process.env.Search_API_KEY;
    const engineId = process.env.Search_ENGINE_ID;

    console.log(`[BEIJO] Comando iniciado por ${sender}`);

    
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
            console.log('[BEIJO] Buscando na API do Google...');
            const query = 'anime kiss gif';
            
            const startIndex = (Math.floor(Math.random() * 5) * 10) + 1;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&fileType=gif&num=10&start=${startIndex}`;
            console.log(`[BEIJO] Página de busca: ${startIndex}`);

            const response = await axios.get(url);

            if (response.data && response.data.items && response.data.items.length > 0) {
                const randomItem = response.data.items[Math.floor(Math.random() * response.data.items.length)];
                gifUrl = randomItem.link;
                console.log(`[BEIJO] Sucesso na API. URL: ${gifUrl}`);
                
                await gifCache.save('beijo', gifUrl);
            } else {
                console.log('[BEIJO] API retornou sem itens.');
            }
        } catch (error) {
            console.error('[BEIJO] Erro ao buscar GIF de beijo da API do Google:', error.message);
        }
    }

    
    if (!gifUrl) {
        console.log('[BEIJO] Falha na API ou sem resultados. Tentando cache...');
        gifUrl = gifCache.getRandom('beijo');
        if (gifUrl) {
            console.log(`[BEIJO] Recuperado do cache: ${gifUrl}`);
        } else {
            console.log('[BEIJO] Cache vazio.');
        }
    }

    
    if (!gifUrl) {
        const errorMsg = (apiKey && engineId)
            ? '❌ Erro ao buscar GIF de beijo e cache vazio.'
            : '⚠️ Chaves de Pesquisa do Google não configuradas e cache vazio.';
        await sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
        return;
    }

    try {
        let caption;
        if (targetJid === commandSenderJid) {
            caption = `😳 @${commandSenderJid.split('@')[0]} beijou... o espelho? Que amor próprio! 😘`;
        } else {
            caption = `😘 @${commandSenderJid.split('@')[0]} deu um beijo em @${targetJid.split('@')[0]}!`;
        }

        console.log('[BEIJO] Baixando mídia...');
        const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data, 'binary');
        console.log(`[BEIJO] Download concluído. Tamanho: ${buffer.length} bytes`);

        const isGif = gifUrl.endsWith('.gif');

        if (isGif) {
            console.log('[BEIJO] Convertendo GIF para MP4...');
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
        console.log('[BEIJO] Enviado com sucesso.');

    } catch (error) {
        console.error('[BEIJO] Erro ao enviar GIF de beijo:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }
}

module.exports = beijo;


module.exports.commandData = {
    name: "beijo",
    description: "Beija alguém.",
    category: "diversao",
    usage: "/beijo",
    aliases: []
};
