const fs = require('fs').promises;
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/gifCache.json');
const MAX_CACHE_SIZE = 10;

class GifCacheManager {
    constructor() {
        this.cache = {
            gif: [],
            tapa: [],
            beijo: [],
            abraco: []
        };
        this.init();
    }

    async init() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf8');
            this.cache = JSON.parse(data);
        } catch (error) {
            
            if (error.code !== 'ENOENT') {
                console.error('Erro ao carregar cache de GIFs:', error);
            }
            await this.saveToFile();
        }
    }

    async saveToFile() {
        try {
            await fs.writeFile(CACHE_FILE, JSON.stringify(this.cache, null, 2));
        } catch (error) {
            console.error('Erro ao salvar cache de GIFs:', error);
        }
    }

    async save(type, url) {
        if (!this.cache[type]) {
            this.cache[type] = [];
        }

        
        if (this.cache[type].includes(url)) {
            return;
        }

        this.cache[type].push(url);

        
        if (this.cache[type].length > MAX_CACHE_SIZE) {
            this.cache[type].shift(); 
        }

        await this.saveToFile();
    }

    getRandom(type) {
        if (!this.cache[type] || this.cache[type].length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * this.cache[type].length);
        return this.cache[type][randomIndex];
    }
}

const gifCacheManager = new GifCacheManager();
module.exports = gifCacheManager;
