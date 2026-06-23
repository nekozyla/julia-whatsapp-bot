/**
 * Sticker Farm Manager
 * Gerencia o rastreamento das últimas mídias (stickers)
 * criadas em grupos habilitados pelo Super Admin.
 * 
 * Armazena até MAX_STICKERS por USUÁRIO por grupo.
 * Filtra imagens muito semelhantes usando Difference Hash (dHash).
 */

const sharp = require('sharp');

const HASH_SIZE = 8;           // dHash 8x8 → 64 bits
const SIMILARITY_THRESHOLD = 8; // bits diferentes tolerados (0=idêntico, 64=totalmente diferente)

/**
 * Gera um Difference Hash (dHash) de um buffer WebP.
 * Retorna um array de 0s e 1s com HASH_SIZE² bits.
 */
async function computeDHash(buffer) {
    // Resize para (HASH_SIZE+1) x HASH_SIZE em escala de cinza
    const { data } = await sharp(buffer)
        .resize(HASH_SIZE + 1, HASH_SIZE, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = [];
    for (let row = 0; row < HASH_SIZE; row++) {
        for (let col = 0; col < HASH_SIZE; col++) {
            const left  = data[row * (HASH_SIZE + 1) + col];
            const right = data[row * (HASH_SIZE + 1) + col + 1];
            hash.push(left < right ? 1 : 0);
        }
    }
    return hash;
}

/**
 * Calcula a distância de Hamming entre dois hashes (arrays de bits).
 */
function hammingDistance(h1, h2) {
    let dist = 0;
    for (let i = 0; i < h1.length; i++) {
        if (h1[i] !== h2[i]) dist++;
    }
    return dist;
}

class StickerFarmManager {
    constructor() {
        // Map<groupJid, { enabled: boolean, userStickers: Map<userJid, { buffer: Buffer, hash: number[] }[]> }>
        this.farms = new Map();
        this.MAX_STICKERS = 10;
    }

    toggleFarm(groupJid) {
        if (!this.farms.has(groupJid)) {
            this.farms.set(groupJid, { enabled: true, userStickers: new Map() });
            return true;
        }

        const state = this.farms.get(groupJid);
        state.enabled = !state.enabled;
        if (!state.enabled) {
            state.userStickers = new Map();
        }
        return state.enabled;
    }

    isFarmEnabled(groupJid) {
        const state = this.farms.get(groupJid);
        return state ? state.enabled : false;
    }

    /**
     * Adiciona um sticker ao pool do usuário no grupo.
     * Rejeita silenciosamente se for muito semelhante a algum já armazenado.
     * @returns {Promise<'added'|'duplicate'|'disabled'>}
     */
    async addSticker(groupJid, userJid, stickerBuffer) {
        if (!this.isFarmEnabled(groupJid)) return 'disabled';

        const state = this.farms.get(groupJid);
        if (!state.userStickers.has(userJid)) {
            state.userStickers.set(userJid, []);
        }

        const userList = state.userStickers.get(userJid);

        // Calcular hash do novo sticker
        let newHash;
        try {
            newHash = await computeDHash(stickerBuffer);
        } catch (e) {
            // Se não conseguir calcular, adiciona sem filtrar
            console.warn('[StickerFarm] Falha ao calcular dHash, adicionando sem filtro:', e.message);
            userList.unshift({ buffer: stickerBuffer, hash: null });
            if (userList.length > this.MAX_STICKERS) userList.pop();
            return 'added';
        }

        // Verificar semelhança com stickers já armazenados (deste usuário no grupo)
        for (const entry of userList) {
            if (!entry.hash) continue;
            const dist = hammingDistance(newHash, entry.hash);
            if (dist <= SIMILARITY_THRESHOLD) {
                console.log(`[StickerFarm] Sticker rejeitado: muito semelhante (dist=${dist}) ao existente de ${userJid.split('@')[0]}`);
                return 'duplicate';
            }
        }

        // Adiciona ao topo
        userList.unshift({ buffer: stickerBuffer, hash: newHash });
        if (userList.length > this.MAX_STICKERS) userList.pop();

        return 'added';
    }

    /**
     * Retorna todos os buffers do grupo (de todos os usuários).
     */
    getStickers(groupJid) {
        const state = this.farms.get(groupJid);
        if (!state) return [];

        const all = [];
        for (const userStickers of state.userStickers.values()) {
            all.push(...userStickers.map(e => e.buffer));
        }
        return all;
    }

    getStatus(groupJid) {
        const state = this.farms.get(groupJid);
        if (!state) {
            return { enabled: false, count: 0, users: 0, limit: this.MAX_STICKERS };
        }

        let total = 0;
        for (const userStickers of state.userStickers.values()) {
            total += userStickers.length;
        }

        return {
            enabled: state.enabled,
            count: total,
            users: state.userStickers.size,
            limit: this.MAX_STICKERS
        };
    }
}

module.exports = new StickerFarmManager();
