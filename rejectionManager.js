// rejectionManager.js
const fs = require('fs');
const path = require('path');

const REJECTION_LOG_FILE = path.join(__dirname, 'rejection_log.json');
let rejectionLog = {}; // Formato: { "userJid": 1678886400000 }

/**
 * Carrega o log de avisos enviados.
 */
function loadLog() {
    try {
        if (fs.existsSync(REJECTION_LOG_FILE)) {
            const data = fs.readFileSync(REJECTION_LOG_FILE, 'utf-8');
            rejectionLog = JSON.parse(data);
            console.log(`[RejectionManager] Log de avisos carregado.`);
        } else {
            console.log(`[RejectionManager] Ficheiro de log de avisos não encontrado. A criar um novo.`);
        }
    } catch (error) {
        console.error('[RejectionManager] Erro ao carregar o log de avisos:', error);
    }
}

/**
 * Salva o log de avisos no ficheiro.
 */
function saveLog() {
    try {
        fs.writeFileSync(REJECTION_LOG_FILE, JSON.stringify(rejectionLog, null, 2));
    } catch (error) {
        console.error('[RejectionManager] Erro ao salvar o log de avisos:', error);
    }
}

/**
 * Verifica se o bot deve enviar a mensagem de aviso para um utilizador.
 * @param {string} jid - O JID do utilizador.
 * @returns {boolean} - Retorna true se a mensagem deve ser enviada.
 */
function shouldSendRejection(jid) {
    const now = Date.now();
    const lastSent = rejectionLog[jid];
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // Se nunca foi enviado ou se já passou mais de 24 horas
    if (!lastSent || (now - lastSent > oneDayInMs)) {
        return true;
    }
    return false;
}

/**
 * Regista que uma mensagem de aviso foi enviada para um utilizador.
 * @param {string} jid - O JID do utilizador.
 */
function recordRejectionSent(jid) {
    rejectionLog[jid] = Date.now();
    saveLog();
}

module.exports = {
    loadLog,
    shouldSendRejection,
    recordRejectionSent
};
