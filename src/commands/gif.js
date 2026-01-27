const axios = require('axios');
const gifCache = require('../managers/gifCacheManager');
const { convertGifToMp4 } = require('../utils/utils');

async function gif(sock, msg, msgDetails) {
    const { sender: remoteJid } = msgDetails;
    const apiKey = process.env.Search_API_KEY;
    const engineId = process.env.Search_ENGINE_ID;

    console.log(`[GIF] Comando iniciado por ${remoteJid}`);

    let gifUrl;
    let title = 'GIF Aleatório';

    
    if (apiKey && engineId) {
        try {
            console.log('[GIF] Buscando na API do Google...');
            const query = 'random gif';
            
            const startIndex = (Math.floor(Math.random() * 5) * 10) + 1;
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&searchType=image&fileType=gif&num=10&start=${startIndex}`;
            console.log(`[GIF] Página de busca: ${startIndex}`);

            const response = await axios.get(url);

            if (response.data && response.data.items && response.data.items.length > 0) {
                
                const randomItem = response.data.items[Math.floor(Math.random() * response.data.items.length)];

                gifUrl = randomItem.link;
                title = randomItem.title || title;

                console.log(`[GIF] Sucesso na API. URL: ${gifUrl}`);

                
                await gifCache.save('gif', gifUrl);
            } else {
                console.log('[GIF] API retornou sem itens.');
            }
        } catch (error) {
            console.error('[GIF] Erro ao buscar GIF da API do Google:', error.message);
        }
    }

    
    if (!gifUrl) {
        console.log('[GIF] Falha na API ou sem resultados. Tentando cache...');
        gifUrl = gifCache.getRandom('gif');
        if (gifUrl) {
            console.log(`[GIF] Recuperado do cache: ${gifUrl}`);
            title += ' (Cache)';
        } else {
            console.log('[GIF] Cache vazio.');
        }
    }

    
    if (!gifUrl) {
        const errorMsg = (apiKey && engineId)
            ? '❌ Erro ao buscar GIF e cache vazio.'
            : '⚠️ Chaves de Pesquisa do Google não configuradas e cache vazio.';
        await sock.sendMessage(remoteJid, { text: errorMsg }, { quoted: msg });
        return;
    }

    
    try {
        console.log('[GIF] Baixando mídia...');
        const mediaResponse = await axios.get(gifUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(mediaResponse.data, 'binary');
        console.log(`[GIF] Download concluído. Tamanho: ${buffer.length} bytes`);

        const isGif = gifUrl.endsWith('.gif');

        if (isGif) {
            console.log('[GIF] Convertendo GIF para MP4...');
            const mp4Buffer = await convertGifToMp4(buffer);
            await sock.sendMessage(remoteJid, {
                video: mp4Buffer,
                caption: title,
                gifPlayback: true
            }, { quoted: msg });
        } else {
            await sock.sendMessage(remoteJid, {
                video: buffer,
                caption: title,
                gifPlayback: true
            }, { quoted: msg });
        }
        console.log('[GIF] Enviado com sucesso.');
    } catch (error) {
        console.error('[GIF] Erro ao enviar GIF:', error);
        await sock.sendMessage(remoteJid, { text: '❌ Erro ao enviar GIF.' }, { quoted: msg });
    }

}

module.exports = gif;


module.exports.commandData = {
    name: "gif",
    description: "Cria gif de sticker animado.",
    category: "midia",
    usage: "/gif",
    aliases: []
};
