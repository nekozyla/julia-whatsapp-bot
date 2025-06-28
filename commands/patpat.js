// commands/patpat.js

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs').promises; 
const path = require('path'); 
const { exec } = require('child_process');
const crypto = require('crypto');
const Pet = require('pet-pet-gif');
const ffmpegPath = require('ffmpeg-static');

// --- ÁREA DE AJUSTE FÁCIL DO MEME ---
const stickerSize = 512;          // Tamanho final da figurinha
const handWidth = 300;             // Largura da mão em pixels
const animationDuration = 4;       // Duração MÁXIMA da figurinha em segundos

async function handlePatPatCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText, messageType } = msgDetails;

    let imageToProcess = null;
    if (messageType === 'imageMessage' && commandText?.toLowerCase().includes('!patpat')) {
        imageToProcess = msg;
    } else if (commandText?.toLowerCase().includes('!patpat') && msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
        const quotedMsgContent = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        imageToProcess = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgContent };
    }

    if (!imageToProcess) {
        if (commandText?.toLowerCase().includes('!patpat')) {
            await sock.sendMessage(sender, { text: "Para usar o `!patpat`, envie o comando na legenda de uma imagem ou responda a uma imagem com `!patpat`." }, { quoted: msg });
        }
        return true; 
    }

    console.log(`[PatPat] Usuário ${pushName} solicitou criação de figurinha pat-pat.`);
    
    const tempDir = path.join(__dirname, '..', 'temp_memes');
    await fs.mkdir(tempDir, { recursive: true });
    
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputGifPath = path.join(tempDir, `${randomId}_in.gif`);
    const outputPath = path.join(tempDir, `${randomId}_sticker.webp`);

    try {
        await sock.sendPresenceUpdate('composing', sender);
        
        const userImageBuffer = await downloadMediaMessage(imageToProcess, 'buffer', {}, { logger: undefined });
        
        console.log('[PatPat] Gerando GIF inicial com a biblioteca pet-pet-gif...');
        const initialGifBuffer = await Pet(userImageBuffer, {
            resolution: 256,
            delay: 50,
        });

        await fs.writeFile(inputGifPath, initialGifBuffer);

        console.log('[PatPat] Convertendo para figurinha animada WebP com fundo preto...');
        
        // --- COMANDO FFMPEG ATUALIZADO ---
        // Removido 'reserve_transparent=1' do palettegen para forçar um fundo opaco.
        const ffmpegCommand = `ffmpeg -i "${inputGifPath}" ` +
            `-vf "scale=${stickerSize}:${stickerSize}:force_original_aspect_ratio=decrease,pad=${stickerSize}:${stickerSize}:-1:-1:color=black,split[s0][s1];[s0]palettegen=max_colors=255[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ` +
            `-loop 0 -c:v libwebp -lossless 0 -q:v 85 -preset default -an -vsync 0 -t ${animationDuration} "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[FFmpeg PatPat Error]:', error);
                    console.error('[FFmpeg PatPat Stderr]:', stderr);
                    return reject(new Error('Falha ao converter o GIF para WebP com FFmpeg.'));
                }
                resolve(stdout);
            });
        });
        console.log('[PatPat] Figurinha WebP gerada com sucesso.');
        
        const outputBuffer = await fs.readFile(outputPath);
        
        console.log('[PatPat] Enviando figurinha para o WhatsApp...');
        await sock.sendMessage(sender, { 
            sticker: outputBuffer
        }, { quoted: msg });
        console.log('[PatPat] Figurinha enviada com sucesso.');

    } catch (err) {
        console.error('[Erro ao gerar figurinha pat-pat]:', err);
        await sock.sendMessage(sender, { text: 'Tive um probleminha pra fazer sua figurinha. 😕' }, { quoted: msg });
    } finally {
        await fs.unlink(inputGifPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        console.log('[PatPat] Arquivos temporários limpos.');
    }
    
    return true;
}

module.exports = handlePatPatCommand;
