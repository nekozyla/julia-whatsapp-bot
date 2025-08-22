// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { path: ffprobePath } = require('ffprobe-static');

async function getVideoDuration(filePath) {
    const command = `${ffprobePath} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(`Erro no ffprobe: ${stderr}`));
            resolve(parseFloat(stdout));
        });
    });
}

async function optimizeAnimatedSticker(inputPath, outputPath) {
    const MAX_SIZE_BYTES = 1024 * 1024;
    const optimizationSteps = [
        { quality: 75, fps: 15 },
        { quality: 65, fps: 12 },
        { quality: 50, fps: 10 },
        { quality: 40, fps: 8 }
    ];
    for (const params of optimizationSteps) {
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
        if (stats.size < MAX_SIZE_BYTES) return;
    }
    throw new Error(`Não foi possível otimizar o sticker para menos de 1 MB.`);
}

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

    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    const options = { pack: '', format: 'original' };
    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const packMatch = argsString.match(packRegex);
    if (packMatch) options.pack = packMatch[1] || packMatch[2] || '';
    const remainingArgs = argsString.replace(packRegex, '').trim();
    if (remainingArgs.toLowerCase().split(' ').includes('quadrado')) options.format = 'square';

    console.log(`[Sticker] Iniciando. Opções: ${JSON.stringify(options)}`);

    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}_in.mp4`);
    const outputPath = path.join(tempDir, `${randomId}_out.webp`);
    
    try {
        const isAnimated = getContentType(mediaToProcess.message) === 'videoMessage';

        // --- LÓGICA DE REAÇÃO CORRIGIDA ---
        if (isAnimated) {
            try {
                console.log(`[Reação] A tentar reagir à mensagem ${msg.key.id}`);
                await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
                console.log(`[Reação] Reação enviada com sucesso.`);
            } catch (reactError) {
                console.error('[Reação] Falha ao enviar a reação:', reactError);
            }
        }
        // -----------------------------

        let buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });

        if (isAnimated) {
            await fsp.writeFile(inputPath, buffer);
            const duration = await getVideoDuration(inputPath);
            if (duration > 5.5) {
                throw new Error("Vídeo muito longo! Envie um com no máximo 5 segundos.");
            }
            await optimizeAnimatedSticker(inputPath, outputPath);
            buffer = await fsp.readFile(outputPath);
        } else {
            const fitMode = options.format === 'square' ? 'cover' : 'contain';
            buffer = await sharp(buffer)
                .resize(512, 512, { fit: fitMode, background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 80 })
                .toBuffer();
        }

        const sticker = new Sticker(buffer, {
            pack: options.pack,
            author: "Criado por Jul.ia by @nekozylajs",
            type: StickerTypes.FULL,
            quality: 80,
        });

        await sock.sendMessage(sender, await sticker.toMessage());

    } catch (err) {
        console.error('[Sticker] Erro ao processar figurinha:', err);
        await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_${err.message}_` });
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }
    
    return true; 
}

module.exports = handleStickerCreationCommand;
