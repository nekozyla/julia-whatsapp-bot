const YTMusic = require('ytmusic-api');

const ytmusic = new YTMusic();

async function getLyrics(song, artist) {
    try {
        await ytmusic.initialize();
        const query = `${song} ${artist}`;
        
        const songs = await ytmusic.search(query);

        if (!songs || songs.length === 0) {
            return null;
        }

        
        const songResult = songs.find(s => (s.type === 'SONG' || s.type === 'VIDEO') && s.videoId);

        if (!songResult) return null;

        const videoId = songResult.videoId;
        if (!videoId) return null;

        
        const lyrics = await ytmusic.getLyrics(videoId);

        if (!lyrics || !lyrics.length) return null;

        
        
        
        
        
        

        if (Array.isArray(lyrics)) {
            return lyrics.map(line => typeof line === 'string' ? line : line.lyrics || '').join('\n');
        } else if (typeof lyrics === 'string') {
            return lyrics;
        } else if (typeof lyrics === 'object' && lyrics.lyrics) {
            return lyrics.lyrics;
        }

        return null;

    } catch (error) {
        console.error("Error fetching lyrics with ytmusic-api:", error.message);
        return null;
    }
}

module.exports = { getLyrics };
