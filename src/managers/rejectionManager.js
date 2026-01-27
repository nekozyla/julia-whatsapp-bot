
const fs = require('fs');
const path = require('path');

const REJECTION_LOG_FILE = path.join(__dirname, '..', '..', 'data', 'rejection_log.json');
let rejectionLog = {}; 


function loadLog() {
    try {
        if (fs.existsSync(REJECTION_LOG_FILE)) {
            const data = fs.readFileSync(REJECTION_LOG_FILE, 'utf-8');
            rejectionLog = JSON.parse(data);
            
        } else {
            
        }
    } catch (error) {
        console.error('[RejectionManager] Erro ao carregar o log de avisos:', error);
    }
}


function saveLog() {
    try {
        fs.writeFileSync(REJECTION_LOG_FILE, JSON.stringify(rejectionLog, null, 2));
    } catch (error) {
        console.error('[RejectionManager] Erro ao salvar o log de avisos:', error);
    }
}


function shouldSendRejection(jid) {
    const now = Date.now();
    const lastSent = rejectionLog[jid];
    const oneDayInMs = 24 * 60 * 60 * 1000;

    
    if (!lastSent || (now - lastSent > oneDayInMs)) {
        return true;
    }
    return false;
}


function recordRejectionSent(jid) {
    rejectionLog[jid] = Date.now();
    saveLog();
}

module.exports = {
    loadLog,
    shouldSendRejection,
    recordRejectionSent
};
