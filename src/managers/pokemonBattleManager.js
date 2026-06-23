// ═══════════════════════════════════════════════════════════
//  ⚡ Pokémon Battle Manager — Sistema de batalhas Gen 1
// ═══════════════════════════════════════════════════════════

const pokeApiService = require('../services/pokeApiPokemonService');
const { TYPE_EMOJI } = require('../services/pokeApiPokemonService');
const fs = require('fs').promises;
const path = require('path');

const LEVEL = 50;
const MAX_TEAM_SIZE = 6;
const MAX_LEGENDARIES = 1;

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TEAMS_FILE = path.join(DATA_DIR, 'pokemon_teams.json');

class PokemonBattleManager {
    constructor() {
        this.teams = new Map();       // playerJid -> { pokemon: [...], ready: bool }
        this.challenges = new Map();  // groupJid -> { challenger, target, timestamp }
        this.battles = new Map();     // groupJid -> battleState
        this.initialized = false;
        this._loadTeams();
    }

    // ── PERSISTÊNCIA ──
    async _loadTeams() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const raw = await fs.readFile(TEAMS_FILE, 'utf-8');
            const data = JSON.parse(raw);
            for (const [jid, team] of Object.entries(data)) {
                this.teams.set(jid, team);
            }
            console.log(`[Pokemon] ${this.teams.size} times carregados do disco.`);
        } catch {
            // File doesn't exist yet, that's fine
        }
    }

    async _saveTeams() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const obj = Object.fromEntries(this.teams);
            await fs.writeFile(TEAMS_FILE, JSON.stringify(obj, null, 2));
        } catch (e) {
            console.error('[Pokemon] Erro ao salvar times:', e);
        }
    }

    async ensureInitialized() {
        if (this.initialized) return;
        await pokeApiService.ensureInitialized();
        this.initialized = true;
    }

    // ═══════════════════════════════════════════════════════
    //  📋 TEAM BUILDING
    // ═══════════════════════════════════════════════════════

    createTeam(playerJid) {
        this.teams.set(playerJid, { pokemon: [], ready: false });
        this._saveTeams();
        return { success: true, message: 'Time criado! Use /pokemon add <nome> para adicionar Pokémon.' };
    }

    getTeam(playerJid) {
        return this.teams.get(playerJid);
    }

    async addToTeam(playerJid, pokemonName) {
        const team = this.teams.get(playerJid);
        if (!team) return { success: false, message: 'Você não tem um time. Use /pokemon novo primeiro.' };
        if (team.ready) return { success: false, message: 'Seu time já está pronto. Use /pokemon novo para resetar.' };
        if (team.pokemon.length >= MAX_TEAM_SIZE) return { success: false, message: `Seu time já tem ${MAX_TEAM_SIZE} Pokémon. Remova algum com /pokemon remover <slot>.` };

        await this.ensureInitialized();
        const pkm = await pokeApiService.findPokemon(pokemonName);
        if (!pkm) return { success: false, message: `Pokémon "${pokemonName}" não encontrado. Use /pokemon pokedex para ver a lista.` };

        // Check duplicates
        if (team.pokemon.some(p => p.id === pkm.id)) {
            return { success: false, message: `Você já tem ${pkm.name} no time!` };
        }

        // Check legendary limit
        if (pkm.legendary) {
            const legendaryCount = team.pokemon.filter(p => p.legendary).length;
            if (legendaryCount >= MAX_LEGENDARIES) {
                return { success: false, message: `Limite de ${MAX_LEGENDARIES} Pokémon lendário por time!` };
            }
        }

        team.pokemon.push({
            ...pkm,
            selectedMoves: null,
            selectedMoveData: null
        });

        this._saveTeams();
        return { success: true, message: `${pkm.name} adicionado ao time! (${team.pokemon.length}/${MAX_TEAM_SIZE})`, pokemon: pkm };
    }

    removeFromTeam(playerJid, slot) {
        const team = this.teams.get(playerJid);
        if (!team) return { success: false, message: 'Você não tem um time.' };
        if (team.ready) return { success: false, message: 'Seu time já está pronto. Use /pokemon novo para resetar.' };

        const idx = slot - 1;
        if (idx < 0 || idx >= team.pokemon.length) return { success: false, message: 'Slot inválido.' };

        const removed = team.pokemon.splice(idx, 1)[0];
        this._saveTeams();
        return { success: true, message: `${removed.name} removido do time.` };
    }

    async setMoves(playerJid, slot, moveNames) {
        const team = this.teams.get(playerJid);
        if (!team) return { success: false, message: 'Você não tem um time.' };

        const idx = slot - 1;
        if (idx < 0 || idx >= team.pokemon.length) return { success: false, message: 'Slot inválido.' };

        const pkm = team.pokemon[idx];
        const selectedMoves = [];
        const errors = [];

        for (const moveName of moveNames) {
            const normalized = moveName.trim();
            // Find the move in the Pokémon's learnable moves (case insensitive)
            const found = pkm.moves.find(m => m.toLowerCase() === normalized.toLowerCase());
            if (!found) {
                errors.push(`"${normalized}" não está disponível para ${pkm.name}`);
                continue;
            }
            const moveData = await pokeApiService.getMoveData(found);
            if (!moveData) {
                errors.push(`Golpe "${found}" não encontrado no banco de dados`);
                continue;
            }
            if (selectedMoves.some(m => m === found)) {
                errors.push(`"${found}" já foi selecionado`);
                continue;
            }
            selectedMoves.push(found);
        }

        if (selectedMoves.length === 0) {
            return { success: false, message: `Nenhum golpe válido. Erros: ${errors.join(', ')}` };
        }

        if (selectedMoves.length > 4) {
            return { success: false, message: 'Máximo de 4 golpes!' };
        }

        const selectedMoveData = [];
        for (const name of selectedMoves) {
            const data = await pokeApiService.getMoveData(name);
            if (data) selectedMoveData.push({ name, data });
        }

        pkm.selectedMoves = selectedMoves;
        pkm.selectedMoveData = selectedMoveData;
        this._saveTeams();
        return {
            success: true,
            message: `Golpes de ${pkm.name} definidos: ${selectedMoves.join(', ')}`,
            errors: errors.length > 0 ? errors : null
        };
    }

    async autoAssignMoves(pkm) {
        // Auto-assign 4 best moves: prioritize STAB, then highest power
        const scored = [];
        for (const name of pkm.moves) {
            const move = await pokeApiService.getMoveData(name);
            if (!move) continue;

            let score = move.pow || 0;
            if (pkm.types.includes(move.type)) score += 30;
            if (move.cat === 'status') {
                if (move.setStatus || move.boost) score = 50;
                else score = 30;
            }
            if (move.cat === 'physical' && pkm.stats[1] >= pkm.stats[3]) score += 10;
            if (move.cat === 'special' && pkm.stats[3] >= pkm.stats[1]) score += 10;

            scored.push({ name, data: move, score });
        }

        if (scored.length <= 4) {
            const selected = scored.map(s => s.name);
            pkm.selectedMoves = selected;
            pkm.selectedMoveData = scored.map(s => ({ name: s.name, data: s.data }));
            return selected;
        }

        scored.sort((a, b) => b.score - a.score);

        const picked = [];
        const selectedMoveData = [];
        for (const entry of scored) {
            if (picked.length >= 4) break;
            picked.push(entry.name);
            selectedMoveData.push({ name: entry.name, data: entry.data });
        }

        pkm.selectedMoves = picked;
        pkm.selectedMoveData = selectedMoveData;

        return picked;
    }

    async setReady(playerJid) {
        const team = this.teams.get(playerJid);
        if (!team) return { success: false, message: 'Você não tem um time.' };
        if (team.pokemon.length === 0) return { success: false, message: 'Seu time está vazio!' };

        // Auto-assign moves for any Pokémon that doesn't have them
        for (const pkm of team.pokemon) {
            if (!pkm.selectedMoves || pkm.selectedMoves.length === 0) {
                await this.autoAssignMoves(pkm);
            }
        }

        team.ready = true;
        this._saveTeams();
        return { success: true, message: 'Time pronto para batalha!' };
    }

    // ═══════════════════════════════════════════════════════
    //  ⚔️ CHALLENGE SYSTEM
    // ═══════════════════════════════════════════════════════

    challenge(groupJid, challengerJid, targetJid) {
        if (this.battles.has(groupJid)) {
            return { success: false, message: 'Já existe uma batalha ativa neste grupo!' };
        }
        if (this.challenges.has(groupJid)) {
            return { success: false, message: 'Já existe um desafio pendente neste grupo!' };
        }
        if (challengerJid === targetJid) {
            return { success: false, message: 'Você não pode desafiar a si mesmo!' };
        }

        const challengerTeam = this.teams.get(challengerJid);
        if (!challengerTeam || !challengerTeam.ready) {
            return { success: false, message: 'Você precisa montar e confirmar seu time primeiro! Use /pokemon novo' };
        }

        this.challenges.set(groupJid, {
            challenger: challengerJid,
            target: targetJid,
            timestamp: Date.now()
        });

        return { success: true };
    }

    acceptChallenge(groupJid, playerJid) {
        const challenge = this.challenges.get(groupJid);
        if (!challenge) return { success: false, message: 'Não há desafio pendente.' };
        if (challenge.target !== playerJid) return { success: false, message: 'Este desafio não é para você!' };

        const targetTeam = this.teams.get(playerJid);
        if (!targetTeam || !targetTeam.ready) {
            return { success: false, message: 'Você precisa montar e confirmar seu time primeiro! Use /pokemon novo' };
        }

        // Start the battle!
        const battle = this.createBattle(groupJid, challenge.challenger, playerJid);
        this.challenges.delete(groupJid);

        return { success: true, battle };
    }

    declineChallenge(groupJid, playerJid) {
        const challenge = this.challenges.get(groupJid);
        if (!challenge) return { success: false, message: 'Não há desafio pendente.' };
        if (challenge.target !== playerJid && challenge.challenger !== playerJid) {
            return { success: false, message: 'Você não faz parte deste desafio!' };
        }

        this.challenges.delete(groupJid);
        return { success: true };
    }

    // ═══════════════════════════════════════════════════════
    //  🎮 BATTLE SYSTEM
    // ═══════════════════════════════════════════════════════

    createBattle(groupJid, player1Jid, player2Jid) {
        const team1 = this.teams.get(player1Jid);
        const team2 = this.teams.get(player2Jid);

        const buildBattlePokemon = (teamData) => {
            return teamData.pokemon.map(pkm => {
                const level = pkm._level || LEVEL;
                const ivs = pkm._ivs || { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
                const evs = pkm._evs || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
                const nature = pkm._nature || 'Hardy';
                const maxHp = this.calcHP(pkm.stats[0], level, ivs.hp, evs.hp);
                return {
                    id: pkm.id,
                    name: pkm.name,
                    types: pkm.types,
                    stats: pkm.stats,
                    level,
                    ivs,
                    evs,
                    nature,
                    moves: (pkm.selectedMoveData || []).map(m => ({
                        name: m.name,
                        data: m.data,
                        ppLeft: m.data.pp
                    })),
                    maxHp,
                    currentHp: maxHp,
                    status: null,       // "burned", "paralyzed", "asleep", "frozen", "poisoned", "badly_poisoned"
                    statusTurns: 0,
                    boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, eva: 0 },
                    fainted: false,
                    seeded: false,
                    poisonCounter: 0   // For badly poisoned
                };
            });
        };

        const battle = {
            players: [player1Jid, player2Jid],
            teams: {
                [player1Jid]: buildBattlePokemon(team1),
                [player2Jid]: buildBattlePokemon(team2)
            },
            active: {
                [player1Jid]: 0,
                [player2Jid]: 0
            },
            actions: {
                [player1Jid]: null,
                [player2Jid]: null
            },
            turn: 1,
            status: 'active',
            log: [],
            forcedSwitch: null  // playerJid that must switch
        };

        this.battles.set(groupJid, battle);
        return battle;
    }

    getBattle(groupJid) {
        return this.battles.get(groupJid);
    }

    getActivePokemon(battle, playerJid) {
        const idx = battle.active[playerJid];
        return battle.teams[playerJid][idx];
    }

    // ── STAT CALCULATIONS (supports IV, EV, Nature, Level) ──

    // Nature modifiers lookup
    static NATURE_MODIFIERS = {
        Hardy: {}, Docile: {}, Serious: {}, Bashful: {}, Quirky: {},
        Lonely: { atk: 1.1, def: 0.9 }, Brave: { atk: 1.1, spe: 0.9 },
        Adamant: { atk: 1.1, spa: 0.9 }, Naughty: { atk: 1.1, spd: 0.9 },
        Bold: { def: 1.1, atk: 0.9 }, Relaxed: { def: 1.1, spe: 0.9 },
        Impish: { def: 1.1, spa: 0.9 }, Lax: { def: 1.1, spd: 0.9 },
        Timid: { spe: 1.1, atk: 0.9 }, Hasty: { spe: 1.1, def: 0.9 },
        Jolly: { spe: 1.1, spa: 0.9 }, Naive: { spe: 1.1, spd: 0.9 },
        Modest: { spa: 1.1, atk: 0.9 }, Mild: { spa: 1.1, def: 0.9 },
        Quiet: { spa: 1.1, spe: 0.9 }, Rash: { spa: 1.1, spd: 0.9 },
        Calm: { spd: 1.1, atk: 0.9 }, Gentle: { spd: 1.1, def: 0.9 },
        Sassy: { spd: 1.1, spe: 0.9 }, Careful: { spd: 1.1, spa: 0.9 }
    };

    calcHP(base, level = LEVEL, iv = 31, ev = 0) {
        return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    }

    calcStat(base, level = LEVEL, iv = 31, ev = 0, natureMod = 1) {
        return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5) * natureMod);
    }

    getEffectiveStat(pkm, statName) {
        const statIdx = { atk: 1, def: 2, spa: 3, spd: 4, spe: 5 }[statName];
        const level = pkm.level || LEVEL;
        const iv = pkm.ivs ? (pkm.ivs[statName] ?? 31) : 31;
        const ev = pkm.evs ? (pkm.evs[statName] ?? 0) : 0;
        const natureMods = PokemonBattleManager.NATURE_MODIFIERS[pkm.nature || 'Hardy'] || {};
        const natureMod = natureMods[statName] || 1;

        const base = this.calcStat(pkm.stats[statIdx], level, iv, ev, natureMod);
        const boost = pkm.boosts[statName] || 0;
        
        let multiplier;
        if (boost >= 0) multiplier = (2 + boost) / 2;
        else multiplier = 2 / (2 - boost);
        
        let value = Math.floor(base * multiplier);

        // Status modifiers
        if (statName === 'atk' && pkm.status === 'burned') value = Math.floor(value * 0.5);
        if (statName === 'spe' && pkm.status === 'paralyzed') value = Math.floor(value * 0.5);

        return Math.max(1, value);
    }

    // ── SUBMIT ACTION ──
    submitAction(groupJid, playerJid, action) {
        const battle = this.battles.get(groupJid);
        if (!battle || battle.status !== 'active') return { success: false, message: 'Não há batalha ativa.' };
        if (!battle.players.includes(playerJid)) return { success: false, message: 'Você não está nesta batalha!' };

        // If forced switch, only allow switch
        if (battle.forcedSwitch === playerJid) {
            if (action.type !== 'switch') {
                return { success: false, message: 'Seu Pokémon desmaiou! Você precisa trocar. Use /pokemon trocar <slot>' };
            }
        }

        const activePkm = this.getActivePokemon(battle, playerJid);

        if (action.type === 'move') {
            if (activePkm.fainted) return { success: false, message: 'Seu Pokémon está desmaiado! Troque!' };
            
            const moveIdx = action.moveIndex;
            if (moveIdx < 0 || moveIdx >= activePkm.moves.length) return { success: false, message: 'Golpe inválido!' };
            
            const move = activePkm.moves[moveIdx];
            if (move.ppLeft <= 0) return { success: false, message: `${move.name} não tem mais PP!` };

            battle.actions[playerJid] = { type: 'move', moveIndex: moveIdx };
        } else if (action.type === 'switch') {
            const slot = action.slot;
            const team = battle.teams[playerJid];
            if (slot < 0 || slot >= team.length) return { success: false, message: 'Slot inválido!' };
            if (team[slot].fainted) return { success: false, message: 'Esse Pokémon está desmaiado!' };
            if (slot === battle.active[playerJid]) return { success: false, message: 'Esse Pokémon já está em campo!' };

            battle.actions[playerJid] = { type: 'switch', slot };
        } else {
            return { success: false, message: 'Ação inválida.' };
        }

        // Check if both players have acted
        const otherPlayer = battle.players.find(p => p !== playerJid);

        // If forced switch, resolve immediately
        if (battle.forcedSwitch === playerJid) {
            battle.active[playerJid] = action.slot;
            const newPkm = this.getActivePokemon(battle, playerJid);
            battle.forcedSwitch = null;
            battle.actions[playerJid] = null;
            return {
                success: true,
                resolved: true,
                switchOnly: true,
                log: [`🔄 ${newPkm.name} entrou em campo!`],
                battle
            };
        }

        if (battle.actions[otherPlayer]) {
            // Both have acted — resolve the turn
            const result = this.resolveTurn(groupJid);
            return { success: true, resolved: true, ...result };
        }

        return { success: true, resolved: false, message: '✅ Ação registrada! Aguardando o oponente...' };
    }

    // ── RESOLVE TURN ──
    resolveTurn(groupJid) {
        const battle = this.battles.get(groupJid);
        const [p1, p2] = battle.players;
        const a1 = battle.actions[p1];
        const a2 = battle.actions[p2];
        const log = [];

        log.push(`\n┏━━❪ ⚔️ 𝗧𝗨𝗥𝗡𝗢 ${battle.turn} ❫━━`);

        // Determine order: switches first, then by speed (with priority)
        const order = this.determineOrder(battle, p1, a1, p2, a2);

        for (const { player, action } of order) {
            const opponent = player === p1 ? p2 : p1;
            
            if (action.type === 'switch') {
                const oldPkm = this.getActivePokemon(battle, player);
                battle.active[player] = action.slot;
                const newPkm = this.getActivePokemon(battle, player);
                log.push(`┃ 🔄 ${oldPkm.name} voltou! ${newPkm.name} entrou em campo!`);
            } else if (action.type === 'move') {
                const attacker = this.getActivePokemon(battle, player);
                const defender = this.getActivePokemon(battle, opponent);
                
                if (attacker.fainted) continue;

                // Check status preventing action
                const statusCheck = this.checkStatusBeforeMove(attacker);
                if (statusCheck.prevented) {
                    log.push(`┃ ${statusCheck.message}`);
                    continue;
                }
                if (statusCheck.message) log.push(`┃ ${statusCheck.message}`);

                const move = attacker.moves[action.moveIndex];
                const moveData = move.data;
                move.ppLeft--;

                log.push(`┃ ${attacker.name} usou *${move.name}*!`);

                if (moveData.cat === 'status') {
                    const statusResult = this.applyStatusMove(attacker, defender, move.name, moveData);
                    log.push(...statusResult.map(m => `┃ ${m}`));
                } else {
                    // Check accuracy
                    const accRoll = Math.random() * 100;
                    const accuracy = moveData.acc >= 999 ? 999 : moveData.acc;
                    if (accRoll >= accuracy) {
                        log.push(`┃ ❌ Mas errou!`);
                        if (moveData.crashDamage) {
                            const crashDmg = Math.floor(attacker.maxHp * moveData.crashDamage);
                            attacker.currentHp = Math.max(0, attacker.currentHp - crashDmg);
                            log.push(`┃ 💥 ${attacker.name} se machucou na queda! (-${crashDmg} HP)`);
                        }
                    } else {
                        const result = this.calculateDamage(attacker, defender, moveData);
                        
                        if (moveData.fixedDamage) {
                            const fixedDmg = moveData.fixedDamage;
                            defender.currentHp = Math.max(0, defender.currentHp - fixedDmg);
                            log.push(`┃ 💥 Causou *${fixedDmg}* de dano!`);
                        } else if (moveData.multiHit) {
                            const [min, max] = moveData.multiHit;
                            const hits = min === max ? min : (Math.floor(Math.random() * (max - min + 1)) + min);
                            let totalDmg = 0;
                            for (let i = 0; i < hits; i++) {
                                const hitResult = this.calculateDamage(attacker, defender, moveData);
                                totalDmg += hitResult.damage;
                            }
                            defender.currentHp = Math.max(0, defender.currentHp - totalDmg);
                            log.push(`┃ 💥 Acertou *${hits} vezes*! Total: *${totalDmg}* de dano!`);
                            if (result.effectiveness > 1) log.push(`┃ ✨ É super efetivo!`);
                            else if (result.effectiveness < 1 && result.effectiveness > 0) log.push(`┃ 😐 Não é muito efetivo...`);
                            else if (result.effectiveness === 0) log.push(`┃ ❌ Não afeta ${defender.name}!`);
                        } else {
                            defender.currentHp = Math.max(0, defender.currentHp - result.damage);
                            
                            if (result.effectiveness === 0) {
                                log.push(`┃ ❌ Não afeta ${defender.name}!`);
                            } else {
                                if (result.effectiveness > 1) log.push(`┃ ✨ É super efetivo!`);
                                else if (result.effectiveness < 1) log.push(`┃ 😐 Não é muito efetivo...`);
                                if (result.critical) log.push(`┃ 🎯 Golpe crítico!`);
                                log.push(`┃ 💥 Causou *${result.damage}* de dano!`);

                                // Recoil
                                if (moveData.recoil) {
                                    const recoilDmg = Math.floor(result.damage * moveData.recoil);
                                    attacker.currentHp = Math.max(0, attacker.currentHp - recoilDmg);
                                    log.push(`┃ 💫 ${attacker.name} sofreu ${recoilDmg} de recuo!`);
                                }

                                // Drain
                                if (moveData.drain) {
                                    const healAmt = Math.floor(result.damage * moveData.drain);
                                    attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
                                    log.push(`┃ 💚 ${attacker.name} recuperou ${healAmt} HP!`);
                                }

                                // Status effect chance
                                this.applySecondaryEffect(attacker, defender, moveData, log);
                            }
                        }

                        // Self-destruct
                        if (moveData.selfDestruct) {
                            attacker.currentHp = 0;
                            log.push(`┃ 💀 ${attacker.name} explodiu!`);
                        }

                        // Self debuff
                        if (moveData.selfDebuff) {
                            for (const [stat, stages] of Object.entries(moveData.selfDebuff)) {
                                attacker.boosts[stat] = Math.max(-6, attacker.boosts[stat] + stages);
                            }
                            const statNames = { atk: 'Ataque', def: 'Defesa', spa: 'Sp.Atk', spd: 'Sp.Def', spe: 'Velocidade' };
                            const debuffs = Object.entries(moveData.selfDebuff).map(([s, v]) => `${statNames[s]} ${v}`).join(', ');
                            log.push(`┃ 📉 ${attacker.name}: ${debuffs}`);
                        }
                    }
                }

                // Check fainted
                if (defender.currentHp <= 0) {
                    defender.currentHp = 0;
                    defender.fainted = true;
                    log.push(`┃ ☠️ ${defender.name} desmaiou!`);
                }
                if (attacker.currentHp <= 0) {
                    attacker.currentHp = 0;
                    attacker.fainted = true;
                    if (!moveData.selfDestruct) log.push(`┃ ☠️ ${attacker.name} desmaiou!`);
                }
            }
        }

        // End-of-turn effects
        for (const player of battle.players) {
            const pkm = this.getActivePokemon(battle, player);
            if (pkm.fainted) continue;

            // Burn damage
            if (pkm.status === 'burned') {
                const burnDmg = Math.floor(pkm.maxHp / 16);
                pkm.currentHp = Math.max(0, pkm.currentHp - burnDmg);
                log.push(`┃ 🔥 ${pkm.name} sofreu ${burnDmg} de queimadura!`);
            }

            // Poison damage
            if (pkm.status === 'poisoned') {
                const poisonDmg = Math.floor(pkm.maxHp / 8);
                pkm.currentHp = Math.max(0, pkm.currentHp - poisonDmg);
                log.push(`┃ ☠️ ${pkm.name} sofreu ${poisonDmg} de veneno!`);
            }

            // Badly poisoned
            if (pkm.status === 'badly_poisoned') {
                pkm.poisonCounter++;
                const poisonDmg = Math.floor(pkm.maxHp * pkm.poisonCounter / 16);
                pkm.currentHp = Math.max(0, pkm.currentHp - poisonDmg);
                log.push(`┃ ☠️ ${pkm.name} sofreu ${poisonDmg} de veneno tóxico!`);
            }

            // Leech Seed
            if (pkm.seeded) {
                const seedDmg = Math.floor(pkm.maxHp / 8);
                const opponent = battle.players.find(p => p !== player);
                const oppPkm = this.getActivePokemon(battle, opponent);
                pkm.currentHp = Math.max(0, pkm.currentHp - seedDmg);
                if (!oppPkm.fainted) {
                    oppPkm.currentHp = Math.min(oppPkm.maxHp, oppPkm.currentHp + seedDmg);
                }
                log.push(`┃ 🌱 Leech Seed drenou ${seedDmg} HP de ${pkm.name}!`);
            }

            // Check fainted from end-of-turn
            if (pkm.currentHp <= 0) {
                pkm.currentHp = 0;
                pkm.fainted = true;
                log.push(`┃ ☠️ ${pkm.name} desmaiou!`);
            }
        }

        log.push(`┗━━━━━━━━━━━━━━`);

        // Reset actions
        battle.actions[p1] = null;
        battle.actions[p2] = null;
        battle.turn++;

        // Check for forced switches & game end
        let winner = null;
        let forcedSwitches = [];

        for (const player of battle.players) {
            const team = battle.teams[player];
            const activePkm = this.getActivePokemon(battle, player);
            
            if (activePkm.fainted) {
                const hasAlive = team.some(p => !p.fainted);
                if (!hasAlive) {
                    winner = battle.players.find(p => p !== player);
                } else {
                    forcedSwitches.push(player);
                }
            }
        }

        if (winner) {
            battle.status = 'finished';
            battle.winner = winner;
            this.battles.delete(groupJid);
            return { log, winner, battle };
        }

        if (forcedSwitches.length > 0) {
            battle.forcedSwitch = forcedSwitches[0];
            return { log, forcedSwitch: forcedSwitches, battle };
        }

        return { log, battle };
    }

    // ── DETERMINE ACTION ORDER ──
    determineOrder(battle, p1, a1, p2, a2) {
        const entries = [
            { player: p1, action: a1 },
            { player: p2, action: a2 }
        ];

        entries.sort((a, b) => {
            // Switches always go first
            if (a.action.type === 'switch' && b.action.type !== 'switch') return -1;
            if (b.action.type === 'switch' && a.action.type !== 'switch') return 1;
            if (a.action.type === 'switch' && b.action.type === 'switch') return 0;

            // Compare priority
            const aPriority = a.action.type === 'move' 
                ? (this.getActivePokemon(battle, a.player).moves[a.action.moveIndex]?.data?.priority || 0) 
                : 0;
            const bPriority = b.action.type === 'move' 
                ? (this.getActivePokemon(battle, b.player).moves[b.action.moveIndex]?.data?.priority || 0) 
                : 0;

            if (aPriority !== bPriority) return bPriority - aPriority;

            // Compare speed
            const aSpeed = this.getEffectiveStat(this.getActivePokemon(battle, a.player), 'spe');
            const bSpeed = this.getEffectiveStat(this.getActivePokemon(battle, b.player), 'spe');
            if (aSpeed !== bSpeed) return bSpeed - aSpeed;

            // Speed tie — random
            return Math.random() > 0.5 ? 1 : -1;
        });

        return entries;
    }

    // ── DAMAGE CALCULATION ──
    calculateDamage(attacker, defender, moveData) {
        if (moveData.fixedDamage) {
            return { damage: moveData.fixedDamage, effectiveness: 1, critical: false };
        }

        const effectiveness = pokeApiService.getEffectiveness(moveData.type, defender.types);
        if (effectiveness === 0) return { damage: 0, effectiveness: 0, critical: false };

        const isPhysical = moveData.cat === 'physical';
        const atkStat = isPhysical ? this.getEffectiveStat(attacker, 'atk') : this.getEffectiveStat(attacker, 'spa');
        const defStat = isPhysical ? this.getEffectiveStat(defender, 'def') : this.getEffectiveStat(defender, 'spd');

        // Critical hit
        const critChance = moveData.critRate ? moveData.critRate / 24 : 1 / 24;
        const critical = Math.random() < critChance;
        const critMult = critical ? 1.5 : 1;

        // STAB
        const stab = attacker.types.includes(moveData.type) ? 1.5 : 1;

        // Random factor (0.85 - 1.0)
        const random = 0.85 + Math.random() * 0.15;

        // Damage formula
        const level = attacker.level || LEVEL;
        const baseDamage = ((2 * level / 5 + 2) * moveData.pow * atkStat / defStat) / 50 + 2;
        const damage = Math.max(1, Math.floor(baseDamage * stab * effectiveness * critMult * random));

        return { damage, effectiveness, critical };
    }

    // ── STATUS CHECK BEFORE MOVE ──
    checkStatusBeforeMove(pkm) {
        if (pkm.status === 'asleep') {
            pkm.statusTurns--;
            if (pkm.statusTurns <= 0) {
                pkm.status = null;
                return { prevented: false, message: `😴 ${pkm.name} acordou!` };
            }
            return { prevented: true, message: `😴 ${pkm.name} está dormindo...` };
        }

        if (pkm.status === 'paralyzed') {
            if (Math.random() < 0.25) {
                return { prevented: true, message: `⚡ ${pkm.name} está paralisado e não conseguiu se mover!` };
            }
        }

        if (pkm.status === 'frozen') {
            if (Math.random() < 0.2) {
                pkm.status = null;
                return { prevented: false, message: `❄️ ${pkm.name} descongelou!` };
            }
            return { prevented: true, message: `❄️ ${pkm.name} está congelado!` };
        }

        return { prevented: false, message: null };
    }

    // ── APPLY STATUS MOVE ──
    applyStatusMove(attacker, defender, moveName, moveData) {
        const messages = [];

        // Accuracy check for status moves
        if (moveData.acc < 999) {
            if (Math.random() * 100 >= moveData.acc) {
                messages.push('❌ Mas errou!');
                return messages;
            }
        }

        // Heal
        if (moveData.heal) {
            const healAmt = Math.floor(attacker.maxHp * moveData.heal);
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
            messages.push(`💚 ${attacker.name} recuperou ${healAmt} HP!`);
        }

        // Full heal (Rest)
        if (moveData.fullHeal) {
            attacker.currentHp = attacker.maxHp;
            attacker.status = 'asleep';
            attacker.statusTurns = moveData.selfSleep || 2;
            messages.push(`💤 ${attacker.name} recuperou todo HP e adormeceu!`);
        }

        // Boost self
        if (moveData.boost) {
            for (const [stat, stages] of Object.entries(moveData.boost)) {
                attacker.boosts[stat] = Math.min(6, (attacker.boosts[stat] || 0) + stages);
            }
            const statNames = { atk: 'Ataque', def: 'Defesa', spa: 'Sp.Atk', spd: 'Sp.Def', spe: 'Velocidade', eva: 'Evasão' };
            const boosts = Object.entries(moveData.boost).map(([s, v]) => `${statNames[s]} +${v}`).join(', ');
            messages.push(`📈 ${attacker.name}: ${boosts}!`);
        }

        // Debuff opponent
        if (moveData.debuff) {
            for (const [stat, stages] of Object.entries(moveData.debuff)) {
                defender.boosts[stat] = Math.max(-6, (defender.boosts[stat] || 0) + stages);
            }
            const statNames = { atk: 'Ataque', def: 'Defesa', spa: 'Sp.Atk', spd: 'Sp.Def', spe: 'Velocidade' };
            const debuffs = Object.entries(moveData.debuff).map(([s, v]) => `${statNames[s]} ${v}`).join(', ');
            messages.push(`📉 ${defender.name}: ${debuffs}!`);
        }

        // Set status
        if (moveData.setStatus) {
            if (defender.status) {
                messages.push(`❌ ${defender.name} já tem uma condição de status!`);
            } else {
                defender.status = moveData.setStatus;
                if (moveData.setStatus === 'asleep') {
                    defender.statusTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
                    messages.push(`😴 ${defender.name} adormeceu!`);
                } else if (moveData.setStatus === 'paralyzed') {
                    messages.push(`⚡ ${defender.name} foi paralisado!`);
                } else if (moveData.setStatus === 'badly_poisoned') {
                    defender.poisonCounter = 0;
                    messages.push(`☠️ ${defender.name} foi gravemente envenenado!`);
                }
            }
        }

        // Leech Seed
        if (moveData.seed) {
            if (defender.seeded) {
                messages.push(`❌ ${defender.name} já está com Leech Seed!`);
            } else if (defender.types.includes('Grass')) {
                messages.push(`❌ Não afeta Pokémon tipo Planta!`);
            } else {
                defender.seeded = true;
                messages.push(`🌱 ${defender.name} foi plantado com Leech Seed!`);
            }
        }

        if (messages.length === 0) messages.push('Mas nada aconteceu...');
        return messages;
    }

    // ── APPLY SECONDARY EFFECTS (burn, freeze, etc.) ──
    applySecondaryEffect(attacker, defender, moveData, log) {
        if (defender.fainted || defender.status) return;

        if (moveData.burn && Math.random() * 100 < moveData.burn) {
            if (!defender.types.includes('Fire')) {
                defender.status = 'burned';
                log.push(`┃ 🔥 ${defender.name} foi queimado!`);
            }
        }
        if (moveData.freeze && Math.random() * 100 < moveData.freeze) {
            if (!defender.types.includes('Ice')) {
                defender.status = 'frozen';
                log.push(`┃ ❄️ ${defender.name} foi congelado!`);
            }
        }
        if (moveData.paralyze && Math.random() * 100 < moveData.paralyze) {
            if (!defender.types.includes('Electric')) {
                defender.status = 'paralyzed';
                log.push(`┃ ⚡ ${defender.name} foi paralisado!`);
            }
        }
        if (moveData.poison && Math.random() * 100 < moveData.poison) {
            if (!defender.types.includes('Poison') && !defender.types.includes('Steel')) {
                defender.status = 'poisoned';
                log.push(`┃ ☠️ ${defender.name} foi envenenado!`);
            }
        }
    }

    // ── FORFEIT ──
    forfeit(groupJid, playerJid) {
        const battle = this.battles.get(groupJid);
        if (!battle) return { success: false, message: 'Não há batalha ativa.' };
        if (!battle.players.includes(playerJid)) return { success: false, message: 'Você não está nesta batalha!' };

        const winner = battle.players.find(p => p !== playerJid);
        battle.status = 'finished';
        battle.winner = winner;
        this.battles.delete(groupJid);

        return { success: true, winner };
    }

    // ═══════════════════════════════════════════════════════
    //  📊 DISPLAY HELPERS
    // ═══════════════════════════════════════════════════════

    renderHP(current, max) {
        const pct = current / max;
        const bars = 10;
        const filled = Math.round(pct * bars);
        const empty = bars - filled;
        let color = '🟩';
        if (pct <= 0.25) color = '🟥';
        else if (pct <= 0.5) color = '🟨';
        return color.repeat(filled) + '⬜'.repeat(empty) + ` ${current}/${max}`;
    }

    renderBattleStatus(battle, groupJid) {
        const [p1, p2] = battle.players;
        const pkm1 = this.getActivePokemon(battle, p1);
        const pkm2 = this.getActivePokemon(battle, p2);

        const alive1 = battle.teams[p1].filter(p => !p.fainted).length;
        const alive2 = battle.teams[p2].filter(p => !p.fainted).length;

        const statusText = (pkm) => {
            if (pkm.status === 'burned') return '🔥QUE';
            if (pkm.status === 'paralyzed') return '⚡PAR';
            if (pkm.status === 'asleep') return '😴DOR';
            if (pkm.status === 'frozen') return '❄️CON';
            if (pkm.status === 'poisoned') return '☠️ENV';
            if (pkm.status === 'badly_poisoned') return '☠️TOX';
            return '✅OK';
        };

        const typeStr = (types) => types.map(t => `${TYPE_EMOJI[t] || ''}${t}`).join('/');

        let text = `┏━━❪ ⚔️ 𝗕𝗔𝗧𝗔𝗟𝗛𝗔 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 ❫━━\n`;
        text += `┃\n`;
        text += `┃ 🔴 @${p1.split('@')[0]} (${alive1}/${battle.teams[p1].length} vivos)\n`;
        text += `┃ ┌─ *${pkm1.name}* (${typeStr(pkm1.types)})\n`;
        text += `┃ │ HP: ${this.renderHP(pkm1.currentHp, pkm1.maxHp)}\n`;
        text += `┃ └─ Status: ${statusText(pkm1)}\n`;
        text += `┃\n`;
        text += `┃ 🔵 @${p2.split('@')[0]} (${alive2}/${battle.teams[p2].length} vivos)\n`;
        text += `┃ ┌─ *${pkm2.name}* (${typeStr(pkm2.types)})\n`;
        text += `┃ │ HP: ${this.renderHP(pkm2.currentHp, pkm2.maxHp)}\n`;
        text += `┃ └─ Status: ${statusText(pkm2)}\n`;
        text += `┃\n`;
        text += `┗━━━━━━━━━━━━━━`;

        return { text, mentions: [p1, p2] };
    }

    renderMoves(battle, playerJid) {
        const pkm = this.getActivePokemon(battle, playerJid);
        if (!pkm || pkm.fainted) return 'Seu Pokémon está desmaiado! Use /pokemon trocar <slot>';

        let text = `┏━━❪ 📋 𝗚𝗢𝗟𝗣𝗘𝗦 — ${pkm.name} ❫━━\n┃\n`;
        pkm.moves.forEach((move, i) => {
            const data = move.data;
            const typeEmoji = TYPE_EMOJI[data.type] || '';
            const catEmoji = data.cat === 'physical' ? '💪' : data.cat === 'special' ? '🌀' : '📊';
            const pow = data.pow > 0 ? data.pow : '—';
            const acc = data.acc >= 999 ? '∞' : data.acc;
            text += `┃ *${i + 1}.* ${typeEmoji} ${move.name}\n`;
            text += `┃    ${catEmoji} Poder: ${pow} | Precisão: ${acc} | PP: ${move.ppLeft}/${data.pp}\n`;
        });
        text += `┃\n┃ Use: /pokemon atk <1-${pkm.moves.length}>\n`;
        text += `┗━━━━━━━━━━━━━━`;
        return text;
    }

    renderTeamList(playerJid, battle = null) {
        const teamData = battle ? battle.teams[playerJid] : this.teams.get(playerJid)?.pokemon;
        if (!teamData) return 'Sem time.';

        let text = `┏━━❪ 📋 𝗦𝗘𝗨 𝗧𝗜𝗠𝗘 ❫━━\n┃\n`;
        teamData.forEach((pkm, i) => {
            const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${t}`).join('/');
            const activeMarker = battle && battle.active[playerJid] === i ? ' ⚔️' : '';
            const fainted = pkm.fainted ? ' ☠️' : '';
            const hp = battle ? ` | HP: ${pkm.currentHp}/${pkm.maxHp}` : '';
            text += `┃ *${i + 1}.* ${pkm.name} (${types})${activeMarker}${fainted}${hp}\n`;
            if (pkm.selectedMoves) {
                text += `┃    Golpes: ${pkm.selectedMoves.join(', ')}\n`;
            } else if (pkm.moves && pkm.moves[0]?.name) {
                text += `┃    Golpes: ${pkm.moves.map(m => m.name).join(', ')}\n`;
            }
        });
        text += `┃\n┗━━━━━━━━━━━━━━`;
        return text;
    }

    // ── RANDOM TEAM ──
    async generateRandomTeam(playerJid) {
        await this.ensureInitialized();
        this.createTeam(playerJid);
        const team = this.teams.get(playerJid);

        const allPokemon = await pokeApiService.getAllPokemon();
        const eligible = allPokemon.filter(p => {
            const total = p.stats.reduce((a, b) => a + b, 0);
            return total >= 300;
        });
        
        const shuffled = [...eligible].sort(() => Math.random() - 0.5);
        let legendaryAdded = false;
        
        for (const pkm of shuffled) {
            if (team.pokemon.length >= MAX_TEAM_SIZE) break;
            if (team.pokemon.some(p => p.id === pkm.id)) continue;
            if (pkm.legendary) {
                if (legendaryAdded) continue;
                legendaryAdded = true;
            }
            team.pokemon.push({
                ...pkm,
                selectedMoves: null,
                selectedMoveData: null
            });
        }

        // Auto-assign moves
        for (const pkm of team.pokemon) {
            await this.autoAssignMoves(pkm);
        }

        team.ready = true;
        this._saveTeams();
        return team;
    }

    // ── CLEANUP ──
    cleanupOldData() {
        const now = Date.now();
        const TIMEOUT = 30 * 60 * 1000; // 30 minutes

        for (const [key, challenge] of this.challenges) {
            if (now - challenge.timestamp > TIMEOUT) {
                this.challenges.delete(key);
            }
        }
    }
}

module.exports = new PokemonBattleManager();
