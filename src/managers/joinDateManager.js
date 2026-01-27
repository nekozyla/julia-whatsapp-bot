const fs = require('fs');
const path = require('path');

const JOIN_DATES_FILE = path.join(__dirname, '../../data/join_dates.json');

class JoinDateManager {
    constructor() {
        this.joinDates = {};
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(JOIN_DATES_FILE)) {
                const data = fs.readFileSync(JOIN_DATES_FILE, 'utf8');
                this.joinDates = JSON.parse(data);
            } else {
                this.joinDates = {};
                this.saveData();
            }
        } catch (error) {
            console.error('[JoinDateManager] Erro ao carregar dados:', error);
            this.joinDates = {};
        }
    }

    saveData() {
        try {
            fs.mkdirSync(path.dirname(JOIN_DATES_FILE), { recursive: true });
            fs.writeFileSync(JOIN_DATES_FILE, JSON.stringify(this.joinDates, null, 2));
        } catch (error) {
            console.error('[JoinDateManager] Erro ao salvar dados:', error);
        }
    }

    setJoinDate(groupJid, userJid, timestamp) {
        if (!this.joinDates[groupJid]) {
            this.joinDates[groupJid] = {};
        }
        
        if (!this.joinDates[groupJid][userJid]) {
            this.joinDates[groupJid][userJid] = timestamp;
            this.saveData();
        }
    }

    getJoinDate(groupJid, userJid) {
        if (this.joinDates[groupJid] && this.joinDates[groupJid][userJid]) {
            return this.joinDates[groupJid][userJid];
        }
        return null;
    }

    
    async ensureJoinDate(groupJid, userJid, sock) {
        
        let stored = this.getJoinDate(groupJid, userJid);
        if (stored) return stored;

        
        
        
        
        
        return null;
    }
}

module.exports = new JoinDateManager();
