const contactManager = require('./contactManager');

class FightManager {
    constructor() {
        this.activeMatches = {}; 
    }

    createMatch(groupJid, challenger, challenged) {
        if (this.activeMatches[groupJid]) {
            return { success: false, message: 'Já existe uma luta ou desafio acontecendo neste grupo!' };
        }

        this.activeMatches[groupJid] = {
            p1: challenger,
            p2: challenged,

            status: 'pending',
            startTime: Date.now()
        };

        
        setTimeout(() => {
            if (this.activeMatches[groupJid]?.status === 'pending') {
                delete this.activeMatches[groupJid];
            }
        }, 60000);

        return { success: true };
    }

    acceptMatch(groupJid, userJid) {
        const match = this.activeMatches[groupJid];
        if (!match || match.status !== 'pending') return { success: false, message: 'Nenhum desafio pendente.' };
        if (match.p2 !== userJid) return { success: false, message: 'Este desafio não é para você!' };

        match.status = 'preparing';
        match.startTime = Date.now();

        
        return { success: true, p1: match.p1, p2: match.p2 };
    }



    getBuffMultipliers(jid) {
        return {
            critChance: 0.10, 
            dodgeChance: 0.05, 
            dmgMult: 1.0,
            def: 0
        };
    }

    simulateFight(groupJid) {
        const match = this.activeMatches[groupJid];
        if (!match) return null;

        match.status = 'fighting';

        let p1Stats = { hp: 100, jid: match.p1, name: contactManager.getNickname(match.p1) || match.p1.split('@')[0], ...this.getBuffMultipliers(match.p1) };
        let p2Stats = { hp: 100, jid: match.p2, name: contactManager.getNickname(match.p2) || match.p2.split('@')[0], ...this.getBuffMultipliers(match.p2) };

        const logs = [];
        let winner = null;
        let loser = null;
        let turn = 0;

        
        let attacker = Math.random() < 0.5 ? p1Stats : p2Stats;
        let defender = attacker === p1Stats ? p2Stats : p1Stats;

        while (p1Stats.hp > 0 && p2Stats.hp > 0 && turn < 20) {
            turn++;

            
            if (Math.random() < defender.dodgeChance) {
                logs.push(`💨 *${defender.name}* esquivou do ataque de *${attacker.name}*!`);
            } else {
                
                let baseDmg = Math.floor(Math.random() * 11) + 10; 
                let isCrit = Math.random() < attacker.critChance;
                let damage = Math.floor(baseDmg * attacker.dmgMult * (isCrit ? 2.0 : 1.0));

                defender.hp -= damage;
                logs.push(`${isCrit ? '💥 *CRÍTICO!* ' : '⚔️ '}*${attacker.name}* causou ${damage} de dano em *${defender.name}*! (${Math.max(0, defender.hp)} HP)`);
            }

            
            let temp = attacker;
            attacker = defender;
            defender = temp;
        }

        if (p1Stats.hp <= 0) { winner = match.p2; loser = match.p1; }
        else if (p2Stats.hp <= 0) { winner = match.p1; loser = match.p2; }
        else {
            
            if (p1Stats.hp > p2Stats.hp) { winner = match.p1; loser = match.p2; }
            else { winner = match.p2; loser = match.p1; }
            logs.push('⏱️ O tempo acabou! Juízes decidiram o vencedor.');
        }

        const winnerName = contactManager.getNickname(winner) || winner.split('@')[0];
        logs.push(`🏆 *VENCEDOR:* ${winnerName}!`);

        return { logs, winner };
    }
}

module.exports = new FightManager();
