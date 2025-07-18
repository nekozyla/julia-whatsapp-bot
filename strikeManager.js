// strikeManager.js
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

const STRIKES_FILE_PATH = path.join(__dirname, 'strikes.json');

// Define as penalidades de tempo (em minutos) para cada nível de strike
const PENALTY_LEVELS_MINUTES = [5, 30, 120, 1440]; // 5m, 30m, 2h, 24h

let strikesCache = {}; // Cache: { "userJid": { level: 1, bannedUntil: timestamp } }

async function loadStrikes() {
    try {
        const data = await fs.readFile(STRIKES_FILE_PATH, 'utf-8');
        strikesCache = JSON.parse(data);
        console.log('[Strike Manager] Histórico de strikes carregado.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Strike Manager] Arquivo de strikes não encontrado, iniciando um novo.');
        } else {
            console.error('[Strike Manager] Erro ao carregar strikes:', error);
        }
    }
}

async function saveStrikes() {
    try {
        await fs.writeFile(STRIKES_FILE_PATH, JSON.stringify(strikesCache, null, 2));
    } catch (error) {
        console.error('[Strike Manager] Erro ao salvar strikes:', error);
    }
}

/**
 * Adiciona um strike a um usuário e calcula o tempo de banimento.
 * @param {string} jid - O JID do usuário.
 * @returns {number} O tempo de banimento em minutos.
 */
async function addStrike(jid) {
    const userData = strikesCache[jid] || { level: 0 };
    userData.level += 1;

    // Pega a penalidade correspondente ou a última da lista se o usuário ultrapassar os níveis
    const penaltyMinutes = PENALTY_LEVELS_MINUTES[userData.level - 1] || PENALTY_LEVELS_MINUTES[PENALTY_LEVELS_MINUTES.length - 1];
    
    userData.bannedUntil = dayjs().add(penaltyMinutes, 'minute').valueOf();
    strikesCache[jid] = userData;
    
    await saveStrikes();

    console.warn(`[Strike Manager] Strike ${userData.level} aplicado a ${jid}. Banido por ${penaltyMinutes} minutos.`);
    return penaltyMinutes;
}

/**
 * Verifica se um usuário está atualmente banido.
 * @param {string} jid - O JID do usuário.
 * @returns {object|null} Retorna o status do banimento ou nulo se não estiver banido.
 */
function getBanStatus(jid) {
    const userData = strikesCache[jid];
    if (!userData || !userData.bannedUntil) {
        return null;
    }

    const now = dayjs();
    const banEnds = dayjs(userData.bannedUntil);

    if (now.isBefore(banEnds)) {
        return {
            level: userData.level,
            minutesRemaining: banEnds.diff(now, 'minute')
        };
    }

    // O tempo de banimento já passou, então não está mais banido
    return null;
}

// Inicia o sistema carregando os strikes existentes
loadStrikes();

module.exports = {
    addStrike,
    getBanStatus
};
