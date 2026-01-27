
const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;

const { pipeline } = require('stream/promises');
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
const { Image } = require('node-webpmux');
const { getTempDir } = require('../utils/utils');

const userPresetManager = require('../managers/userPresetManager.js');



const videoQueue = [];
let isProcessing = false;
let currentlyProcessingJid = null;


async function processQueue() {
    if (videoQueue.length === 0) {
        isProcessing = false;
        currentlyProcessingJid = null;
        console.log('[Sticker Queue] Fila vazia. Processador a dormir.');
        return;
    }

    isProcessing = true;

    const job = videoQueue.shift();
    const { sock, msg, msgDetails, mediaToProcess, downloadedFilePath, isDownloadedFromUrl, options } = job;
    const { sender, commandSenderJid } = msgDetails;

    currentlyProcessingJid = commandSenderJid;

    await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });

    const tempDirStickers = await getTempDir('stickers');
    const randomId = crypto.randomBytes(8).toString('hex');

    
    const inputPath = isDownloadedFromUrl ? downloadedFilePath : path.join(tempDirStickers, `${randomId}_in`);
    
    const outputPath = path.join(tempDirStickers, `${randomId}_out.webp`);

    try {
        if (!isDownloadedFromUrl) {
            try {
                
                const messageType = getContentType(mediaToProcess.message);
                const stream = await downloadContentFromMessage(mediaToProcess.message[messageType], messageType.replace('Message', ''));

                
                await pipeline(
                    stream,
                    fs.createWriteStream(inputPath)
                );

            } catch (downloadErr) {
                console.error('[Sticker Queue] Erro no downloadContentFromMessage:', downloadErr);
                throw new Error("Falha ao baixar a mídia. Tente reenviar a imagem/vídeo.");
            }
        }

        
        await optimizeAnimatedSticker(inputPath, outputPath, options);

        let finalBuffer = await fsp.readFile(outputPath);

        
        finalBuffer = await addExif(finalBuffer, options);

        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(sender, { sticker: finalBuffer });

    } catch (err) {
        console.error('[Sticker Queue] Erro ao processar item da fila:', err);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(sender, { text: `Ocorreu um erro ao criar a sua figurinha de vídeo. 😕\n\n_${err.message}_` }, { quoted: msg });
    } finally {
        
        await fsp.unlink(inputPath).catch(() => { });
        await fsp.unlink(inputPath + "_fixed.mp4").catch(() => { }); 
        await fsp.unlink(outputPath).catch(() => { });

        if (isDownloadedFromUrl && downloadedFilePath) {
            await fsp.unlink(downloadedFilePath).catch(() => { });
        }

        currentlyProcessingJid = null;
        processQueue();
    }
}



async function addExif(buffer, options) {
    const stickerPackId = crypto.randomBytes(16).toString('hex');
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': options.pack,
        'sticker-pack-publisher': options.author,
        'emojis': options.categories || [],
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


async function optimizeAnimatedSticker(inputPath, outputPath, options) {
    const MAX_SIZE_BYTES = 1000 * 1000; 
    let lastError = null;
    const optimizationSteps = [
        { quality: 100, fps: 30 },
        { quality: 50, fps: 30 },
        { quality: 30, fps: 30 },
        { quality: 30, fps: 24 },
        { quality: 30, fps: 15 },
        { quality: 30, fps: 10 }
    ];

    
    
    
    const fixedInputPath = inputPath + "_fixed.mp4";

    
    
    
    
    
    
    
    const sanitizeCommand = `ffmpeg -y -i "${inputPath}" -t 10 -c:v libx264 -preset superfast -crf 23 -pix_fmt yuv420p -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${fixedInputPath}"`;

    try {
        await new Promise((resolve, reject) => {
            exec(sanitizeCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error("Erro na sanitização:", stderr);
                    
                    return reject(new Error("Falha ao preparar o vídeo para conversão."));
                }
                resolve();
            });
        });
    } catch (e) {
        
        
        console.warn("Sanitização falhou, tentando com arquivo original...");
        
        await fsp.copyFile(inputPath, fixedInputPath);
    }

    

    
    const format = options?.format;
    let baseFilter;

    if (format === 'stretch') {
        baseFilter = "scale=256:256:flags=lanczos";
    } else if (format === 'square') {
        baseFilter = "scale=256:256:force_original_aspect_ratio=increase,crop=256:256";
    } else {
        baseFilter = "scale=256:256:force_original_aspect_ratio=decrease";
    }

    
    for (const params of optimizationSteps) {
        
        
        const videoFilter = `${baseFilter},fps=${params.fps},format=rgb24,split[s0][s1];[s0]palettegen=max_colors=254[p];[s1][p]paletteuse=dither=bayer`;

        const ffmpegCommand = `ffmpeg -i "${fixedInputPath}" -y ` +
            `-vf "${videoFilter}" ` +
            `-c:v libwebp -lossless 0 -q:v ${params.quality} -loop 0 -preset default -an -fps_mode passthrough "${outputPath}"`;

        try {
            await new Promise((resolve, reject) => {
                exec(ffmpegCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Tentativa q=${params.quality} falhou:`, stderr);
                        return reject(new Error(`FFmpeg falhou: ${stderr}`));
                    }
                    resolve();
                });
            });

            const stats = await fsp.stat(outputPath);
            
            if (stats.size < MAX_SIZE_BYTES) {
                return; 
            }
        } catch (err) {
            
            
            lastError = err;
        }
    }

    
    
    try {
        const stats = await fsp.stat(outputPath);
        if (stats.size > MAX_SIZE_BYTES) { 
            throw new Error("O vídeo é muito complexo para virar sticker (mesmo com qualidade baixa).");
        }
    } catch (e) {
        console.error("Erro final na verificação do arquivo de saída:", e);
        if (lastError) {
            throw new Error(`Não foi possível converter este vídeo. Erro original: ${lastError.message || lastError}`);
        }
        throw new Error(`Não foi possível converter este vídeo. Detalhes: ${e.message}`);
    }
}


async function handleStickerCommand(sock, msg, msgDetails) {
    const { sender, commandText, messageType, quotedMsgInfo, commandSenderJid } = msgDetails;
    console.log(`[Sticker] Comando iniciado por ${sender} (${commandSenderJid})`);

    let mediaToProcess = null;
    let isDownloadedFromUrl = false;
    let downloadedFilePath = '';

    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        mediaToProcess = msg;
    } else if (quotedMsgInfo) {
        const quotedMsgType = getContentType(quotedMsgInfo);
        if (quotedMsgType === 'imageMessage' || quotedMsgType === 'videoMessage') {
            mediaToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
        }
    }

    const argsString = (commandText || '').substring(msgDetails.command.length).trim();

    if (!mediaToProcess) {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const urlMatch = argsString.match(urlRegex);
        const url = urlMatch ? urlMatch[0] : null;

        if (url) {
            try {
                await sock.sendMessage(sender, { react: { text: '🔗', key: msg.key } });
                const tempDir = await getTempDir('downloads');
                const randomId = crypto.randomBytes(8).toString('hex');
                const tempOutputPath = path.join(tempDir, `${randomId}.%(ext)s`);
                const ytdlpCommand = `python3.11 -m yt_dlp -f 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o "${tempOutputPath}" "${url}"`;

                downloadedFilePath = await new Promise((resolve, reject) => {
                    exec(ytdlpCommand, { timeout: 300000 }, async (error, stdout, stderr) => {
                        if (error) {
                            console.error('[YTDLP Sticker Error]:', stderr);
                            return reject(new Error('Não foi possível baixar o vídeo do link.'));
                        }

                        try {
                            const files = await fsp.readdir(tempDir);
                            const foundFile = files.find(f => f.startsWith(randomId));
                            if (foundFile) {
                                resolve(path.join(tempDir, foundFile));
                            } else {
                                reject(new Error("Download concluído, mas não encontrei o ficheiro final."));
                            }
                        } catch (scanError) {
                            reject(scanError);
                        }
                    });
                });
                isDownloadedFromUrl = true;
            } catch (e) {
                console.error("[Sticker URL] Erro ao baixar mídia com yt-dlp:", e.message);
                await sock.sendMessage(sender, { text: `Não consegui baixar a mídia desse link. 😕\n\n_${e.message}_` }, { quoted: msg });
                return true;
            }
        }
    }

    if (!mediaToProcess && !isDownloadedFromUrl) {
        await sock.sendMessage(sender, { text: 'Para usar o `/sticker`, envie ou responda a uma imagem/vídeo, ou envie o comando com um link.' }, { quoted: msg });
        return true;
    }

    
    let pack = 'Criado com Jul.ia';
    let author = 'by @nekozylajs';
    let format = 'original';

    const savedPreset = userPresetManager.getPreset(sender, commandSenderJid);
    if (savedPreset) {
        if (savedPreset.pack !== undefined) pack = savedPreset.pack;
        if (savedPreset.author !== undefined) author = savedPreset.author;
        if (savedPreset.format) format = savedPreset.format;
    }

    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const authorRegex = /autor:(?:"([^"]+)"|'([^']+)')/i;
    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    if (packMatch) pack = packMatch[1] || packMatch[2] || '';
    if (authorMatch) author = authorMatch[1] || authorMatch[2] || '';

    const remainingArgs = argsString.replace(packRegex, '').replace(authorRegex, '').trim().toLowerCase();

    if (remainingArgs.includes('quadrado')) format = 'square';
    else if (remainingArgs.includes('esticado')) format = 'stretch';
    else if (remainingArgs.includes('original')) format = 'original';

    const options = { pack, author, format };
    // --- FIM PRESETS ---

    const isAnimated = isDownloadedFromUrl || (mediaToProcess && getContentType(mediaToProcess.message) === 'videoMessage');

    // Força formato quadrado para vídeos se estiver como original
    if (isAnimated && options.format === 'original') {
        options.format = 'square';
    }

    if (isAnimated) {
        const isUserAlreadyInQueue = (isProcessing && currentlyProcessingJid === commandSenderJid) || videoQueue.some(job => job.commandSenderJid === commandSenderJid);

        if (isUserAlreadyInQueue) {
            await sock.sendMessage(sender, { text: "Você já tem uma figurinha de vídeo na fila ou a ser processada! Por favor, aguarde ela ser finalizada." }, { quoted: msg });
            return;
        }

        const job = { sock, msg, msgDetails, mediaToProcess, downloadedFilePath, isDownloadedFromUrl, commandSenderJid, options };
        videoQueue.push(job);

        await sock.sendMessage(sender, { text: `✅ Seu pedido de sticker de vídeo foi adicionado à fila! Posição: *${videoQueue.length}* de ${videoQueue.length}.` }, { quoted: msg });

        if (!isProcessing) {
            processQueue();
        }

    } else {
        // IMAGEM ESTÁTICA
        try {
            await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });

            // ALTERAÇÃO: Usando downloadContentFromMessage para imagens estáticas também
            const messageType = getContentType(mediaToProcess.message);
            const stream = await downloadContentFromMessage(mediaToProcess.message[messageType], messageType.replace('Message', ''));

            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const resizeOptions = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } };
            if (options.format === 'square') resizeOptions.fit = 'cover';
            else if (options.format === 'stretch') resizeOptions.fit = 'fill';

            let finalBuffer = await sharp(buffer)
                .resize(256, 256, resizeOptions)
                .webp({ quality: 80 })
                .toBuffer();

            finalBuffer = await addExif(finalBuffer, options);
            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(sender, { sticker: finalBuffer });
        } catch (err) {
            console.error('[Sticker] Erro ao processar figurinha estática:', err);
            await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_${err.message}_` }, { quoted: msg });
        }
    }
}

handleStickerCommand.commandData = {
    name: "sticker",
    description: "Cria figurinhas animadas ou estáticas (imagem/vídeo/url).",
    category: "midia",
    usage: "/sticker [pack:nome] [autor:nome] [quadrado/esticado]",
    aliases: ["/f", "/fig", "/s"]
};

module.exports = handleStickerCommand;
