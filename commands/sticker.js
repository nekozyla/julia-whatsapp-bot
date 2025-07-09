// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

/**
 * Converte um vídeo para um sticker WebP animado.
 * @param {string} inputPath - Caminho para o vídeo de entrada.
 * @param {string} outputPath - Caminho para salvar o sticker .webp de saída.
 * @returns {Promise<void>}
 */
async function optimizeAnimatedSticker(inputPath, outputPath) {
    // ... (a sua função de otimização continua a mesma, não precisa ser alterada)
    const MAX_SIZE_BYTES = 1024 * 1024; // 1 MB
    const optimizationSteps = [ { quality: 75, fps: 20 }, { quality: 65, fps: 16 }, { quality: 50, fps: 14 }, { quality: 40, fps: 12 }, { quality: 30, fps: 10 }];

    console.log('[Sticker Optimizer] Iniciando processo de otimização...');
    for (let i = 0; i < optimizationSteps.length; i++) {
        const params = optimizationSteps[i];
        console.log(`[Sticker Optimizer] Tentativa ${i + 1}/${optimizationSteps.length}: Qualidade=${params.quality}, FPS=${params.fps}`);
        
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -y -t 7 ` +
            `-vf "scale=512:512:force_original_aspect_ratio=decrease,fps=${params.fps},pad=512:512:-1:-1:color=black@0" ` +
            `-c:v libwebp -lossless 0 -q:v ${params.quality} -loop 0 -preset default -an "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) { console.error('[FFmpeg Error]:', stderr); return reject(new Error('Falha na execução do FFmpeg.')); }
                resolve(stdout);
            });
        });
        const stats = await fsp.stat(outputPath);
        if (stats.size < MAX_SIZE_BYTES) { console.log(`[Sticker Optimizer] Sucesso! O sticker está dentro do limite de tamanho.`); return; }
    }
    throw new Error(`Não foi possível otimizar o sticker para menos de 1 MB.`);
}


/**
 * Lógica principal que baixa, processa e envia uma figurinha.
 * @param {object} sock
 * @param {object} msgWithMedia
 * @param {object} originalMsgToQuote
 * @param {('original'|'square')} format - O formato desejado para o sticker.
 */
async function processAndSendSticker(sock, msgWithMedia, originalMsgToQuote, format = 'original') {
    const sender = originalMsgToQuote.key.remoteJid;
    const messageType = getContentType(msgWithMedia.message);
    const isAnimated = (messageType === 'videoMessage');
    
    console.log(`[Sticker Processing] Formato solicitado: ${format}. Animado: ${isAnimated}.`);
    
    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.mp4`);
    const outputPath = path.join(tempDir, `${randomId}.webp`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        const buffer = await downloadMediaMessage(msgWithMedia, 'buffer', {}, { logger: undefined });
        let stickerBuffer;

        if (isAnimated) {
            // A lógica de otimização já cria um sticker em um canvas quadrado,
            // então não há distinção de formato para vídeos por enquanto.
            await fsp.writeFile(inputPath, buffer);
            await optimizeAnimatedSticker(inputPath, outputPath);
            stickerBuffer = await fsp.readFile(outputPath);
        } else {
            // --- LÓGICA DE FORMATO PARA IMAGENS ESTÁTICAS ---
            let sharpInstance = sharp(buffer);

            if (format === 'square') {
                // Formato Quadrado: Preenche todo o espaço 512x512, cortando as bordas se necessário.
                sharpInstance = sharpInstance.resize(512, 512, { fit: 'cover' });
            } else {
                // Formato Original (padrão): Redimensiona a imagem para caber em 512x512, preservando as proporções.
                sharpInstance = sharpInstance.resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
            }

            stickerBuffer = await sharpInstance.webp({ quality: 90 }).toBuffer();
        }

        if (!stickerBuffer || stickerBuffer.length === 0) {
            throw new Error('Ocorreu um erro ao processar a mídia e o resultado foi um arquivo vazio.');
        }
        
        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: originalMsgToQuote });

    } catch (err) {
        console.error('[Erro ao processar figurinha]:', err);
        await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_${err.message}_` }, { quoted: originalMsgToQuote });
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }
}


/**
 * Handler para o comando !sticker.
 * Ele identifica a mídia e o formato desejado, e então chama a função de processamento.
 */
async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, commandText, messageType } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    
    let mediaToProcess = null;
    const commandParts = (commandText || '').toLowerCase().split(' ');
    const format = commandParts.includes('quadrado') ? 'square' : 'original';

    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        mediaToProcess = msg;
    } else if (quotedMsgInfo) {
        const quotedMsgType = getContentType(quotedMsgInfo);
        if (quotedMsgType === 'imageMessage' || quotedMsgType === 'videoMessage') {
            mediaToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
        }
    }

    if (!mediaToProcess) {
        if (commandText?.toLowerCase().includes('!sticker')) {
            await sock.sendMessage(sender, { text: 'Para usar o `!sticker`, envie o comando na legenda de uma imagem/gif ou responda a um com `!sticker`.' }, { quoted: msg });
        }
        return true;
    }
    
    // Passa o formato para a função de processamento
    await processAndSendSticker(sock, mediaToProcess, msg, format);
    
    return true; 
}

// Exportações necessárias para o bot
module.exports = handleStickerCreationCommand;
module.exports.processAndSendSticker = processAndSendSticker;
