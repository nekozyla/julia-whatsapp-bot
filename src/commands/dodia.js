
const muchaManager = require('../managers/muchaMusicaManager.js');
const npManager = require('../managers/npManager.js');
const config = require('../../config.js');
const axios = require('axios');
const contactManager = require('../managers/contactManager.js');

const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

/**
 * Busca a música que o usuário está ouvindo agora via Last.fm
 */
async function getNowPlaying(username) {
    if (!config.LASTFM_API_KEY || !username) return null;

    try {
        const response = await axios.get(LASTFM_BASE_URL, {
            params: {
                method: 'user.getrecenttracks',
                user: username,
                api_key: config.LASTFM_API_KEY,
                format: 'json',
                limit: 1
            },
            timeout: 10000
        });

        const track = response.data?.recenttracks?.track?.[0];
        if (!track) return null;

        return {
            name: track.name,
            artist: track.artist?.['#text'] || 'Desconhecido',
            album: track.album?.['#text'] || '',
            nowPlaying: track['@attr']?.nowplaying === 'true'
        };
    } catch (e) {
        console.error('[Dodia] Erro ao buscar Last.fm:', e.message);
        return null;
    }
}

async function handleDodiaCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, args } = msgDetails;

    // Só funciona em grupo
    if (!isGroup) {
        return sock.sendMessage(sender, {
            text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Comando apenas para grupos\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
    }

    // Verifica se o modo está ativo
    if (!muchaManager.isActive(sender)) {
        return sock.sendMessage(sender, {
            text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Mucha Música não está ativo\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use /muchamusica on\n┃\n┗━━━━━━━━━━━━━━'
        }, { quoted: msg });
    }

    let track = null;
    let artist = null;
    let link = null;

    // Regex para detectar links de música (Spotify, YouTube, YT Music)
    const linkRegex = /(https?:\/\/(?:open\.spotify\.com\/(?:track|album|intl-[a-z]+\/track)\/[^\s?]+(?:\?[^\s]*)?|(?:www\.|m\.)?youtube\.com\/watch\?[^\s]+|youtu\.be\/[^\s]+|music\.youtube\.com\/watch\?[^\s]+|spotify\.link\/[^\s]+))/i;

    // Se tem argumentos, parse manual: /dodia Música - Artista [link]
    if (args.length > 0) {
        let fullText = args.join(' ');

        // Extrai link se houver
        const linkMatch = fullText.match(linkRegex);
        if (linkMatch) {
            link = linkMatch[1];
            // Remove o link do texto para parse limpo do track/artist
            fullText = fullText.replace(linkMatch[0], '').trim();
        }

        // Se sobrou texto, faz parse do track/artist
        if (fullText) {
            // Aceita formatos: "música - artista", "música — artista", "música | artista"
            const separators = [' - ', ' — ', ' | ', ' by '];
            let parts = null;

            for (const sep of separators) {
                if (fullText.includes(sep)) {
                    const idx = fullText.indexOf(sep);
                    parts = [fullText.slice(0, idx).trim(), fullText.slice(idx + sep.length).trim()];
                    break;
                }
            }

            if (parts && parts[0] && parts[1]) {
                track = parts[0];
                artist = parts[1];
            } else {
                // Se não tem separador, tenta usar tudo como nome de música
                track = fullText;
                artist = 'Desconhecido';
            }
        } else if (link) {
            // Só mandou link sem texto — usa o próprio link como o nome da faixa
            track = '🔊 Link: ' + link;
            artist = 'Indefinido';
        }
    } else {
        // Sem argumentos — tenta Last.fm
        const lastfmUser = npManager.getUserLastFm(commandSenderJid);

        if (!lastfmUser) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 🎵 𝗗𝗢𝗗𝗜𝗔 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música informada\n┃\n┃ ➢ 𝗢𝗽çã𝗼 𝟭 › /dodia música - artista\n┃ ➢ 𝗢𝗽çã𝗼 𝟮 › /dodia <link spotify/yt>\n┃ ➢ 𝗢𝗽çã𝗼 𝟯 › Configure Last.fm:\n┃   /fm set <username>\n┃   Depois use /dodia sem args\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        const nowPlaying = await getNowPlaying(lastfmUser);

        if (!nowPlaying) {
            return sock.sendMessage(sender, {
                text: '┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhuma música encontrada\n┃ ➢ 𝗗𝗶𝗰𝗮 › Abra o Spotify/player e\n┃   tente novamente, ou use:\n┃   /dodia música - artista\n┃\n┗━━━━━━━━━━━━━━'
            }, { quoted: msg });
        }

        track = nowPlaying.name;
        artist = nowPlaying.artist;
    }

    // Registra a música (com link se houver)
    const result = await muchaManager.submitSong(sender, commandSenderJid, track, artist, link);

    if (!result.success) {
        return sock.sendMessage(sender, {
            text: `┏━━❪ 🎵 𝗗𝗢𝗗𝗜𝗔 ❫━━\n┃\n┃ ➢ ${result.message}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }

    const mentions = [];
    let memberName = contactManager.getNickname(commandSenderJid);
    if (!memberName) {
        memberName = `@${commandSenderJid.split('@')[0]}`;
        mentions.push(commandSenderJid);
    }

    const late = result.song?.late ? '\n┃ ➢ ⏰ Registro atrasado' : '';

    let text = `┏━━❪ 🎵 𝗗𝗢𝗗𝗜𝗔 ❫━━\n┃\n`;
    text += `┃ ➢ 𝗠𝗲𝗺𝗯𝗿𝗼 › ${memberName}\n`;
    text += `┃ ➢ 𝗠𝘂́𝘀𝗶𝗰𝗮 › ${track}\n`;
    text += `┃ ➢ 𝗔𝗿𝘁𝗶𝘀𝘁𝗮 › ${artist}\n`;
    if (link) {
        text += `┃ ➢ 🔗 𝗟𝗶𝗻𝗸 › ${link}\n`;
    }
    text += `┃ ➢ 𝗗𝗶𝗮 › ${result.song?.day || muchaManager.todayStr()}${late}\n┃\n`;
    text += `┃ ✅ ${result.message}\n┃\n`;
    text += `┗━━━━━━━━━━━━━━`;

    // React com emoji musical
    sock.sendMessage(sender, { react: { text: '🎵', key: msg.key } }).catch(() => {});

    return sock.sendMessage(sender, { text, mentions }, { quoted: msg });
}

module.exports = handleDodiaCommand;

module.exports.commandData = {
    name: "dodia",
    description: "Registra a música do dia no Mucha Música.",
    category: "diversao",
    usage: "/dodia [música - artista]",
    aliases: ["/songoftheday", "/sotd"]
};
