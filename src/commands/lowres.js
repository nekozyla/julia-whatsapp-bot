
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendGiratinaError, getTempDir } = require('../utils/utils.js');


async function fryVideo(mediaBuffer, scalePercent) {
    const tempDir = await getTempDir('lowres');
    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}_in.mp4`);
    const outputPath = path.join(tempDir, `${randomId}_out.mp4`);

    try {
        await fs.writeFile(inputPath, mediaBuffer);

        
        
        

        
        
        const targetHeight = Math.max(32, Math.round(480 * (scalePercent / 100)));

        
        const videoBitrate = Math.max(10, Math.round(500 * (scalePercent / 100))) + 'k';

        
        
        const supportedRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
        let targetAudioRate = Math.max(7350, Math.round(44100 * (scalePercent / 100)));

        
        const audioRate = supportedRates.reduce((prev, curr) => {
            return (Math.abs(curr - targetAudioRate) < Math.abs(prev - targetAudioRate) ? curr : prev);
        });

        
        
        
        
        
        
        const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -vf "scale=-2:${targetHeight}" -c:v libx264 -preset superfast -b:v ${videoBitrate} -c:a aac -b:a 32k -ar ${audioRate} -ac 1 "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(ffmpegCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Lowres Video] Erro ffmpeg:', stderr);
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        const friedBuffer = await fs.readFile(outputPath);
        return friedBuffer;

    } finally {
        
        await fs.unlink(inputPath).catch(() => { });
        await fs.unlink(outputPath).catch(() => { });
    }
}


async function handleFritarCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

    const usageText = "Para usar, responda a uma imagem, vídeo ou figurinha com `/lowres [escala]`.\n\nA escala é um número de 1 (pior/menor) a 100 (original). O padrão é 5.";

    let targetMessage = null;
    let isStickerInput = false;
    let isVideoInput = false;

    
    const checkMessage = (msgObj) => {
        if (!msgObj) return { isMedia: false };
        const type = getContentType(msgObj);

        if (type === 'imageMessage') {
            return { isMedia: true, isVideo: false, isSticker: false };
        }

        if (type === 'videoMessage') {
            return { isMedia: true, isVideo: true, isSticker: false };
        }

        if (type === 'stickerMessage') {
            const isAnimated = msgObj.stickerMessage?.isAnimated;
            
            return { isMedia: true, isVideo: isAnimated, isSticker: true };
        }

        return { isMedia: false };
    };

    
    let mediaInfo = checkMessage(msg.message);
    if (mediaInfo.isMedia) {
        targetMessage = msg;
        isStickerInput = mediaInfo.isSticker;
        isVideoInput = mediaInfo.isVideo;
    }
    
    else if (quotedMsgInfo) {
        mediaInfo = checkMessage(quotedMsgInfo);
        if (mediaInfo.isMedia) {
            targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
            isStickerInput = mediaInfo.isSticker;
            isVideoInput = mediaInfo.isVideo;
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    
    const args = commandText.split(' ').slice(1);
    let scalePercent = parseInt(args[0], 10);
    if (isNaN(scalePercent)) {
        scalePercent = 5; 
    }
    
    scalePercent = Math.max(1, Math.min(100, scalePercent));

    try {
        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

        const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });
        const caption = `LowRes aplicado! Nível: ${scalePercent}%`;
        let friedBuffer;

        if (isVideoInput) {
            
            friedBuffer = await fryVideo(mediaBuffer, scalePercent);

            
            await sock.sendMessage(sender, { video: friedBuffer, caption: caption, gifPlayback: isStickerInput }, { quoted: msg });

        } else {
            
            let staticBuffer = mediaBuffer;
            
            if (isStickerInput) {
                staticBuffer = await sharp(mediaBuffer).png().toBuffer();
            }

            const sharpInstance = sharp(staticBuffer);
            const metadata = await sharpInstance.metadata();
            
            const finalWidth = Math.max(1, Math.round((metadata.width || 512) * (scalePercent / 100)));
            const finalHeight = Math.max(1, Math.round((metadata.height || 512) * (scalePercent / 100)));

            friedBuffer = await sharpInstance
                .resize(finalWidth, finalHeight, { kernel: sharp.kernel.nearest, fit: 'contain' })
                .jpeg({ quality: scalePercent, force: true })
                .toBuffer();

            
            await sock.sendMessage(sender, { image: friedBuffer, caption: caption }, { quoted: msg });
        }

    } catch (error) {
        console.error('[Lowres] Erro ao processar mídia:', error);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });

        let errorMsg = "Não consegui aplicar o /lowres nessa mídia.";
        if (error.message && error.message.includes('ffmpeg')) {
            errorMsg += " Houve um erro interno no processamento de vídeo.";
        }

        await sendGiratinaError(sock, sender, msg, error, errorMsg);
    }

    return true;
}

module.exports = handleFritarCommand;


module.exports.commandData = {
    name: "lowres",
    description: "Reduz qualidade da imagem.",
    category: "midia",
    usage: "/lowres",
    aliases: ["/low","/baixa","/qualidade"]
};
