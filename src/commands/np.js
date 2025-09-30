// commands/np.js (Versão final com perfil completo e link do Spotify)
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config.js');
const SpotifyWebApi = require('spotify-web-api-node');

// --- LÓGICA DE PERSISTÊNCIA DE NICKS DO LAST.FM ---
const nicknamesFilePath = path.join(__dirname, '..', '..', 'data', 'np_users.json');
let userNicknames = {};
async function loadNicknames() {
    try {
        await fs.mkdir(path.dirname(nicknamesFilePath), { recursive: true });
        const data = await fs.readFile(nicknamesFilePath, 'utf-8');
        userNicknames = JSON.parse(data);
        console.log('[Last.fm] Nicks de utilizadores carregados com sucesso.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Last.fm] Ficheiro de nicks de utilizador não encontrado, a iniciar um novo.');
            userNicknames = {};
        } else {
            console.error('[Last.fm] Erro ao carregar nicks de utilizador:', error);
        }
    }
}
async function saveNicknames() {
    try {
        await fs.writeFile(nicknamesFilePath, JSON.stringify(userNicknames, null, 2));
    } catch (error) {
        console.error('[Last.fm] Erro ao salvar nicks de utilizador:', error);
    }
}
loadNicknames();
// --- FIM DA LÓGICA DE PERSISTÊNCIA ---

// --- LÓGICA PARA CARREGAR TOKENS DO SPOTIFY ---
const tokensFilePath = path.join(__dirname, '..', '..', 'data', 'spotify_tokens.json');
let spotifyTokens = {};
async function loadSpotifyTokens() {
    try {
        const data = await fs.readFile(tokensFilePath, 'utf-8');
        spotifyTokens = JSON.parse(data);
    } catch (e) {
        spotifyTokens = {};
    }
}
// --- FIM DA LÓGICA DO SPOTIFY ---


/**
 * Função para buscar e formatar o Top de um período.
 */
async function handleTopCommand(sock, msg, msgDetails, period, type) {
    const { sender, commandText, commandSenderJid } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const targetUsername = args[1] || userNicknames[commandSenderJid];

    if (!targetUsername) {
        await sock.sendMessage(sender, { text: `Para ver o top, defina o seu nick com \`/np set <nick>\` ou especifique um utilizador.\n\n*Exemplo:*\n\`/np ${period} <usuario>\`` }, { quoted: msg });
        return;
    }

    const periodMap = { semana: '7day', mes: '1month', ano: '12month' };
    const apiPeriod = periodMap[period];
    const periodText = { semana: 'da Semana', mes: 'do Mês', ano: 'do Ano' }[period];
    const typeText = type === 'tracks' ? 'Músicas' : 'Artistas';
    const method = type === 'tracks' ? 'user.gettoptracks' : 'user.gettopartists';
    
    const apiUrl = `https://ws.audioscrobbler.com/2.0/?method=${method}&user=${targetUsername}&period=${apiPeriod}&limit=10&api_key=${config.LASTFM_API_KEY}&format=json`;

    try {
        await sock.sendPresenceUpdate('composing', sender);
        const { data } = await axios.get(apiUrl);
        const list = data.toptracks?.track || data.topartists?.artist;

        if (!list || list.length === 0) {
            await sock.sendMessage(sender, { text: `Não encontrei o top de ${typeText.toLowerCase()} para "${targetUsername}" neste período. 😕` });
            return;
        }

        let responseText = `*🏆 Top 10 ${typeText} ${periodText} de ${targetUsername} 🏆*\n\n`;
        
        list.forEach((item, index) => {
            const medal = ['🥇', '🥈', '🥉'][index] || `*${index + 1}.*`;
            const artistName = type === 'tracks' ? ` - ${item.artist.name}` : '';
            responseText += `${medal} *${item.name}*${artistName} _(${item.playcount} scrobbles)_\n`;
        });

        const topImage = list[0].image.find(img => img.size === 'extralarge')['#text'];
        if (topImage) {
            await sock.sendMessage(sender, { image: { url: topImage }, caption: responseText.trim() }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: responseText.trim() }, { quoted: msg });
        }

    } catch (error) {
        console.error(`[Last.fm Top Scrobbles] Erro:`, error.response?.data || error.message);
        await sock.sendMessage(sender, { text: `Ocorreu um erro ao buscar o top de ${typeText.toLowerCase()}.` }, { quoted: msg });
    }
}


module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, commandSenderJid } = msgDetails;
    
    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();

    if (!config.LASTFM_API_KEY) {
        await sock.sendMessage(sender, { text: "A funcionalidade do Last.fm não está configurada corretamente." }, { quoted: msg });
        return;
    }

    if (subCommand === 'set') {
        const nickname = args[1];
        if (!nickname) {
            await sock.sendMessage(sender, { text: "Por favor, forneça o seu nick do Last.fm.\n\n*Exemplo:*\n`/np set meu_nick`" }, { quoted: msg });
            return;
        }
        userNicknames[commandSenderJid] = nickname;
        await saveNicknames();
        await sock.sendMessage(sender, { text: `✅ Seu nick do Last.fm foi salvo como: *${nickname}*.\n\nAgora pode usar apenas \`/np\` para ver o que está a ouvir.` }, { quoted: msg });
        return;
    }
    
    if (['semana', 'mes', 'ano'].includes(subCommand)) {
        await handleTopCommand(sock, msg, msgDetails, subCommand, 'tracks');
        return;
    }
     if (['artistas', 'artista'].includes(subCommand)) {
        const period = args[1] || 'semana';
        if (!['semana', 'mes', 'ano'].includes(period)) {
             await sock.sendMessage(sender, { text: "Período inválido. Use `semana`, `mes` ou `ano`." });
             return;
        }
        await handleTopCommand(sock, msg, msgDetails, period, 'artists');
        return;
    }

    let targetUsername = subCommand;
    if (!targetUsername) {
        targetUsername = userNicknames[commandSenderJid];
    }

    if (!targetUsername) {
        const tutorialText = "🎶 Para ver o que alguém está a ouvir:\n`/np <usuario>`\n\nPara definir o seu perfil padrão:\n`/np set <seu_nick>`\n\nPara ver os tops:\n`/np semana|mes|ano [usuario]`\n`/np artistas semana|mes|ano [usuario]`";
        await sock.sendMessage(sender, { text: tutorialText }, { quoted: msg });
        return;
    }

    try {
        await sock.sendPresenceUpdate('composing', sender);

        const recentTracksUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${targetUsername}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`;
        const userInfoUrl = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${targetUsername}&api_key=${config.LASTFM_API_KEY}&format=json`;
        const topArtistsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${targetUsername}&period=7day&limit=3&api_key=${config.LASTFM_API_KEY}&format=json`;
        const topAlbumsUrl = `https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${targetUsername}&period=7day&limit=3&api_key=${config.LASTFM_API_KEY}&format=json`;

        const [recentTracksRes, userInfoRes, topArtistsRes, topAlbumsRes] = await Promise.all([
            axios.get(recentTracksUrl),
            axios.get(userInfoUrl),
            axios.get(topArtistsUrl),
            axios.get(topAlbumsUrl)
        ]);

        const { data: recentTracksData } = recentTracksRes;
        const { data: userInfoData } = userInfoRes;
        const { data: topArtistsData } = topArtistsRes;
        const { data: topAlbumsData } = topAlbumsRes;
        
        let songInfoText = `Não foi encontrada nenhuma música recente para *${targetUsername}*.`;
        let image = userInfoData.user?.image.find(img => img.size === 'extralarge')['#text'] || null;
        let songForSearch, artistForSearch, spotifyUrl;

        if (recentTracksData.recenttracks && recentTracksData.recenttracks.track.length > 0) {
            const track = recentTracksData.recenttracks.track[0];
            artistForSearch = track.artist['#text'];
            songForSearch = track.name;
            image = track.image.find(img => img.size === 'extralarge')['#text'] || image;
            const isPlayingNow = track['@attr'] && track['@attr'].nowplaying === 'true';
            const title = isPlayingNow ? `🎧 *A ouvir agora:*` : `🎶 *Última ouvida:*`;
            
            // --- LÓGICA DE BUSCA DO SPOTIFY ---
            await loadSpotifyTokens();
            const tokenInfo = spotifyTokens[commandSenderJid];
            if (tokenInfo) {
                try {
                    const spotifyApi = new SpotifyWebApi({ clientId: config.SPOTIFY_CLIENT_ID, clientSecret: config.SPOTIFY_CLIENT_SECRET });
                    spotifyApi.setRefreshToken(tokenInfo.refreshToken);
                    const dataToken = await spotifyApi.refreshAccessToken();
                    spotifyApi.setAccessToken(dataToken.body['access_token']);
                    const searchResult = await spotifyApi.searchTracks(`track:${songForSearch} artist:${artistForSearch}`, { limit: 1 });
                    if (searchResult.body.tracks.items.length > 0) {
                        spotifyUrl = searchResult.body.tracks.items[0].external_urls.spotify;
                    }
                } catch (spotifyError) {
                    console.error(`[Spotify Search in NP] Erro ao buscar link para ${commandSenderJid}:`, spotifyError.message);
                }
            }

            songInfoText = `${title}\n*${songForSearch}* de *${artistForSearch}*`;
            if (spotifyUrl) {
                songInfoText += `\n${spotifyUrl}`;
            }
        }
        
        const totalScrobbles = Number(userInfoData.user?.playcount || 0).toLocaleString('pt-BR');
        const registrationDate = new Date(userInfoData.user?.registered.unixtime * 1000).toLocaleDateString('pt-BR');

        let topArtistsText = "_Nenhum artista na última semana._";
        if (topArtistsData.topartists && topArtistsData.topartists.artist.length > 0) {
            topArtistsText = topArtistsData.topartists.artist.map((artist, i) => `${i+1}. *${artist.name}* (${artist.playcount})`).join('\n');
        }

        let topAlbumsText = "_Nenhum álbum na última semana._";
        if (topAlbumsData.topalbums && topAlbumsData.topalbums.album.length > 0) {
            topAlbumsText = topAlbumsData.topalbums.album.map((album, i) => `${i+1}. *${album.name}* (${album.playcount})`).join('\n');
        }

        let messageText = `*Perfil de ${targetUsername} no Last.fm*\n_Membro desde ${registrationDate} • ${totalScrobbles} scrobbles_\n\n${songInfoText}\n\n*Top 3 Artistas (Semana):*\n${topArtistsText}\n\n*Top 3 Álbuns (Semana):*\n${topAlbumsText}`;

        if (image) {
            await sock.sendMessage(sender, { image: { url: image }, caption: messageText.trim() }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: messageText.trim() }, { quoted: msg });
        }

    } catch (error) {
        if (error.response && error.response.data && error.response.data.error === 6) {
             await sock.sendMessage(sender, { text: `😕 O utilizador "${targetUsername}" não foi encontrado no Last.fm.` }, { quoted: msg });
        } else {
            console.error("[Last.fm] Erro ao buscar dados da API:", error.response?.data || error.message);
            await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar comunicar com o Last.fm. Tente novamente mais tarde." }, { quoted: msg });
        }
    }
};
