// commands/toimage.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils');

async function handleToImageCommand(sock, msg, msgDetails) {
    const { sender, quotedMsgInfo, pushName } = msgDetails;

    // 1. Validações iniciais
    if (!quotedMsgInfo) {
        await sock.sendMessage(sender, { text: "Para converter uma figurinha, responda a ela com o comando `!toimage`." }, { quoted: msg });
        return true;
    }

    const quotedMsgType = getContentType(quotedMsgInfo);
    if (quotedMsgType !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: "Isso não é uma figurinha. Por favor, responda a uma figurinha." }, { quoted: msg });
        return true;
    }

    // A verificação correta para saber se o sticker é animado
    const isAnimated = quotedMsgInfo.stickerMessage?.isAnimated === true;
    console.log(`[ToImage] Recebida solicitação de ${pushName}. Figurinha animada: ${isAnimated}`);

    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.webp`);
    const outputPath = path.join(tempDir, `${randomId}.gif`);
    
    try {
        await sock.sendPresenceUpdate('composing', sender);

        const stickerMsg = {
            key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key,
            message: quotedMsgInfo
        };

        const buffer = await downloadMediaMessage(stickerMsg, 'buffer', {}, { logger: undefined });

        if (isAnimated) {
            // --- LÓGICA CORRIGIDA PARA FIGURINHAS ANIMADAS (WEBP -> GIF) ---
            await fsp.writeFile(inputPath, buffer);

            // Este comando de 2 passos (palettegen + paletteuse) é a forma mais confiável
            // de converter animações para GIF, preservando a qualidade e a animação.
            const ffmpegCommand = `ffmpeg -i "${inputPath}" -vf "split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${outputPath}"`;

            await new Promise((resolve, reject) => {
                exec(ffmpegCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('[FFmpeg ToImage Error]:', stderr);
                        return reject(new Error('Falha ao converter a figurinha animada com FFmpeg.'));
                    }
                    resolve(stdout);
                });
            });

            const gifBuffer = await fsp.readFile(outputPath);
            await sock.sendMessage(sender, { 
                video: gifBuffer, 
                caption: "✨ Figurinha animada convertida para GIF!",
                gifPlayback: true 
            });

        } else {
            // --- LÓGICA PARA FIGURINHAS ESTÁTICAS (WEBP -> PNG) ---
            const imageBuffer = await sharp(buffer).toFormat('png').toBuffer();
            await sock.sendMessage(sender, { 
                image: imageBuffer,
                caption: "✨ Figurinha convertida para imagem!"
            }, { quoted: msg });
        }

    } catch (error) {
        console.error("[ToImage] Erro ao converter figurinha:", error);
        await sendJuliaError(sock, sender, msg, error);
    } finally {
        // Limpeza dos arquivos temporários
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }

    return true;
}

module.exports = handleToImageCommand;
