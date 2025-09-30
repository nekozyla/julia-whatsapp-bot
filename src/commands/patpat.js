// commands/patpat.js (Versão final, com conversão de sticker para PNG)
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const Pet = require('pet-pet-gif');
const { Image } = require('node-webpmux');
const sharp = require('sharp'); // Adicionada dependência para conversão de imagem

// --- ÁREA DE AJUSTE FÁCIL DO MEME ---
const stickerSize = 512;      // Tamanho final da figurinha
const animationDuration = 4;   // Duração MÁXIMA da figurinha em segundos

/**
 * Adiciona metadados EXIF a um buffer de imagem WebP.
 */
async function addExif(buffer) {
    const stickerPackId = crypto.randomBytes(16).toString('hex');
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': 'PatPats',
        'sticker-pack-publisher': 'Criado por Jul.ia',
        'emojis': ['❤️'],
    };

    const exif = Buffer.concat([
        Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
        Buffer.from(JSON.stringify(json), 'utf-8'),
    ]);
    exif.writeUIntLE(Buffer.from(JSON.stringify(json), 'utf-8').length, 14, 4);

    const image = new Image();
    await image.load(buffer);
    image.exif = exif;
    return await image.save(null);
}

async function handlePatPatCommand(sock, msg, msgDetails) {
    const { sender, messageType, quotedMsgInfo } = msgDetails;

    let targetMessage = null;
    let isStickerInput = false;
    const usageText = "Para usar, responda a uma imagem ou figurinha estática com `!patpat`.";

    // Lógica de deteção de imagem ou figurinha
    if (messageType === 'imageMessage') {
        targetMessage = msg;
    } else if (quotedMsgInfo) {
        const quotedType = getContentType(quotedMsgInfo);
        if (quotedType === 'imageMessage') {
            targetMessage = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
        } else if (quotedType === 'stickerMessage') {
            if (quotedMsgInfo.stickerMessage?.isAnimated) {
                await sock.sendMessage(sender, { text: "Não consigo fazer patpat com uma figurinha animada. Por favor, use uma imagem ou figurinha estática." }, { quoted: msg });
                return true;
            }
            targetMessage = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
            isStickerInput = true; // Marca que a entrada é uma figurinha
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }
    
    const tempDir = path.join(__dirname, '..', 'temp_memes');
    await fs.mkdir(tempDir, { recursive: true });
    
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputGifPath = path.join(tempDir, `${randomId}_in.gif`);
    const outputPath = path.join(tempDir, `${randomId}_sticker.webp`);

    try {
        await sock.sendMessage(sender, { react: { text: '🐾', key: msg.key } });
        
        let userImageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });
        
        // --- NOVA ETAPA DE CONVERSÃO ---
        // Se a entrada for uma figurinha (WebP), converte para PNG antes de continuar.
        if (isStickerInput) {
            userImageBuffer = await sharp(userImageBuffer).toFormat('png').toBuffer();
        }

        const initialGifBuffer = await Pet(userImageBuffer, {
            resolution: 256,
            delay: 30,
        });

        await fs.writeFile(inputGifPath, initialGifBuffer);
        
        const ffmpegCommand = `ffmpeg -i "${inputGifPath}" ` +
            `-filter_complex "[0:v]scale=${stickerSize}:${stickerSize}:force_original_aspect_ratio=decrease[scaled]; color=black:s=${stickerSize}x${stickerSize}[bg]; [bg][scaled]overlay=(W-w)/2:(H-h)/2:shortest=1,split[s0][s1];[s0]palettegen=max_colors=255[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ` +
            `-loop 0 -c:v libwebp -lossless 0 -q:v 85 -preset default -an -vsync 0 -t ${animationDuration} "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[FFmpeg PatPat Error]:', stderr);
                    return reject(new Error('Falha ao converter o GIF para WebP com FFmpeg.'));
                }
                resolve(stdout);
            });
        });
        
        let outputBuffer = await fs.readFile(outputPath);
        
        outputBuffer = await addExif(outputBuffer);

        await sock.sendMessage(sender, { sticker: outputBuffer }, { quoted: msg });

    } catch (err) {
        console.error('[Erro ao gerar figurinha pat-pat]:', err);
        await sock.sendMessage(sender, { text: 'Tive um probleminha pra fazer sua figurinha. 😕' }, { quoted: msg });
    } finally {
        await fs.unlink(inputGifPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
    }
    
    return true;
}

module.exports = handlePatPatCommand;
