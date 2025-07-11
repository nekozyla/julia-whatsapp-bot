// spamManager.js

// --- CONFIGURAÇÕES DO ANTISPAM (AJUSTE SE NECESSÁRIO) ---
const MAX_REQUESTS = 5; // Máximo de solicitações permitidas...
const TIME_WINDOW_SECONDS = 10; // ...dentro desta janela de tempo (em segundos).
// -------------------------------------------------------------

const userRequests = new Map();

/**
 * Registra uma nova solicitação de um usuário e verifica se ele está fazendo spam.
 * @param {string} jid - O JID do usuário.
 * @returns {boolean} - Retorna true se o usuário for detectado como spammer, caso contrário, false.
 */
function recordRequest(jid) {
    const now = Date.now();
    
    // Se o usuário não está no nosso mapa, o adicionamos
    if (!userRequests.has(jid)) {
        userRequests.set(jid, []);
    }

    const timestamps = userRequests.get(jid);
    
    // Remove os timestamps que são mais antigos que a nossa janela de tempo
    const relevantTimestamps = timestamps.filter(ts => now - ts < TIME_WINDOW_SECONDS * 1000);
    
    // Adiciona o novo timestamp
    relevantTimestamps.push(now);
    
    // Atualiza o mapa com os timestamps recentes
    userRequests.set(jid, relevantTimestamps);

    // Se o número de solicitações recentes ultrapassar o limite, é spam!
    if (relevantTimestamps.length > MAX_REQUESTS) {
        console.warn(`[Spam Detector] Usuário ${jid} detectado como spammer!`);
        return true; // É spam
    }

    return false; // Não é spam
}

// Limpa o mapa de usuários periodicamente para não consumir memória
setInterval(() => {
    const now = Date.now();
    for (const [jid, timestamps] of userRequests.entries()) {
        if (now - timestamps[timestamps.length - 1] > (TIME_WINDOW_SECONDS * 1000 * 5)) {
            userRequests.delete(jid);
        }
    }
}, 5 * 60 * 1000); // Roda a cada 5 minutos

module.exports = { recordRequest };
