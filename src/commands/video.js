const path = require('path');
const fsp = require('fs').promises;
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

function buildYtdlpArgs(cookiesFilePath, height, outputPath, url) {
    // Priorizando codec avc (H.264) e áudio m4a (AAC) para melhor compatibilidade do WhatsApp
    const format = `bestvideo[vcodec^=avc][ext=mp4][height<=${height}]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=${height}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${height}]/best[height<=${height}]/best`;
    
    const args = [
        '-m', 'yt_dlp',
        '--js-runtimes', 'node',
        '--remote-components', 'ejs:github',
        '--impersonate', 'chrome',
        '-f', format,
        '-S', `vcodec:h264,res:${height},acodec:m4a`,
        '--merge-output-format', 'mp4',
        '-o', outputPath
    ];

    if (cookiesFilePath) {
        args.push('--cookies', cookiesFilePath);
    }

    args.push(url);
    return args;
}

async function runYtdlp(args, tempDir, randomId) {
    try {
        await execFileAsync('python3.12', args, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 });
        const files = await fsp.readdir(tempDir);
        const foundFile = files.find(f => f.startsWith(randomId));
        if (foundFile) {
            return path.join(tempDir, foundFile);
        }
    } catch (error) {
        console.error('[YTDLP Error]:', error);
    }
    throw new Error('Não foi possível baixar o vídeo. O link pode ser privado ou inválido.');
}

const crypto = require('crypto');

const MAX_SIZE = 32 * 1024 * 1024; // 32MB
const QUALITY_TIERS = [1080, 720, 480, 360];

function extractUrl(text) {
    if (!text || typeof text !== 'string') return null;
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    return urlMatch ? urlMatch[0] : null;
}

function extractUrlFromQuotedMessage(msg) {
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = contextInfo?.quotedMessage;
    if (!quoted) return null;

    const quotedTexts = [
        quoted.conversation,
        quoted.extendedTextMessage?.text,
        quoted.imageMessage?.caption,
        quoted.videoMessage?.caption,
        quoted.documentMessage?.caption,
    ];

    for (const text of quotedTexts) {
        const found = extractUrl(text);
        if (found) return found;
    }

    return null;
}

async function handleVideoCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const url = extractUrl(commandText) || extractUrlFromQuotedMessage(msg);

    if (!url) {
        await sock.sendMessage(sender, {
            text: "Envie um link com /video ou responda uma mensagem que contenha link usando /video."
        }, { quoted: msg });
        return true;
    }

    console.log(`[Video] ${pushName} solicitou o download do vídeo de: ${url}`);

    const tempDir = path.join(__dirname, '..', 'temp');
    await fsp.mkdir(tempDir, { recursive: true });

    const isYouTube = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
    let cookiesFilePath = '';
    if (isYouTube) {
        const pathCandidate = path.join(__dirname, '..', 'cookies.txt');
        try {
            await fsp.access(pathCandidate);
            cookiesFilePath = pathCandidate;
        } catch (e) {
            console.warn('[Download] Arquivo cookies.txt não encontrado.');
        }
    }

    let downloadedFilePath = '';
    let chosenQuality = null;

    try {
        await sock.sendMessage(sender, { text: "🎥 Baixando vídeo, isso pode levar um momento..." }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);

        for (const height of QUALITY_TIERS) {
            const randomId = crypto.randomBytes(8).toString('hex');
            const tempOutputPath = path.join(tempDir, `${randomId}.%(ext)s`);
            const ytdlpArgs = buildYtdlpArgs(cookiesFilePath, height, tempOutputPath, url);

            console.log(`[Video] Tentando ${height}p...`);

            try {
                downloadedFilePath = await runYtdlp(ytdlpArgs, tempDir, randomId);
            } catch (e) {
                // Se falhou o download em si, propaga o erro
                throw e;
            }

            const stats = await fsp.stat(downloadedFilePath);
            console.log(`[Video] ${height}p = ${(stats.size / 1024 / 1024).toFixed(1)}MB`);

            if (stats.size <= MAX_SIZE) {
                chosenQuality = height;
                break;
            }

            // Arquivo grande demais, apaga e tenta qualidade inferior
            console.log(`[Video] ${height}p excede 32MB, tentando qualidade inferior...`);
            await fsp.unlink(downloadedFilePath).catch(() => { });
            downloadedFilePath = '';
        }

        if (!downloadedFilePath) {
            await sock.sendMessage(sender, { text: "O vídeo é muito grande mesmo na qualidade mais baixa (> 32MB). 😢" }, { quoted: msg });
            return true;
        }

        const fileBuffer = await fsp.readFile(downloadedFilePath);
        const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
        await sock.sendMessage(sender, {
            video: fileBuffer,
            caption: `✅ Vídeo baixado! (${chosenQuality}p • ${sizeMB}MB)`
        });

    } catch (error) {
        console.error("[Video] Erro no processo de download:", error);
        await sock.sendMessage(sender, { text: `😕 Falha no download.\n\n_Motivo: ${error.message}_` }, { quoted: msg });
    } finally {
        if (downloadedFilePath) {
            await fsp.unlink(downloadedFilePath).catch(() => { });
        }
    }

    return true;
}

module.exports = handleVideoCommand;

module.exports.commandData = {
    name: "video",
    description: "Baixa video a partir de um link.",
    category: "downloads",
    usage: "/video <link>",
    aliases: ["/vid", "/mp4", "/assistir"]
};
