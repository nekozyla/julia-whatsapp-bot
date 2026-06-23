const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const { execFile } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const { generateNPCard } = require('./npCardGenerator');

const execFileAsync = util.promisify(execFile);
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');
const MAX_VIDEO_SECONDS = 30;
const PYTHON_CANDIDATES = ['python3.11', 'python3', 'python'];
const YTDLP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

async function safeUnlink(filePath) {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
    } catch (e) { }
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch (e) {
        return false;
    }
}

async function downloadSpotifyPreview(previewUrl, outputPath) {
    const response = await axios.get(previewUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: {
            'User-Agent': YTDLP_USER_AGENT
        }
    });

    await fs.writeFile(outputPath, Buffer.from(response.data));
    return outputPath;
}

async function downloadYoutubeAudio(searchQuery) {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const stamp = `npvideo_${Date.now()}`;
    const outputTemplate = path.join(TEMP_DIR, `${stamp}_%(id)s.%(ext)s`);
    const cookiesPath = path.join(__dirname, '..', 'cookies.txt');

    const commonArgs = [
        '-m', 'yt_dlp',
        '--output', outputTemplate,
        '--no-playlist',
        '--force-ipv4',
        '--no-warnings',
        '--user-agent', YTDLP_USER_AGENT,
        '--restrict-filenames',
        '-x',
        '--audio-format', 'm4a',
        `ytsearch1:${searchQuery}`
    ];

    if (await fileExists(cookiesPath)) {
        commonArgs.push('--cookies', cookiesPath);
    }

    const attemptArgsList = [
        ['--js-runtimes', 'node', '--remote-components', 'ejs:github', '--impersonate', 'chrome'],
        ['--js-runtimes', 'node', '--impersonate', 'chrome'],
        ['--js-runtimes', 'node'],
        []
    ];

    let lastError = null;

    for (const pythonCmd of PYTHON_CANDIDATES) {
        for (const extraArgs of attemptArgsList) {
            try {
                await execFileAsync(pythonCmd, [...commonArgs.slice(0, 7), ...extraArgs, ...commonArgs.slice(7)], { maxBuffer: 1024 * 1024 * 10 });
                const files = await fs.readdir(TEMP_DIR);
                const foundFile = files.find(file => file.startsWith(`${stamp}_`));
                if (foundFile) {
                    return path.join(TEMP_DIR, foundFile);
                }
            } catch (error) {
                lastError = error;
            }
        }
    }

    throw new Error(lastError?.stderr || lastError?.message || 'Falha ao baixar áudio para o vídeo.');
}

async function resolveAudioPreview(track, spotifyData) {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const previewPath = path.join(TEMP_DIR, `np_preview_${Date.now()}.mp3`);

    if (spotifyData?.previewUrl) {
        try {
            await downloadSpotifyPreview(spotifyData.previewUrl, previewPath);
            return previewPath;
        } catch (error) {
            await safeUnlink(previewPath);
            console.warn('[NP Video] Spotify preview falhou, usando YouTube:', error.message);
        }
    }

    return downloadYoutubeAudio(`${track.name} ${track.artist} audio`);
}

async function renderVideo(imagePath, audioPath, outputPath, durationSeconds = MAX_VIDEO_SECONDS) {
    const ffmpegCandidates = [ffmpegStatic, 'ffmpeg'].filter(Boolean);
    const safeDuration = Math.max(5, Math.min(MAX_VIDEO_SECONDS, Number(durationSeconds) || MAX_VIDEO_SECONDS));
    const filterComplex = [
        `[0:v]scale=720:720:force_original_aspect_ratio=increase,crop=720:720,format=yuv420p,drawbox=x=50:y=650:w=620:h=8:color=white@0.18:t=fill,drawbox=x=50:y=650:w='620*min(t/${safeDuration}\\,1)':h=8:color=0x1DB954@0.95:t=fill[base]`,
        '[1:a]aformat=channel_layouts=mono,showwaves=s=620x120:mode=cline:colors=0x1DB954|0xFFFFFF,format=rgba[waves]',
        '[base][waves]overlay=x=(W-w)/2:y=500:shortest=1[v]'
    ].join(';');

    let lastError = null;

    for (const ffmpegCmd of ffmpegCandidates) {
        try {
            await execFileAsync(ffmpegCmd, [
                '-y',
                '-loop', '1',
                '-i', imagePath,
                '-i', audioPath,
                '-filter_complex', filterComplex,
                '-map', '[v]',
                '-map', '1:a',
                '-c:v', 'libx264',
                '-preset', 'veryfast',
                '-tune', 'stillimage',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-r', '30',
                '-shortest',
                '-t', String(safeDuration),
                '-movflags', '+faststart',
                outputPath
            ], { maxBuffer: 1024 * 1024 * 10 });
            return outputPath;
        } catch (error) {
            lastError = error;
        }
    }

    throw new Error(lastError?.stderr || lastError?.message || 'Falha ao renderizar vídeo NP.');
}

async function generateNPVideo(track, user, username, theme, currentDuration, totalDuration, progressPercent, spotifyData = {}) {
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const cardPath = await generateNPCard(track, user, username, theme, currentDuration, totalDuration, progressPercent);
    let audioPath = null;
    const outputPath = path.join(TEMP_DIR, `np_video_${Date.now()}.mp4`);

    try {
        audioPath = await resolveAudioPreview(track, spotifyData);
        const durationSeconds = Math.min(MAX_VIDEO_SECONDS, Math.max(10, Math.ceil((spotifyData?.duration || 30000) / 1000)));
        await renderVideo(cardPath, audioPath, outputPath, durationSeconds);

        return {
            videoPath: outputPath,
            cleanupPaths: [cardPath, audioPath]
        };
    } catch (error) {
        await Promise.all([
            safeUnlink(cardPath),
            safeUnlink(audioPath),
            safeUnlink(outputPath)
        ]);
        throw error;
    }
}

module.exports = {
    generateNPVideo
};
