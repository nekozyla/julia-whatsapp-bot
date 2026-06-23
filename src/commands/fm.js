
const util = require('util');
const { exec, execFile } = require('child_process');
const execAsync = util.promisify(exec);
const execFileAsync = util.promisify(execFile);
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config.js');

// Novos Módulos
const themes = require('../utils/npThemes.js');
const npManager = require('../managers/npManager.js');
const { generateNPCard, generateTopTracksCard, generateLyricsCard, generateChartCard, generateArtistChartCard, generateTopArtistsCard, generateTopAlbumsCard, generateReceiptCard, generateProfileCard, generateStreakCard, generateIcebergCard, generateDiscoveryCard, generateTasteCard, generateWhoKnowsCard, generateYearCard } = require('../helpers/npCardGenerator.js');
const { generateNPVideo } = require('../helpers/npVideoGenerator.js');

// Helpers existentes
const { getSpotifyData, getSpotifyArtistImage } = require('../helpers/spotifyHelper');
const profileManager = require('../managers/profileManager');
const fmGameManager = require('../managers/fmGameManager');
const groupMetadataManager = require('../managers/groupMetadataManager');
const crownManager = require('../managers/crownManager');
const contactManager = require('../managers/contactManager');

const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';
const NP_BASE_THEME = 'dynamic';
const PERIOD_MAP = {
    semana: '7day',
    week: '7day',
    weekly: '7day',
    w: '7day',
    mes: '1month',
    month: '1month',
    monthly: '1month',
    m: '1month',
    trimestre: '3month',
    quarter: '3month',
    quarterly: '3month',
    q: '3month',
    semestre: '6month',
    half: '6month',
    h: '6month',
    ano: '12month',
    year: '12month',
    yearly: '12month',
    y: '12month',
    geral: 'overall',
    all: 'overall',
    alltime: 'overall',
    overall: 'overall',
    a: 'overall'
};
const PERIOD_LABEL_MAP = {
    '7day': 'SEMANA',
    '1month': 'MÊS',
    '3month': 'TRIMESTRE',
    '6month': 'SEMESTRE',
    '12month': 'ANO',
    overall: 'GERAL'
};

function resolvePeriod(token, fallback = '7day') {
    if (!token) return fallback;
    return PERIOD_MAP[token.toLowerCase()] || fallback;
}

// Retorna nick do bot → last.fm username → número do telefone
function getDisplayName(jid) {
    if (!jid) return '?';
    return contactManager.getNickname(jid) || npManager.getUserLastFm(jid) || jid.split('@')[0];
}

function relativeTimeFromUnix(unixTs) {
    if (!unixTs) return 'agora há pouco';
    const tsMs = Number(unixTs) * 1000;
    if (!Number.isFinite(tsMs)) return 'agora há pouco';

    const deltaSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
    if (deltaSec < 60) return `${deltaSec}s atrás`;

    const minutes = Math.floor(deltaSec / 60);
    if (minutes < 60) return `${minutes}min atrás`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;

    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
}

async function lastFmRequest(params, retry403 = true) {
    const requestParams = {
        ...params,
        api_key: config.LASTFM_API_KEY,
        format: 'json'
    };

    try {
        const response = await axios.get(LASTFM_BASE_URL, {
            params: requestParams,
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*'
            }
        });
        return response.data;
    } catch (error) {
        if (retry403 && error.response?.status === 403) {
            await new Promise(resolve => setTimeout(resolve, 450));
            return lastFmRequest(params, false);
        }
        throw error;
    }
}

async function handleTheme(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const requestedTheme = args[1]?.toLowerCase();

    // Auto-detect .nptheme file
    let docMessage = msg.message?.documentMessage;
    if (!docMessage && msg.message?.documentWithCaptionMessage) {
        docMessage = msg.message.documentWithCaptionMessage.message.documentMessage;
    }

    if (docMessage) {
        const filename = docMessage.fileName?.toLowerCase() || '';
        if (filename.endsWith('.nptheme') || filename.endsWith('.json')) {
            try {
                const stream = await downloadContentFromMessage(docMessage, 'document');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                const themeData = JSON.parse(buffer.toString('utf-8'));

                // Apply custom NP theme colors
                const validKeys = ['cardBg', 'textColor', 'subTextColor', 'accentColor', 'borderColor', 'statusColor', 'statusBg', 'shadow', 'fontFamily', 'cardOpacity', 'borderRadius', 'layout', 'elementPositions', 'decorations'];
                const customNp = {};
                for (const key of validKeys) {
                    if (themeData[key] || themeData.theme?.[key]) {
                        customNp[key] = themeData[key] || themeData.theme[key];
                    }
                }

                if (Object.keys(customNp).length === 0) {
                    return sock.sendMessage(sender, { text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Arquivo de tema inválido\n┃\n┗━━━━━━━━━━━━━━' }, { quoted: msg });
                }

                const settings = npManager.getUserSettings(commandSenderJid);
                settings.customNpTheme = customNp;
                settings.theme = 'custom-np';
                await npManager.setUserSettings(commandSenderJid, settings);

                return sock.sendMessage(sender, {
                    text: '┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Tema importado\n┃ ➢ 𝗧𝗲𝗺𝗮 › Custom NP\n┃\n┗━━━━━━━━━━━━━━'
                }, { quoted: msg });

            } catch (e) {
                console.error('[NP] Error importing .nptheme:', e);
                return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha na importação\n┃ ➢ 𝗜𝗻𝗳𝗼 › ${e.message}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
        }
    }

    if (!requestedTheme) {
        let themeList = `┏━━❪ 𝗧𝗛𝗘𝗠𝗘𝗦 ❫━━\n┃\n`;
        Object.keys(themes).forEach(key => {
            const t = themes[key];
            if (t.name) themeList += `┃ ➢ ${key.toUpperCase()} › ${t.name}\n`;
        });
        themeList += `┃ ➢ 𝗖𝗨𝗦𝗧𝗢𝗠 › Definido via /fm bg\n`;
        themeList += `┃ ➢ 𝗔𝗥𝗤𝗨𝗜𝗩𝗢 › Importar .nptheme\n┃\n`;
        themeList += `┣━━❪ 𝗨𝗦𝗢 ❫━━\n┃\n`;
        themeList += `┃ ➢ /fm tema <nome>\n`;
        themeList += `┃ ➢ Ex: /fm tema neon\n┃\n`;
        themeList += `┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text: themeList }, { quoted: msg });
    }

    if (themes[requestedTheme] || requestedTheme === 'custom') {
        const settings = npManager.getUserSettings(commandSenderJid);
        if (requestedTheme !== 'custom-np' && settings.customNpTheme) {
            delete settings.customNpTheme;
            settings.theme = requestedTheme;
            await npManager.setUserSettings(commandSenderJid, settings);
        } else {
            await npManager.setUserTheme(commandSenderJid, requestedTheme);
        }

        const themeName = requestedTheme === 'custom' ? 'Customizado' : themes[requestedTheme].name;
        return sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Tema Definido\n┃ ➢ 𝗧𝗲𝗺𝗮 › ${themeName}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    } else {
        return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Tema não encontrado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm tema\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }
}

async function handleBackground(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

    const messageType = Object.keys(msg.message)[0];
    const isImage = messageType === 'imageMessage';
    const isQuotedImage = messageType === 'extendedTextMessage' && msg.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage;

    let targetMessage = null;

    if (isImage) {
        targetMessage = msg;
    } else if (isQuotedImage) {
        targetMessage = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
    } else {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Formatação Incorreta\n┃ ➢ 𝗗𝗶𝗰𝗮 › Marque uma imagem com /fm bg\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        const imageMessage = targetMessage.message.imageMessage;
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length > 0) {
            const success = await profileManager.setCustomBackground(commandSenderJid, buffer);
            if (success) {
                await npManager.setUserTheme(commandSenderJid, 'custom');
                return sock.sendMessage(sender, { text: "┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Fundo Customizado\n┃ ➢ 𝗧𝗲𝗺𝗮 › Custom\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
            } else {
                return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao salvar fundo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
            }
        }
    } catch (e) {
        console.error("Error downloading media:", e);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao baixar imagem\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleDownload(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        const recentRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
        const track = recentRes.data.recenttracks.track[0];

        if (!track) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const fullName = `${track.name} - ${track.artist['#text']}`;
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗠𝗨𝗦𝗜𝗖 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Baixando...\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${fullName}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });

        const tempDir = path.join(__dirname, '..', '..', 'temp');
        await fs.mkdir(tempDir, { recursive: true });
        const outputTemplate = path.join(tempDir, `npdl_${Date.now()}_%(id)s.%(ext)s`);
        const cookiesPath = path.join(__dirname, '..', 'cookies.txt');

        const ytdlpArgs = [
            '-m', 'yt_dlp',
            `ytsearch1:${fullName}`,
            '-f', 'bestaudio[ext=m4a]/bestaudio/best',
            '--output', outputTemplate,
            '--no-playlist',
            '-v',
            '--js-runtimes', 'node',
            '--force-ipv4',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];

        try {
            await fs.access(cookiesPath);
            ytdlpArgs.push('--cookies', cookiesPath);
        } catch (e) { }

        let stdout;
        try {
            const res = await execFileAsync('python3.12', ytdlpArgs, { maxBuffer: 1024 * 1024 * 10 });
            stdout = res.stdout;
        } catch (err) {
            console.error('[FM YTDLP Error]:', err);
        }
        if (!stdout) {
            throw new Error('Falha ao baixar áudio.');
        }
        const timestamp = path.basename(outputTemplate).split('_')[1];
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.includes(`npdl_${timestamp}`));

        if (found) {
            const downloadedFile = path.join(tempDir, found);
            await sock.sendMessage(sender, {
                audio: { url: downloadedFile },
                mimetype: 'audio/mpeg',
                fileName: path.basename(downloadedFile)
            }, { quoted: msg });

            setTimeout(() => {
                fs.unlink(downloadedFile).catch(() => { });
            }, 10000);
        } else {
            throw new Error("Arquivo não encontrado após execução.");
        }

    } catch (e) {
        console.error("[NP Download Error]", e);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha no download\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleVideo(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    const targetUser = npManager.getUserLastFm(commandSenderJid);

    if (!targetUser) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    if (!config.LASTFM_API_KEY) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › LASTFM_API_KEY ausente\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    let cleanupPaths = [];

    try {
        await sock.sendMessage(sender, { react: { text: '🎬', key: msg.key } });

        const [recentData, userDataResponse] = await Promise.all([
            lastFmRequest({ method: 'user.getrecenttracks', user: targetUser, limit: 1 }),
            lastFmRequest({ method: 'user.getinfo', user: targetUser })
        ]);

        if (recentData?.error) throw Object.assign(new Error(recentData.message || 'Last.fm error'), { response: { data: recentData } });
        if (userDataResponse?.error) throw Object.assign(new Error(userDataResponse.message || 'Last.fm error'), { response: { data: userDataResponse } });

        const trackData = recentData?.recenttracks?.track?.[0];
        const userData = userDataResponse?.user;

        if (!trackData) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const track = {
            name: trackData.name,
            artist: trackData.artist['#text'],
            album: trackData.album['#text'],
            image: trackData.image.find(i => i.size === 'extralarge')['#text'] || 'https://i.imgur.com/To2300W.png',
            nowPlaying: trackData['@attr'] && trackData['@attr'].nowplaying === 'true'
        };

        const spotifyData = await getSpotifyData(track.name, track.artist, commandSenderJid);
        if (spotifyData?.image) track.image = spotifyData.image;

        let trackInfo = null;
        try {
            const trackInfoData = await lastFmRequest({
                method: 'track.getInfo',
                artist: track.artist,
                track: track.name,
                username: targetUser
            });
            trackInfo = trackInfoData?.track || null;
        } catch (e) { }

        let userProfilePic = userData.image.find(i => i.size === 'large')['#text'];
        try {
            const targetJid = npManager.getJidByLastFm(targetUser);
            if (targetJid) {
                const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                if (ppUrl) userProfilePic = ppUrl;
            } else if (targetUser === npManager.getUserLastFm(commandSenderJid)) {
                const ppUrl = await sock.profilePictureUrl(commandSenderJid, 'image').catch(() => null);
                if (ppUrl) userProfilePic = ppUrl;
            }
        } catch (e) { }
        if (!userProfilePic) userProfilePic = 'https://i.imgur.com/6X2v6lX.png';

        const settings = npManager.getUserSettings(commandSenderJid);
        let userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        if (userThemeKey === 'custom') {
            const customData = profileManager.getCustomTheme(commandSenderJid);
            if (customData?.backgroundPath) {
                try {
                    const bgData = await fs.readFile(customData.backgroundPath);
                    userTheme = { ...themes[NP_BASE_THEME], name: 'Custom', ...customData.colors, customBackground: `data:image/jpeg;base64,${bgData.toString('base64')}` };
                } catch (e) { }
            }
        }
        if (userThemeKey === 'custom-np' && settings.customNpTheme) {
            userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };
        }

        let totalDuration = "3:45";
        let currentDuration = Math.random() < 0.05 ? "0:67" : "1:07";
        let progressPercent = 30;

        if (spotifyData?.duration) {
            const durationMs = spotifyData.duration;
            const durationSec = Math.floor(durationMs / 1000);
            const min = Math.floor(durationSec / 60);
            const sec = durationSec % 60;
            totalDuration = `${min}:${sec.toString().padStart(2, '0')}`;

            if (durationSec < 260) {
                progressPercent = Math.min((67 / durationSec) * 100, 100);
            } else if (durationSec <= 419) {
                currentDuration = "4:20";
                progressPercent = Math.min((260 / durationSec) * 100, 100);
            } else {
                currentDuration = "6:66";
                progressPercent = Math.min((426 / durationSec) * 100, 100);
            }
        }

        const videoResult = await generateNPVideo(
            track,
            { image: userProfilePic, scrobbles: userData.playcount },
            targetUser,
            userTheme,
            currentDuration,
            totalDuration,
            progressPercent,
            spotifyData
        );

        cleanupPaths = [videoResult.videoPath, ...videoResult.cleanupPaths];

        let artistDisplay = track.artist;
        if (isGroup) {
            const crown = crownManager.getCrown(sender, track.artist);
            if (crown && crown.holderJid === commandSenderJid) {
                artistDisplay = `${track.artist} 👑`;
            }
        }

        const status = track.nowPlaying ? '𝗡𝗣 𝗩𝗜𝗗𝗘𝗢' : '𝗟𝗔𝗦𝗧 𝗣𝗟𝗔𝗬𝗘𝗗 𝗩𝗜𝗗𝗘𝗢';
        let caption = `┏━━❪ ${status} ❫━━\n┃\n`;
        caption += `┃ ✦ 𝗧𝗿𝗮𝗰𝗸 › ${track.name}\n`;
        caption += `┃ ✦ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${artistDisplay}\n`;
        caption += `┃ ✦ 𝗔𝗹𝗯𝘂𝗺 › ${track.album}\n`;
        caption += `┃ ✦ 𝗗𝘂𝗿𝗮çã𝗼 › até 30s\n┃\n`;

        if (trackInfo?.userplaycount) {
            caption += `┣━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n`;
            caption += `┃ ➢ 𝗬𝗼𝘂𝗿 𝗣𝗹𝗮𝘆𝘀 › ${trackInfo.userplaycount}\n`;
            if (spotifyData?.link) caption += `┃ ➢ 𝗦𝗽𝗼𝘁𝗶𝗳𝘆 › ${spotifyData.link}\n`;
            caption += `┃\n`;
        } else if (spotifyData?.link) {
            caption += `┣━━❪ 𝗟𝗜𝗡𝗞 ❫━━\n┃\n┃ ➢ ${spotifyData.link}\n┃\n`;
        }

        caption += `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            video: { url: videoResult.videoPath },
            mimetype: 'video/mp4',
            caption,
            gifPlayback: false
        }, { quoted: msg });

        setTimeout(() => {
            cleanupPaths.forEach(filePath => fs.unlink(filePath).catch(() => { }));
        }, 15000);
    } catch (e) {
        cleanupPaths.forEach(filePath => fs.unlink(filePath).catch(() => { }));
        console.error('[NP Video] Erro:', e.response?.status || e.code || e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar vídeo NP\n┃ ➢ 𝗗𝗶𝗰𝗮 › Tente novamente em instantes\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleMatch(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = mentionedJids[0];
    if (!targetJid) {
        await sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Mencione um usuário\n┃ ➢ 𝗘𝘅 › /fm match @user\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        return;
    }

    const user1 = npManager.getUserLastFm(commandSenderJid);
    const user2 = npManager.getUserLastFm(targetJid);

    if (!user1 || !user2) {
        await sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm necessário\n┃ ➢ 𝗗𝗶𝗰𝗮 › Configure com /fm set\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        return;
    }

    try {
        const [res1, res2] = await Promise.all([
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${user1}&period=12month&limit=20&api_key=${config.LASTFM_API_KEY}&format=json`),
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${user2}&period=12month&limit=20&api_key=${config.LASTFM_API_KEY}&format=json`)
        ]);

        const artists1 = res1.data.topartists.artist.map(a => a.name);
        const artists2 = res2.data.topartists.artist.map(a => a.name);

        const common = artists1.filter(a => artists2.includes(a));
        const score = Math.round((common.length / 20) * 100);

        let msgMatch = `┏━━❪ 𝗠𝗨𝗦𝗜𝗖𝗔𝗟 𝗠𝗔𝗧𝗖𝗛 ❫━━\n┃\n`;
        msgMatch += `┃ ➢ 𝗨𝘀𝗲𝗿 𝟭 › ${user1}\n┃ ➢ 𝗨𝘀𝗲𝗿 𝟮 › ${user2}\n`;
        msgMatch += `┃ ➢ 𝗠𝗮𝘁𝗰𝗵 › ${score}%\n┃\n`;

        if (common.length > 0) {
            msgMatch += `┣━━❪ 𝗖𝗢𝗠𝗠𝗢𝗡 ❫━━\n┃\n┃ ➢ ${common.slice(0, 5).join('\n┃ ➢ ')}`;
            if (common.length > 5) msgMatch += `\n┃ ... e mais ${common.length - 5}`;
        } else {
            msgMatch += "┣━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n┃ ➢ Sem artistas em comum no Top 20";
        }
        msgMatch += `\n┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text: msgMatch }, { quoted: msg });

    } catch (e) {
        console.error("[Match Error]", e.message);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao calcular match\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }
}

async function handleTopTracks(sock, msg, msgDetails, period) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <nick>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    const periodApi = resolvePeriod(period, '7day');
    const periodLabel = PERIOD_LABEL_MAP[periodApi] || 'SEMANAL';

    try {
        await sock.sendMessage(sender, { react: { text: '🏆', key: msg.key } });

        const { data } = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&period=${periodApi}&limit=8&api_key=${config.LASTFM_API_KEY}&format=json`);
        const tracks = data.toptracks.track;

        if (!tracks || tracks.length === 0) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const enrichedTracks = await Promise.all(tracks.map(async (t) => {
            const spData = await getSpotifyData(t.name, t.artist.name, commandSenderJid);
            return {
                ...t,
                spotifyImage: spData?.image,
                spotifyAlbum: spData?.album
            };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        if (userThemeKey === 'custom-np' && settings.customNpTheme) {
            userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };
        }

        const cardPath = await generateTopTracksCard(enrichedTracks, periodLabel, username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗧𝗢𝗣 𝗧𝗥𝗔𝗖𝗞𝗦 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);

    } catch (e) {
        console.error("[TopTracks Error]", e.message);
        await sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar top músicas\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleTopArtists(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎤', key: msg.key } });
        const period = resolvePeriod(args[1], '7day');
        const periodLabel = PERIOD_LABEL_MAP[period] || 'SEMANA';
        const data = await lastFmRequest({ method: 'user.gettopartists', user: username, period, limit: 8 });
        const artists = data?.topartists?.artist || [];

        if (!artists.length) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhum artista encontrado\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        // Enrich with Spotify images
        const enriched = await Promise.all(artists.map(async (a) => {
            const img = await getSpotifyArtistImage(a.name);
            return { ...a, image: img || 'https://i.imgur.com/To2300W.png' };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateTopArtistsCard(enriched, periodLabel, username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗧𝗢𝗣 𝗔𝗥𝗧𝗜𝗦𝗧𝗦 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM TopArtists Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar top artistas\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleTopAlbums(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '💿', key: msg.key } });
        const period = resolvePeriod(args[1], '7day');
        const periodLabel = PERIOD_LABEL_MAP[period] || 'SEMANA';
        const data = await lastFmRequest({ method: 'user.gettopalbums', user: username, period, limit: 8 });
        const albums = data?.topalbums?.album || [];

        if (!albums.length) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhum álbum encontrado\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        // Enrich with Spotify images
        const enriched = await Promise.all(albums.map(async (a) => {
            const spData = await getSpotifyData(a.name, a.artist?.name, commandSenderJid);
            const lfmImg = a.image?.find(i => i.size === 'extralarge')?.['#text'];
            return {
                name: a.name,
                artist: a.artist?.name || 'Desconhecido',
                playcount: a.playcount,
                image: spData?.image || lfmImg || 'https://i.imgur.com/To2300W.png'
            };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateTopAlbumsCard(enriched, periodLabel, username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗧𝗢𝗣 𝗔𝗟𝗕𝗨𝗠𝗦 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM TopAlbums Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar top álbuns\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleRecent(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    const requested = Number(args[1]);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(10, requested)) : 5;

    try {
        const data = await lastFmRequest({ method: 'user.getrecenttracks', user: username, limit });
        const recentTracks = data?.recenttracks?.track || [];

        if (!recentTracks.length) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhum scrobble recente\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        let text = `┏━━❪ 𝗥𝗘𝗖𝗘𝗡𝗧 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n`;
        text += `┃ ➢ 𝗤𝘁𝗱 › ${recentTracks.length}\n┃\n`;

        recentTracks.forEach((track, i) => {
            const artist = track.artist?.['#text'] || 'Desconhecido';
            const isNowPlaying = track['@attr']?.nowplaying === 'true';
            const timeInfo = isNowPlaying ? 'tocando agora' : relativeTimeFromUnix(track?.date?.uts);
            text += `┃ ${String(i + 1).padStart(2, '0')} › ${track.name} — ${artist} (${timeInfo})\n`;
        });

        text += `┃\n┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Recent Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar recentes\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleOverview(sock, msg, msgDetails, args, useRecapMode = false) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    const period = useRecapMode ? '12month' : resolvePeriod(args[1], '7day');

    try {
        const [userInfo, topArtistData, topAlbumData, topTrackData, recentData] = await Promise.all([
            lastFmRequest({ method: 'user.getinfo', user: username }),
            lastFmRequest({ method: 'user.gettopartists', user: username, period, limit: 1 }),
            lastFmRequest({ method: 'user.gettopalbums', user: username, period, limit: 1 }),
            lastFmRequest({ method: 'user.gettoptracks', user: username, period, limit: 1 }),
            lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1 })
        ]);

        const user = userInfo?.user;
        const topArtist = topArtistData?.topartists?.artist?.[0];
        const topAlbum = topAlbumData?.topalbums?.album?.[0];
        const topTrack = topTrackData?.toptracks?.track?.[0];
        const recentTrack = recentData?.recenttracks?.track?.[0];

        let text = `┏━━❪ ${useRecapMode ? '𝗥𝗘𝗖𝗔𝗣' : '𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪'} ❫━━\n┃\n`;
        text += `┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n`;
        text += `┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${PERIOD_LABEL_MAP[period]}\n`;
        if (user?.playcount) text += `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 𝗦𝗰𝗿𝗼𝗯𝗯𝗹𝗲𝘀 › ${Number(user.playcount).toLocaleString('pt-BR')}\n`;
        text += `┃\n`;

        text += `┣━━❪ 𝗧𝗢𝗣 ❫━━\n┃\n`;
        if (topArtist) text += `┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁𝗮 › ${topArtist.name} (${Number(topArtist.playcount || 0).toLocaleString('pt-BR')})\n`;
        if (topAlbum) text += `┃ ➢ 𝗔́𝗹𝗯𝘂𝗺 › ${topAlbum.name} — ${topAlbum.artist?.name || '?'} (${Number(topAlbum.playcount || 0).toLocaleString('pt-BR')})\n`;
        if (topTrack) text += `┃ ➢ 𝗠𝘂́𝘀𝗶𝗰𝗮 › ${topTrack.name} — ${topTrack.artist?.name || '?'} (${Number(topTrack.playcount || 0).toLocaleString('pt-BR')})\n`;

        if (recentTrack) {
            const isNowPlaying = recentTrack['@attr']?.nowplaying === 'true';
            const when = isNowPlaying ? 'tocando agora' : relativeTimeFromUnix(recentTrack?.date?.uts);
            text += `┃\n┣━━❪ 𝗥𝗘𝗖𝗘𝗡𝗧𝗘 ❫━━\n┃\n`;
            text += `┃ ➢ ${recentTrack.name} — ${recentTrack.artist?.['#text'] || '?'} (${when})\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Overview Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao montar overview\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleCover(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🖼️', key: msg.key } });

        const recentRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
        const trackData = recentRes.data.recenttracks.track[0];

        if (!trackData) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const trackName = trackData.name;
        const trackArtist = trackData.artist['#text'];
        const albumName = trackData.album['#text'];
        const nowPlaying = trackData['@attr']?.nowplaying === 'true';

        // Tenta Spotify primeiro (melhor qualidade), fallback para Last.fm
        let coverUrl = null;
        const spotifyData = await getSpotifyData(trackName, trackArtist, commandSenderJid);
        if (spotifyData?.image) {
            coverUrl = spotifyData.image;
        } else {
            coverUrl = trackData.image.find(i => i.size === 'extralarge')?.['#text'];
        }

        if (!coverUrl || coverUrl.trim() === '') {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Capa não encontrada\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const status = nowPlaying ? '𝗡𝗢𝗪 𝗣𝗟𝗔𝗬𝗜𝗡𝗚' : '𝗟𝗔𝗦𝗧 𝗣𝗟𝗔𝗬𝗘𝗗';
        let caption = `┏━━❪ ${status} ❫━━\n┃\n`;
        caption += `┃ ✦ 𝗧𝗿𝗮𝗰𝗸 › ${trackName}\n`;
        caption += `┃ ✦ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${trackArtist}\n`;
        if (albumName) caption += `┃ ✦ 𝗔𝗹𝗯𝘂𝗺 › ${albumName}\n`;
        caption += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { image: { url: coverUrl }, caption }, { quoted: msg });
    } catch (e) {
        console.error('[NP Cover Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar capa\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

function parseChartArgs(args) {
    let width = 3, height = 3, period = '7day', showTitles = true;
    for (const arg of args) {
        const lc = arg.toLowerCase();
        const sizeMatch = lc.match(/^(\d+)x(\d+)$/);
        if (sizeMatch) {
            width = Math.min(10, Math.max(1, parseInt(sizeMatch[1])));
            height = Math.min(10, Math.max(1, parseInt(sizeMatch[2])));
        } else if (lc === 'notitles' || lc === 'nt') {
            showTitles = false;
        } else if (PERIOD_MAP[lc]) {
            period = PERIOD_MAP[lc];
        }
    }
    if (width * height > 100) { width = 10; height = 10; }
    return { width, height, period, showTitles };
}

async function handleChart(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    const { width, height, period, showTitles } = parseChartArgs(args);
    const periodLabel = PERIOD_LABEL_MAP[period] || 'SEMANA';
    const needed = width * height;

    try {
        await sock.sendMessage(sender, { react: { text: '📊', key: msg.key } });

        const data = await lastFmRequest({ method: 'user.gettopalbums', user: username, period, limit: needed });
        const albums = data?.topalbums?.album || [];

        if (albums.length < needed) {
            return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Álbuns insuficientes (${albums.length}/${needed})\n┃ ➢ 𝗗𝗶𝗰𝗮 › Diminua o tamanho ou aumente o período\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        // Enrich images with Spotify (parallel, max 25 for speed)
        const enriched = await Promise.all(albums.slice(0, needed).map(async (a) => {
            const spData = await getSpotifyData(a.name, a.artist?.name, commandSenderJid);
            const lfmImg = a.image?.find(i => i.size === 'extralarge')?.['#text'];
            return {
                name: a.name,
                artist: a.artist?.name || '',
                playcount: a.playcount,
                image: spData?.image || lfmImg || null
            };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateChartCard(enriched, width, height, periodLabel, username, showTitles, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗖𝗛𝗔𝗥𝗧 ❫━━\n┃\n┃ ➢ 𝗦𝗶𝘇𝗲 › ${width}x${height}\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Chart Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar chart\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleArtistChart(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    const { width, height, period, showTitles } = parseChartArgs(args);
    const periodLabel = PERIOD_LABEL_MAP[period] || 'SEMANA';
    const needed = width * height;

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        const data = await lastFmRequest({ method: 'user.gettopartists', user: username, period, limit: needed });
        const artists = data?.topartists?.artist || [];

        if (artists.length < needed) {
            return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Artistas insuficientes (${artists.length}/${needed})\n┃ ➢ 𝗗𝗶𝗰𝗮 › Diminua o tamanho ou aumente o período\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        // Enrich with Spotify artist images
        const enriched = await Promise.all(artists.slice(0, needed).map(async (a) => {
            const img = await getSpotifyArtistImage(a.name);
            return { name: a.name, playcount: a.playcount, image: img || null };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateArtistChartCard(enriched, width, height, periodLabel, username, showTitles, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗔𝗥𝗧𝗜𝗦𝗧 𝗖𝗛𝗔𝗥𝗧 ❫━━\n┃\n┃ ➢ 𝗦𝗶𝘇𝗲 › ${width}x${height}\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM ArtistChart Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar artist chart\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleReceipt(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🧾', key: msg.key } });
        const period = resolvePeriod(args[1], '7day');
        const periodLabel = PERIOD_LABEL_MAP[period] || 'SEMANA';

        const [tracksData, userInfo] = await Promise.all([
            lastFmRequest({ method: 'user.gettoptracks', user: username, period, limit: 10 }),
            lastFmRequest({ method: 'user.getinfo', user: username })
        ]);

        const tracks = tracksData?.toptracks?.track || [];
        if (!tracks.length) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma faixa encontrada\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const enriched = tracks.map(t => ({
            name: t.name,
            artist: t.artist?.name || '',
            playcount: t.playcount
        }));

        const totalScrobbles = userInfo?.user?.playcount || 0;

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateReceiptCard(enriched, periodLabel, username, userTheme, totalScrobbles);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗥𝗘𝗖𝗘𝗜𝗣𝗧 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗶𝗼𝗱𝗼 › ${periodLabel}\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Receipt Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar receipt\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleStreak(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

        const data = await lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 50 });
        const tracks = data?.recenttracks?.track || [];

        if (tracks.length < 2) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Scrobbles insuficientes\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        // Calculate streaks
        const firstTrack = tracks[0];
        const firstName = firstTrack.name;
        const firstArtist = firstTrack.artist?.['#text'] || '';
        const firstAlbum = firstTrack.album?.['#text'] || '';

        let trackStreak = 0, artistStreak = 0, albumStreak = 0;

        for (const t of tracks) {
            if (t.name === firstName && (t.artist?.['#text'] || '') === firstArtist) trackStreak++;
            else break;
        }

        for (const t of tracks) {
            if ((t.artist?.['#text'] || '') === firstArtist) artistStreak++;
            else break;
        }

        for (const t of tracks) {
            if ((t.album?.['#text'] || '') === firstAlbum && (t.artist?.['#text'] || '') === firstArtist) albumStreak++;
            else break;
        }

        const spData = await getSpotifyData(firstName, firstArtist, commandSenderJid);
        const streakImage = spData?.image || firstTrack.image?.find(i => i.size === 'extralarge')?.['#text'] || 'https://i.imgur.com/To2300W.png';

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateStreakCard({
            trackName: firstName,
            artistName: firstArtist,
            albumName: firstAlbum,
            trackStreak,
            artistStreak,
            albumStreak,
            image: streakImage
        }, userTheme, username);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗦𝗧𝗥𝗘𝗔𝗞 ❫━━\n┃\n┃ ➢ 𝗙𝗮𝗶𝘅𝗮 › ${firstName} (${trackStreak}x)\n┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁𝗮 › ${firstArtist} (${artistStreak}x)\n┃ ➢ 𝗔́𝗹𝗯𝘂𝗺 › ${firstAlbum || '?'} (${albumStreak}x)\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Streak Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao calcular streak\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handlePlays(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        const [userInfo, weekData, monthData, yearData] = await Promise.all([
            lastFmRequest({ method: 'user.getinfo', user: username }),
            lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1, from: Math.floor((Date.now() - 7 * 86400000) / 1000) }),
            lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1, from: Math.floor((Date.now() - 30 * 86400000) / 1000) }),
            lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1, from: Math.floor((Date.now() - 365 * 86400000) / 1000) })
        ]);

        const total = Number(userInfo?.user?.playcount || 0);
        const weekTotal = Number(weekData?.recenttracks?.['@attr']?.total || 0);
        const monthTotal = Number(monthData?.recenttracks?.['@attr']?.total || 0);
        const yearTotal = Number(yearData?.recenttracks?.['@attr']?.total || 0);

        const regDate = userInfo?.user?.registered?.unixtime;
        const avgDaily = regDate ? Math.round(total / Math.max(1, (Date.now() - Number(regDate) * 1000) / 86400000)) : 0;

        let text = `┏━━❪ 𝗣𝗟𝗔𝗬𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃\n`;
        text += `┣━━❪ 𝗦𝗖𝗥𝗢𝗕𝗕𝗟𝗘𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 › ${total.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗦𝗲𝗺𝗮𝗻𝗮 › ${weekTotal.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗠𝗲̂𝘀 › ${monthTotal.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗔𝗻𝗼 › ${yearTotal.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗠𝗲́𝗱𝗶𝗮/𝗗𝗶𝗮 › ${avgDaily.toLocaleString('pt-BR')}\n`;
        text += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Plays Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar plays\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handlePace(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        const userInfo = await lastFmRequest({ method: 'user.getinfo', user: username });
        const total = Number(userInfo?.user?.playcount || 0);
        const regUnix = Number(userInfo?.user?.registered?.unixtime || 0);
        const daysSinceReg = Math.max(1, (Date.now() / 1000 - regUnix) / 86400);
        const avgDaily = total / daysSinceReg;

        // Parse target from args
        let target = null;
        for (const a of args.slice(1)) {
            const num = a.replace(/k/i, '000').replace(/m/i, '000000');
            if (!isNaN(num) && Number(num) > 0) { target = Number(num); break; }
        }

        if (!target) {
            // auto-calculate next milestone
            const milestones = [1000, 5000, 10000, 25000, 50000, 100000, 150000, 200000, 250000, 500000, 1000000];
            target = milestones.find(m => m > total) || total + 50000;
        }

        const remaining = Math.max(0, target - total);
        const daysNeeded = Math.ceil(remaining / avgDaily);
        const targetDate = new Date(Date.now() + daysNeeded * 86400000);
        const dateStr = targetDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

        let text = `┏━━❪ 𝗣𝗔𝗖𝗘 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n`;
        text += `┃ ➢ 𝗔𝘁𝘂𝗮𝗹 › ${total.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗠𝗲𝘁𝗮 › ${target.toLocaleString('pt-BR')}\n`;
        text += `┃ ➢ 𝗙𝗮𝗹𝘁𝗮𝗺 › ${remaining.toLocaleString('pt-BR')}\n┃\n`;
        text += `┣━━❪ 𝗘𝗦𝗧𝗜𝗠𝗔𝗧𝗜𝗩𝗔 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗠𝗲́𝗱𝗶𝗮 › ${Math.round(avgDaily).toLocaleString('pt-BR')}/dia\n`;
        text += `┃ ➢ 𝗗𝗮𝘁𝗮 › ~${dateStr}\n`;
        text += `┃ ➢ 𝗗𝗶𝗮𝘀 › ~${daysNeeded.toLocaleString('pt-BR')}\n`;
        text += `┃\n┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Pace Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao calcular pace\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

async function handleProfile(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);

    if (!username) {
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }

    try {
        await sock.sendMessage(sender, { react: { text: '👤', key: msg.key } });

        const [userInfo, topArtistData, topAlbumData, topTrackData] = await Promise.all([
            lastFmRequest({ method: 'user.getinfo', user: username }),
            lastFmRequest({ method: 'user.gettopartists', user: username, period: 'overall', limit: 1 }),
            lastFmRequest({ method: 'user.gettopalbums', user: username, period: 'overall', limit: 1 }),
            lastFmRequest({ method: 'user.gettoptracks', user: username, period: 'overall', limit: 1 })
        ]);

        const user = userInfo?.user;
        const topArtist = topArtistData?.topartists?.artist?.[0];
        const topAlbum = topAlbumData?.topalbums?.album?.[0];
        const topTrack = topTrackData?.toptracks?.track?.[0];

        // Get images
        let profilePic = user?.image?.find(i => i.size === 'large')?.['#text'];
        try {
            const targetJid = npManager.getJidByLastFm(username) || commandSenderJid;
            const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
            if (ppUrl) profilePic = ppUrl;
        } catch (e) {}

        let topArtistImg = null, topAlbumImg = null;
        if (topArtist) {
            topArtistImg = await getSpotifyArtistImage(topArtist.name);
        }
        if (topAlbum) {
            const spData = await getSpotifyData(topAlbum.name, topAlbum.artist?.name, commandSenderJid);
            topAlbumImg = spData?.image || topAlbum.image?.find(i => i.size === 'extralarge')?.['#text'];
        }

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];
        if (userThemeKey === 'custom-np' && settings.customNpTheme) userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };

        const cardPath = await generateProfileCard({
            username,
            scrobbles: user?.playcount || 0,
            registered: user?.registered?.unixtime,
            country: user?.country || '',
            profilePic
        }, {
            topArtist: topArtist?.name,
            topArtistPlays: topArtist?.playcount,
            topArtistImg,
            topAlbum: topAlbum ? `${topAlbum.name} — ${topAlbum.artist?.name || ''}` : null,
            topAlbumPlays: topAlbum?.playcount,
            topAlbumImg,
            topTrack: topTrack ? `${topTrack.name} — ${topTrack.artist?.name || ''}` : null,
            topTrackPlays: topTrack?.playcount,
            artistCount: user?.artist_count || 0,
            albumCount: user?.album_count || 0
        }, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃ ➢ 𝗦𝗰𝗿𝗼𝗯𝗯𝗹𝗲𝘀 › ${Number(user?.playcount || 0).toLocaleString('pt-BR')}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Profile Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar perfil\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🔀 JUMBLE — Guess the scrambled artist
// ═══════════════════════════════════════════════════════════
async function handleJumble(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const existingGame = fmGameManager.getGame(sender);
    if (existingGame && !existingGame.expired && !existingGame.solved) {
        return sock.sendMessage(sender, { text: `┏━━❪ 🎮 𝗝𝗨𝗠𝗕𝗟𝗘 ❫━━\n┃\n┃ ➢ Já tem um jogo ativo!\n┃ ➢ Palpite: *${existingGame.hint}*\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🔀', key: msg.key } });
        const data = await lastFmRequest({ method: 'user.gettopartists', user: username, period: 'overall', limit: 50 });
        const artists = data?.topartists?.artist;
        if (!artists?.length) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Sem artistas suficientes\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const candidates = artists.filter(a => a.name.length >= 3);
        const chosen = candidates[Math.floor(Math.random() * candidates.length)] || artists[0];
        const scrambled = fmGameManager.constructor.scramble(chosen.name);

        fmGameManager.createGame(sender, 'jumble', chosen.name, scrambled, null, {
            startedBy: commandSenderJid,
            artistName: chosen.name,
            playcount: chosen.playcount
        });

        const hint1 = chosen.name[0];
        let text = `┏━━❪ 🔀 𝗝𝗨𝗠𝗕𝗟𝗘 ❫━━\n┃\n`;
        text += `┃ Adivinhe o artista!\n┃\n`;
        text += `┃ 🔤 *${scrambled}*\n┃\n`;
        text += `┃ 💡 Começa com: *${hint1}*\n`;
        text += `┃ 📊 ${Number(chosen.playcount).toLocaleString('pt-BR')} plays\n`;
        text += `┃ ⏱️ 60 segundos\n┃\n`;
        text += `┃ Responda com /fm g [palpite]\n┃\n┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Jumble Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao criar jogo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🖼️ PIXEL — Guess the pixelated album
// ═══════════════════════════════════════════════════════════
async function handlePixel(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const existingGame = fmGameManager.getGame(sender);
    if (existingGame && !existingGame.expired && !existingGame.solved) {
        return sock.sendMessage(sender, { text: `┏━━❪ 🎮 𝗣𝗜𝗫𝗘𝗟 ❫━━\n┃\n┃ ➢ Já tem um jogo ativo!\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });
        const data = await lastFmRequest({ method: 'user.gettopalbums', user: username, period: 'overall', limit: 50 });
        const albums = data?.topalbums?.album?.filter(a => {
            const img = a.image?.find(i => i.size === 'extralarge')?.['#text'];
            return img && img.trim() !== '';
        });
        if (!albums?.length) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Sem álbuns com capa\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const chosen = albums[Math.floor(Math.random() * Math.min(30, albums.length))];
        const imgUrl = chosen.image.find(i => i.size === 'extralarge')?.['#text'];
        const albumName = chosen.name;
        const artistName = chosen.artist?.name || '';

        // Generate heavily pixelated image via HTML canvas
        const html = `<!DOCTYPE html><html><head><style>
            * { margin: 0; padding: 0; }
            body { width: 300px; height: 300px; }
            canvas { width: 300px; height: 300px; image-rendering: pixelated; }
        </style></head><body>
            <canvas id="c" width="300" height="300"></canvas>
            <img src="${imgUrl}" id="src" crossorigin="anonymous" style="display:none" onload="
                var c = document.getElementById('c');
                var ctx = c.getContext('2d');
                var img = this;
                var s = 15;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, s, s);
                ctx.drawImage(c, 0, 0, s, s, 0, 0, 300, 300);
            "/>
        </body></html>`;

        let tempPath = null;
        try {
            tempPath = path.join(__dirname, '..', '..', 'temp', `pixel_${Date.now()}.png`);
            const { generateImage } = require('../helpers/imageGenerator');
            await generateImage(html, tempPath, {}, { width: 300, height: 300 });

            fmGameManager.createGame(sender, 'pixel', albumName, artistName, imgUrl, {
                startedBy: commandSenderJid,
                albumName,
                artistName,
                originalImage: imgUrl
            });

            let caption = `┏━━❪ 🖼️ 𝗣𝗜𝗫𝗘𝗟 ❫━━\n┃\n`;
            caption += `┃ Adivinhe o álbum!\n┃\n`;
            caption += `┃ 👤 Artista: *${artistName}*\n`;
            caption += `┃ ⏱️ 60 segundos\n┃\n`;
            caption += `┃ Responda com /fm g [palpite]\n┃\n┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, {
                image: { url: tempPath },
                caption
            }, { quoted: msg });
        } finally {
            if (tempPath) {
                await fs.unlink(tempPath).catch(() => {});
            }
        }
    } catch (e) {
        console.error('[FM Pixel Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao criar jogo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🎯 GUESS — Handle game guesses
// ═══════════════════════════════════════════════════════════
async function handleGuess(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const guess = args.slice(1).join(' ').trim();
    if (!guess) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › /fm g <palpite>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const game = fmGameManager.getGame(sender);
    if (!game) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Nenhum jogo ativo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    if (game.expired) {
        const answer = game.type === 'pixel' ? game.albumName : game.artistName;
        fmGameManager.deleteGame(sender);
        return sock.sendMessage(sender, { text: `┏━━❪ ⏰ 𝗧𝗘𝗠𝗣𝗢 ❫━━\n┃\n┃ Tempo esgotado!\n┃ ➢ Resposta: *${answer}*\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    const result = fmGameManager.checkAnswer(sender, guess);
    if (!result) return;

    if (result.correct) {
        fmGameManager.deleteGame(sender);
        const emoji = game.type === 'jumble' ? '🔀' : '🖼️';
        const typeName = game.type === 'jumble' ? 'JUMBLE' : 'PIXEL';
        await sock.sendMessage(sender, { react: { text: '🎉', key: msg.key } });

        let text = `┏━━❪ ${emoji} ${typeName} ❫━━\n┃\n`;
        text += `┃ 🎉 ${getDisplayName(commandSenderJid)} acertou!\n┃\n`;
        text += `┃ ➢ Resposta: *${game.type === 'pixel' ? game.albumName : game.artistName}*\n`;
        text += `┃ ➢ Tentativas: ${result.attempts}\n┃\n┗━━━━━━━━━━━━━━`;

        if (game.type === 'pixel' && game.originalImage) {
            return sock.sendMessage(sender, {
                image: { url: game.originalImage },
                caption: text,
                mentions: [commandSenderJid]
            }, { quoted: msg });
        }

        return sock.sendMessage(sender, { text, mentions: [commandSenderJid] }, { quoted: msg });
    }

    if (result.maxAttemptsReached) {
        fmGameManager.deleteGame(sender);
        return sock.sendMessage(sender, { text: `┏━━❪ ❌ 𝗙𝗜𝗠 ❫━━\n┃\n┃ Máximo de tentativas!\n┃ ➢ Resposta: *${game.type === 'pixel' ? game.albumName : game.artistName}*\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    if (result.close) {
        return sock.sendMessage(sender, { text: `🔥 Quase! Tente de novo...` }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🎵 TASTE — Compare musical taste
// ═══════════════════════════════════════════════════════════
async function handleTaste(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username1 = npManager.getUserLastFm(commandSenderJid);
    if (!username1) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let username2 = null;

    if (mentionedJids.length > 0) {
        username2 = npManager.getUserLastFm(mentionedJids[0]);
        if (!username2) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Esse user não tem Last.fm\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    } else if (args[1]) {
        username2 = args[1];
    }

    if (!username2) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ /fm taste @user ou /fm taste <lastfm>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🎵', key: msg.key } });

        const [data1, data2] = await Promise.all([
            lastFmRequest({ method: 'user.gettopartists', user: username1, period: 'overall', limit: 100 }),
            lastFmRequest({ method: 'user.gettopartists', user: username2, period: 'overall', limit: 100 })
        ]);

        const artists1 = data1?.topartists?.artist || [];
        const artists2 = data2?.topartists?.artist || [];
        if (!artists1.length || !artists2.length) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Dados insuficientes\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        const map2 = new Map(artists2.map(a => [a.name.toLowerCase(), a]));
        const common = [];
        for (const a of artists1) {
            const match = map2.get(a.name.toLowerCase());
            if (match) {
                common.push({
                    name: a.name,
                    plays1: Number(a.playcount),
                    plays2: Number(match.playcount),
                    image: null
                });
            }
        }

        const score = Math.min(100, Math.round((common.length / Math.min(artists1.length, artists2.length)) * 100));

        const topCommon = common.sort((a, b) => (b.plays1 + b.plays2) - (a.plays1 + a.plays2)).slice(0, 8);
        await Promise.all(topCommon.slice(0, 4).map(async (a) => {
            try { a.image = await getSpotifyArtistImage(a.name); } catch (e) {}
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        const displayName1 = getDisplayName(commandSenderJid);
        const displayName2 = mentionedJids.length > 0 ? getDisplayName(mentionedJids[0]) : username2;

        const cardPath = await generateTasteCard(
            { name: displayName1 }, { name: displayName2 },
            topCommon, score, userTheme
        );

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 🎵 𝗧𝗔𝗦𝗧𝗘 ❫━━\n┃\n┃ ${displayName1} vs ${displayName2}\n┃ ➢ Compatibilidade: *${score}%*\n┃ ➢ Em comum: *${common.length}* artistas\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Taste Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao comparar gostos\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🤝 AFFINITY — Musical affinity with group
// ═══════════════════════════════════════════════════════════
async function handleAffinity(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🤝', key: msg.key } });

        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
        if (!groupMeta?.participants) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha nos dados do grupo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const allUsers = npManager.getAllUsers();
        const membersFm = groupMeta.participants
            .filter(p => p.id !== commandSenderJid && allUsers[p.id])
            .map(p => ({ jid: p.id, lastfm: allUsers[p.id] }))
            .slice(0, 10);

        if (!membersFm.length) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Nenhum membro com Last.fm\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const myData = await lastFmRequest({ method: 'user.gettopartists', user: username, period: 'overall', limit: 100 });
        const myArtists = new Set((myData?.topartists?.artist || []).map(a => a.name.toLowerCase()));

        const results = [];
        await Promise.all(membersFm.map(async (member) => {
            try {
                const theirData = await lastFmRequest({ method: 'user.gettopartists', user: member.lastfm, period: 'overall', limit: 50 });
                const theirArtists = (theirData?.topartists?.artist || []).map(a => a.name.toLowerCase());
                const common = theirArtists.filter(a => myArtists.has(a));
                const score = Math.min(100, Math.round((common.length / Math.min(myArtists.size, theirArtists.length)) * 100));
                results.push({ jid: member.jid, lastfm: member.lastfm, score, commonCount: common.length });
            } catch (e) {}
        }));

        results.sort((a, b) => b.score - a.score);

        const barEmojis = (pct) => {
            const filled = Math.round(pct / 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled);
        };

        let text = `┏━━❪ 🤝 𝗔𝗙𝗙𝗜𝗡𝗜𝗧𝗬 ❫━━\n┃\n┃ Afinidade de ${username}\n┃\n`;
        for (const r of results.slice(0, 8)) {
            const emoji = r.score >= 70 ? '💚' : r.score >= 40 ? '💛' : '🤍';
            text += `┃ ${emoji} ${getDisplayName(r.jid)}\n`;
            text += `┃   ${barEmojis(r.score)} ${r.score}%\n┃\n`;
        }
        text += `┗━━━━━━━━━━━━━━`;

        return sock.sendMessage(sender, { text, mentions: results.slice(0, 8).map(r => r.jid) }, { quoted: msg });
    } catch (e) {
        console.error('[FM Affinity Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha calcular afinidade\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🏆 WHO KNOWS — Who in the group knows an artist
// ═══════════════════════════════════════════════════════════
async function handleWhoKnows(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    let artistQuery = args.slice(1).join(' ').trim();

    if (!artistQuery) {
        try {
            const recentData = await lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1 });
            const track = recentData?.recenttracks?.track?.[0];
            if (track) artistQuery = track.artist?.['#text'] || track.artist?.name;
        } catch (e) {}
    }

    if (!artistQuery) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ /fm wk <artista>\n┃ ➢ Ou toque algo no Last.fm\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
        if (!groupMeta?.participants) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha dados do grupo\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const allUsers = npManager.getAllUsers();
        const membersFm = groupMeta.participants
            .filter(p => allUsers[p.id])
            .map(p => ({ jid: p.id, lastfm: allUsers[p.id], displayName: getDisplayName(p.id) }));

        if (!membersFm.length) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Nenhum membro com Last.fm\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const listeners = [];
        const artistInfoPromise = lastFmRequest({ method: 'artist.getinfo', artist: artistQuery, autocorrect: 1 });

        await Promise.all(membersFm.map(async (member) => {
            try {
                const res = await lastFmRequest({ method: 'artist.getinfo', artist: artistQuery, username: member.lastfm, autocorrect: 1 });
                const plays = parseInt(res?.artist?.stats?.userplaycount || 0);
                if (plays > 0) {
                    listeners.push({ ...member, username: member.lastfm, playcount: plays });
                }
            } catch (e) {}
        }));

        const artistInfo = await artistInfoPromise;
        const correctedName = artistInfo?.artist?.name || artistQuery;

        listeners.sort((a, b) => b.playcount - a.playcount);

        if (!listeners.length) {
            return sock.sendMessage(sender, { text: `┏━━❪ 🏆 𝗪𝗛𝗢 𝗞𝗡𝗢𝗪𝗦 ❫━━\n┃\n┃ Ninguém no grupo ouve *${correctedName}*\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        // Crown auto-claim for #1 listener
        const top = listeners[0];
        const crownResult = crownManager.setCrown(sender, correctedName, top.jid, top.username, top.playcount);

        let artistImage = null;
        try { artistImage = await getSpotifyArtistImage(correctedName); } catch (e) {}

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        const cardPath = await generateWhoKnowsCard(correctedName, artistImage, listeners, userTheme);

        const totalPlays = listeners.reduce((s, l) => s + l.playcount, 0);

        let crownLine = '';
        if (crownResult.updated) {
            if (crownResult.isNew) crownLine = `┃ 👑 *${top.displayName}* ganhou a crown!\n`;
            else if (crownResult.isStealed) crownLine = `┃ 👑 Crown roubada de *${getDisplayName(crownResult.previousHolder?.holderJid)}*!\n`;
        } else {
            crownLine = `┃ 👑 Crown: *${top.displayName}*\n`;
        }

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 🏆 𝗪𝗛𝗢 𝗞𝗡𝗢𝗪𝗦 ❫━━\n┃\n┃ ➢ *${correctedName}*\n┃ ➢ ${listeners.length} ouvintes\n┃ ➢ ${Number(totalPlays).toLocaleString('pt-BR')} plays total\n┃\n${crownLine}┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM WhoKnows Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar dados\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  👑 CROWN — Show crown holder for an artist
// ═══════════════════════════════════════════════════════════
async function handleCrown(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    let artistQuery = args.slice(1).join(' ').trim();

    if (!artistQuery) {
        try {
            const recentData = await lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1 });
            const track = recentData?.recenttracks?.track?.[0];
            if (track) artistQuery = track.artist?.['#text'] || track.artist?.name;
        } catch (e) {}
    }

    if (!artistQuery) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ /fm crown <artista>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        const artistInfo = await lastFmRequest({ method: 'artist.getinfo', artist: artistQuery, autocorrect: 1 });
        const correctedName = artistInfo?.artist?.name || artistQuery;

        const crown = crownManager.getCrown(sender, correctedName);

        if (!crown) {
            return sock.sendMessage(sender, { text: `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡 ❫━━\n┃\n┃ ➢ *${correctedName}*\n┃\n┃ Nenhuma crown para esse artista.\n┃ Use /fm wk para reclamar!\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        const claimedDate = new Date(crown.claimedAt).toLocaleDateString('pt-BR');
        let text = `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡 ❫━━\n┃\n`;
        text += `┃ ➢ *${correctedName}*\n┃\n`;
        text += `┃ 👑 *${getDisplayName(crown.holderJid)}*\n`;
        text += `┃ ➢ ${Number(crown.plays).toLocaleString('pt-BR')} plays\n`;
        text += `┃ ➢ Desde: ${claimedDate}\n`;
        if (crown.previousHolder) {
            text += `┃\n┃ 🔄 Anterior: ${getDisplayName(crown.previousHolder.holderJid)} (${Number(crown.previousHolder.plays).toLocaleString('pt-BR')})\n`;
        }
        text += `┃\n┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Crown Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar crown\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  👑 CROWNS — List crowns held by a user
// ═══════════════════════════════════════════════════════════
async function handleCrowns(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    // Check for mention
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetJid = mentionedJids[0] || commandSenderJid;
    const displayName = getDisplayName(targetJid);

    const crowns = crownManager.getUserCrowns(sender, targetJid);

    if (!crowns.length) {
        return sock.sendMessage(sender, { text: `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡𝗦 ❫━━\n┃\n┃ *${displayName}* não tem crowns neste grupo.\n┃ Use /fm wk para conquistar!\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    let text = `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡𝗦 ❫━━\n┃\n`;
    text += `┃ 👤 *${displayName}*\n`;
    text += `┃ 🏆 ${crowns.length} crown${crowns.length !== 1 ? 's' : ''}\n┃\n`;

    const show = crowns.slice(0, 15);
    show.forEach((c, i) => {
        text += `┃ ${i + 1}. *${c.artistName}* — ${Number(c.plays).toLocaleString('pt-BR')} plays\n`;
    });

    if (crowns.length > 15) text += `┃ ... e mais ${crowns.length - 15}\n`;
    text += `┃\n┗━━━━━━━━━━━━━━`;
    return sock.sendMessage(sender, { text }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════
//  👑 CROWN LEADERBOARD — Who has the most crowns
// ═══════════════════════════════════════════════════════════
async function handleCrownLeaderboard(sock, msg, msgDetails) {
    const { sender, isGroup } = msgDetails;
    if (!isGroup) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const leaderboard = crownManager.getCrownLeaderboard(sender);
    const totalCrowns = crownManager.getGroupCrownCount(sender);

    if (!leaderboard.length) {
        return sock.sendMessage(sender, { text: `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡𝗦 ❫━━\n┃\n┃ Nenhuma crown conquistada ainda.\n┃ Use /fm wk <artista>!\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    const medals = ['🥇', '🥈', '🥉'];
    let text = `┏━━❪ 👑 𝗖𝗥𝗢𝗪𝗡 𝗟𝗕 ❫━━\n┃\n`;
    text += `┃ 🏆 ${totalCrowns} crowns no grupo\n┃\n`;

    leaderboard.slice(0, 10).forEach((entry, i) => {
        const medal = medals[i] || `${i + 1}.`;
        const name = getDisplayName(entry.holderJid);
        text += `┃ ${medal} *${name}* — ${entry.count} crown${entry.count !== 1 ? 's' : ''}\n`;
    });

    text += `┃\n┗━━━━━━━━━━━━━━`;
    return sock.sendMessage(sender, { text }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════
//  🔍 WHOIS — Who owns a Last.fm account in this group
// ═══════════════════════════════════════════════════════════
async function handleWhois(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid, isGroup } = msgDetails;

    let query = args.join(' ').trim();

    // Se não passou argumento, mostra a conta do próprio usuário
    if (!query) {
        const ownUser = npManager.getUserLastFm(commandSenderJid);
        if (!ownUser) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Você não tem conta vinculada.\n┃ Use /fm set <usuario>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
        query = ownUser;
    }

    const targetJid = npManager.getJidByLastFm(query);

    if (!targetJid) {
        return sock.sendMessage(sender, { text: `┏━━❪ 🔍 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ Nenhum membro tem a conta\n┃ *${query}* vinculada.\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    // Se for em grupo, verifica se o dono está no grupo
    if (isGroup) {
        try {
            const meta = await groupMetadataManager.getGroupMetadata(sock, sender);
            const participants = meta?.participants?.map(p => p.id) || [];
            if (!participants.includes(targetJid)) {
                return sock.sendMessage(sender, { text: `┏━━❪ 🔍 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ A conta *${query}* está vinculada\n┃ a um usuário que não está\n┃ neste grupo.\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
        } catch (e) { /* ignora erro de metadados */ }
    }

    const displayName = getDisplayName(targetJid);
    const phone = targetJid.split('@')[0];
    const linkedUsername = npManager.getUserLastFm(targetJid);

    let text = `┏━━❪ 🔍 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n`;
    text += `┃ 👤 @${phone}\n`;
    text += `┃ 🎵 last.fm: *${linkedUsername}*\n`;

    if (isGroup) {
        const crownsCount = crownManager.getUserCrowns(sender, targetJid).length;
        if (crownsCount > 0) {
            text += `┃ 👑 ${crownsCount} crown${crownsCount !== 1 ? 's' : ''} neste grupo\n`;
        }
    }

    text += `┃\n┗━━━━━━━━━━━━━━`;
    return sock.sendMessage(sender, { text, mentions: [targetJid] }, { quoted: msg });
}

// ═══════════════════════════════════════════════════════════
//  🏅 MILESTONE — Scrobble milestones
// ═══════════════════════════════════════════════════════════
async function handleMilestone(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🏅', key: msg.key } });
        const userInfo = await lastFmRequest({ method: 'user.getinfo', user: username });
        const totalScrobbles = parseInt(userInfo?.user?.playcount || 0);
        const registered = parseInt(userInfo?.user?.registered?.unixtime || 0);

        const milestones = [100, 500, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
        const passed = milestones.filter(m => totalScrobbles >= m);
        const next = milestones.find(m => totalScrobbles < m);

        const daysSinceReg = Math.max(1, Math.floor((Date.now() / 1000 - registered) / 86400));
        const avgPerDay = totalScrobbles / daysSinceReg;

        let text = `┏━━❪ 🏅 𝗠𝗜𝗟𝗘𝗦𝗧𝗢𝗡𝗘𝗦 ❫━━\n┃\n`;
        text += `┃ 👤 ${username}\n`;
        text += `┃ 🎵 ${Number(totalScrobbles).toLocaleString('pt-BR')} scrobbles\n┃\n`;

        for (const m of passed) {
            text += `┃ ✅ ${Number(m).toLocaleString('pt-BR')}\n`;
        }

        if (next) {
            const remaining = next - totalScrobbles;
            const daysToGo = Math.ceil(remaining / avgPerDay);
            const eta = new Date(Date.now() + daysToGo * 86400000);
            text += `┃\n┃ ⏳ Próximo: ${Number(next).toLocaleString('pt-BR')}\n`;
            text += `┃ ➢ Faltam: ${Number(remaining).toLocaleString('pt-BR')}\n`;
            text += `┃ ➢ Estimativa: ~${daysToGo} dias (${eta.toLocaleDateString('pt-BR')})\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;
        return sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        console.error('[FM Milestone Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar milestones\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  📅 YEAR — Year in review
// ═══════════════════════════════════════════════════════════
async function handleYear(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    const targetYear = parseInt(args[1]) || new Date().getFullYear();
    const yearStart = Math.floor(new Date(targetYear, 0, 1).getTime() / 1000);
    const yearEnd = Math.floor(new Date(targetYear + 1, 0, 1).getTime() / 1000);

    try {
        await sock.sendMessage(sender, { react: { text: '📅', key: msg.key } });

        // Get weekly chart list to find relevant weeks
        const chartsData = await lastFmRequest({ method: 'user.getweeklychartlist', user: username });
        const charts = chartsData?.weeklychartlist?.chart || [];
        const yearCharts = charts.filter(c => parseInt(c.from) >= yearStart && parseInt(c.to) <= yearEnd);

        let yearScrobbles = 0;
        let topArtists = [], topAlbums = [], topTracks = [];

        if (yearCharts.length > 0) {
            const from = yearCharts[0].from;
            const to = yearCharts[yearCharts.length - 1].to;

            const [aData, alData, tData] = await Promise.all([
                lastFmRequest({ method: 'user.getweeklyartistchart', user: username, from, to }),
                lastFmRequest({ method: 'user.getweeklyalbumchart', user: username, from, to }),
                lastFmRequest({ method: 'user.getweeklytrackchart', user: username, from, to })
            ]);

            const allArtists = aData?.weeklyartistchart?.artist || [];
            const allAlbums = alData?.weeklyalbumchart?.album || [];
            const allTracks = tData?.weeklytrackchart?.track || [];

            topArtists = allArtists.sort((a, b) => parseInt(b.playcount) - parseInt(a.playcount)).slice(0, 5);
            topAlbums = allAlbums.sort((a, b) => parseInt(b.playcount) - parseInt(a.playcount)).slice(0, 5);
            topTracks = allTracks.sort((a, b) => parseInt(b.playcount) - parseInt(a.playcount)).slice(0, 5);
            yearScrobbles = allTracks.reduce((sum, t) => sum + parseInt(t.playcount || 0), 0);
        }

        if (!yearScrobbles && !topArtists.length) {
            return sock.sendMessage(sender, { text: `┏━━❪ 📅 ${targetYear} ❫━━\n┃\n┃ Sem dados para ${targetYear}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        }

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        const cardPath = await generateYearCard({
            scrobbles: yearScrobbles,
            topArtists, topAlbums, topTracks
        }, username, targetYear, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 📅 ${targetYear} ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃ ➢ 𝗦𝗰𝗿𝗼𝗯𝗯𝗹𝗲𝘀 › ~${Number(yearScrobbles).toLocaleString('pt-BR')}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Year Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar year review\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🧊 ICEBERG — Musical obscurity iceberg
// ═══════════════════════════════════════════════════════════
async function handleIceberg(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🧊', key: msg.key } });
        const data = await lastFmRequest({ method: 'user.gettopartists', user: username, period: 'overall', limit: 80 });
        const artists = data?.topartists?.artist || [];
        if (artists.length < 10) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ Precisa de pelo menos 10 artistas\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        // Get listener counts for obscurity ranking
        const enriched = [];
        const batchSize = 10;
        for (let i = 0; i < Math.min(artists.length, 60); i += batchSize) {
            const batch = artists.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(async (a) => {
                try {
                    const info = await lastFmRequest({ method: 'artist.getinfo', artist: a.name, autocorrect: 1 });
                    return { name: a.name, playcount: a.playcount, listeners: parseInt(info?.artist?.stats?.listeners || 0) };
                } catch (e) {
                    return { name: a.name, playcount: a.playcount, listeners: 999999 };
                }
            }));
            enriched.push(...results);
        }

        enriched.sort((a, b) => b.listeners - a.listeners);

        const layerCount = 6;
        const perLayer = Math.ceil(enriched.length / layerCount);
        const layers = [];
        for (let i = 0; i < layerCount; i++) {
            const slice = enriched.slice(i * perLayer, (i + 1) * perLayer);
            if (slice.length) layers.push({ artists: slice.slice(0, 6) });
        }

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        const cardPath = await generateIcebergCard(layers, username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 🧊 𝗜𝗖𝗘𝗕𝗘𝗥𝗚 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${username}\n┃ ➢ ${enriched.length} artistas analisados\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Iceberg Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar iceberg\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ═══════════════════════════════════════════════════════════
//  🔍 DISCOVERY — Recently discovered artists
// ═══════════════════════════════════════════════════════════
async function handleDiscovery(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const username = npManager.getUserLastFm(commandSenderJid);
    if (!username) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use /fm set <user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🔍', key: msg.key } });

        const [recentData, topData] = await Promise.all([
            lastFmRequest({ method: 'user.gettopartists', user: username, period: '1month', limit: 50 }),
            lastFmRequest({ method: 'user.gettopartists', user: username, period: 'overall', limit: 100 })
        ]);

        const recentArtists = recentData?.topartists?.artist || [];
        const topArtists = new Set((topData?.topartists?.artist || []).slice(0, 30).map(a => a.name.toLowerCase()));

        const discovered = recentArtists.filter(a => !topArtists.has(a.name.toLowerCase())).slice(0, 10);

        if (!discovered.length) return sock.sendMessage(sender, { text: "┏━━❪ 🔍 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗬 ❫━━\n┃\n┃ Nenhuma descoberta recente!\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

        const enriched = await Promise.all(discovered.map(async (a) => {
            let image = null;
            try { image = await getSpotifyArtistImage(a.name); } catch (e) {}
            return { ...a, image };
        }));

        const settings = npManager.getUserSettings(commandSenderJid);
        const userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        const cardPath = await generateDiscoveryCard(enriched, username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `┏━━❪ 🔍 𝗗𝗜𝗦𝗖𝗢𝗩𝗘𝗥𝗬 ❫━━\n┃\n┃ ➢ ${enriched.length} artistas novos este mês\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => {}), 5000);
    } catch (e) {
        console.error('[FM Discovery Error]', e.message);
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar descobertas\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
}

// ========== SCROBBLE HELPERS ==========

function generateApiSig(params) {
    const keys = Object.keys(params).sort();
    let sig = '';
    for (const key of keys) {
        sig += key + params[key];
    }
    sig += config.LASTFM_SHARED_SECRET;
    return crypto.createHash('md5').update(sig, 'utf-8').digest('hex');
}

async function lastFmPost(params) {
    const postParams = {
        ...params,
        api_key: config.LASTFM_API_KEY,
        format: 'json'
    };
    postParams.api_sig = generateApiSig(
        Object.fromEntries(Object.entries(postParams).filter(([k]) => k !== 'format'))
    );

    const response = await axios.post(LASTFM_BASE_URL, new URLSearchParams(postParams).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
        },
        timeout: 15000
    });
    return response.data;
}

async function handleScrobbleAuth(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;

    if (!config.LASTFM_SHARED_SECRET) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › LASTFM_SHARED_SECRET não configurado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Configure no .env\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    // Check if already authenticated
    const existingSession = npManager.getLastfmSession(commandSenderJid);
    if (existingSession?.key) {
        return sock.sendMessage(sender, {
            text: `┏━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Já autenticado\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${existingSession.name}\n┃\n┃ ➢ Use /fm scrobble para scrobbar\n┃ ➢ Use /fm desauth para desconectar\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }

    try {
        // Step 1: Get auth token
        const tokenData = await lastFmRequest({ method: 'auth.getToken' });
        const token = tokenData.token;

        if (!token) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não foi possível obter token\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        // Store pending token
        npManager.setPendingAuthToken(commandSenderJid, token);

        const authUrl = `https://www.last.fm/api/auth/?api_key=${config.LASTFM_API_KEY}&token=${token}`;

        return sock.sendMessage(sender, {
            text: `┏━━❪ 🔐 𝗔𝗨𝗧𝗛 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Autorização necessária\n┃\n┃ 1️⃣ Acesse o link abaixo:\n┃ ${authUrl}\n┃\n┃ 2️⃣ Autorize o aplicativo\n┃\n┃ 3️⃣ Depois digite:\n┃    /fm confirmar\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (e) {
        console.error('[FM Scrobble Auth Error]', e.message);
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha na autenticação\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }
}

async function handleScrobbleConfirm(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;

    const pendingToken = npManager.getPendingAuthToken(commandSenderJid);
    if (!pendingToken) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma autorização pendente\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth primeiro\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    try {
        // Get session key using the authorized token
        const params = {
            method: 'auth.getSession',
            token: pendingToken
        };
        const sessionData = await lastFmPost(params);

        if (!sessionData?.session?.key) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Autorização não concluída\n┃ ➢ 𝗗𝗶𝗰𝗮 › Acesse o link e autorize\n┃ ➢ depois use /fm confirmar\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        const session = {
            key: sessionData.session.key,
            name: sessionData.session.name
        };

        await npManager.setLastfmSession(commandSenderJid, session);
        npManager.removePendingAuthToken(commandSenderJid);

        // Also set the Last.fm username if not set
        if (!npManager.getUserLastFm(commandSenderJid)) {
            await npManager.setUserLastFm(commandSenderJid, session.name);
        }

        return sock.sendMessage(sender, {
            text: `┏━━❪ ✅ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Autenticado com sucesso!\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${session.name}\n┃\n┃ ➢ Agora você pode scrobbar!\n┃ ➢ Use /fm scrobble <musica> - <artista>\n┃ ➢ ou /fm scrobble (usa a música atual)\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (e) {
        console.error('[FM Scrobble Confirm Error]', e.response?.data || e.message);

        if (e.response?.data?.error === 14) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Token não autorizado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Acesse o link enviado\n┃ ➢ e autorize o app primeiro\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao confirmar sessão\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }
}

async function handleScrobbleDeauth(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;

    const session = npManager.getLastfmSession(commandSenderJid);
    if (!session?.key) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Nenhuma sessão ativa\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    await npManager.removeLastfmSession(commandSenderJid);
    return sock.sendMessage(sender, {
        text: "┏━━❪ ✅ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Sessão removida\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth para reconectar\n┃\n┗━━━━━━━━━━━━━━"
    }, { quoted: msg });
}

async function handleScrobble(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;

    const session = npManager.getLastfmSession(commandSenderJid);
    if (!session?.key) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não autenticado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth primeiro\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    if (!config.LASTFM_SHARED_SECRET) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › LASTFM_SHARED_SECRET não configurado\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    let trackName, trackArtist, trackAlbum;
    const manualInput = args.slice(1).join(' ');

    if (manualInput) {
        // Parse "track - artist" or "track by artist" format
        let parts = manualInput.includes(' - ') ? manualInput.split(' - ') : manualInput.split(' by ');
        if (parts.length >= 2) {
            trackName = parts[0].trim();
            trackArtist = parts.slice(1).join(' - ').trim();
        } else {
            // Try to search on Last.fm
            try {
                const searchRes = await lastFmRequest({
                    method: 'track.search',
                    track: manualInput.trim(),
                    limit: 1
                });
                const foundTrack = searchRes.results?.trackmatches?.track?.[0];
                if (foundTrack) {
                    trackName = foundTrack.name;
                    trackArtist = foundTrack.artist;
                } else {
                    return sock.sendMessage(sender, {
                        text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Música não encontrada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use: /fm scrobble nome - artista\n┃\n┗━━━━━━━━━━━━━━"
                    }, { quoted: msg });
                }
            } catch (e) {
                return sock.sendMessage(sender, {
                    text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha na busca\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use: /fm scrobble nome - artista\n┃\n┗━━━━━━━━━━━━━━"
                }, { quoted: msg });
            }
        }
    } else {
        // Use current playing track from Last.fm
        const username = npManager.getUserLastFm(commandSenderJid);
        if (!username) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm não configurado\n┃ ➢ 𝗨𝘀𝗼 › /fm scrobble <musica> - <artista>\n┃ ➢ ou configure: /fm set <user>\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        try {
            const recentRes = await lastFmRequest({
                method: 'user.getrecenttracks',
                user: username,
                limit: 1
            });
            const track = recentRes?.recenttracks?.track?.[0];
            if (!track) {
                return sock.sendMessage(sender, {
                    text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃\n┗━━━━━━━━━━━━━━"
                }, { quoted: msg });
            }
            trackName = track.name;
            trackArtist = track.artist['#text'];
            trackAlbum = track.album?.['#text'];
        } catch (e) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar música atual\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }
    }

    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const scrobbleParams = {
            method: 'track.scrobble',
            artist: trackArtist,
            track: trackName,
            timestamp: String(timestamp),
            sk: session.key
        };
        if (trackAlbum) scrobbleParams.album = trackAlbum;

        const result = await lastFmPost(scrobbleParams);

        if (result?.scrobbles?.['@attr']?.accepted > 0) {
            return sock.sendMessage(sender, {
                text: `┏━━❪ ✅ 𝗦𝗖𝗥𝗢𝗕𝗕𝗟𝗘 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Scrobblado!\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName}\n┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${trackArtist}\n${trackAlbum ? `┃ ➢ 𝗔𝗹𝗯𝘂𝗺 › ${trackAlbum}\n` : ''}┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
        } else if (result?.scrobbles?.['@attr']?.ignored > 0) {
            const reason = result.scrobbles.scrobble?.ignoredMessage?.code;
            let reasonText = 'Rejeitado pelo Last.fm';
            if (reason === '1') reasonText = 'Artista ignorado pelo filtro';
            if (reason === '2') reasonText = 'Track ignorada pelo filtro';
            if (reason === '3') reasonText = 'Timestamp muito antigo';
            if (reason === '4') reasonText = 'Timestamp no futuro';
            if (reason === '5') reasonText = 'Scrobble diário excedido';

            return sock.sendMessage(sender, {
                text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${reasonText}\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName} - ${trackArtist}\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
        }

        return sock.sendMessage(sender, {
            text: `┏━━❪ ✅ 𝗦𝗖𝗥𝗢𝗕𝗕𝗟𝗘 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Enviado!\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName}\n┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${trackArtist}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (e) {
        console.error('[FM Scrobble Error]', e.response?.data || e.message);

        if (e.response?.data?.error === 9) {
            // Invalid session key - remove it
            await npManager.removeLastfmSession(commandSenderJid);
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Sessão expirada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth novamente\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao scrobbar\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }
}

async function handleNowPlaying(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;

    const session = npManager.getLastfmSession(commandSenderJid);
    if (!session?.key) {
        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não autenticado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth primeiro\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }

    let trackName, trackArtist, trackAlbum;
    const manualInput = args.slice(1).join(' ');

    if (manualInput) {
        let parts = manualInput.includes(' - ') ? manualInput.split(' - ') : manualInput.split(' by ');
        if (parts.length >= 2) {
            trackName = parts[0].trim();
            trackArtist = parts.slice(1).join(' - ').trim();
        } else {
            try {
                const searchRes = await lastFmRequest({ method: 'track.search', track: manualInput.trim(), limit: 1 });
                const foundTrack = searchRes.results?.trackmatches?.track?.[0];
                if (foundTrack) {
                    trackName = foundTrack.name;
                    trackArtist = foundTrack.artist;
                }
            } catch (e) { }

            if (!trackName) {
                return sock.sendMessage(sender, {
                    text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Música não encontrada\n┃\n┗━━━━━━━━━━━━━━"
                }, { quoted: msg });
            }
        }
    } else {
        const username = npManager.getUserLastFm(commandSenderJid);
        if (!username) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Use: /fm np <musica> - <artista>\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        try {
            const recentRes = await lastFmRequest({ method: 'user.getrecenttracks', user: username, limit: 1 });
            const track = recentRes?.recenttracks?.track?.[0];
            if (track) {
                trackName = track.name;
                trackArtist = track.artist['#text'];
                trackAlbum = track.album?.['#text'];
            }
        } catch (e) { }

        if (!trackName) {
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }
    }

    try {
        const npParams = {
            method: 'track.updateNowPlaying',
            artist: trackArtist,
            track: trackName,
            sk: session.key
        };
        if (trackAlbum) npParams.album = trackAlbum;

        await lastFmPost(npParams);

        return sock.sendMessage(sender, {
            text: `┏━━❪ 🎵 𝗡𝗢𝗪 𝗣𝗟𝗔𝗬𝗜𝗡𝗚 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Atualizado!\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName}\n┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${trackArtist}\n${trackAlbum ? `┃ ➢ 𝗔𝗹𝗯𝘂𝗺 › ${trackAlbum}\n` : ''}┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (e) {
        console.error('[FM UpdateNowPlaying Error]', e.response?.data || e.message);
        if (e.response?.data?.error === 9) {
            await npManager.removeLastfmSession(commandSenderJid);
            return sock.sendMessage(sender, {
                text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Sessão expirada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm auth novamente\n┃\n┗━━━━━━━━━━━━━━"
            }, { quoted: msg });
        }

        return sock.sendMessage(sender, {
            text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao atualizar now playing\n┃\n┗━━━━━━━━━━━━━━"
        }, { quoted: msg });
    }
}

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();

    // 1. Configurar usuário
    if (subCommand === 'set') {
        const nickname = args[1];
        if (!nickname) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Uso incorreto\n┃ ➢ 𝗘𝘅 › /fm set <lastfm_user>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        await npManager.setUserLastFm(commandSenderJid, nickname);
        return sock.sendMessage(sender, { text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Nick Salvo\n┃ ➢ 𝗨𝘀𝗲𝗿 › ${nickname}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    // 2. Status
    if (subCommand === 'status' || subCommand === 'help') {
        const lastfmUser = npManager.getUserLastFm(commandSenderJid);
        let text = "┏━━❪ 𝗦𝗧𝗔𝗧𝗨𝗦 ❫━━\n┃\n";
        text += `┃ ➢ 𝗟𝗮𝘀𝘁.𝗳𝗺 › ${lastfmUser ? `Conectado (${lastfmUser})` : "Não configurado"}\n┃\n`;
        text += "┣━━❪ 𝗣𝗟𝗔𝗬 ❫━━\n┃\n";
        text += "┃ ➢ /fm › Now Playing (card)\n";
        text += "┃ ➢ /fm --satori › Card via Satori (padrão)\n";
        text += "┃ ➢ /fm --browser › Card via navegador\n";
        text += "┃ ➢ /fm video › Now Playing (vídeo)\n";
        text += "┃ ➢ /fm recent [qtd] › Recentes\n";
        text += "┃ ➢ /fm streak › Streak atual\n";
        text += "┃ ➢ /fm plays › Scrobbles\n";
        text += "┃ ➢ /fm pace [meta] › Estimativa\n";
        text += "┃ ➢ /fm milestone › Marcos\n┃\n";
        text += "┣━━❪ 𝗧𝗢𝗣 𝗟𝗜𝗦𝗧𝗦 ❫━━\n┃\n";
        text += "┃ ➢ /fm ta [período] › Top Artistas\n";
        text += "┃ ➢ /fm talbums [período] › Top Álbuns\n";
        text += "┃ ➢ /fm tt [período] › Top Faixas\n┃\n";
        text += "┣━━❪ 𝗜𝗠𝗔𝗚𝗘𝗠 ❫━━\n┃\n";
        text += "┃ ➢ /fm chart [NxN] [per] › Grid álbuns\n";
        text += "┃ ➢ /fm ac [NxN] [per] › Grid artistas\n";
        text += "┃ ➢ /fm receipt [per] › Receiptify\n";
        text += "┃ ➢ /fm profile › Perfil\n";
        text += "┃ ➢ /fm iceberg › Iceberg\n";
        text += "┃ ➢ /fm year [ano] › Ano em review\n┃\n";
        text += "┣━━❪ 𝗦𝗢𝗖𝗜𝗔𝗟 ❫━━\n┃\n";
        text += "┃ ➢ /fm taste @user › Comparar gosto\n";
        text += "┃ ➢ /fm affinity › Afinidade do grupo\n";
        text += "┃ ➢ /fm wk [artista] › Who Knows?\n";
        text += "┃ ➢ /fm match @user › Match\n";
        text += "┃ ➢ /fm crown [artista] › Crown do artista\n";
        text += "┃ ➢ /fm crowns [@user] › Crowns do user\n";
        text += "┃ ➢ /fm cwlb › Crown leaderboard\n";
        text += "┃ ➢ /fm whois <user> › Quem é dono da conta\n┃\n";
        text += "┣━━❪ 🎮 𝗝𝗢𝗚𝗢𝗦 ❫━━\n┃\n";
        text += "┃ ➢ /fm jumble › Adivinhe o artista\n";
        text += "┃ ➢ /fm pixel › Adivinhe o álbum\n";
        text += "┃ ➢ /fm g [palpite] › Responder\n┃\n";
        text += "┣━━❪ 𝗢𝗨𝗧𝗥𝗢𝗦 ❫━━\n┃\n";
        text += "┃ ➢ /fm overview › Visão geral\n";
        text += "┃ ➢ /fm recap › Recap anual\n";
        text += "┃ ➢ /fm discovery › Descobertas\n";
        text += "┃ ➢ /fm cover › Capa do álbum\n";
        text += "┃ ➢ /fm letra › Letra\n";
        text += "┃ ➢ /fm trecho [1-3] › Quote card\n";
        text += "┃ ➢ /fm dl › Download\n";
        text += "┃ ➢ /fm tema › Mudar tema\n┃\n";
        text += "┣━━❪ 🔴 𝗦𝗖𝗥𝗢𝗕𝗕𝗟𝗘 ❫━━\n┃\n";
        text += "┃ ➢ /fm auth › Autenticar p/ scrobble\n";
        text += "┃ ➢ /fm confirmar › Confirmar auth\n";
        text += "┃ ➢ /fm scrobble [nome - artista] › Scrobbar\n";
        text += "┃ ➢ /fm tocando [nome - artista] › Now Playing\n";
        text += "┃ ➢ /fm desauth › Desconectar sessão\n┃\n";
        text += "┣━━❪ 𝗣𝗘𝗥𝗜𝗢𝗗𝗢𝗦 ❫━━\n┃\n";
        text += "┃ w/semana • m/mes • q/trimestre\n";
        text += "┃ h/semestre • y/ano • a/geral\n";
        text += "┃\n┗━━━━━━━━━━━━━━";
        return sock.sendMessage(sender, { text }, { quoted: msg });
    }

    // Routings
    if (subCommand === 'tema' || subCommand === 'theme') return handleTheme(sock, msg, msgDetails, args);
    if (subCommand === 'auth' || subCommand === 'autenticar' || subCommand === 'login') return handleScrobbleAuth(sock, msg, msgDetails);
    if (subCommand === 'confirmar' || subCommand === 'confirm') return handleScrobbleConfirm(sock, msg, msgDetails);
    if (subCommand === 'desauth' || subCommand === 'desconectar' || subCommand === 'logout') return handleScrobbleDeauth(sock, msg, msgDetails);
    if (['scrobble', 'sb'].includes(subCommand)) return handleScrobble(sock, msg, msgDetails, args);
    if (['tocando', 'nowplaying', 'snp'].includes(subCommand)) return handleNowPlaying(sock, msg, msgDetails, args);
    if (subCommand === 'match') return handleMatch(sock, msg, msgDetails);
    if (subCommand === 'background' || subCommand === 'bg' || subCommand === 'fundo') return handleBackground(sock, msg, msgDetails);
    if (['semana', 'mes', 'ano', 'geral'].includes(subCommand)) return handleTopTracks(sock, msg, msgDetails, subCommand);
    if (['toptracks', 'tt', 'tracks'].includes(subCommand)) return handleTopTracks(sock, msg, msgDetails, args[1]);
    if (['topartists', 'ta', 'artists'].includes(subCommand)) return handleTopArtists(sock, msg, msgDetails, args);
    if (['topalbums', 'talbums', 'tab'].includes(subCommand)) return handleTopAlbums(sock, msg, msgDetails, args);
    if (['recent', 'recentes', 'r'].includes(subCommand)) return handleRecent(sock, msg, msgDetails, args);
    if (['overview', 'ov', 'o'].includes(subCommand)) return handleOverview(sock, msg, msgDetails, args, false);
    if (['recap', 'wrapped'].includes(subCommand)) return handleOverview(sock, msg, msgDetails, args, true);
    if (['download', 'baixar', 'dl'].includes(subCommand)) return handleDownload(sock, msg, msgDetails);
    if (['video', 'vid', 'clipe', 'mv'].includes(subCommand)) return handleVideo(sock, msg, msgDetails);
    if (['cover', 'capa'].includes(subCommand)) return handleCover(sock, msg, msgDetails);
    if (['chart', 'c'].includes(subCommand)) return handleChart(sock, msg, msgDetails, args.slice(1));
    if (['artistchart', 'ac'].includes(subCommand)) return handleArtistChart(sock, msg, msgDetails, args.slice(1));
    if (['receipt', 'rcpt', 'receiptify'].includes(subCommand)) return handleReceipt(sock, msg, msgDetails, args);
    if (['streak', 'str'].includes(subCommand)) return handleStreak(sock, msg, msgDetails);
    if (['plays', 'p', 'scrobbles'].includes(subCommand)) return handlePlays(sock, msg, msgDetails, args);
    if (['pace', 'pc'].includes(subCommand)) return handlePace(sock, msg, msgDetails, args);
    if (['profile', 'perfil', 'stats'].includes(subCommand)) return handleProfile(sock, msg, msgDetails);
    if (['jumble', 'embaralhar'].includes(subCommand)) return handleJumble(sock, msg, msgDetails);
    if (['pixel', 'px'].includes(subCommand)) return handlePixel(sock, msg, msgDetails);
    if (['g', 'guess', 'palpite'].includes(subCommand)) return handleGuess(sock, msg, msgDetails, args);
    if (['taste', 'gosto'].includes(subCommand)) return handleTaste(sock, msg, msgDetails, args);
    if (['affinity', 'afinidade'].includes(subCommand)) return handleAffinity(sock, msg, msgDetails);
    if (['whoknows', 'wk'].includes(subCommand)) return handleWhoKnows(sock, msg, msgDetails, args);
    if (['crown', 'cw'].includes(subCommand)) return handleCrown(sock, msg, msgDetails, args);
    if (['crowns', 'cws'].includes(subCommand)) return handleCrowns(sock, msg, msgDetails);
    if (['crownleaderboard', 'cwlb', 'crownlb'].includes(subCommand)) return handleCrownLeaderboard(sock, msg, msgDetails);
    if (['whois', 'wi'].includes(subCommand)) return handleWhois(sock, msg, msgDetails, args.slice(1));
    if (['milestone', 'ms', 'marcos'].includes(subCommand)) return handleMilestone(sock, msg, msgDetails);
    if (['year', 'ano-review'].includes(subCommand)) return handleYear(sock, msg, msgDetails, args);
    if (['iceberg', 'ice'].includes(subCommand)) return handleIceberg(sock, msg, msgDetails);
    if (['discovery', 'descobertas', 'discover'].includes(subCommand)) return handleDiscovery(sock, msg, msgDetails);

    // Lyrics & Feature
    if (['lyric', 'letra'].includes(subCommand)) {
        const username = npManager.getUserLastFm(commandSenderJid);

        let trackName, trackArtist;
        const manualInput = args.slice(1).join(' ');

        if (manualInput) {
            let parts = manualInput.includes('-') ? manualInput.split('-') : manualInput.split(' by ');
            if (parts.length >= 2) {
                trackName = parts[0].trim();
                trackArtist = parts.slice(1).join('-').trim();
            } else {
                try {
                    const searchRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(manualInput.trim())}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
                    const foundTrack = searchRes.data.results?.trackmatches?.track?.[0];
                    if (foundTrack) {
                        trackName = foundTrack.name;
                        trackArtist = foundTrack.artist;
                    } else {
                        trackName = manualInput.trim();
                        trackArtist = "";
                    }
                } catch (e) {
                    trackName = manualInput.trim();
                    trackArtist = "";
                }
            }
        }

        if (!trackName && !username) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Configure Last.fm primeiro ou escreva o nome da música e artista\n┃ ➢ 𝗘𝘅 › /fm letra nome da musica - artista\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }

        try {
            if (!trackName) {
                const resentRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
                const track = resentRes.data.recenttracks.track[0];
                if (!track) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música tocando recentemente.\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
                trackName = track.name;
                trackArtist = track.artist['#text'];
            }

            const waitMsg = await sock.sendMessage(sender, { text: `┏━━❪ 𝗦𝗘𝗔𝗥𝗖𝗛 ❫━━\n┃\n┃ ➢ 𝗕𝘂𝘀𝗰𝗮𝗻𝗱𝗼 𝗟𝗲𝘁𝗿𝗮...\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });

            const scriptPath = path.join(__dirname, '..', 'scripts', 'scrapper.py');
            let lyricsStr = null;

            try {
                // S3RL fix: genius indexa como "dj-s3rl"
                const lyricsArtist = (trackArtist || '').toLowerCase() === 's3rl' ? 'dj-s3rl' : trackArtist;
                const { stdout } = await execFileAsync('python3.12', [scriptPath, lyricsArtist || '', trackName]);
                const result = JSON.parse(stdout);
                if (result.lyrics) {
                    // Verifica se a letra encontrada corresponde à música solicitada
                    const normalize = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const reqTrack = normalize(trackName);
                    const reqArtist = normalize(trackArtist);
                    const foundTrack = normalize(result.found_track);
                    const foundArtist = normalize(result.found_artist);

                    const trackMatch = foundTrack.includes(reqTrack) || reqTrack.includes(foundTrack);
                    const artistMatch = !reqArtist || !foundArtist || foundArtist.includes(reqArtist) || reqArtist.includes(foundArtist);

                    if (!trackMatch || !artistMatch) {
                        console.warn(`[NP] Letra errada retornada. Pedido: "${trackName} - ${trackArtist}" | Encontrado: "${result.found_track} - ${result.found_artist}"`);
                        return sock.sendMessage(sender, {
                            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Letra incorreta encontrada\n┃ ➢ 𝗣𝗲𝗱𝗶𝗱𝗼 › ${trackName} - ${trackArtist || '?'}\n┃ ➢ 𝗘𝗻𝗰𝗼𝗻𝘁𝗿𝗮𝗱𝗼 › ${result.found_track || '?'} - ${result.found_artist || '?'}\n┃\n┗━━━━━━━━━━━━━━`,
                            edit: waitMsg.key
                        });
                    }

                    lyricsStr = result.lyrics;
                }
            } catch (err) {
                console.error('[NP] Erro no scrapper:', err);
            }

            if (lyricsStr) {
                const lines = lyricsStr.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                npManager.setLyricsCache(commandSenderJid, { name: trackName, artist: trackArtist, lines });
                const numberedLyrics = lines.map((l, i) => `[${i + 1}] ${l}`).join('\n');
                return sock.sendMessage(sender, { text: `┏━━❪ 𝗟𝗬𝗥𝗜𝗖𝗦 ❫━━\n┃\n┃ ➢ 𝗧𝗿𝗮𝗰𝗸 › ${trackName.toUpperCase()}\n┃\n┣━━❪ 𝗧𝗘𝗫𝗧 ❫━━\n┃\n${numberedLyrics}\n┃\n┣━━❪ 𝗗𝗜𝗖𝗔 ❫━━\n┃\n┃ ➢ Use /fm trecho 1-3\n┃\n┗━━━━━━━━━━━━━━`, edit: waitMsg.key });
            } else {
                return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Letra não encontrada\n┃\n┗━━━━━━━━━━━━━━", edit: waitMsg.key });
            }
        } catch (e) {
            console.error('[NP] Erro geral lyrics:', e);
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao buscar música\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
    }

    if (['quote', 'trecho', 'citar'].includes(subCommand)) {
        const username = npManager.getUserLastFm(commandSenderJid);
        if (!username) return sock.sendMessage(sender, { text: "Configure seu Last.fm primeiro!" }, { quoted: msg });

        let quoteText = args.slice(1).join(' ');
        let isRange = false;
        const rangeMatch = quoteText ? quoteText.match(/^(\d+)(?:-(\d+))?$/) : null;

        if (rangeMatch) {
            const cached = npManager.getLyricsCache(commandSenderJid);
            if (!cached) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma letra carregada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /fm letra\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
            const start = parseInt(rangeMatch[1]) - 1;
            const sliceEnd = rangeMatch[2] ? parseInt(rangeMatch[2]) : start + 1;
            if (start < 0 || start >= cached.lines.length || sliceEnd > cached.lines.length || start >= sliceEnd) {
                return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Intervalo inválido\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
            quoteText = cached.lines.slice(start, sliceEnd).join('\n');
            isRange = true;
        }

        if (!quoteText) {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            quoteText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text;
        }
        if (!quoteText) return sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Digite o trecho/intervalo\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });

        try {
            await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });
            let trackName, trackArtist;

            if (isRange && npManager.getLyricsCache(commandSenderJid)) {
                const cached = npManager.getLyricsCache(commandSenderJid);
                trackName = cached.name;
                trackArtist = cached.artist;
            } else {
                const { data } = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
                const trackData = data.recenttracks.track[0];
                trackName = trackData.name;
                trackArtist = trackData.artist['#text'];
            }

            const spotifyData = await getSpotifyData(trackName, trackArtist, commandSenderJid);
            const image = spotifyData?.image || 'https://i.imgur.com/To2300W.png';

            const settings = npManager.getUserSettings(commandSenderJid);
            let userThemeKey = settings?.theme || NP_BASE_THEME;
            let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

            if (userThemeKey === 'custom') {
                const customData = profileManager.getCustomTheme(commandSenderJid);
                if (customData?.backgroundPath) {
                    try {
                        const bgData = await fs.readFile(customData.backgroundPath);
                        userTheme = {
                            ...themes[NP_BASE_THEME], name: 'Custom',
                            ...customData.colors,
                            customBackground: `data:image/jpeg;base64,${bgData.toString('base64')}`
                        };
                    } catch (e) { }
                }
            }
            if (userThemeKey === 'custom-np' && settings.customNpTheme) {
                userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };
            }

            let scrobbles = '0';
            try {
                const trackInfo = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${config.LASTFM_API_KEY}&artist=${encodeURIComponent(trackArtist)}&track=${encodeURIComponent(trackName)}&username=${username}&format=json`);
                scrobbles = trackInfo.data?.track?.userplaycount || '0';
            } catch (e) { }

            let userProfilePic = await sock.profilePictureUrl(commandSenderJid, 'image').catch(() => null);
            const cardPath = await generateLyricsCard({ name: trackName, artist: trackArtist, image }, userTheme, username, quoteText, scrobbles, userProfilePic);

            await sock.sendMessage(sender, { image: { url: cardPath }, caption: `┏━━❪ 𝗤𝗨𝗢𝗧𝗘 ❫━━\n┃\n${quoteText}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);
            return;
        } catch (e) {
            console.error(e);
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao gerar card\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
    }

    // Comando Principal (Now Playing)
    const rendererOption = args.includes('--browser') ? 'browser' : 'satori';
    const npPositionalArgs = args.filter(arg => arg !== '--satori' && arg !== '--browser');
    const npTargetCandidate = npPositionalArgs[0]?.toLowerCase();
    let targetUser = npTargetCandidate && !['semana', 'mes', 'ano', 'yt', 'youtube', 'status'].includes(npTargetCandidate)
        ? npPositionalArgs[0]
        : npManager.getUserLastFm(commandSenderJid);

    if (!targetUser) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › User não encontrado\n┃ ➢ 𝗨𝘀𝗼 › /fm set <nick>\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    if (!config.LASTFM_API_KEY) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › LASTFM_API_KEY ausente\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🎵', key: msg.key } });
        const [recentData, userDataResponse] = await Promise.all([
            lastFmRequest({ method: 'user.getrecenttracks', user: targetUser, limit: 1 }),
            lastFmRequest({ method: 'user.getinfo', user: targetUser })
        ]);

        if (recentData?.error) throw Object.assign(new Error(recentData.message || 'Last.fm error'), { response: { data: recentData } });
        if (userDataResponse?.error) throw Object.assign(new Error(userDataResponse.message || 'Last.fm error'), { response: { data: userDataResponse } });

        const trackData = recentData?.recenttracks?.track?.[0];
        const userData = userDataResponse?.user;

        if (!trackData) return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        if (!userData) throw Object.assign(new Error('User data not found'), { response: { data: { error: 6 } } });

        const track = {
            name: trackData.name,
            artist: trackData.artist['#text'],
            album: trackData.album['#text'],
            image: trackData.image.find(i => i.size === 'extralarge')['#text'] || 'https://i.imgur.com/To2300W.png',
            nowPlaying: trackData['@attr'] && trackData['@attr'].nowplaying === 'true'
        };

        const spotifyData = await getSpotifyData(track.name, track.artist, commandSenderJid);
        if (spotifyData?.image) track.image = spotifyData.image;

        let trackInfo = null;
        try {
            const trackInfoData = await lastFmRequest({
                method: 'track.getInfo',
                artist: track.artist,
                track: track.name,
                username: targetUser
            });
            trackInfo = trackInfoData?.track || null;
        } catch (e) { }

        // Resolve Profile Pic
        let userProfilePic = userData.image.find(i => i.size === 'large')['#text'];
        try {
            // Logic to find JID from username to get WhatsApp PP, or use sender PP if self
            const targetJid = npManager.getJidByLastFm(targetUser);
            if (targetJid) {
                const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null);
                if (ppUrl) userProfilePic = ppUrl;
            } else if (targetUser === npManager.getUserLastFm(commandSenderJid)) {
                const ppUrl = await sock.profilePictureUrl(commandSenderJid, 'image').catch(() => null);
                if (ppUrl) userProfilePic = ppUrl;
            }
        } catch (e) { }
        if (!userProfilePic) userProfilePic = 'https://i.imgur.com/6X2v6lX.png';

        // Theme Loading
        const settings = npManager.getUserSettings(commandSenderJid);
        let userThemeKey = settings?.theme || NP_BASE_THEME;
        let userTheme = themes[userThemeKey] || themes[NP_BASE_THEME];

        if (userThemeKey === 'custom') {
            const customData = profileManager.getCustomTheme(commandSenderJid);
            if (customData?.backgroundPath) {
                try {
                    const bgData = await fs.readFile(customData.backgroundPath);
                    userTheme = { ...themes[NP_BASE_THEME], name: 'Custom', ...customData.colors, customBackground: `data:image/jpeg;base64,${bgData.toString('base64')}` };
                } catch (e) { }
            }
        }
        if (userThemeKey === 'custom-np' && settings.customNpTheme) {
            userTheme = { ...themes[NP_BASE_THEME], ...settings.customNpTheme, name: 'Custom NP' };
        }

        // Easter Egg Logic for Duration
        let totalDuration = "3:45";
        let currentDuration = Math.random() < 0.05 ? "0:67" : "1:07";
        let progressPercent = 30;

        if (spotifyData?.duration) {
            const durationMs = spotifyData.duration;
            const durationSec = Math.floor(durationMs / 1000);
            const min = Math.floor(durationSec / 60);
            const sec = durationSec % 60;
            totalDuration = `${min}:${sec.toString().padStart(2, '0')}`;

            if (durationSec < 260) {
                progressPercent = Math.min((67 / durationSec) * 100, 100);
            } else if (durationSec <= 419) {
                currentDuration = "4:20";
                progressPercent = Math.min((260 / durationSec) * 100, 100);
            } else {
                currentDuration = "6:66";
                progressPercent = Math.min((426 / durationSec) * 100, 100);
            }
        }

        const cardPath = await generateNPCard(
            track,
            { image: userProfilePic, scrobbles: userData.playcount },
            targetUser,
            userTheme,
            currentDuration,
            totalDuration,
            progressPercent,
            { renderer: rendererOption }
        );

        // Check crown for current artist in this group
        let artistDisplay = track.artist;
        if (isGroup) {
            const crown = crownManager.getCrown(sender, track.artist);
            if (crown && crown.holderJid === commandSenderJid) {
                artistDisplay = `${track.artist} 👑`;
            }
        }

        const status = track.nowPlaying ? '𝗡𝗢𝗪 𝗣𝗟𝗔𝗬𝗜𝗡𝗚' : '𝗟𝗔𝗦𝗧 𝗣𝗟𝗔𝗬𝗘𝗗';
        let caption = `┏━━❪ ${status} ❫━━\n┃\n`;
        caption += `┃ ✦ 𝗧𝗿𝗮𝗰𝗸 › ${track.name}\n`;
        caption += `┃ ✦ 𝗔𝗿𝘁𝗶𝘀𝘁 › ${artistDisplay}\n`;
        caption += `┃ ✦ 𝗔𝗹𝗯𝘂𝗺 › ${track.album}\n┃\n`;

        if (trackInfo) {
            caption += `┣━━❪ 𝗜𝗡𝗙𝗢 ❫━━\n┃\n`;
            if (trackInfo.userplaycount) caption += `┃ ➢ 𝗬𝗼𝘂𝗿 𝗣𝗹𝗮𝘆𝘀 › ${trackInfo.userplaycount}\n`;
            if (trackInfo.playcount) caption += `┃ ➢ 𝗚𝗹𝗼𝗯𝗮𝗹 › ${Number(trackInfo.playcount).toLocaleString('pt-BR')}\n`;
            if (trackInfo.toptags?.tag?.length > 0) {
                const tags = trackInfo.toptags.tag.slice(0, 3).map(t => t.name).join(', ');
                caption += `┃ ➢ 𝗧𝗮𝗴𝘀 › ${tags}\n`;
            }
            caption += `┃\n`;
        }
        if (spotifyData?.link) caption += `┣━━❪ 𝗟𝗜𝗡𝗞 ❫━━\n┃\n┃ ➢ ${spotifyData.link}\n┃\n`;
        caption += `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { image: { url: cardPath }, caption }, { quoted: msg });
        setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);

    } catch (e) {
        console.error('[NP] Erro:', e.response?.status || e.code || e.message);
        if (e.response?.data?.error === 6) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Usuário não encontrado\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
        if (e.response?.data?.error === 17) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Perfil Last.fm privado\n┃ ➢ 𝗗𝗶𝗰𝗮 › Torne os scrobbles públicos\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
        if (e.response?.status === 403) {
            return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Last.fm retornou 403\n┃ ➢ 𝗗𝗶𝗰𝗮 › Verifique LASTFM_API_KEY\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
        }
        return sock.sendMessage(sender, { text: "┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha na API Last.fm\n┃\n┗━━━━━━━━━━━━━━" }, { quoted: msg });
    }
};

module.exports.commandData = {
    name: "fm",
    description: "Mostra o que está ouvindo.",
    category: "diversao",
    usage: "/fm",
    aliases: ["/np", "/lastfm", "/music", "/tocando"]
};
