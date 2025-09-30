// commands/sticker.js (Versão Corrigida com criação de pasta na fila)
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { Image } = require('node-webpmux');
const axios = require('axios');
const { fileTypeFromBuffer } = require('file-type');

// --- LÓGICA DA FILA DE PROCESSAMENTO ---

const videoQueue = []; 
let isProcessing = false; 
let currentlyProcessingJid = null;

/**
 * Processa o próximo item na fila de vídeos.
 */
async function processQueue() {
    if (videoQueue.length === 0) {
        isProcessing = false;
        currentlyProcessingJid = null;
        console.log('[Sticker Queue] Fila vazia. Processador a dormir.');
        return;
    }

    isProcessing = true;
    const job = videoQueue.shift();
    const { sock, msg, msgDetails, mediaToProcess, downloadedFilePath, isDownloadedFromUrl } = job;
    const { sender, commandSenderJid } = msgDetails;

    currentlyProcessingJid = commandSenderJid;

    console.log(`[Sticker Queue] A processar sticker de vídeo para ${commandSenderJid}. Itens restantes: ${videoQueue.length}`);
    await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });

    // --- CORREÇÃO AQUI ---
    // Garante que a pasta temporária para stickers existe antes de usá-la
    const tempDirStickers = path.join(__dirname, '..', '..', 'temp', 'stickers');
    await fsp.mkdir(tempDirStickers, { recursive: true });
    // --- FIM DA CORREÇÃO ---

    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = isDownloadedFromUrl ? downloadedFilePath : path.join(tempDirStickers, `${randomId}_in`);
    const outputPath = path.join(tempDirStickers, `${randomId}_out.webp`);
    
    try {
        if (!isDownloadedFromUrl) {
            const buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });
            await fsp.writeFile(inputPath, buffer);
        }

        await optimizeAnimatedSticker(inputPath, outputPath);
        let finalBuffer = await fsp.readFile(outputPath);
        
        const options = { pack: 'Criado com Jul.ia', author: 'by @nekozylajs' };
        finalBuffer = await addExif(finalBuffer, options);

        await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(sender, { sticker: finalBuffer });

    } catch (err) {
        console.error('[Sticker Queue] Erro ao processar item da fila:', err);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(sender, { text: `Ocorreu um erro ao criar a sua figurinha de vídeo. 😕\n\n_${err.message}_` }, { quoted: msg });
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
        if (isDownloadedFromUrl && downloadedFilePath) {
            await fsp.unlink(downloadedFilePath).catch(() => {});
        }
        currentlyProcessingJid = null; 
        processQueue();
    }
}


/**
 * Adiciona metadados EXIF a um buffer de imagem WebP.
 */
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

async function optimizeAnimatedSticker(inputPath, outputPath) {
    const MAX_SIZE_BYTES = 1000 * 1000; // 1 MB
    const optimizationSteps = [
        { quality: 50, fps: 24 },
        { quality: 25, fps: 24 },
        { quality: 10, fps: 24 },
        { quality: 5, fps: 24 },
        { quality: 1, fps: 24 }
    ];

    for (const params of optimizationSteps) {
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -y -t 10 ` + 
            `-vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=${params.fps},split[s0][s1];[s0]palettegen=max_colors=254[p];[s1][p]paletteuse=dither=bayer" ` +
            `-c:v libwebp -lossless 0 -q:v ${params.quality} -loop 0 -preset default -an -vsync 0 "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error(`FFmpeg stderr: ${stderr}`);
                    return reject(new Error(`Erro no FFmpeg: ${error.message}`));
                }
                resolve();
            });
        });

        const stats = await fsp.stat(outputPath);
        if (stats.size < MAX_SIZE_BYTES) {
            return;
        }
    }
    throw new Error(`Não foi possível otimizar o sticker para menos de 1 MB.`);
}

async function handleStickerCommand(sock, msg, msgDetails) {
    const { sender, commandText, messageType, quotedMsgInfo, commandSenderJid } = msgDetails;
    
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
                const tempDir = path.join(__dirname, '..', '..', 'temp', 'downloads');
                await fsp.mkdir(tempDir, { recursive: true });
                const randomId = crypto.randomBytes(8).toString('hex');
                const tempOutputPath = path.join(tempDir, `${randomId}.%(ext)s`);
                const ytdlpCommand = `yt-dlp -f 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o "${tempOutputPath}" "${url}"`;
                
                downloadedFilePath = await new Promise((resolve, reject) => {
                    exec(ytdlpCommand, { timeout: 300000 }, async (error, stdout, stderr) => {
                        if (error) {
                            console.error('[YTDLP Sticker Error]:', stderr);
                            return reject(new Error('Não foi possível baixar o vídeo do link.'));
                        }
                        const downloadedFileMatch = stdout.match(/\[download\] Destination: (.*)/);
                        if (downloadedFileMatch && downloadedFileMatch[1]) {
                            resolve(downloadedFileMatch[1].trim());
                        } else {
                           try {
                               const files = await fsp.readdir(tempDir);
                               const foundFile = files.find(f => f.startsWith(randomId));
                               if(foundFile) resolve(path.join(tempDir, foundFile));
                               else reject(new Error("Download concluído, mas não encontrei o ficheiro final."));
                           } catch (scanError) {
                                reject(scanError);
                           }
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

    const isAnimated = isDownloadedFromUrl || (mediaToProcess && getContentType(mediaToProcess.message) === 'videoMessage');

    if (isAnimated) {
        const isUserAlreadyInQueue = (isProcessing && currentlyProcessingJid === commandSenderJid) || videoQueue.some(job => job.commandSenderJid === commandSenderJid);

        if (isUserAlreadyInQueue) {
            await sock.sendMessage(sender, { text: "Você já tem uma figurinha de vídeo na fila ou a ser processada! Por favor, aguarde ela ser finalizada." }, { quoted: msg });
            return;
        }

        const job = { sock, msg, msgDetails, mediaToProcess, downloadedFilePath, isDownloadedFromUrl, commandSenderJid };
        videoQueue.push(job);

        await sock.sendMessage(sender, { text: `✅ Seu pedido de sticker de vídeo foi adicionado à fila! Posição: *${videoQueue.length}* de ${videoQueue.length}.` }, { quoted: msg });

        if (!isProcessing) {
            processQueue();
        }

    } else {
        try {
            await sock.sendMessage(sender, { react: { text: '⚙️', key: msg.key } });
            const buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });
            const options = { pack: 'Criado com Jul.ia', author: 'by @nekozylajs', format: 'original' };
            const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
            const packMatch = argsString.match(packRegex);
            if (packMatch) options.pack = packMatch[1] || packMatch[2] || '';
            const remainingArgs = argsString.replace(packRegex, '').trim().toLowerCase();
            if (remainingArgs.includes('quadrado')) options.format = 'square';
            if (remainingArgs.includes('esticado')) options.format = 'stretch';
            
            const resizeOptions = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } };
            if (options.format === 'square') resizeOptions.fit = 'cover';
            else if (options.format === 'stretch') resizeOptions.fit = 'fill';
            
            let finalBuffer = await sharp(buffer)
                .resize(512, 512, resizeOptions)
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

module.exports = handleStickerCommand;
