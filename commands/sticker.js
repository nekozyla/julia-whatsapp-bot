// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const sharp = require('sharp');

async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, commandText, messageType, quotedMsgInfo } = msgDetails;
    
    let mediaToProcess = null;
    
    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        mediaToProcess = msg;
    } else if (quotedMsgInfo) {
        const quotedMsgType = getContentType(quotedMsgInfo);
        if (quotedMsgType === 'imageMessage' || quotedMsgType === 'videoMessage') {
            mediaToProcess = {
                key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key,
                message: quotedMsgInfo
            };
        }
    }

    if (!mediaToProcess) {
        await sock.sendMessage(sender, { text: 'Para usar o `!sticker`, envie o comando na legenda de uma imagem/gif ou responda a um com `!sticker`.' }, { quoted: msg });
        return true;
    }

    // --- NOVA LÓGICA DE EXTRAÇÃO COM ASPAS ---
    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    
    const options = {
        pack: '',
        format: 'original',
    };

    // Regex para encontrar pack:"qualquer texto aqui"
    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const packMatch = argsString.match(packRegex);

    if (packMatch) {
        // packMatch[1] conterá o texto de aspas duplas, packMatch[2] o de aspas simples
        options.pack = packMatch[1] || packMatch[2] || '';
    }

    // Remove a parte do pack para não confundir a busca pelo formato
    const remainingArgs = argsString.replace(packRegex, '').trim();
    
    if (remainingArgs.toLowerCase().split(' ').includes('quadrado')) {
        options.format = 'square';
    }
    // --- FIM DA LÓGICA DE EXTRAÇÃO ---

    console.log(`[Sticker] Iniciando. Opções: ${JSON.stringify(options)}`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        let buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });
        const isAnimated = getContentType(mediaToProcess.message) === 'videoMessage';

        let stickerTypeForFormatter;

        if (isAnimated) {
            stickerTypeForFormatter = StickerTypes.FULL; // Vídeos sempre quadrados
        } else {
            const fitMode = options.format === 'square' ? 'cover' : 'contain';
            
            buffer = await sharp(buffer)
                .resize(512, 512, {
                    fit: fitMode,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .webp({ quality: 80 })
                .toBuffer();
            
            stickerTypeForFormatter = StickerTypes.DEFAULT;
        }

        const sticker = new Sticker(buffer, {
            pack: options.pack,
            author: "Criado por Jul.ia by @nekozylajs",
            type: stickerTypeForFormatter,
            quality: 80,
        });

        const stickerMessage = await sticker.toMessage();
        await sock.sendMessage(sender, stickerMessage, { quoted: msg });

    } catch (err) {
        console.error('[Sticker] Erro ao processar figurinha:', err);
        await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_${err.message}_` });
    }
    
    return true; 
}

module.exports = handleStickerCreationCommand;
