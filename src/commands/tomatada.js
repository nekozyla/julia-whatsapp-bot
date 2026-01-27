
const { sendJuliaError, getTempDir } = require('../utils/utils');
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
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    
    let targetJid = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;

    const tempDir = await getTempDir('tomatada');
    const pfpPath = path.join(tempDir, `${targetJid.split('@')[0]}_pfp.jpg`);
    const outputPath = path.join(tempDir, `${targetJid.split('@')[0]}_tomatada.mp4`);
    
    const overlayPath = path.resolve(__dirname, '../../temp/tomato_overlay.gif');

    try {
        await sock.sendMessage(sender, { react: { text: '🍅', key: msg.key } });

        
        try {
            await fs.access(overlayPath);
        } catch (e) {
            throw new Error("O arquivo 'tomato_overlay.gif' não foi encontrado na pasta temp.");
        }

        
        let pfpUrl;
        try {
            pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            await sock.sendMessage(sender, { text: "⚠️ Não consegui pegar a foto de perfil dessa pessoa." }, { quoted: msg });
            return;
        }

        
        const pfpResponse = await axios.get(pfpUrl, { responseType: 'arraybuffer' });
        await fs.writeFile(pfpPath, pfpResponse.data);

        
        
        
        
        const ffmpegBin = await getFfmpegPath();

        await new Promise((resolve, reject) => {
            const args = [
                '-y', 
                '-i', pfpPath, 
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

        await sock.sendMessage(sender, {
            video: videoBuffer,
            gifPlayback: true,
            caption: `🍅 TOMATADA em @${targetJid.split('@')[0]}!`,
            mentions: [targetJid]
        }, { quoted: msg });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    } finally {
        
        await fs.unlink(pfpPath).catch(() => { });
        await fs.unlink(outputPath).catch(() => { });
    }
}

module.exports = handleTomatadaCommand;


module.exports.commandData = {
    name: "tomatada",
    description: "Fiscal de inatividade.",
    category: "admin",
    usage: "/tomatada",
    aliases: ["/fiscal"]
};
