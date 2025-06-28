// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText, messageType } = msgDetails;

    // O comando !sticker precisa ser o texto/legenda principal
    if (!commandText?.toLowerCase().includes('!sticker')) {
        return false;
    }

    let mediaToProcess = null;
    let isAnimated = false;

    // Prioriza a mídia na mensagem atual, se houver
    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        mediaToProcess = msg;
        isAnimated = (messageType === 'videoMessage');
    } 
    // Senão, verifica se é uma resposta a uma mídia
    else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedMsgContent = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        if (quotedMsgContent.imageMessage) {
            mediaToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
            isAnimated = false;
        } else if (quotedMsgContent.videoMessage) {
            mediaToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
            isAnimated = true;
        }
    }

    // Se após todas as verificações, não encontrou mídia, informa o usuário.
    if (!mediaToProcess) {
        await sock.sendMessage(sender, { text: 'Para usar o `!sticker`, envie o comando na legenda de uma imagem/gif ou responda a um com `!sticker`.' }, { quoted: msg });
        return true; // O comando foi invocado, mas de forma incorreta. Tratado.
    }
    
    console.log(`[Sticker] Usuário ${pushName} solicitou criação de sticker (${isAnimated ? 'Animado' : 'Estático'}).`);
    
    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fs.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');

    try {
        const buffer = await downloadMediaMessage(mediaToProcess, 'buffer', {}, { logger: undefined });
        let stickerBuffer;

        if (isAnimated) {
            // Lógica para stickers animados (GIF/Vídeo) usando FFmpeg
            const inputPath = path.join(tempDir, `${randomId}.mp4`);
            const outputPath = path.join(tempDir, `${randomId}.webp`);
            await fs.writeFile(inputPath, buffer);
            const ffmpegCommand = `ffmpeg -i "${inputPath}" -t 7 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=white@0" -an -vsync 0 -loop 0 -f webp "${outputPath}"`;
            
            await new Promise((resolve, reject) => {
                exec(ffmpegCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('[FFmpeg Error]:', error);
                        console.error('[FFmpeg Stderr]:', stderr);
                        return reject(new Error('Falha ao converter o vídeo/GIF com FFmpeg.'));
                    }
                    resolve(stdout);
                });
            });
            stickerBuffer = await fs.readFile(outputPath);
            await fs.unlink(inputPath);
            await fs.unlink(outputPath);
        } else {
            // Lógica para stickers estáticos (Imagem) usando Sharp
            stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 90 })
                .toBuffer();
        }
        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });
    } catch (err) {
        console.error('[Erro ao gerar figurinha com !sticker]:', err);
        await sock.sendMessage(sender, { text: 'Tive um probleminha pra fazer essa figurinha 😕. Verifique se é uma imagem ou GIF válido (e não muito longo).' }, { quoted: msg });
    }
    return true; 
}

module.exports = handleStickerCreationCommand;
