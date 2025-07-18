// agreementManager.js
const fs = require('fs').promises;
const path = require('path');

const AGREEMENT_FILE_PATH = path.join(__dirname, 'agreements.json');
let agreedUsersCache = new Set(); // Cache para acesso rápido

/**
 * Carrega a lista de usuários que já concordaram com os termos.
 */
async function loadAgreements() {
    try {
        const data = await fs.readFile(AGREEMENT_FILE_PATH, 'utf-8');
        const loadedJids = JSON.parse(data);
        agreedUsersCache = new Set(loadedJids);
        console.log(`[Agreement] ${agreedUsersCache.size} acordos de usuário carregados.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Agreement] Arquivo de acordos não encontrado, iniciando um novo.');
        } else {
            console.error('[Agreement] Erro ao carregar acordos:', error);
        }
    }
}

/**
 * Salva a lista de usuários que concordaram.
 */
async function saveAgreements() {
    try {
        await fs.writeFile(AGREEMENT_FILE_PATH, JSON.stringify([...agreedUsersCache]));
    } catch (error) {
        console.error('[Agreement] Erro ao salvar acordos:', error);
    }
}

/**
 * Marca um usuário como tendo concordado com os termos.
 * @param {string} jid - O JID do usuário.
 */
async function setUserAsAgreed(jid) {
    if (!agreedUsersCache.has(jid)) {
        agreedUsersCache.add(jid);
        await saveAgreements();
        console.log(`[Agreement] Usuário ${jid} concordou com os termos.`);
    }
}

/**
 * Verifica se um usuário já concordou com os termos.
 * @param {string} jid - O JID do usuário.
 * @returns {boolean}
 */
function hasUserAgreed(jid) {
    return agreedUsersCache.has(jid);
}

module.exports = {
    loadAgreements,
    setUserAsAgreed,
    hasUserAgreed
};
