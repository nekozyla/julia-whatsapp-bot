// commands/togif.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils');

async function handleToGifCommand(sock, msg, msgDetails) {
    const { sender, quotedMsgInfo, pushName } = msgDetails;

    // 1. Valida se o usuário está respondendo a uma figurinha
    if (!quotedMsgInfo || getContentType(quotedMsgInfo) !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: "Para converter uma figurinha em GIF, por favor, responda a uma figurinha com o comando `!togif`." }, { quoted: msg });
        return true;
    }

    console.log(`[ToGif] Recebida solicitação de ${pushName}. Tentando conversão para GIF.`);

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
        await fsp.writeFile(inputPath, buffer);
        
        // Comando FFmpeg robusto que funciona tanto para stickers animados quanto estáticos.
        // Adicionadas as flags 'analyzeduration' e 'probesize' para ajudar na decodificação de arquivos difíceis.
        const ffmpegCommand = `ffmpeg -analyzeduration 20M -probesize 10M -i "${inputPath}" -vf "split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[FFmpeg ToGif Error]:', stderr);
                    return reject(new Error('Falha ao converter a figurinha para GIF.'));
                }
                resolve(stdout);
            });
        });

        const gifBuffer = await fsp.readFile(outputPath);
        
        await sock.sendMessage(sender, { 
            video: gifBuffer, 
            caption: "✨ Figurinha convertida para GIF!",
            gifPlayback: true 
        }, { quoted: msg });

    } catch (error) {
        console.error("[ToGif] Erro ao converter para GIF:", error);
        await sendJuliaError(sock, sender, msg, error);
    } finally {
        await fsp.unlink(inputPath).catch(() => {});
        await fsp.unlink(outputPath).catch(() => {});
    }

    return true;
}

module.exports = handleToGifCommand;
