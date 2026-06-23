const axios = require('axios');

const HEADERS = {
    'authority': 'duckduckgo.com',
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'referer': 'https://duckduckgo.com/'
};

/**
 * Extracts VQD token from the search page
 * @param {string} query 
 * @returns {Promise<string|null>}
 */
async function getVqd(query) {
    try {
        // console.log('[DDG Scraper] Fetching VQD...');
        const response = await axios.get(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iax=images&ia=images`, {
            headers: {
                ...HEADERS,
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
            }
        });

        // Try multiple patterns for VQD
        const vqdPatterns = [
            /vqd="([^"]+)"/,
            /vqd=([0-9-]+)\&/,
            /vqd='([^']+)'/
        ];

        for (const regex of vqdPatterns) {
            const match = response.data.match(regex);
            if (match && match[1]) {
                // console.log('[DDG Scraper] VQD found:', match[1]);
                return match[1];
            }
        }

        console.error('[DDG Scraper] Could not find VQD token in response.');
        return null;
    } catch (error) {
        console.error('[DDG Scraper] Error fetching VQD:', error.message);
        return null;
    }
}

/**
 * Searches DuckDuckGo Images
 * @param {string} query Search query
 * @returns {Promise<string[]>} List of image URLs
 */
async function searchDuckDuckGoImages(query) {
    try {
        const vqd = await getVqd(query);
        if (!vqd) {
            return [];
        }

        // Wait a bit to mimic human behavior/network latency
        await new Promise(r => setTimeout(r, 200));

        const url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=-1`;

        const response = await axios.get(url, { headers: HEADERS });

        if (response.data && response.data.results) {
            return response.data.results.map(result => result.image);
        }

        return [];
    } catch (error) {
        console.error(`[DDG Scraper] Error searching images: ${error.message}`);
        // If 403, it often means the VQD expired or was rejected. 
        return [];
    }
}

module.exports = { searchDuckDuckGoImages };
