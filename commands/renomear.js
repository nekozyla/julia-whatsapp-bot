// commands/renomear.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { path: ffprobePath } = require('ffprobe-static');
const { sendJuliaError } = require('../utils');

/**
 * Pega a duração de um arquivo de vídeo em segundos.
 */
async function getVideoDuration(filePath) {
    const command = `${ffprobePath} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(`Erro no ffprobe: ${stderr}`));
            resolve(parseFloat(stdout));
        });
    });
}

/**
 * Otimiza um sticker animado para ficar abaixo de 1MB.
 */
async function optimizeAnimatedSticker(inputPath, outputPath) {
    const MAX_SIZE_BYTES = 1024 * 1024;
    const optimizationSteps = [
        { quality: 75, fps: 15 },
        { quality: 65, fps: 12 },
        { quality: 50, fps: 10 }
    ];

    console.log('[Renomear Optimizer] Iniciando otimização...');
    for (const params of optimizationSteps) {
        console.log(`[Renomear Optimizer] Tentativa: Qualidade=${params.quality}, FPS=${params.fps}`);
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -y -t 7 ` +
            `-vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${params.fps},split[s0][s1];[s0]palettegen=max_colors=254[p];[s1][p]paletteuse=dither=bayer" ` +
            `-c:v libwebp -lossless 0 -q:v ${params.quality} -loop 0 -preset default -an -vsync 0 "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error) => {
                if (error) return reject(new Error(`Erro no FFmpeg: ${error.message}`));
                resolve();
            });
        });

        const stats = await fsp.stat(outputPath);
        if (stats.size < MAX_SIZE_BYTES) {
            console.log(`[Renomear Optimizer] Sucesso! Tamanho final: ${(stats.size / 1024).toFixed(2)} KB.`);
            return;
        }
    }
    throw new Error(`Não foi possível otimizar o sticker para menos de 1 MB.`);
}


async function handleRenameCommand(sock, msg, msgDetails) {
    const { sender, commandText, quotedMsgInfo, pushName } = msgDetails;
    const usageText = "Para usar, responda a uma figurinha com `!renomear` e as opções.\n\n*Exemplos:*\n- Para limpar: `!renomear`\n- Para novo pacote: `!renomear pack:\"Meu Pacote\"`";

    if (!quotedMsgInfo || getContentType(quotedMsgInfo) !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    const options = { pack: '', author: '' };
    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const authorRegex = /autor:(?:"([^"]+)"|'([^']+)')/i;
    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    if (packMatch) options.pack = packMatch[1] || packMatch[2] || '';
    if (authorMatch) options.author = authorMatch[1] || authorMatch[2] || '';
    
    console.log(`[Renomear] ${pushName} solicitou renomear sticker. Opções: ${JSON.stringify(options)}`);

    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}_in.webp`);
    const outputPath = path.join(tempDir, `${randomId}_out.webp`);
    
    try {
        await sock.sendPresenceUpdate('composing', sender);
        let buffer = await downloadMediaMessage({ key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo }, 'buffer', {}, { logger: undefined });
        const isAnimated = quotedMsgInfo.stickerMessage?.isAnimated === true;

        if (isAnimated) {
            await fsp.writeFile(inputPath, buffer);
            const duration = await getVideoDuration(inputPath);
            console.log(`[Renomear] Duração detectada: ${duration.toFixed(2)}s`);

            if (duration > 7.5) { // Um pouco mais de tolerância para renomear
                throw new Error("Figurinha animada muito longa (máx 7s) para ser reprocessada.");
            }

            await optimizeAnimatedSticker(inputPath, outputPath);
            buffer = await fsp.readFile(outputPath);
        }

        const sticker = new Sticker(buffer, {
            pack: options.pack,
            author: options.author,
            type: StickerTypes.DEFAULT,
            quality: 100,
        });

        await sock.sendMessage(sender, await sticker.toMessage());

    } catch (err) {
        console.error('[Renomear] Erro ao recriar figurinha:', err);
        await sendJuliaError(sock, sender, msg, err);
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }
    
    return true; 
}

module.exports = handleRenameCommand;
