const fs = require('fs').promises;
const path = require('path');

const countsFilePath = path.join(__dirname, '..', '..', 'data', 'message_counts.json');
let messageCounts = {}; 


async function loadCounts() {
    try {
        await fs.mkdir(path.dirname(countsFilePath), { recursive: true });
        const data = await fs.readFile(countsFilePath, 'utf-8');
        messageCounts = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            messageCounts = {};
        } else {
            console.error('[RankManager] Error loading message counts:', error);
        }
    }
}


async function saveCounts() {
    try {
        await fs.writeFile(countsFilePath, JSON.stringify(messageCounts, null, 2));
    } catch (error) {
        console.error('[RankManager] Error saving message counts:', error);
    }
}


loadCounts();

module.exports = {
    
    incrementCount: (groupJid, userJid) => {
        if (!messageCounts[groupJid]) {
            messageCounts[groupJid] = {};
        }
        if (!messageCounts[groupJid][userJid]) {
            messageCounts[groupJid][userJid] = 0;
        }
        messageCounts[groupJid][userJid]++;

        
        if (messageCounts[groupJid][userJid] % 10 === 0) {
            saveCounts();
        }
    },

    
    getCount: (groupJid, userJid) => {
        return messageCounts[groupJid]?.[userJid] || 0;
    },

    
    getRankInfo: (groupJid, userJid) => {
        if (!messageCounts[groupJid]) return null;

        const groupCounts = messageCounts[groupJid];
        
        const sortedUsers = Object.entries(groupCounts)
            .sort(([, a], [, b]) => b - a);

        const index = sortedUsers.findIndex(([jid]) => jid === userJid);

        if (index === -1) return { rank: 0, total: sortedUsers.length };

        return {
            rank: index + 1,
            total: sortedUsers.length
        };
    },

    
    getTopUsers: (groupJid, limit = 10) => {
        if (!messageCounts[groupJid]) return [];
        return Object.entries(messageCounts[groupJid])
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([jid, count]) => ({ jid, count }));
    },

    
    resetGroupCounts: async (groupJid) => {
        if (messageCounts[groupJid]) {
            messageCounts[groupJid] = {};
            await saveCounts();
        }
    },

    
    initGroup: async (groupJid) => {
        if (!messageCounts[groupJid]) {
            messageCounts[groupJid] = {};
            await saveCounts();
        }
    }
};
