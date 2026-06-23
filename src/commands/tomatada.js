
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { sendGiratinaError, getTempDir } = require('../utils/utils');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');

const os = require('os');

async function getFfmpegPath() {
    try {
        await fs.access(ffmpegStatic);
        return ffmpegStatic;
    } catch (e) {
        const customPath = path.join(os.homedir(), 'bin', 'ffmpeg');
        try {
            await fs.access(customPath);
            return customPath;
        } catch (e2) {
            return 'ffmpeg';
        }
    }
}

async function handleTomatadaCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const mentionedJids = contextInfo?.mentionedJid || [];

    const tempDir = await getTempDir('tomatada');
    const uniqueId = Date.now();
    const imagePath = path.join(tempDir, `${uniqueId}_input.jpg`);
    const outputPath = path.join(tempDir, `${uniqueId}_tomatada.mp4`);
    const overlayPath = path.resolve(__dirname, '../assets/tomate/tomato_overlay.gif');

    let targetJid = null;
    let captionText = '';

    try {
        await sock.sendMessage(sender, { react: { text: '🍅', key: msg.key } });

        try {
            await fs.access(overlayPath);
        } catch (e) {
            throw new Error("O arquivo 'tomato_overlay.gif' não foi encontrado na pasta de assets.");
        }

        // 1) Imagem enviada diretamente com o comando
        if (msg.message.imageMessage) {
            const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: undefined });
            await fs.writeFile(imagePath, buffer);
            targetJid = commandSenderJid;
            captionText = '🍅 TOMATADA!';

            // 2) Respondendo a uma mensagem
        } else if (quotedMsgInfo) {
            const quotedType = getContentType(quotedMsgInfo);

            // 2a) Mensagem citada tem imagem
            if (quotedType === 'imageMessage') {
                const buffer = await downloadMediaMessage(
                    { key: msg.key.remoteJid, message: quotedMsgInfo },
                    'buffer', {}, { logger: undefined }
                );
                await fs.writeFile(imagePath, buffer);
                targetJid = contextInfo?.participant || commandSenderJid;
                captionText = `🍅 TOMATADA em @${targetJid.split('@')[0]}!`;

                // 2b) Mensagem citada tem sticker estático
            } else if (quotedType === 'stickerMessage' && !quotedMsgInfo.stickerMessage?.isAnimated) {
                const buffer = await downloadMediaMessage(
                    { key: msg.key.remoteJid, message: quotedMsgInfo },
                    'buffer', {}, { logger: undefined }
                );
                await fs.writeFile(imagePath, buffer);
                targetJid = contextInfo?.participant || commandSenderJid;
                captionText = `🍅 TOMATADA em @${targetJid.split('@')[0]}!`;

                // 2c) Mensagem citada sem mídia — usa foto de perfil de quem mandou
            } else {
                targetJid = contextInfo?.participant || commandSenderJid;
                await downloadProfilePicture(sock, targetJid, imagePath);
                captionText = `🍅 TOMATADA em @${targetJid.split('@')[0]}!`;
            }

            // 3) Mencionou alguém — usa foto de perfil do mencionado
        } else if (mentionedJids.length > 0) {
            targetJid = mentionedJids[0];
            await downloadProfilePicture(sock, targetJid, imagePath);
            captionText = `🍅 TOMATADA em @${targetJid.split('@')[0]}!`;

            // 4) Sem nada — usa foto de perfil do próprio remetente
        } else {
            targetJid = commandSenderJid;
            await downloadProfilePicture(sock, targetJid, imagePath);
            captionText = `🍅 TOMATADA em @${targetJid.split('@')[0]}!`;
        }

        // Gerar vídeo com FFmpeg
        const ffmpegBin = await getFfmpegPath();

        await new Promise((resolve, reject) => {
            const args = [
                '-y',
                '-i', imagePath,
                '-i', overlayPath,
                '-filter_complex',
                '[0:v]scale=512:512[base];[1:v]scale=512:512[over];[base][over]overlay=0:0',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-f', 'mp4',
                outputPath
            ];

            const ffmpegProcess = spawn(ffmpegBin, args);

            ffmpegProcess.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${code}`));
            });

            ffmpegProcess.on('error', (err) => reject(err));
        });

        const videoBuffer = await fs.readFile(outputPath);

        const sendOpts = {
            video: videoBuffer,
            gifPlayback: true,
            caption: captionText
        };
        if (targetJid) sendOpts.mentions = [targetJid];

        await sock.sendMessage(sender, sendOpts, { quoted: msg });

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    } finally {
        await fs.unlink(imagePath).catch(() => { });
        await fs.unlink(outputPath).catch(() => { });
    }
}

async function downloadProfilePicture(sock, jid, savePath) {
    let pfpUrl;
    try {
        pfpUrl = await sock.profilePictureUrl(jid, 'image');
    } catch (e) {
        throw new Error("Não consegui pegar a foto de perfil dessa pessoa.");
    }
    const pfpResponse = await axios.get(pfpUrl, { responseType: 'arraybuffer' });
    await require('fs').promises.writeFile(savePath, pfpResponse.data);
}

module.exports = handleTomatadaCommand;

module.exports.commandData = {
    name: "tomatada",
    description: "Fiscal de inatividade.",
    category: "admin",
    usage: "/tomatada",
    aliases: ["/fiscal"]
};

