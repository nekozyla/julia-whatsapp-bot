
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const { tmpdir } = require('os');
const path = require('path');
const ffmpegStatic = require('ffmpeg-static');
const fsSync = require('fs');

let ffmpegPath = process.env.FFMPEG_PATH;

if (!ffmpegPath) {
    if (ffmpegStatic && fsSync.existsSync(ffmpegStatic)) {
        ffmpegPath = ffmpegStatic;
    } else {
        console.warn("[FFMPEG] Binário do ffmpeg-static não encontrado ou inválido. Usando 'ffmpeg' global.");
        ffmpegPath = 'ffmpeg';
    }
} else {
    if (!fsSync.existsSync(ffmpegPath) && ffmpegPath !== 'ffmpeg') {
        console.warn(`[FFMPEG] O caminho especificado em FFMPEG_PATH (${ffmpegPath}) não existe. Tentando fallback.`);
        if (ffmpegStatic && fsSync.existsSync(ffmpegStatic)) {
            ffmpegPath = ffmpegStatic;
        } else {
            ffmpegPath = 'ffmpeg';
        }
    }
}

const ffmpeg = ffmpegPath;
const ffprobe = require('ffprobe-static');



const { formatError, formatSuccess } = require('./theme');

async function sendGiratinaError(sock, chatJid, originalMsg, error) {
    console.error(`[Error Handler for ${chatJid}]: ${error.message} (Status: ${error.status || 'N/A'})`);
    console.error(error.stack);

    let friendlyMessage = `⚠️ *A disturbance in the Pokemon universe*\n\nI could not complete your request.`;

    if (error.message && error.message.includes('GoogleGenerativeAI Error')) {
        if (error.message.includes('500 Internal Server Error')) {
            console.warn(`[Error Handler] Google 500 error, skipping user-facing message.`);
            return;
        }
        if (error.message.includes('API key not valid')) {
            friendlyMessage = "🔑 *Invalid Dimension Key*\nMy Gemini API key needs to be checked in the `.env` file.";
        } else if (error.message.includes('quota')) {
            friendlyMessage = "⏳ *Energy Drained*\nI hit my processing limit for now. Try again later.";
        }
    } else if (error.message.includes('FFMPEG')) {
        friendlyMessage = "📼 *Corrupted File*\nI had trouble processing the media file. The format may be invalid.";
    } else {
        friendlyMessage = `⚠️ *Execution Failed*\n\n${error.message}`;
    }

    try {
        await sock.sendMessage(chatJid, { text: formatError(friendlyMessage) }, { quoted: originalMsg });
    } catch (sendError) {
        console.error(`[Error Handler] Failed to send the error message to ${chatJid}:`, sendError);
    }
}




function getTextFromMsg(message) {
    if (!message) return null;

    const ephemeralContainer = message.ephemeralMessage;
    if (ephemeralContainer?.message) {
        const nestedText = getTextFromMsg(ephemeralContainer.message);
        if (nestedText) return nestedText;
    }

    const viewOnceContainer = message.viewOnceMessage || message.viewOnceMessageV2 || message.viewOnceMessageV2Extension;
    if (viewOnceContainer?.message) {
        const nestedText = getTextFromMsg(viewOnceContainer.message);
        if (nestedText) return nestedText;
    }


    return message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        null;
}


function extractCommandText(fullText, commandPrefix) {
    if (!fullText || !fullText.startsWith(commandPrefix)) return null;
    return fullText.substring(commandPrefix.length).trim();
}



async function convertAudioToWav(audioBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            '-i', 'pipe:0',
            '-f', 'wav',
            '-ac', '1',
            '-ar', '16000',
            'pipe:1'
        ]);

        let outputBuffers = [];
        ffmpegProcess.stdout.on('data', (chunk) => outputBuffers.push(chunk));
        ffmpegProcess.stderr.on('data', (data) => console.error(`[FFMPEG STDERR] ${data}`));

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(outputBuffers));
            } else {
                reject(new Error(`FFMPEG falhou ao converter para WAV com o código ${code}`));
            }
        });

        ffmpegProcess.on('error', (err) => {
            reject(err);
        });

        ffmpegProcess.stdin.write(audioBuffer);
        ffmpegProcess.stdin.end();
    });
}



async function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        exec(`${ffprobe.path} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (error, stdout, stderr) => {
            if (error) {
                reject(`Erro ao obter a duração do vídeo: ${stderr}`);
            } else {
                resolve(parseFloat(stdout));
            }
        });
    });
}


async function pcmToOgg(pcmBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            '-f', 's16le',
            '-ar', '24000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-c:a', 'libopus',
            '-b:a', '16k',
            '-vbr', 'on',
            '-f', 'ogg',
            'pipe:1'
        ]);

        let outputBuffers = [];
        ffmpegProcess.stdout.on('data', (chunk) => {
            outputBuffers.push(chunk);
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log("[FFMPEG] Conversão de PCM para OGG concluída.");
                resolve(Buffer.concat(outputBuffers));
            } else {
                reject(new Error(`FFMPEG falhou com o código ${code}`));
            }
        });

        ffmpegProcess.on('error', (err) => {
            reject(err);
        });

        ffmpegProcess.stdin.write(pcmBuffer);
        ffmpegProcess.stdin.end();
    });
}


async function getTempDir(subDir = '') {
    const tempPath = path.join(__dirname, '..', '..', 'temp', subDir);
    await fs.mkdir(tempPath, { recursive: true });
    return tempPath;
}


async function getChromiumPath() {
    const possiblePaths = [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/snap/bin/chromium',
        '/snap/bin/chromium-browser'
    ];

    for (const path of possiblePaths) {
        try {
            await fs.access(path);
            return path;
        } catch (e) { }
    }
    return null;
}

module.exports = {
    sendGiratinaError,
    getTextFromMsg,
    extractCommandText,
    convertAudioToWav,
    getVideoDuration,
    pcmToOgg,
    getTempDir,
    getChromiumPath,
    normalizeText,
    convertGifToMp4,
    getRandomToken
};


function normalizeText(text) {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getRandomToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}


async function convertGifToMp4(gifBuffer) {
    const tempDir = await getTempDir('conversions');
    const inputPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.gif`);
    const outputPath = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);

    await fs.writeFile(inputPath, gifBuffer);

    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            '-y',
            '-i', inputPath,
            '-movflags', 'faststart',
            '-pix_fmt', 'yuv420p',
            '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
            '-f', 'mp4',
            outputPath
        ]);

        ffmpegProcess.on('close', async (code) => {
            if (code === 0) {
                try {
                    const mp4Buffer = await fs.readFile(outputPath);
                    await fs.unlink(inputPath).catch(() => { });
                    await fs.unlink(outputPath).catch(() => { });
                    resolve(mp4Buffer);
                } catch (err) {
                    reject(err);
                }
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpegProcess.on('error', (err) => reject(err));
    });
}
