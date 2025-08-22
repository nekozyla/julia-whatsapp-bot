// donationManager.js
const fs = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');

const DONATION_STATE_FILE = path.join(__dirname, 'donationState.json');
const COOLDOWN_HOURS = 24;   // Um utilizador só receberá um pedido a cada 24 horas

let donationState = {}; // Cache: { "userJid": { lastRequest: timestamp } }

async function loadState() {
    try {
        const data = await fs.readFile(DONATION_STATE_FILE, 'utf-8');
        donationState = JSON.parse(data);
        console.log('[Donation Manager] Estado de doações carregado.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Donation Manager] Ficheiro de estado de doações não encontrado, a iniciar um novo.');
        } else {
            console.error('[Donation Manager] Erro ao carregar estado:', error);
        }
    }
}

async function saveState() {
    try {
        await fs.writeFile(DONATION_STATE_FILE, JSON.stringify(donationState, null, 2));
    } catch (error) {
        console.error('[Donation Manager] Erro ao salvar estado:', error);
    }
}

/**
 * Regista o uso de um comando e verifica se uma mensagem de doação deve ser enviada.
 * @param {string} jid - O JID do utilizador.
 * @returns {boolean} - Retorna true se a mensagem de doação deve ser enviada.
 */
function shouldSendDonationMessage(jid) {
    const now = dayjs();
    const userData = donationState[jid] || { lastRequest: 0 };

    const hoursSinceLastRequest = userData.lastRequest ? now.diff(dayjs(userData.lastRequest), 'hour') : COOLDOWN_HOURS + 1;

    // Verifica apenas se o tempo de cooldown já passou
    if (hoursSinceLastRequest >= COOLDOWN_HOURS) {
        console.log(`[Donation Manager] Utilizador ${jid} elegível para receber mensagem de doação.`);
        return true;
    }

    return false;
}

/**
 * Atualiza o estado de um utilizador após o envio da mensagem de doação.
 * @param {string} jid - O JID do utilizador.
 */
function recordDonationMessageSent(jid) {
    donationState[jid] = {
        lastRequest: dayjs().valueOf(),
    };
    saveState();
    console.log(`[Donation Manager] Mensagem de doação registada para ${jid}.`);
}

// Carrega o estado na inicialização do módulo
loadState();

module.exports = {
    shouldSendDonationMessage,
    recordDonationMessageSent
};
