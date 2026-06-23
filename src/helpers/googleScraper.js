const axios = require('axios');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br'
};

/**
 * Scrapes Google Images for GIF URLs
 * @param {string} query Search term
 * @returns {Promise<string[]>} List of image URLs
 */
async function scrapeGoogleImages(query) {
    try {
        const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&asearch=ichunk&async=_id:rg_s,_pms:s,_fmt:pc`;

        const response = await axios.get(url, { headers: HEADERS });
        const html = response.data;

        const imageUrls = [];

        // Regex to find image URLs in the specific Google Images script format
        // This targets the "http" strings often found inside the JSON-like structures
        // It's a heuristic and might need adjustment if Google changes layout
        const regex = /"(https?:\/\/[^"]+\.gif)"/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            // Filter out Google's own logos or small thumbs if possible
            if (!match[1].includes('gstatic.com') && !match[1].includes('google.com')) {
                imageUrls.push(match[1]);
            }
        }

        // Fallback: Try a broader scraping if the specific async format fails
        if (imageUrls.length === 0) {
            const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            const fbResponse = await axios.get(fallbackUrl, { headers: HEADERS });
            const fbHtml = fbResponse.data;

            // Look for generic image links pattern
            const fbRegex = /"(https?:\/\/[^"]+\.gif)"/g;
            let fbMatch;
            while ((fbMatch = fbRegex.exec(fbHtml)) !== null) {
                if (!fbMatch[1].includes('gstatic.com') && !fbMatch[1].includes('google.com')) {
                    imageUrls.push(fbMatch[1]);
                }
            }
        }

        return [...new Set(imageUrls)]; // Remove duplicates
    } catch (error) {
        console.error('[GoogleScraper] Error:', error.message);
        return [];
    }
}

module.exports = { scrapeGoogleImages };
