const path = require('path');
const fsp = require('fs').promises;
const axios = require('axios');
const { spawn } = require('child_process');
const crypto = require('crypto');

const MAX_SIZE = 32 * 1024 * 1024; // 32MB (áudio)
const MAX_SIZE_DOCUMENT = 200 * 1024 * 1024; // 200MB (arquivo)
const MAX_DURATION = 600; // 10 minutos em segundos
const THUMB_TIMEOUT = 15000;

function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    return urlMatch ? urlMatch[0] : null;
}

function sanitizeMetadataValue(value, fallback = '') {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    return normalized || fallback;
}

function sanitizeFileName(value, fallback = 'audio') {
    const safe = sanitizeMetadataValue(value, fallback)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return safe || fallback;
}

function buildAudioMetadata(info, fallbackUrl) {
    const thumbs = Array.isArray(info.thumbnails) ? info.thumbnails : [];
    const bestThumb = thumbs.length > 0 ? thumbs[thumbs.length - 1]?.url : null;

    const trackTitle = sanitizeMetadataValue(info.track || info.title, 'Desconhecido');
    const artist = sanitizeMetadataValue(info.artist || info.uploader || info.channel, 'Desconhecido');
    const album = sanitizeMetadataValue(info.album || info.playlist_title, 'YouTube');
    const genre = sanitizeMetadataValue(info.genre, '');
    const releaseYear = info.release_year || info.upload_date?.slice(0, 4) || '';
    const comment = sanitizeMetadataValue(info.description, '');
    const webpageUrl = sanitizeMetadataValue(info.webpage_url || fallbackUrl, '');
    const thumbnailUrl = sanitizeMetadataValue(info.thumbnail || bestThumb, '');

    return {
        title: trackTitle,
        artist,
        album,
        genre,
        releaseYear: sanitizeMetadataValue(String(releaseYear || ''), ''),
        comment,
        webpageUrl,
        thumbnailUrl
    };
}

async function downloadThumbnailBuffer(url) {
    if (!url) return null;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: THUMB_TIMEOUT,
            maxRedirects: 5
        });
        const buffer = Buffer.from(response.data);
        if (!buffer.length) return null;
        return buffer;
    } catch (error) {
        console.warn('[Audio] Falha ao baixar thumbnail:', error.message);
        return null;
    }
}

function runFfmpegWithCover(inputPath, outputPath, coverPath, metadata) {
    return new Promise((resolve, reject) => {
        const args = [
            '-y',
            '-i', inputPath,
            '-i', coverPath,
            '-map', '0:a',
            '-map', '1:v',
            '-c:a', 'copy',
            '-c:v', 'mjpeg',
            '-disposition:v:0', 'attached_pic',
            '-metadata', `title=${metadata.title}`,
            '-metadata', `artist=${metadata.artist}`,
            '-metadata', `album=${metadata.album}`,
            '-metadata', `album_artist=${metadata.artist}`,
            '-metadata', `genre=${metadata.genre || 'Unknown'}`,
            '-metadata', `date=${metadata.releaseYear || ''}`,
            '-metadata', `comment=${metadata.comment || ''}`,
            '-metadata', `synopsis=${metadata.webpageUrl || ''}`,
            outputPath
        ];

        const ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';

        ffmpegProcess.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });

        ffmpegProcess.on('error', (err) => {
            reject(err);
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`ffmpeg retornou código ${code}: ${stderr.slice(-400)}`));
            }
        });
    });
}

const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function runYtdlp(args, tempDir, randomId) {
    try {
        const { stdout, stderr } = await execFileAsync('python3.12', args, { timeout: 300000, maxBuffer: 1024 * 1024 * 10 });
        const combined = (stdout || '') + (stderr || '');
        
        const files = await fsp.readdir(tempDir);
        const foundFile = files.find(f => f.startsWith(randomId));
        if (foundFile) {
            return { filePath: path.join(tempDir, foundFile), stdout };
        } else {
            console.warn('[YTDLP] Arquivo não encontrado após download.');
            console.warn('[YTDLP stdout]:', stdout);
            console.warn('[YTDLP stderr]:', stderr);

            if (combined.includes('does not pass filter') || combined.includes('SkiSkipping') || combined.includes('duration')) {
                throw new Error('O vídeo excede o limite de duração (10 minutos) ou foi filtrado.');
            }
            if (combined.includes('Sign in') || combined.includes('confirm your age') || combined.includes('bot')) {
                throw new Error('O YouTube está exigindo verificação. Tente novamente mais tarde.');
            }
            if (combined.includes('Private video') || combined.includes('private')) {
                throw new Error('Este vídeo é privado e não pode ser baixado.');
            }
            if (combined.includes('Postprocessing')) {
                throw new Error('Erro na conversão do áudio após o download.');
            }
            throw new Error('Download não gerou arquivo. O vídeo pode ser privado, removido ou não está disponível.');
        }
    } catch (error) {
        console.error('[YTDLP Error]:', error);
        const combined = (error.stdout || '') + (error.stderr || '') + (error.message || '');
        if (combined.includes('DRM')) {
            throw new Error('Este conteúdo é protegido por DRM e não pode ser baixado.');
        }
        if (combined.includes('No video found') || combined.includes('no results')) {
            throw new Error('Nenhum resultado encontrado para essa busca.');
        }
        if (combined.includes('Sign in') || combined.includes('log in') || combined.includes('confirm your age') || combined.includes('bot')) {
            throw new Error('O YouTube está exigindo verificação. Tente novamente mais tarde.');
        }
        if (combined.includes('Private video') || combined.includes('private')) {
            throw new Error('Este vídeo é privado e não pode ser baixado.');
        }
    }
    throw new Error('Não foi possível baixar o áudio. O link pode ser privado ou inválido.');
}

async function getVideoInfo(args) {
    try {
        const { stdout } = await execFileAsync('python3.12', args, { timeout: 30000 });
        return JSON.parse(stdout.trim());
    } catch (e) {
        console.error('[YTDLP Info Error]:', e);
    }
    throw new Error('Não encontrei nenhum resultado.');
}

async function handleAudioCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;

    const argsRaw = (commandText || '').substring(msgDetails.command.length).trim();
    const url = extractUrl(argsRaw);
    const searchQuery = !url ? argsRaw : null;

    if (!url && !searchQuery) {
        await sock.sendMessage(sender, {
            text: `𝗠𝗨𝗦𝗜𝗖 ─ Como usar:\n\n` +
                `▸ /audio <link> — baixa áudio de um link\n` +
                `▸ /musica <nome> — busca e baixa uma música\n\n` +
                `_Aliases: /play, /mp3, /som_`
        }, { quoted: msg });
        return true;
    }

    const tempDir = path.join(__dirname, '..', 'temp');
    await fsp.mkdir(tempDir, { recursive: true });

    // Cookies só para YouTube
    let cookiesArgument = '';
    let cookiesFilePath = '';
    const targetUrl = url || `ytsearch1:${searchQuery}`;
    const isYouTube = url ? /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url) : true; // search sempre é YT
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
    const tempFiles = new Set();
    let songTitle = '';

    try {
        const statusMsg = await sock.sendMessage(sender, {
            text: searchQuery
                ? `🔎 Buscando: _${searchQuery}_...`
                : `🎵 Verificando áudio, por favor aguarde...`
        }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);

        // Busca info antes de baixar (tanto para URL direta quanto para busca por nome)
        const infoTarget = searchQuery ? `ytsearch1:${searchQuery}` : url;
        
        const infoArgs = [
            '-m', 'yt_dlp',
            '--js-runtimes', 'node',
            '--remote-components', 'ejs:github',
            '--impersonate', 'chrome',
            '--dump-json',
            '--no-download'
        ];

        if (cookiesFilePath) {
            infoArgs.push('--cookies', cookiesFilePath);
        }
        infoArgs.push(infoTarget);

        let info;
        try {
            info = await getVideoInfo(infoArgs);
        } catch (e) {
            const errText = searchQuery
                ? `😕 Nenhum resultado encontrado para: _${searchQuery}_`
                : `😕 Não foi possível obter informações do vídeo. O link pode ser inválido, privado ou não disponível.`;
            await sock.sendMessage(sender, { text: errText, edit: statusMsg.key });
            return true;
        }

        songTitle = info.title || 'Desconhecido';
        const metadata = buildAudioMetadata(info, url);
        const duration = info.duration || 0;
        const uploader = info.uploader || info.channel || '';
        const durationStr = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;

        if (searchQuery) {
            console.log(`[Audio] ${pushName} buscando: "${searchQuery}" → encontrado: "${songTitle}" (${duration}s)`);
        } else {
            console.log(`[Audio] ${pushName} solicitou áudio de: ${url} → "${songTitle}" (${duration}s)`);
        }

        const isLong = duration > MAX_DURATION;

        await sock.sendMessage(sender, {
            text: isLong
                ? `📁 Baixando como arquivo: *${songTitle}*${uploader ? ` — _${uploader}_` : ''}\n⏱ ${durationStr} _(acima de 10 min)_`
                : `🎵 Baixando: *${songTitle}*${uploader ? ` — _${uploader}_` : ''}\n⏱ ${durationStr}`,
            edit: statusMsg.key
        });

        await sock.sendPresenceUpdate('composing', sender);

        const randomId = crypto.randomBytes(8).toString('hex');
        const tempOutputPath = path.join(tempDir, `${randomId}.%(ext)s`);

        const downloadArgs = [
            '-m', 'yt_dlp',
            '--js-runtimes', 'node',
            '--remote-components', 'ejs:github',
            '--impersonate', 'chrome',
            '-x',
            '--audio-format', 'm4a',
            '-o', tempOutputPath
        ];

        if (cookiesFilePath) {
            downloadArgs.push('--cookies', cookiesFilePath);
        }
        downloadArgs.push(infoTarget);

        console.log(`[Audio] Executando download com argumentos do yt-dlp`);
        const result = await runYtdlp(downloadArgs, tempDir, randomId);
        downloadedFilePath = result.filePath;
        tempFiles.add(downloadedFilePath);

        let thumbnailBuffer = await downloadThumbnailBuffer(metadata.thumbnailUrl);

        if (thumbnailBuffer && downloadedFilePath) {
            const coverPath = path.join(tempDir, `${randomId}_cover.jpg`);
            const metadataOutputPath = path.join(tempDir, `${randomId}_meta.m4a`);

            try {
                await fsp.writeFile(coverPath, thumbnailBuffer);
                tempFiles.add(coverPath);

                await runFfmpegWithCover(downloadedFilePath, metadataOutputPath, coverPath, metadata);
                tempFiles.add(metadataOutputPath);
                downloadedFilePath = metadataOutputPath;
                console.log(`[Audio] Metadata + capa embutidas com sucesso: ${downloadedFilePath}`);
            } catch (embedError) {
                console.warn('[Audio] Falha ao embutir metadata/capa, seguindo com arquivo original:', embedError.message);
            }
        }

        console.log(`[Audio] Mídia baixada: ${downloadedFilePath}`);
        await fsp.access(downloadedFilePath);

        const stats = await fsp.stat(downloadedFilePath);
        const sizeLimit = isLong ? MAX_SIZE_DOCUMENT : MAX_SIZE;
        if (stats.size > sizeLimit) {
            const limitStr = isLong ? '200MB' : '32MB';
            await sock.sendMessage(sender, { text: `O arquivo foi baixado, mas é muito grande para ser enviado no WhatsApp (> ${limitStr}). 😢` }, { quoted: msg });
        } else {
            const fileBuffer = await fsp.readFile(downloadedFilePath);
            const sizeMB = (fileBuffer.length / 1024 / 1024).toFixed(1);
            const safeFileName = `${sanitizeFileName(`${metadata.title} - ${metadata.artist}`, 'audio')}.m4a`;
            const richTitle = metadata.title || songTitle;
            const richBody = `${metadata.artist || uploader || 'Desconhecido'}${metadata.album ? ` • ${metadata.album}` : ''}`;

            const contextInfo = thumbnailBuffer ? {
                externalAdReply: {
                    title: richTitle,
                    body: richBody,
                    thumbnail: thumbnailBuffer,
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    sourceUrl: metadata.webpageUrl || undefined,
                    showAdAttribution: false
                }
            } : undefined;

            if (isLong) {
                await sock.sendMessage(sender, {
                    document: fileBuffer,
                    mimetype: 'audio/mp4',
                    fileName: safeFileName
                }, { quoted: msg });
                console.log(`[Audio] Enviado como arquivo: "${songTitle}" (${sizeMB}MB)`);
            } else {
                await sock.sendMessage(sender, {
                    audio: fileBuffer,
                    mimetype: 'audio/mp4',
                    fileName: safeFileName,
                    ptt: false,
                    seconds: duration,
                    ...(thumbnailBuffer ? { jpegThumbnail: thumbnailBuffer } : {}),
                    ...(contextInfo ? { contextInfo } : {})
                });
                console.log(`[Audio] Enviado com sucesso: "${songTitle || url}" (${sizeMB}MB)`);
            }
        }

    } catch (error) {
        console.error("[Audio] Erro no processo de download:", error);
        await sock.sendMessage(sender, { text: `😕 Falha no download.\n\n_Motivo: ${error.message}_` }, { quoted: msg });
    } finally {
        for (const filePath of tempFiles) {
            await fsp.unlink(filePath).catch(() => { });
        }
    }

    return true;
}

module.exports = handleAudioCommand;

module.exports.commandData = {
    name: "audio",
    description: "Baixa audio de link ou busca no YouTube.",
    category: "downloads",
    usage: "/audio <link ou busca>",
    aliases: ["/musica", "/mp3", "/play", "/som"]
};
