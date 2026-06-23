
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const fsp = require('fs').promises;
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto');
const ffmpegStatic = require('ffmpeg-static');
const { sendGiratinaError, getTempDir } = require('../utils/utils');

async function handleToImageCommand(sock, msg, msgDetails) {
    const { sender, quotedMsgInfo, pushName } = msgDetails;

    
    if (!quotedMsgInfo) {
        await sock.sendMessage(sender, { text: "Para converter uma figurinha, responda a ela com o comando `!toimage`." }, { quoted: msg });
        return true;
    }

    const quotedMsgType = getContentType(quotedMsgInfo);
    if (quotedMsgType !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: "Isso não é uma figurinha. Por favor, responda a uma figurinha." }, { quoted: msg });
        return true;
    }

    
    const isAnimated = quotedMsgInfo.stickerMessage?.isAnimated === true;
    console.log(`[ToImage] Recebida solicitação de ${pushName}. Figurinha animada: ${isAnimated}`);

    const tempDir = await getTempDir('stickers');
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputGifPath = path.join(tempDir, `${randomId}.gif`);
    const outputMp4Path = path.join(tempDir, `${randomId}.mp4`);

    try {
        await sock.sendPresenceUpdate('composing', sender);

        const stickerMsg = {
            key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key,
            message: quotedMsgInfo
        };

        let buffer;
        try {
            buffer = await downloadMediaMessage(stickerMsg, 'buffer', {}, { logger: undefined });
        } catch (downloadErr) {
            console.error('[ToImage] Erro no downloadMediaMessage:', downloadErr);
            throw new Error("Falha ao baixar a figurinha. Tente responder a ela novamente.");
        }

        if (isAnimated) {
            

            
            const gifBuffer = await sharp(buffer, { animated: true })
                .toFormat('gif')
                .toBuffer();

            await fsp.writeFile(inputGifPath, gifBuffer);

            
            
            

            const runFfmpeg = (cmdPath) => {
                const command = `"${cmdPath}" -i "${inputGifPath}" -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputMp4Path}"`;
                return new Promise((resolve, reject) => {
                    exec(command, (error, stdout, stderr) => {
                        if (error) {
                            reject({ error, stderr });
                        } else {
                            resolve(stdout);
                        }
                    });
                });
            };

            try {
                
                await runFfmpeg(ffmpegStatic);
            } catch (err1) {
                console.warn(`[ToImage] Falha com ffmpeg-static: ${err1.stderr || err1.error?.message}. Tentando ffmpeg do sistema...`);
                try {
                    
                    await runFfmpeg('ffmpeg');
                } catch (err2) {
                    console.error('[FFmpeg ToImage Error]:', err2.stderr);
                    throw new Error(`Falha ao converter GIF para MP4 com FFmpeg: ${err2.stderr}`);
                }
            }

            const mp4Buffer = await fsp.readFile(outputMp4Path);
            await sock.sendMessage(sender, {
                video: mp4Buffer,
                caption: "✨ Figurinha animada convertida para vídeo!",
                gifPlayback: false 
            }, { quoted: msg });

        } else {
            
            const imageBuffer = await sharp(buffer).toFormat('png').toBuffer();
            await sock.sendMessage(sender, {
                image: imageBuffer,
                caption: "✨ Figurinha convertida para imagem!"
            }, { quoted: msg });
        }

    } catch (error) {
        console.error("[ToImage] Erro ao converter figurinha:", error);
        await sendGiratinaError(sock, sender, msg, error);
    } finally {
        
        await fsp.unlink(inputGifPath).catch(() => { });
        await fsp.unlink(outputMp4Path).catch(() => { });
    }

    return true;
}

module.exports = handleToImageCommand;


module.exports.commandData = {
    name: "toimage",
    description: "Converte figurinha para imagem.",
    category: "midia",
    usage: "/toimage",
    aliases: ["/toimg","/img"]
};
