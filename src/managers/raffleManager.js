

class RaffleManager {
    constructor() {
        this.activeRaffles = new Map();
    }

    
    createRaffle(groupId, creatorJid) {
        if (this.activeRaffles.has(groupId)) {
            return false;
        }
        this.activeRaffles.set(groupId, {
            creator: creatorJid,
            participants: new Set(),
            startTime: Date.now()
        });
        return true;
    }

    
    addParticipant(groupId, participantJid) {
        const raffle = this.activeRaffles.get(groupId);
        if (!raffle) {
            return { success: false, message: 'Não há nenhum sorteio ativo neste grupo.' };
        }
        if (raffle.participants.has(participantJid)) {
            return { success: false, message: 'Você já está participando do sorteio!' };
        }
        raffle.participants.add(participantJid);
        return { success: true, message: 'Você entrou no sorteio com sucesso!' };
    }

    
    endRaffle(groupId, requesterJid) {
        const raffle = this.activeRaffles.get(groupId);
        if (!raffle) {
            return { success: false, message: 'Não há sorteio ativo para finalizar.' };
        }

        
        
        
        

        if (raffle.participants.size === 0) {
            this.activeRaffles.delete(groupId);
            return { success: false, message: 'O sorteio foi cancelado pois ninguém participou.' };
        }

        const participantsArray = Array.from(raffle.participants);
        const winner = participantsArray[Math.floor(Math.random() * participantsArray.length)];

        this.activeRaffles.delete(groupId);
        return { success: true, winner, participantCount: participantsArray.length };
    }

    
    hasActiveRaffle(groupId) {
        return this.activeRaffles.has(groupId);
    }

    
    getRaffle(groupId) {
        return this.activeRaffles.get(groupId);
    }
}

module.exports = new RaffleManager();
