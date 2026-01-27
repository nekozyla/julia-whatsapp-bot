const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');

async function abraco(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const apiKey = process.env.Search_API_KEY;
    const engineId = process.env.Search_ENGINE_ID;

    console.log(`[ABRACO] Comando iniciado por ${sender}`);

    
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
            console.log('[ABRACO] Buscando na API do Google...');
            const query = 'anime hug gif';
            
            const startIndex = (Math.floor(Math.random() * 5) * 10) + 1;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&fileType=gif&num=10&start=${startIndex}`;
            console.log(`[ABRACO] Página de busca: ${startIndex}`);

            const response = await axios.get(url);

            if (response.data && response.data.items && response.data.items.length > 0) {
                const randomItem = response.data.items[Math.floor(Math.random() * response.data.items.length)];
                gifUrl = randomItem.link;
                console.log(`[ABRACO] Sucesso na API. URL: ${gifUrl}`);
                
                await gifCache.save('abraco', gifUrl);
            } else {
                console.log('[ABRACO] API retornou sem itens.');
            }
        } catch (error) {
            console.error('[ABRACO] Erro ao buscar GIF de abraço da API do Google:', error.message);
        }
    }

    
    if (!gifUrl) {
        console.log('[ABRACO] Falha na API ou sem resultados. Tentando cache...');
        gifUrl = gifCache.getRandom('abraco');
        if (gifUrl) {
            console.log(`[ABRACO] Recuperado do cache: ${gifUrl}`);
        } else {
            console.log('[ABRACO] Cache vazio.');
        }
    }

    
    if (!gifUrl) {
        const errorMsg = (apiKey && engineId)
            ? '❌ Erro ao buscar GIF de abraço e cache vazio.'
            : '⚠️ Chaves de Pesquisa do Google não configuradas e cache vazio.';
        await sock.sendMessage(sender, { text: errorMsg }, { quoted: msg });
        return;
    }

    try {
        let caption;
        if (targetJid === commandSenderJid) {
            caption = `🤗 @${commandSenderJid.split('@')[0]} se abraçou! Às vezes a gente só precisa de um pouco de carinho.`;
        } else {
            caption = `🤗 @${commandSenderJid.split('@')[0]} deu um abraço apertado em @${targetJid.split('@')[0]}!`;
        }

        console.log('[ABRACO] Baixando mídia...');
        const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data, 'binary');
        console.log(`[ABRACO] Download concluído. Tamanho: ${buffer.length} bytes`);

        const isGif = gifUrl.endsWith('.gif');

        if (isGif) {
            console.log('[ABRACO] Convertendo GIF para MP4...');
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
        console.log('[ABRACO] Enviado com sucesso.');

    } catch (error) {
        console.error('[ABRACO] Erro ao enviar GIF de abraço:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }
}

module.exports = abraco;


module.exports.commandData = {
    name: "abraco",
    description: "Abraça alguém.",
    category: "diversao",
    usage: "/abraco",
    aliases: []
};
