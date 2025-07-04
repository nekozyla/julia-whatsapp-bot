// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises; // Usaremos 'fsp' para 'fs.promises' para clareza
const { exec } = require('child_process');
const crypto = require('crypto');

async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText, messageType } = msgDetails;

    if (!commandText?.toLowerCase().includes('!sticker')) {
        return false;
    }

    let imageToProcess = null;
    let isAnimated = false;

    if (messageType === 'imageMessage' || messageType === 'videoMessage') {
        imageToProcess = msg;
        isAnimated = (messageType === 'videoMessage');
    } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quotedMsgContent = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        const quotedMsgType = getContentType(quotedMsgContent);

        if (quotedMsgType === 'imageMessage') {
            imageToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
            isAnimated = false;
        } else if (quotedMsgType === 'videoMessage') {
            imageToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
            isAnimated = true;
        }
    }

    if (!imageToProcess) {
        await sock.sendMessage(sender, { text: 'Para usar o `!sticker`, envie o comando na legenda de uma imagem/gif ou responda a um com `!sticker`.' }, { quoted: msg });
        return true;
    }
    
    console.log(`[Sticker] Usuário ${pushName} solicitou criação de sticker (${isAnimated ? 'Animado' : 'Estático'}).`);
    
    const tempDir = path.join(__dirname, '..', 'temp_stickers');
    await fsp.mkdir(tempDir, { recursive: true });
    const randomId = crypto.randomBytes(8).toString('hex');
    const outputPath = path.join(tempDir, `${randomId}.webp`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        
        const buffer = await downloadMediaMessage(imageToProcess, 'buffer', {}, { logger: undefined });
        
        let stickerBuffer;

        if (isAnimated) {
            const inputPath = path.join(tempDir, `${randomId}.mp4`);
            await fsp.writeFile(inputPath, buffer);
            
		const ffmpegCommand = `ffmpeg -i "${inputPath}" -t 7 -blend_mode additive -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000,split=2 [a][b]; [a] palettegen=reserve_transparent=1:transparency_color=ffffff [palette]; [b] [palette] alphamerge, format=rgba, colorchannelmixer=aa=1:ab=0:ar=0:ag=0 [final]; [final] setsar=1:1" -loop 0 -alpha_threshold 128 -c:v libwebp -lossless 0 -q:v 85 -preset default -an -vsync 0 "${outputPath}"`;

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
            stickerBuffer = await fsp.readFile(outputPath);
            await fsp.unlink(inputPath);
        } else {
            stickerBuffer = await sharp(buffer)
                .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .webp({ quality: 90 })
                .toBuffer();
        }

        // --- NOVA VERIFICAÇÃO DE SANIDADE ---
        if (!stickerBuffer || stickerBuffer.length === 0) {
            console.error('[Sticker] O buffer da figurinha foi gerado vazio ou nulo após o processamento.');
            throw new Error('Ocorreu um erro ao processar a mídia e o resultado foi um arquivo vazio.');
        }
        console.log(`[Sticker] Buffer da figurinha gerado com sucesso. Tamanho: ${stickerBuffer.length} bytes.`);
        
        await sock.sendMessage(sender, { sticker: stickerBuffer }, { quoted: msg });

    } catch (err) {
        console.error('[Erro ao gerar figurinha com !sticker]:', err);
        await sock.sendMessage(sender, { text: 'Tive um probleminha pra fazer essa figurinha 😕. A imagem ou GIF pode ser inválida ou estar em um formato não suportado.' }, { quoted: msg });
    } finally {
        await fsp.unlink(outputPath).catch(() => {}); // Tenta limpar o arquivo de saída
    }
    
    return true; 
}

module.exports = handleStickerCreationCommand;
