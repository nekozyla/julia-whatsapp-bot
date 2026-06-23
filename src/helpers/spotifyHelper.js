const SpotifyWebApi = require('spotify-web-api-node');
const config = require('../../config.js');

let spotifyAppToken = null;
let spotifyAppTokenExpiresAt = 0;

async function getAppToken() {
    if (spotifyAppToken && Date.now() < spotifyAppTokenExpiresAt) {
        return spotifyAppToken;
    }

    try {
        const spotifyApi = new SpotifyWebApi({
            clientId: config.SPOTIFY_CLIENT_ID,
            clientSecret: config.SPOTIFY_CLIENT_SECRET
        });

        const data = await spotifyApi.clientCredentialsGrant();
        spotifyAppToken = data.body['access_token'];
        spotifyAppTokenExpiresAt = Date.now() + (data.body['expires_in'] * 1000) - 60000;
        return spotifyAppToken;
    } catch (e) {
        console.error('[Spotify] Error getting app token:', e.message);
        return null;
    }
}

async function getSpotifyData(songName, artistName) {
    if (!config.SPOTIFY_CLIENT_ID) return null;

    try {
        const token = await getAppToken();
        if (!token) return null;

        const spotifyApi = new SpotifyWebApi();
        spotifyApi.setAccessToken(token);


        const query = artistName ? `track:${songName} artist:${artistName}` : `${songName}`;
        const search = await spotifyApi.searchTracks(query, { limit: 1 });

        if (search.body.tracks.items.length > 0) {
            const item = search.body.tracks.items[0];
            return {
                link: item.external_urls.spotify,
                image: item.album.images.find(i => i.height > 300)?.url || item.album.images[0]?.url,
                album: item.album.name,
                name: item.name,
                artist: item.artists.map(a => a.name).join(', '),
                duration: item.duration_ms,
                previewUrl: item.preview_url || null
            };
        } else {

            const looseQuery = artistName ? `${songName} ${artistName}` : songName;
            const looseSearch = await spotifyApi.searchTracks(looseQuery, { limit: 1 });
            if (looseSearch.body.tracks.items.length > 0) {
                const item = looseSearch.body.tracks.items[0];
                return {
                    link: item.external_urls.spotify,
                    image: item.album.images.find(i => i.height > 300)?.url || item.album.images[0]?.url,
                    album: item.album.name,
                    name: item.name,
                    artist: item.artists.map(a => a.name).join(', '),
                    duration: item.duration_ms,
                    previewUrl: item.preview_url || null
                };
            }
        }
    } catch (e) {
        console.error('[Spotify] Error fetching data:', e.message);
    }
    return null;
}

async function getSpotifyArtistImage(artistName) {
    if (!config.SPOTIFY_CLIENT_ID || !artistName) return null;
    try {
        const token = await getAppToken();
        if (!token) return null;
        const spotifyApi = new SpotifyWebApi();
        spotifyApi.setAccessToken(token);
        const search = await spotifyApi.searchArtists(artistName, { limit: 1 });
        const artist = search.body.artists?.items?.[0];
        if (artist?.images?.length > 0) {
            return artist.images.find(i => i.height >= 300)?.url || artist.images[0]?.url;
        }
    } catch (e) {
        console.error('[Spotify] Error fetching artist image:', e.message);
    }
    return null;
}

module.exports = {
    getSpotifyData,
    getSpotifyArtistImage
};
