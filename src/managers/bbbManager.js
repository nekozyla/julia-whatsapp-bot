const fs = require('fs').promises;
const path = require('path');

const dataPath = path.join(__dirname, '..', '..', 'data', 'bbb_data.json');


const getInitialState = () => ({
    gameActive: false,
    registrationOpen: false,
    participants: [], 
    eliminated: [],   
    leader: null,     
    angel: null,      
    paredao: {
        active: false,
        nominees: [], 
        votes: {}     
    },
    history: []       
});

let gameData = getInitialState();

async function loadData() {
    try {
        await fs.mkdir(path.dirname(dataPath), { recursive: true });
        const data = await fs.readFile(dataPath, 'utf8');
        const loaded = JSON.parse(data);
        gameData = { ...getInitialState(), ...loaded }; 
    } catch (e) {
        gameData = getInitialState();
    }
}

async function saveData() {
    try {
        await fs.writeFile(dataPath, JSON.stringify(gameData, null, 2));
    } catch (e) {
        console.error('Error saving BBB data:', e);
    }
}


loadData();


const normalizeJid = (jid) => jid?.split(':')[0] || '';

module.exports = {
    getData: () => gameData,

    
    startGame: async () => {
        if (!gameData.registrationOpen && gameData.participants.length === 0) return { success: false, msg: 'Nenhum participante inscrito.' };
        gameData.gameActive = true;
        gameData.registrationOpen = false;
        await saveData();
        return { success: true };
    },

    openRegistration: async () => {
        if (gameData.gameActive) return { success: false, msg: 'Jogo já em andamento.' };
        gameData.registrationOpen = true;
        gameData.participants = [];
        gameData.eliminated = [];
        
        gameData.leader = null;
        gameData.angel = null;
        gameData.paredao = { active: false, nominees: [], votes: {} };
        await saveData();
        return { success: true };
    },

    resetGame: async () => {
        gameData = getInitialState();
        await saveData();
        return { success: true };
    },

    
    enrollUser: async (jid) => {
        if (!gameData.registrationOpen) return { success: false, msg: 'Inscrições fechadas.' };
        const userJid = normalizeJid(jid);
        if (gameData.participants.includes(userJid)) return { success: false, msg: 'Já inscrito.' };

        gameData.participants.push(userJid);
        await saveData();
        return { success: true, count: gameData.participants.length };
    },

    getParticipants: () => gameData.participants,

    
    setLeader: async (jid) => {
        const userJid = normalizeJid(jid);
        if (!gameData.participants.includes(userJid)) return { success: false, msg: 'Usuário não é participante.' };
        gameData.leader = userJid;
        await saveData();
        return { success: true };
    },

    setAngel: async (jid) => {
        const userJid = normalizeJid(jid);
        if (!gameData.participants.includes(userJid)) return { success: false, msg: 'Usuário não é participante.' };
        gameData.angel = userJid;
        await saveData();
        return { success: true };
    },

    
    createParedao: async (nomineeJids) => {
        if (!gameData.gameActive) return { success: false, msg: 'Jogo não iniciado.' };
        if (gameData.paredao.active) return { success: false, msg: 'Já existe um paredão ativo.' };

        
        const nominees = nomineeJids.map(normalizeJid);
        const invalid = nominees.filter(jid => !gameData.participants.includes(jid));
        if (invalid.length > 0) return { success: false, msg: 'Alguns indicados não são participantes.' };

        gameData.paredao = {
            active: true,
            nominees: nominees,
            votes: {}
        };
        await saveData();
        return { success: true };
    },

    vote: async (voterJid, targetJid) => {
        if (!gameData.paredao.active) return { success: false, msg: 'Nenhum paredão ativo.' };

        const voter = normalizeJid(voterJid);
        const target = normalizeJid(targetJid);

        
        if (!gameData.paredao.nominees.includes(target)) return { success: false, msg: 'Esse usuário não está no paredão.' };

        
        gameData.paredao.votes[voter] = target;
        await saveData();
        return { success: true };
    },

    getVoteCounts: () => {
        if (!gameData.paredao.active) return {};
        const counts = {};
        gameData.paredao.nominees.forEach(n => counts[n] = 0);

        Object.values(gameData.paredao.votes).forEach(target => {
            if (counts[target] !== undefined) counts[target]++;
        });
        return counts;
    },

    eliminate: async () => {
        if (!gameData.paredao.active) return { success: false, msg: 'Nenhum paredão ativo.' };

        const counts = module.exports.getVoteCounts();
        let maxVotes = -1;
        let eliminated = null;
        let draw = false;

        
        for (const [jid, count] of Object.entries(counts)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminated = jid;
                draw = false;
            } else if (count === maxVotes) {
                draw = true;
            }
        }

        if (draw) return { success: false, msg: 'Empate na votação! Decidam o desempate (ex: líder desempatar) ou votem mais.' };
        if (!eliminated) return { success: false, msg: 'Sem votos computados.' };

        
        gameData.participants = gameData.participants.filter(p => p !== eliminated);
        gameData.eliminated.push(eliminated);

        
        gameData.paredao = { active: false, nominees: [], votes: {} };
        
        gameData.leader = null;
        gameData.angel = null;

        await saveData();
        return { success: true, eliminatedJid: eliminated, votes: maxVotes };
    }
};
