const fs = require('fs').promises;
const path = require('path');

// ═══════════════════════════════════════════════════════════
//  ⚔️  D U E L O   M A N A G E R  —  RPG Battle System
// ═══════════════════════════════════════════════════════════

const STATS_FILE = path.join(__dirname, '..', '..', 'data', 'duelo_stats.json');
const GAMES_FILE = path.join(__dirname, '..', '..', 'data', 'duelo_games.json');

// ── Classes RPG ─────────────────────────────────────────
const CLASSES = {
    guerreiro: {
        name: 'Guerreiro', emoji: '🗡️',
        hp: 120, atk: 17, def: 13,
        special: { name: 'Fúria Berserker', desc: 'ATK +50% por 2 turnos', cooldown: 3 },
        lore: 'Forjado nas guerras antigas, cada cicatriz conta uma vitória.'
    },
    mago: {
        name: 'Mago', emoji: '🧙',
        hp: 95, atk: 23, def: 9,
        special: { name: 'Meteoro Arcano', desc: 'Dano massivo ignorando DEF', cooldown: 3 },
        lore: 'Domina as forças elementais. Sua mente é sua arma mais letal.'
    },
    arqueiro: {
        name: 'Arqueiro', emoji: '🏹',
        hp: 105, atk: 18, def: 12,
        special: { name: 'Chuva de Flechas', desc: '3 hits de 8-14 cada', cooldown: 3 },
        lore: 'Olhos de águia, mãos firmes. Nunca erra o alvo.'
    },
    paladino: {
        name: 'Paladino', emoji: '🛡️',
        hp: 140, atk: 12, def: 18,
        special: { name: 'Escudo Divino', desc: 'Bloqueia dano + cura 20 HP', cooldown: 3 },
        lore: 'Guardião sagrado. Sua fé é inquebrantável.'
    },
    assassino: {
        name: 'Assassino', emoji: '🥷',
        hp: 90, atk: 24, def: 7,
        special: { name: 'Execução Sombria', desc: 'Dano 2x se inimigo < 30% HP', cooldown: 3 },
        lore: 'Nas sombras, aguarda. Um golpe. É tudo o que precisa.'
    },
    dragao: {
        name: 'Dragão', emoji: '🐉',
        hp: 110, atk: 19, def: 12,
        special: { name: 'Sopro de Fogo', desc: 'Dano + burn (5/turno, 3 turnos)', cooldown: 3 },
        lore: 'A última criatura que você verá. Fogo e destruição.'
    },
    barbaro: {
        name: 'Bárbaro', emoji: '🪓',
        hp: 150, atk: 15, def: 8,
        special: { name: 'Sede de Sangue', desc: 'Ataque aumenta conforme perde HP (+30% a cada 10% de HP faltando)', cooldown: 3 },
        lore: 'A dor o alimenta. Quanto mais próximo da morte, mais brutal o golpe.'
    },
    clerigo: {
        name: 'Clérigo', emoji: '✝️',
        hp: 115, atk: 12, def: 15,
        special: { name: 'Milagre Curativo', desc: 'Cura 40 HP e remove Veneno, Bleed, Burn', cooldown: 3 },
        lore: 'Possui o dom da luz divina. Sua prioridade é sobreviver a qualquer custo.'
    },
    necromante: {
        name: 'Necromante', emoji: '🧟‍♂️',
        hp: 105, atk: 16, def: 13,
        special: { name: 'Almas Gêmeas', desc: 'Invoca servo que absorve 20 de dano do próximo ataque', cooldown: 3 },
        lore: 'Senhor dos mortos. Ele nunca luta sozinho nas trevas.'
    },
    tecnomago: {
        name: 'Tecnomago', emoji: '⚙️',
        hp: 110, atk: 17, def: 14,
        special: { name: 'Pulso Eletromagnético', desc: 'Dano + Silencia o inimigo por 2 turnos', cooldown: 4 },
        lore: 'A fusão perfeita entre magia e tecnologia. Desativa seus oponentes.'
    },
    scat: {
        name: 'Scat', emoji: '💩',
        hidden: true,
        hp: 130, atk: 10, def: 15,
        special: { name: 'Chuva de Bosta', desc: 'Dano de merda + Veneno Tóxico (6 dmg/t por 3t)', cooldown: 3 },
        lore: 'A classe mais fedida. Inimigos morrem só de inalar a essência desta aberração.'
    },
    calvo: {
        name: 'Calvo', emoji: '👨‍🦲',
        hidden: true,
        hp: 90, atk: 25, def: 5,
        special: { name: 'Brilho Ofuscante', desc: 'Reflete a luz do sol na careca, cegando o inimigo (100% miss)', cooldown: 4 },
        lore: 'Falta de cabelo convertida completamente em ódio e força física.'
    },
    femboy: {
        name: 'Femboy', emoji: '👗',
        hidden: true,
        hp: 105, atk: 16, def: 12,
        special: { name: 'Fofura Extrema', desc: 'Regenera 30 HP e silencia o inimigo (UwU)', cooldown: 3 },
        lore: 'Usa meias de programação. O inimigo fica muito confuso (e talvez atraído?).'
    }
};

// ── Espécies (Raças) ────────────────────────────────────
const ESPECIES = {
    humano: {
        name: 'Humano', emoji: '👱‍♂️',
        modifiers: { hp: 10, atk: 1, def: 1 },
        special: { name: 'Adaptação', desc: 'Copia o último especial do oponente ou +25% ATK 1t', cooldown: 4 },
        lore: 'A raça mais versátil. Equilibrados e adaptáveis a qualquer situação.'
    },
    elfo: {
        name: 'Elfo', emoji: '🧝‍♀️',
        modifiers: { hp: -10, atk: 3, def: -2 },
        special: { name: 'Flecha Arcana', desc: 'Disparo mágico: 12-20 dano puro (ignora DEF)', cooldown: 3 },
        lore: 'Seres ancestrais focados na precisão e magia. Rápidos, mortais, mas frágeis.'
    },
    orc: {
        name: 'Orc', emoji: '👹',
        modifiers: { hp: 15, atk: 2, def: 1 },
        special: { name: 'Grito de Guerra', desc: 'ATK +40% por 2 turnos + 5 dmg de terror', cooldown: 4 },
        lore: 'Brutais e resistentes. O campo de batalha é o seu verdadeiro lar.'
    },
    anao: {
        name: 'Anão', emoji: '🧔‍♂️',
        modifiers: { hp: 5, atk: 1, def: 4 },
        special: { name: 'Pele de Ferro', desc: 'DEF +100% por 2 turnos', cooldown: 4 },
        lore: 'Duros na queda como as montanhas de onde vieram. Defesa impenetrável.'
    },
    mortovivo: {
        name: 'Morto-Vivo', emoji: '💀',
        modifiers: { hp: 20, atk: 2, def: -1 },
        special: { name: 'Pacto da Morte', desc: 'Revive com 15 HP se morrer (1x por luta)', cooldown: 5 },
        lore: 'O que está morto não pode morrer. Trazem resiliência implacável e pavor.'
    },
    demonio: {
        name: 'Demônio', emoji: '😈',
        modifiers: { hp: 5, atk: 4, def: -1 },
        special: { name: 'Fúria Infernal', desc: 'Sacrifica 15 HP → 25-40 dano puro', cooldown: 3 },
        lore: 'Criaturas do abismo. Seu ataque é devastador, mas a fúria cega sua defesa.'
    },
    vampiro: {
        name: 'Vampiro', emoji: '🦇',
        modifiers: { hp: 0, atk: 3, def: -2 },
        special: { name: 'Mordida Noturna', desc: 'Drena 15-25 HP (dano + cura 100%)', cooldown: 4 },
        lore: 'Filhos da noite. Curam 10% do dano causado (Roubo de Vida).'
    },
    golem: {
        name: 'Golem', emoji: '🪨',
        modifiers: { hp: 25, atk: 1, def: 5 },
        special: { name: 'Terremoto', desc: 'Dano 10-18 + purga todos os buffs do inimigo', cooldown: 4 },
        lore: 'Seres de pura pedra e magia. Imunes a Envenenamento e Queimadura.'
    },
    celestial: {
        name: 'Celestial', emoji: '👼',
        modifiers: { hp: -5, atk: 2, def: 2 },
        special: { name: 'Bênção Divina', desc: 'Cura 25 HP + limpa debuffs + escudo 10', cooldown: 4 },
        lore: 'Seres de luz pura. Reduzem em 15% todo dano recebido.'
    },
    bruxa: {
        name: 'Bruxa', emoji: '🧙‍♀️',
        modifiers: { hp: -10, atk: 4, def: 1 },
        special: { name: 'Maldição da Tontura', desc: 'Aplica tontura (60% de chance de errar ataques) por 2 turnos', cooldown: 5 },
        lore: 'Mestres do ocultismo. Sua presença reduz a cura do inimigo em 50% passivamente.'
    },
    carioca: {
        name: 'Carioca', emoji: '🔫',
        hidden: true,
        modifiers: { hp: -5, atk: 5, def: 0 },
        special: { name: 'Dois Cara', desc: 'Rouba a poção do inimigo. Se não tiver, causa 20 de dano puro', cooldown: 4 },
        lore: 'Aja naturalmente. Proficiente na arte do recolhimento de bens adversários.'
    },
    baiano: {
        name: 'Baiano', emoji: '🛌',
        hidden: true,
        modifiers: { hp: 30, atk: -5, def: 5 },
        special: { name: 'Cochilo Tático', desc: 'Pula o próximo turno inteiro dormindo, mas regenera 60 HP magicamente', cooldown: 5 },
        lore: 'Mestre da inércia. O corpo preguiçoso também é a melhor fortificação.'
    }
};

// ── Narrativas Épicas ───────────────────────────────────
const ATTACK_NARRATIONS = [
    '⚡ desfere um golpe devastador!',
    '💥 avança com fúria implacável!',
    '🌪️ ataca com velocidade sobre-humana!',
    '☄️ libera um ataque brutal!',
    '🔥 golpeia com a força de mil sóis!',
    '⚔️ corta o ar com precisão mortal!',
    '💫 desfere uma sequência impiedosa!'
];

const CRITICAL_NARRATIONS = [
    '🌟 ✦ 𝗚𝗢𝗟𝗣𝗘 𝗖𝗥𝗜́𝗧𝗜𝗖𝗢 ✦ O impacto fez a terra tremer!',
    '💀 ✦ 𝗖𝗥𝗜́𝗧𝗜𝗖𝗢 ✦ Um golpe que transcende os limites mortais!',
    '⚡ ✦ 𝗗𝗔𝗡𝗢 𝗠𝗔́𝗫𝗜𝗠𝗢 ✦ Os céus se abriram com a força do impacto!'
];

const DODGE_NARRATIONS = [
    '💨 desvia com agilidade sobrenatural!',
    '🌀 se esquiva no último instante!',
    '👁️ prevê o ataque e se move como o vento!',
    '✨ desaparece por um instante e reaparece intacto!'
];

const DEFEND_NARRATIONS = [
    '🛡️ ergue sua guarda com determinação de aço!',
    '🏔️ se torna uma fortaleza inabalável!',
    '⚙️ se posiciona em defesa perfeita!'
];

const KILL_NARRATIONS = [
    '☠️ 𝗙𝗜𝗡𝗔𝗟𝗜𝗭𝗔𝗗𝗢! O oponente cai derrotado!',
    '💀 𝗘𝗟𝗜𝗠𝗜𝗡𝗔𝗗𝗢! Não resta nada além de silêncio.',
    '🏆 𝗩𝗜𝗧𝗢́𝗥𝗜𝗔 𝗔𝗕𝗦𝗢𝗟𝗨𝗧𝗔! A lenda cresce!',
    '⚰️ 𝗗𝗘𝗥𝗥𝗢𝗧𝗔 𝗧𝗢𝗧𝗔𝗟! O chão treme com a queda.'
];

const COUNTER_NARRATIONS = [
    '🔄 ✦ 𝗖𝗢𝗡𝗧𝗥𝗔-𝗔𝗧𝗔𝗤𝗨𝗘 ✦ Reflete o golpe com precisão!',
    '🔄 ✦ 𝗥𝗘𝗩𝗜𝗗𝗘 ✦ Rebate o impacto de volta!'
];

const LAST_BREATH_NARRATIONS = [
    '💀 ✦ 𝗨́𝗟𝗧𝗜𝗠𝗢 𝗦𝗨𝗦𝗣𝗜𝗥𝗢 ✦ Com a vida por um fio, o poder EXPLODE!',
    '💀 ✦ 𝗗𝗘𝗦𝗘𝗦𝗣𝗘𝗥𝗢 ✦ Nada a perder... DANO AMPLIFICADO!'
];

const COMBO_NARRATIONS = [
    '⚡ ✦ 𝗖𝗢𝗠𝗕𝗢 ✦ Ataque consecutivo! Dano amplificado!',
    '⚡ ✦ 𝗦𝗘𝗤𝗨𝗘̂𝗡𝗖𝗜𝗔 ✦ Golpe duplo! Força adicional!'
];

// ── Estado em memória ───────────────────────────────────
let activeGames = {};    // groupJid -> game state
let dueloStats = {};     // jid -> { wins, losses, streak, maxStreak, classWins }

// ── Persistência ────────────────────────────────────────
async function loadStats() {
    try {
        await fs.mkdir(path.dirname(STATS_FILE), { recursive: true });
        const data = await fs.readFile(STATS_FILE, 'utf-8');
        dueloStats = JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') dueloStats = {};
        else console.error('[DueloManager] Erro ao carregar stats:', e);
    }
}

async function saveStats() {
    try {
        await fs.writeFile(STATS_FILE, JSON.stringify(dueloStats, null, 2));
    } catch (e) {
        console.error('[DueloManager] Erro ao salvar stats:', e);
    }
}

async function loadGames() {
    try {
        const data = await fs.readFile(GAMES_FILE, 'utf-8');
        const loaded = JSON.parse(data);
        const now = Date.now();
        // Filtrar jogos expirados (mais de 5 min) e finalizados
        for (const [groupJid, game] of Object.entries(loaded)) {
            if (game.status === 'finished' || now - (game.lastActivity || game.createdAt) > 10 * 60 * 1000) {
                continue; // descarta expirados/finalizados
            }
            activeGames[groupJid] = game;
        }
        const restored = Object.keys(activeGames).length;
        if (restored > 0) {
            console.log(`[DueloManager] ${restored} duelo(s) restaurado(s) do disco.`);
        }
    } catch (e) {
        if (e.code !== 'ENOENT') {
            console.error('[DueloManager] Erro ao carregar jogos:', e);
        }
    }
}

async function saveGames() {
    try {
        await fs.writeFile(GAMES_FILE, JSON.stringify(activeGames, null, 2));
    } catch (e) {
        console.error('[DueloManager] Erro ao salvar jogos:', e);
    }
}

loadStats();
loadGames();

// ── Utilitários ─────────────────────────────────────────
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function hpBar(current, max) {
    const total = 10;
    const filled = Math.max(0, Math.round((current / max) * total));
    const empty = total - filled;
    let color = '🟩';
    if (current / max <= 0.3) color = '🟥';
    else if (current / max <= 0.6) color = '🟨';
    return color.repeat(filled) + '⬛'.repeat(empty) + ` ${current}/${max}`;
}

// ── Lógica de Combate ───────────────────────────────────

function createGame(groupJid, challengerJid, targetJid) {
    if (activeGames[groupJid]) {
        return { success: false, message: 'Já existe um duelo ativo neste grupo!' };
    }

    const challengerStats = getStats(challengerJid);
    if (!challengerStats.specie || !challengerStats.lastClass) {
        return { success: false, message: 'Você precisa definir sua Espécie e Classe antes de desafiar alguém!\nUse `/duelo guia 1` para ver as opções.' };
    }

    activeGames[groupJid] = {
        status: 'pending',       // pending -> class_select -> ongoing -> finished
        challenger: challengerJid,
        target: targetJid,
        players: {},
        turn: null,
        turnCount: 0,
        log: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
    };

    saveGames();
    return { success: true };
}

function acceptChallenge(groupJid, playerJid) {
    const game = activeGames[groupJid];
    if (!game || game.status !== 'pending') {
        return { success: false, message: 'Não há desafio pendente.' };
    }
    if (game.target !== playerJid) {
        return { success: false, message: 'Este desafio não é pra você!' };
    }

    const targetStats = getStats(playerJid);
    if (!targetStats.specie || !targetStats.lastClass) {
        return { success: false, message: 'Você precisa definir sua Espécie e Classe antes de aceitar batalhas!\nUse `/duelo guia 1` para ver as opções.' };
    }

    game.status = 'class_select';
    saveGames();
    return { success: true };
}

function setSpecie(playerJid, specieName) {
    const specieKey = specieName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!ESPECIES[specieKey]) {
        return { success: false, message: `Espécie "${specieName}" não existe!`, especies: Object.keys(ESPECIES) };
    }

    if (!dueloStats[playerJid]) {
        dueloStats[playerJid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {} };
    }

    dueloStats[playerJid].specie = specieKey;
    saveStats();
    return { success: true, specieData: ESPECIES[specieKey] };
}

function selectBuild(groupJid, playerJid, className) {
    const game = activeGames[groupJid];

    // Normalizar nome da classe
    const clsKey = className.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!CLASSES[clsKey]) {
        return { success: false, message: `Classe "${className}" não existe!`, classes: Object.keys(CLASSES) };
    }

    // Se não tiver jogo ativo, apenas salva a classe escolhida como favorita/última
    if (!dueloStats[playerJid]) {
        dueloStats[playerJid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {} };
    }
    dueloStats[playerJid].lastClass = clsKey;
    saveStats();

    if (!game) {
        const cls = CLASSES[clsKey];
        return { success: true, savedOutsideBattle: true, classData: cls };
    }

    // Verifica se já tem espécie definida no perfil
    const userStats = getStats(playerJid);
    if (!userStats.specie) {
        return { success: false, requireSpecie: true, message: 'Você precisa escolher sua Espécie antes de jogar!' };
    }
    const specieKey = userStats.specie;

    // Auto-aceitar: se o target tentar escolher build durante 'pending', aceita automaticamente
    if (game.status === 'pending') {
        if (playerJid === game.target || playerJid === game.challenger) {
            game.status = 'class_select';
        } else {
            return { success: false, message: 'Você não faz parte deste duelo!' };
        }
    }

    if (game.status !== 'class_select') {
        return { success: false, message: 'Não há seleção de classe ativa.' };
    }

    const classKey = className.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (!CLASSES[classKey]) {
        return { success: false, message: `Classe "${className}" não existe!`, classes: Object.keys(CLASSES) };
    }

    if (game.players[playerJid]) {
        return { success: false, message: 'Você já escolheu sua build!' };
    }

    const spv = ESPECIES[specieKey];
    const cls = CLASSES[classKey];

    if (!dueloStats[playerJid]) {
        dueloStats[playerJid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {} };
    }
    dueloStats[playerJid].lastClass = classKey;

    const finalHp = cls.hp + spv.modifiers.hp + (userStats.allocatedStats.hp * 5); // 1 point = 5 HP
    const finalAtk = Math.max(1, cls.atk + spv.modifiers.atk + userStats.allocatedStats.atk); // 1 point = 1 ATK
    const finalDef = Math.max(1, cls.def + spv.modifiers.def + userStats.allocatedStats.def); // 1 point = 1 DEF

    game.players[playerJid] = {
        specie: specieKey,
        specieName: spv.name,
        class: classKey,
        className: cls.name,
        emoji: spv.emoji,
        classEmoji: cls.emoji,
        hp: finalHp,
        maxHp: finalHp,
        atk: finalAtk,
        def: finalDef,
        specialCooldown: 0,
        racialCooldown: 0,
        racialName: spv.special.name,
        potions: 1,
        hasRevive: specieKey === 'mortovivo',
        specialName: cls.special.name,
        lastAction: null,
        lastSpecialUsed: null,
        consecutiveAttacks: 0,
        buffs: {
            atkMultiplier: 1,
            atkBuffTurns: 0,
            shielded: false,
            burn: 0,
            poison: 0,
            magicBarrier: false,
            precisionAim: false,
            boneShield: 0,
            silenced: 0,
            ironSkinTurns: 0,
            dizzy: 0,
            blind: 0,
            stink: 0,
            sleeping: 0
        }
    };

    // Se ambos escolheram, iniciar combate
    const bothReady = game.players[game.challenger] && game.players[game.target];
    if (bothReady) {
        game.status = 'ongoing';
        game.turn = Math.random() < 0.5 ? game.challenger : game.target;
        game.turnCount = 1;
    }

    game.lastActivity = Date.now();
    saveGames();
    saveStats();
    return {
        success: true,
        bothReady,
        classData: cls,
        game
    };
}

function performAction(groupJid, playerJid, action) {
    const game = activeGames[groupJid];
    if (!game || game.status !== 'ongoing') {
        return { success: false, message: 'Não há duelo em andamento.' };
    }
    if (game.turn !== playerJid) {
        return { success: false, message: 'Não é sua vez!' };
    }

    const attacker = game.players[playerJid];
    const defenderJid = playerJid === game.challenger ? game.target : game.challenger;
    const defender = game.players[defenderJid];

    const result = {
        success: true,
        action,
        attackerJid: playerJid,
        defenderJid,
        narration: '',
        damage: 0,
        healed: 0,
        isCrit: false,
        isDodge: false,
        isCounter: false,
        isLastBreath: false,
        isCombo: false,
        burnDmg: 0,
        poisonDmg: 0,
        counterDmg: 0,
        gameOver: false,
        winner: null,
        loser: null
    };

    // Processar burn no início do turno do jogador
    if (attacker.buffs.burn > 0) {
        if (attacker.specie === 'golem') {
            attacker.buffs.burn = 0;
            result.narration += `🪨 _O Golem ignorou as chamas!_\n`;
        } else {
            const burnDmg = 5;
            attacker.hp = Math.max(0, attacker.hp - burnDmg);
            attacker.buffs.burn--;
            result.burnDmg = burnDmg;
            result.narration += `🔥 _Queimadura causa ${burnDmg} de dano!_\n`;
        }
    }

    // Processar veneno no início do turno
    if (attacker.buffs.poison > 0) {
        if (attacker.specie === 'golem') {
            attacker.buffs.poison = 0;
            result.narration += `🪨 _O sangue de pedra do Golem anulou o veneno!_\n`;
        } else {
            const poisonDmg = 3;
            attacker.hp = Math.max(0, attacker.hp - poisonDmg);
            attacker.buffs.poison--;
            result.poisonDmg = poisonDmg;
            result.narration += `☠️ _Veneno causa ${poisonDmg} de dano!_\n`;
        }
    }

    // Processar fedor no início do turno
    if (attacker.buffs.stink > 0) {
        const stinkDmg = 6;
        attacker.hp = Math.max(0, attacker.hp - stinkDmg);
        attacker.buffs.stink--;
        result.narration += `🤢 _O fedor letal sufoca! (-${stinkDmg} HP)._\n`;
    }

    // Decrementar buff de ATK
    if (attacker.buffs.atkBuffTurns > 0) {
        attacker.buffs.atkBuffTurns--;
        if (attacker.buffs.atkBuffTurns <= 0) {
            attacker.buffs.atkMultiplier = 1;
        }
    }

    // Limpar barreira mágica do turno anterior
    if (attacker.buffs.magicBarrier) {
        attacker.buffs.magicBarrier = false;
    }

    // Decrementar cooldown especial
    if (attacker.specialCooldown > 0) attacker.specialCooldown--;

    // Decrementar cooldown racial
    if (attacker.racialCooldown > 0) attacker.racialCooldown--;

    // Decrementar Pele de Ferro
    if (attacker.buffs.ironSkinTurns > 0) {
        attacker.buffs.ironSkinTurns--;
        if (attacker.buffs.ironSkinTurns <= 0 && attacker._ironOriginalDef) {
            attacker.def = attacker._ironOriginalDef;
            delete attacker._ironOriginalDef;
            result.narration += `🧔‍♂️ _Pele de Ferro dissipou!_\n`;
        }
    }

    // Decrementar Tontura e Blind
    if (attacker.buffs.dizzy > 0) attacker.buffs.dizzy--;
    if (attacker.buffs.blind > 0) attacker.buffs.blind--;

    let isSleeping = false;
    if (attacker.buffs.sleeping > 0) {
        attacker.buffs.sleeping--;
        isSleeping = true;
    }

    // Checar se morreu pelo burn/veneno/stink
    if (attacker.hp <= 0) {
        if (attacker.hasRevive) {
            attacker.hp = 15;
            attacker.hasRevive = false;
            result.narration += `\n💀 ✦ 𝗣𝗔𝗖𝗧𝗢 𝗗𝗔 𝗠𝗢𝗥𝗧𝗘 ✦\n_A morte não o aceita! Reviveu com ${attacker.hp} HP!_\n`;
        } else {
            result.gameOver = true;
            result.winner = defenderJid;
            result.loser = playerJid;
            result.narration += `\n${pick(KILL_NARRATIONS)}`;
            _finishGame(groupJid, result.winner, result.loser);
            return result;
        }
    }

    // ── ÚLTIMO SUSPIRO: +25% ATK quando HP < 15% ──
    const isLastBreath = (attacker.hp / attacker.maxHp) < 0.15;
    if (isLastBreath && action === 'atacar') {
        result.isLastBreath = true;
        result.narration += pick(LAST_BREATH_NARRATIONS) + '\n';
    }

    // ── COMBO: 2 ataques seguidos = +15% dano ──
    const isCombo = action === 'atacar' && attacker.consecutiveAttacks >= 1;
    if (isCombo) {
        result.isCombo = true;
    }

    if (isSleeping) {
        result.narration += `🛌 💤 _Zzzzzz... roncando alto e perdendo a vez!_`;

        // Passa o turno pro inimigo
        game.turn = defenderJid;
        game.turnCount++;
        game.lastActivity = Date.now();
        saveGames();

        return result;
    }

    switch (action) {
        case 'atacar': {
            // Cegueira 100% erro
            if (attacker.buffs.blind > 0) {
                result.isDodge = true;
                result.narration += `😎 _Ficou CEGO pelo brilho da careca e errou o ataque completamente!_\n`;
                attacker.consecutiveAttacks = 0;
                break;
            }

            // Chance de errar por tontura (60%)
            if (attacker.buffs.dizzy > 0) {
                if (Math.random() < 0.60) {
                    result.isDodge = true;
                    result.narration += `💫 _Ficou tonto e ERROU o ataque completamente!_\n`;
                    attacker.consecutiveAttacks = 0;
                    break;
                }
            }

            // Chance de esquiva (10%)
            if (Math.random() < 0.10) {
                result.isDodge = true;
                result.narration += pick(DODGE_NARRATIONS);
                attacker.consecutiveAttacks = 0;
                break;
            }

            // Chance de crítico (aumentada em 20% se Arqueiro com mira precisa)
            let critChance = 0.15;
            if (attacker.buffs.precisionAim) {
                critChance = 0.35;
                attacker.buffs.precisionAim = false;
                result.narration += '🎯 _Mira precisa ativa!_\n';
            }
            result.isCrit = Math.random() < critChance;

            let baseAtk = attacker.atk * attacker.buffs.atkMultiplier;

            // Último suspiro: +25% ATK
            if (isLastBreath) baseAtk *= 1.25;

            // Combo: +15% dano
            if (isCombo) {
                baseAtk *= 1.15;
                result.narration += pick(COMBO_NARRATIONS) + '\n';
            }

            const variance = rand(-3, 5);
            // Barreira mágica do defensor: -15% dano
            let defMod = defender.def * 0.5;
            if (defender.buffs.magicBarrier) {
                defMod *= 1.15;
                result.narration += '🔮 _Barreira mágica reduz o dano!_\n';
            }
            let dmg = Math.max(1, Math.floor(baseAtk + variance - defMod));

            // Celestial recebe -15% de todo dano
            if (defender.specie === 'celestial') {
                dmg = Math.floor(dmg * 0.85);
            }

            if (result.isCrit) dmg = Math.floor(dmg * 2);

            if (defender.buffs.shielded) {
                dmg = 0;
                defender.buffs.shielded = false;
                result.narration += '🛡️ ✦ 𝗕𝗟𝗢𝗤𝗨𝗘𝗔𝗗𝗢 ✦ O Escudo Divino absorveu todo o dano!\n';
            } else {
                if (defender.buffs.boneShield > 0) {
                    if (dmg <= defender.buffs.boneShield) {
                        defender.buffs.boneShield -= dmg;
                        result.narration += `\n🦴 _O Servo Sombrio absorveu todo o dano! (${defender.buffs.boneShield} restantes)_`;
                        dmg = 0;
                    } else {
                        dmg -= defender.buffs.boneShield;
                        result.narration += `\n🦴 _O Servo Sombrio foi destruído ao absorver parte do dano!_`;
                        defender.buffs.boneShield = 0;
                    }
                }

                defender.hp = Math.max(0, defender.hp - dmg);
                result.damage = dmg;
                result.narration += pick(ATTACK_NARRATIONS);
                if (result.isCrit) {
                    result.narration += '\n' + pick(CRITICAL_NARRATIONS);
                }

                // Vampiro (Lifesteal) cura 10% do dano causado no hit básico (mínimo 1)
                if (attacker.specie === 'vampiro' && dmg > 0) {
                    let lifesteal = Math.max(1, Math.floor(dmg * 0.1));
                    if (defender.specie === 'bruxa') lifesteal = Math.max(1, Math.floor(lifesteal * 0.5));
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                    result.healed += lifesteal;
                    result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                }
            }

            attacker.consecutiveAttacks++;
            break;
        }

        case 'defender': {
            // Defesa: reduz dano recebido no próximo ataque (+50% DEF temporário)
            attacker.def = Math.floor(attacker.def * 1.5);
            result.narration += pick(DEFEND_NARRATIONS);
            result.narration += `\n_DEF temporariamente aumentada para ${attacker.def}!_`;

            // CONTRA-ATAQUE: 8% chance ao defender de refletir 30% do dano
            if (Math.random() < 0.08) {
                const counterDmg = Math.max(1, Math.floor(defender.atk * 0.3));
                defender.hp = Math.max(0, defender.hp - counterDmg);
                result.isCounter = true;
                result.counterDmg = counterDmg;
                result.narration += `\n${pick(COUNTER_NARRATIONS)}\n_${counterDmg} de dano refletido!_`;
            }

            // Reset def no próximo turno é implícito — guardar original
            if (!attacker._originalDef) attacker._originalDef = CLASSES[attacker.class].def;
            attacker.consecutiveAttacks = 0;
            break;
        }

        case 'especial': {
            if (attacker.buffs.silenced > 0) {
                result.success = false;
                result.message = 'Você está SILENCIADO! Não pode usar magia.';
                return result;
            }
            if (attacker.specialCooldown > 0) {
                result.success = false;
                result.message = `Especial em cooldown! Faltam ${attacker.specialCooldown} turno(s).`;
                return result;
            }

            attacker.specialCooldown = CLASSES[attacker.class].special.cooldown;
            const cls = attacker.class;

            if (cls === 'guerreiro') {
                attacker.buffs.atkMultiplier = 1.5;
                attacker.buffs.atkBuffTurns = 2;
                result.narration += '🗡️ ✦ 𝗙𝗨́𝗥𝗜𝗔 𝗕𝗘𝗥𝗦𝗘𝗥𝗞𝗘𝗥 ✦\n_Os olhos brilham vermelho! ATK +50% por 2 turnos!_';
            }
            else if (cls === 'mago') {
                const dmg = rand(30, 45);
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += '🧙 ✦ 𝗠𝗘𝗧𝗘𝗢𝗥𝗢 𝗔𝗥𝗖𝗔𝗡𝗢 ✦\n🛡️ O Escudo Divino absorveu o meteoro!';
                } else {
                    let finalDmg = dmg;
                    if (defender.specie === 'celestial') finalDmg = Math.floor(finalDmg * 0.85);

                    if (defender.buffs.boneShield > 0) {
                        if (finalDmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= finalDmg;
                            result.narration += `\n🦴 _O Servo Sombrio absorveu o Meteoro! (${defender.buffs.boneShield} restantes)_`;
                            finalDmg = 0;
                        } else {
                            finalDmg -= defender.buffs.boneShield;
                            result.narration += `\n🦴 _O Servo Sombrio foi desintegrado pelo Meteoro!_`;
                            defender.buffs.boneShield = 0;
                        }
                    }

                    defender.hp = Math.max(0, defender.hp - finalDmg);
                    result.damage = finalDmg;
                    result.narration += `🧙 ✦ 𝗠𝗘𝗧𝗘𝗢𝗥𝗢 𝗔𝗥𝗖𝗔𝗡𝗢 ✦\n_Um meteoro cai dos céus! ${finalDmg} de dano puro!_`;

                    if (attacker.specie === 'vampiro' && finalDmg > 0) {
                        let lifesteal = Math.max(1, Math.floor(finalDmg * 0.1));
                        if (defender.specie === 'bruxa') lifesteal = Math.max(1, Math.floor(lifesteal * 0.5));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                        result.healed += lifesteal;
                        result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                    }
                }
                // BARREIRA MÁGICA: -15% dano recebido por 1 turno após usar especial
                attacker.buffs.magicBarrier = true;
                result.narration += '\n🔮 _Barreira Mágica ativada! -15% dano recebido no próximo turno._';
            }
            else if (cls === 'arqueiro') {
                let totalDmg = 0;
                const hits = [];
                for (let i = 0; i < 3; i++) {
                    const hit = rand(8, 14);
                    hits.push(hit);
                    totalDmg += hit;
                }
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += '🏹 ✦ 𝗖𝗛𝗨𝗩𝗔 𝗗𝗘 𝗙𝗟𝗘𝗖𝗛𝗔𝗦 ✦\n🛡️ O Escudo Divino bloqueou todas as flechas!';
                } else {
                    // Celestial redução passiva na Chuva de Flechas
                    if (defender.specie === 'celestial') totalDmg = Math.floor(totalDmg * 0.85);

                    if (defender.buffs.boneShield > 0) {
                        if (totalDmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= totalDmg;
                            result.narration += `\n🦴 _O Servo Sombrio absorveu as flechas! (${defender.buffs.boneShield} restantes)_`;
                            totalDmg = 0;
                        } else {
                            totalDmg -= defender.buffs.boneShield;
                            result.narration += `\n🦴 _O Servo Sombrio quebrou em pedaços ao defender as flechas!_`;
                            defender.buffs.boneShield = 0;
                        }
                    }

                    defender.hp = Math.max(0, defender.hp - totalDmg);
                    result.damage = totalDmg;
                    result.narration += `🏹 ✦ 𝗖𝗛𝗨𝗩𝗔 𝗗𝗘 𝗙𝗟𝗘𝗖𝗛𝗔𝗦 ✦\n_3 flechas atingem o alvo! [${hits.join(' + ')}] = ${totalDmg} de dano!_`;

                    if (attacker.specie === 'vampiro' && totalDmg > 0) {
                        let lifesteal = Math.max(1, Math.floor(totalDmg * 0.1));
                        if (defender.specie === 'bruxa') lifesteal = Math.max(1, Math.floor(lifesteal * 0.5));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                        result.healed += lifesteal;
                        result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                    }
                }
                // MIRA PRECISA: próximo ataque tem +20% chance de crit
                attacker.buffs.precisionAim = true;
                result.narration += '\n🎯 _Mira Precisa! Próximo ataque com +20% chance de crítico._';
            }
            else if (cls === 'paladino') {
                attacker.buffs.shielded = true;
                let heal = 20;
                if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                result.healed = heal;
                result.narration += `🛡️ ✦ 𝗘𝗦𝗖𝗨𝗗𝗢 𝗗𝗜𝗩𝗜𝗡𝗢 ✦\n_Uma aura dourada envolve o Paladino! Escudo ativo + ${heal} HP curados!_`;
            }
            else if (cls === 'assassino') {
                const hpPercent = defender.hp / defender.maxHp;
                let dmg;
                if (hpPercent <= 0.3) {
                    dmg = Math.floor(attacker.atk * 2 + rand(5, 15));
                    result.narration += `🥷 ✦ 𝗘𝗫𝗘𝗖𝗨𝗖̧𝗔̃𝗢 𝗦𝗢𝗠𝗕𝗥𝗜𝗔 ✦\n_O alvo está fraco... DANO DOBRADO! ${dmg} de dano letal!_`;
                } else {
                    dmg = Math.floor(attacker.atk * 1.2 + rand(3, 8));
                    result.narration += `🥷 ✦ 𝗘𝗫𝗘𝗖𝗨𝗖̧𝗔̃𝗢 𝗦𝗢𝗠𝗕𝗥𝗜𝗔 ✦\n_Golpe das sombras! ${dmg} de dano! (Dano dobrado se HP < 30%)_`;
                }
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.damage = 0;
                    result.narration = '🥷 ✦ 𝗘𝗫𝗘𝗖𝗨𝗖̧𝗔̃𝗢 𝗦𝗢𝗠𝗕𝗥𝗜𝗔 ✦\n🛡️ O Escudo Divino bloqueou a execução!';
                } else {
                    // Celestial passiva na execução do assassino
                    if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);

                    if (defender.buffs.boneShield > 0) {
                        if (dmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= dmg;
                            result.narration += `\n🦴 _A Execução Sombria cortou a cabeça do Servo, mas protegeu o alvo! (${defender.buffs.boneShield} restantes)_`;
                            dmg = 0;
                        } else {
                            dmg -= defender.buffs.boneShield;
                            result.narration += `\n🦴 _O Servo foi dilacerado mas evitou parte do corte!_`;
                            defender.buffs.boneShield = 0;
                        }
                    }

                    defender.hp = Math.max(0, defender.hp - dmg);
                    result.damage = dmg;

                    if (attacker.specie === 'vampiro' && dmg > 0) {
                        let lifesteal = Math.max(1, Math.floor(dmg * 0.1));
                        if (defender.specie === 'bruxa') lifesteal = Math.max(1, Math.floor(lifesteal * 0.5));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                        result.healed += lifesteal;
                        result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                    }
                }
                // VENENO: 3 dmg/turno por 2 turnos
                defender.buffs.poison = 2;
                result.narration += '\n☠️ _Lâmina envenenada! Veneno aplicado por 2 turnos._';
            }
            else if (cls === 'dragao') {
                const dmg = rand(15, 25);
                defender.buffs.burn = 3;
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += '🐉 ✦ 𝗦𝗢𝗣𝗥𝗢 𝗗𝗘 𝗙𝗢𝗚𝗢 ✦\n🛡️ O Escudo bloqueou o fogo, mas a queimadura persiste!';
                } else {
                    let finalDmg = dmg;
                    if (defender.specie === 'celestial') finalDmg = Math.floor(finalDmg * 0.85);

                    if (defender.buffs.boneShield > 0) {
                        if (finalDmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= finalDmg;
                            result.narration += `\n🦴 _O Servo Sombrio bloqueou as chamas! (${defender.buffs.boneShield} restantes)_`;
                            finalDmg = 0;
                        } else {
                            finalDmg -= defender.buffs.boneShield;
                            result.narration += `\n🦴 _O Servo Sombrio virou cinzas ao tentar bloquear o fogo!_`;
                            defender.buffs.boneShield = 0;
                        }
                    }

                    defender.hp = Math.max(0, defender.hp - finalDmg);
                    result.damage = finalDmg;
                    result.narration += `🐉 ✦ 𝗦𝗢𝗣𝗥𝗢 𝗗𝗘 𝗙𝗢𝗚𝗢 ✦\n_Fogo devastador! ${finalDmg} de dano + queimadura por 3 turnos!_`;

                    if (attacker.specie === 'vampiro' && finalDmg > 0) {
                        let lifesteal = Math.max(1, Math.floor(finalDmg * 0.1));
                        if (defender.specie === 'bruxa') lifesteal = Math.max(1, Math.floor(lifesteal * 0.5));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                        result.healed += lifesteal;
                        result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                    }
                }
            }
            else if (cls === 'scat') {
                const dmg = rand(10, 15);
                let finalDmg = dmg;
                if (defender.specie === 'celestial') finalDmg = Math.floor(finalDmg * 0.85);

                if (defender.buffs.boneShield > 0) {
                    if (finalDmg <= defender.buffs.boneShield) {
                        defender.buffs.boneShield -= finalDmg;
                        result.narration += `\n🦴 _O Servo Sombrio afundou na merda! (${defender.buffs.boneShield} restantes)_`;
                        finalDmg = 0;
                    } else {
                        finalDmg -= defender.buffs.boneShield;
                        defender.buffs.boneShield = 0;
                    }
                }
                defender.hp = Math.max(0, defender.hp - finalDmg);
                result.damage = finalDmg;
                defender.buffs.stink = 3;
                result.narration += `💩 ✦ 𝗖𝗛𝗨𝗩𝗔 𝗗𝗘 𝗕𝗢𝗦𝗧𝗔 ✦\n_Um cheiro insuportável invade a arena! ${finalDmg} de dano + Fedentina Tóxica por 3 turnos!_`;
            }
            else if (cls === 'calvo') {
                const dmg = rand(15, 25);
                let finalDmg = dmg;
                if (defender.specie === 'celestial') finalDmg = Math.floor(finalDmg * 0.85);

                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += `👨‍🦲 ✦ 𝗕𝗥𝗜𝗟𝗛𝗢 𝗢𝗙𝗨𝗦𝗖𝗔𝗡𝗧𝗘 ✦\n🛡️ O Escudo Divino aparou o clarão da careca!`;
                } else {
                    if (defender.buffs.boneShield > 0) {
                        if (finalDmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= finalDmg;
                            finalDmg = 0;
                        } else {
                            finalDmg -= defender.buffs.boneShield;
                            defender.buffs.boneShield = 0;
                        }
                    }
                    defender.hp = Math.max(0, defender.hp - finalDmg);
                    result.damage = finalDmg;
                    defender.buffs.blind = 1;
                    result.narration += `👨‍🦲 ✦ 𝗕𝗥𝗜𝗟𝗛𝗢 𝗢𝗙𝗨𝗦𝗖𝗔𝗡𝗧𝗘 ✦\n_Refletiu o sol na careca! ${finalDmg} de dano e CEGOU o inimigo (Errará o próximo ataque)!_`;
                }
            }
            else if (cls === 'femboy') {
                let heal = 30;
                if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                result.healed = heal;
                defender.buffs.silenced = 1;
                result.narration += `👗 ✦ 𝗙𝗢𝗙𝗨𝗥𝗔 𝗘𝗫𝗧𝗥𝗘𝗠𝗔 ✦\n_UwU 👉👈! Seduziu o oponente! Curou ${heal} HP e deixou o inimigo confuso (Silenciado)!_`;
            }
            else if (cls === 'barbaro') {
                // +30% de dano base para cada 10% de HP faltante na hora da Sede
                const hpMissingPct = 1 - (attacker.hp / attacker.maxHp);
                const stacks = Math.floor(hpMissingPct / 0.10);
                const bonusMultiplier = 1 + (stacks * 0.30);

                attacker.buffs.atkMultiplier = bonusMultiplier;
                attacker.buffs.atkBuffTurns = 2; // Dura 2 turnos igual Fúria, mas o scale é enorme se ele tiver morrendo
                result.narration += `🪓 ✦ 𝗦𝗘𝗗𝗘 𝗗𝗘 𝗦𝗔𝗡𝗚𝗨𝗘 ✦\n_A dor alimenta o guerreiro! ATK +${Math.floor((bonusMultiplier - 1) * 100)}% por 2 turnos!_`;
            }
            else if (cls === 'clerigo') {
                let heal = 40;
                if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                result.healed = heal;
                // Purificação
                attacker.buffs.burn = 0;
                attacker.buffs.poison = 0;
                attacker.buffs.silenced = 0;
                result.narration += `✝️ ✦ 𝗠𝗜𝗟𝗔𝗚𝗥𝗘 𝗖𝗨𝗥𝗔𝗧𝗜𝗩𝗢 ✦\n_Uma luz sagrada limpa as feridas e debuffs! +${heal} HP recuperados._`;
            }
            else if (cls === 'necromante') {
                attacker.buffs.boneShield = 20;
                result.narration += `🧟‍♂️ ✦ 𝗔𝗟𝗠𝗔𝗦 𝗚𝗘̂𝗠𝗘𝗔𝗦 ✦\n_Um Servo Esquelético se ergue do chão! Absorverá os próximos ${attacker.buffs.boneShield} de dano por você!_`;
            }
            else if (cls === 'tecnomago') {
                const dmg = rand(10, 20); // Dano menor para balancear o controle
                defender.buffs.silenced = 2; // Inimigo silenciado por 2 turnos

                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += `⚙️ ✦ 𝗣𝗨𝗟𝗦𝗢 𝗘𝗟𝗘𝗧𝗥𝗢𝗠𝗔𝗚𝗡𝗘́𝗧𝗜𝗖𝗢 ✦\n🛡️ O Escudo bloqueou o PEM, mas os sistemas do inimigo falharam (Silenciado por 2 turnos)!`;
                } else {
                    let finalDmg = dmg;
                    if (defender.specie === 'celestial') finalDmg = Math.floor(finalDmg * 0.85);

                    if (defender.buffs.boneShield > 0) {
                        if (finalDmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= finalDmg;
                            result.narration += `\n🦴 _O Servo Sombrio aterrou a eletricidade! (${defender.buffs.boneShield} restantes)_`;
                            finalDmg = 0;
                        } else {
                            finalDmg -= defender.buffs.boneShield;
                            result.narration += `\n🦴 _O Servo Sombrio foi destruído pela sobrecarga!_`;
                            defender.buffs.boneShield = 0;
                        }
                    }

                    defender.hp = Math.max(0, defender.hp - finalDmg);
                    result.damage = finalDmg;
                    result.narration += `⚙️ ✦ 𝗣𝗨𝗟𝗦𝗢 𝗘𝗟𝗘𝗧𝗥𝗢𝗠𝗔𝗚𝗡𝗘́𝗧𝗜𝗖𝗢 ✦\n_Sobrecarga de energia!! ${finalDmg} de dano + Inimigo SILENCIADO por 2 turnos!_`;

                    if (attacker.specie === 'vampiro' && finalDmg > 0) {
                        const lifesteal = Math.max(1, Math.floor(finalDmg * 0.1));
                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
                        result.healed += lifesteal;
                        result.narration += `\n🦇 _Roubo de vida curou ${lifesteal} HP!_`;
                    }
                }
            }
            attacker.lastSpecialUsed = cls;
            break;
        }

        case 'racial': {
            if (attacker.buffs.silenced > 0) {
                result.success = false;
                result.message = 'Você está SILENCIADO! Não pode usar racial.';
                return result;
            }
            if (attacker.racialCooldown > 0) {
                result.success = false;
                result.message = `Racial em cooldown! Faltam ${attacker.racialCooldown} turno(s).`;
                return result;
            }

            const sp = attacker.specie;
            attacker.racialCooldown = ESPECIES[sp].special.cooldown;

            if (sp === 'humano') {
                // Adaptação: copia o último especial do oponente ou +25% ATK
                if (defender.lastSpecialUsed) {
                    result.narration += `👱‍♂️ ✦ 𝗔𝗗𝗔𝗣𝗧𝗔𝗖̧𝗔̃𝗢 ✦\n_O Humano copia o poder de ${CLASSES[defender.lastSpecialUsed]?.special?.name || 'desconhecido'}!_\n`;
                    // Aplica +25% ATK como efeito genérico da cópia
                    attacker.buffs.atkMultiplier = 1.25;
                    attacker.buffs.atkBuffTurns = 2;
                } else {
                    attacker.buffs.atkMultiplier = 1.25;
                    attacker.buffs.atkBuffTurns = 1;
                    result.narration += `👱‍♂️ ✦ 𝗔𝗗𝗔𝗣𝗧𝗔𝗖̧𝗔̃𝗢 ✦\n_Nenhum especial para copiar. ATK +25% por 1 turno!_`;
                }
            }
            else if (sp === 'elfo') {
                // Flecha Arcana: dano puro 12-20 ignorando DEF
                let dmg = rand(12, 20);
                if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);
                if (defender.buffs.boneShield > 0) {
                    if (dmg <= defender.buffs.boneShield) {
                        defender.buffs.boneShield -= dmg;
                        result.narration += `🦴 _Servo absorveu a flecha! (${defender.buffs.boneShield} restantes)_`;
                        dmg = 0;
                    } else {
                        dmg -= defender.buffs.boneShield;
                        defender.buffs.boneShield = 0;
                    }
                }
                defender.hp = Math.max(0, defender.hp - dmg);
                result.damage = dmg;
                result.narration += `🧑‍♀️ ✦ 𝗙𝗟𝗘𝗖𝗛𝗔 𝗔𝗥𝗖𝗔𝗡𝗔 ✦\n_Um disparo mágico atravessa as defesas! ${dmg} de dano puro!_`;
            }
            else if (sp === 'orc') {
                // Grito de Guerra: ATK +40% 2t + 5 dmg terror
                attacker.buffs.atkMultiplier = 1.4;
                attacker.buffs.atkBuffTurns = 2;
                const terrorDmg = 5;
                defender.hp = Math.max(0, defender.hp - terrorDmg);
                result.damage = terrorDmg;
                result.narration += `👹 ✦ 𝗚𝗥𝗜𝗧𝗢 𝗗𝗘 𝗚𝗨𝗘𝗥𝗥𝗔 ✦\n_WAAAAAGH! ATK +40% por 2 turnos + ${terrorDmg} de dano de terror!_`;
            }
            else if (sp === 'anao') {
                // Pele de Ferro: DEF +100% por 2 turnos
                if (!attacker._ironOriginalDef) attacker._ironOriginalDef = attacker.def;
                attacker.def = attacker._ironOriginalDef * 2;
                attacker.buffs.ironSkinTurns = 2;
                result.narration += `🧔‍♂️ ✦ 𝗣𝗘𝗟𝗘 𝗗𝗘 𝗙𝗘𝗥𝗥𝗢 ✦\n_A pele endurece como aço! DEF dobrada por 2 turnos!_`;
            }
            else if (sp === 'mortovivo') {
                // Pacto da Morte: ativa a flag de revive (já está ativa por padrão)
                // Se já usou, dá um buff de HP temporário
                if (attacker.hasRevive) {
                    result.narration += `💀 ✦ 𝗣𝗔𝗖𝗧𝗢 𝗗𝗔 𝗠𝗢𝗥𝗧𝗘 ✦\n_O pacto já está selado! Você reviverá com 15 HP se morrer._`;
                } else {
                    // Segunda chance: cura 10 HP como consolação
                    let heal = 10;
                    if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                    result.healed = heal;
                    result.narration += `💀 ✦ 𝗘𝗡𝗘𝗥𝗚𝗜𝗔 𝗠𝗢𝗥𝗧𝗔𝗟 ✦\n_A energia dos mortos restaura ${heal} HP!_`;
                }
            }
            else if (sp === 'demonio') {
                // Fúria Infernal: sacrifica 15HP, causa 25-40 puro
                attacker.hp = Math.max(1, attacker.hp - 15);
                let dmg = rand(25, 40);
                if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += `😈 ✦ 𝗙𝗨́𝗥𝗜𝗔 𝗜𝗡𝗙𝗘𝗥𝗡𝗔𝗟 ✦\n🛡️ O Escudo bloqueou as chamas do inferno, mas o demônio perdeu 15 HP!`;
                } else {
                    if (defender.buffs.boneShield > 0) {
                        if (dmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= dmg;
                            dmg = 0;
                        } else {
                            dmg -= defender.buffs.boneShield;
                            defender.buffs.boneShield = 0;
                        }
                    }
                    defender.hp = Math.max(0, defender.hp - dmg);
                    result.damage = dmg;
                    result.narration += `😈 ✦ 𝗙𝗨́𝗥𝗜𝗔 𝗜𝗡𝗙𝗘𝗥𝗡𝗔𝗟 ✦\n_Sacrificou 15 HP para desferir ${dmg} de dano devastador!_`;
                }
            }
            else if (sp === 'vampiro') {
                // Mordida Noturna: drena 15-25 (dano + cura 100%)
                let dmg = rand(15, 25);
                if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);
                if (defender.buffs.shielded) {
                    defender.buffs.shielded = false;
                    result.narration += `🦇 ✦ 𝗠𝗢𝗥𝗗𝗜𝗗𝗔 𝗡𝗢𝗧𝗨𝗥𝗡𝗔 ✦\n🛡️ O Escudo Divino bloqueou a mordida!`;
                } else {
                    if (defender.buffs.boneShield > 0) {
                        if (dmg <= defender.buffs.boneShield) {
                            defender.buffs.boneShield -= dmg;
                            dmg = 0;
                        } else {
                            dmg -= defender.buffs.boneShield;
                            defender.buffs.boneShield = 0;
                        }
                    }
                    defender.hp = Math.max(0, defender.hp - dmg);
                    result.damage = dmg;

                    let heal = dmg;
                    if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                    result.healed = heal;
                    result.narration += `🦇 ✦ 𝗠𝗢𝗥𝗗𝗜𝗗𝗔 𝗡𝗢𝗧𝗨𝗥𝗡𝗔 ✦\n_Presas na jugular! ${dmg} de dano e ${heal} de HP drenados!_`;
                }
            }
            else if (sp === 'golem') {
                // Terremoto: dano 10-18 + purge de TODOS os buffs do oponente
                let dmg = rand(10, 18);
                if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);
                defender.hp = Math.max(0, defender.hp - dmg);
                result.damage = dmg;
                // Purge completo
                defender.buffs.atkMultiplier = 1;
                defender.buffs.atkBuffTurns = 0;
                defender.buffs.shielded = false;
                defender.buffs.magicBarrier = false;
                defender.buffs.precisionAim = false;
                defender.buffs.boneShield = 0;
                defender.buffs.ironSkinTurns = 0;
                if (defender._ironOriginalDef) {
                    defender.def = defender._ironOriginalDef;
                    delete defender._ironOriginalDef;
                }
                result.narration += `🪨 ✦ 𝗧𝗘𝗥𝗥𝗘𝗠𝗢𝗧𝗢 ✦\n_O chão TREME! ${dmg} de dano + TODOS os buffs do inimigo foram purgados!_`;
            }
            else if (sp === 'celestial') {
                // Bênção Divina: cura 25 + limpa debuffs + escudo 10
                let heal = 25;
                if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                result.healed = heal;
                attacker.buffs.burn = 0;
                attacker.buffs.poison = 0;
                attacker.buffs.silenced = 0;
                attacker.buffs.boneShield += 10; // escudo extra
                result.narration += `👼 ✦ 𝗕𝗘̂𝗡𝗖̧𝗔̃𝗢 𝗗𝗜𝗩𝗜𝗡𝗔 ✦\n_Luz celestial purifica o corpo! +${heal} HP, debuffs removidos, escudo de 10 ativado!_`;
            }
            else if (sp === 'bruxa') {
                // Tontura: reduz a chance de ataque em 60% por 2 turnos
                defender.buffs.dizzy = 2;
                result.narration += `🧙‍♀️ ✦ 𝗠𝗔𝗟𝗗𝗜𝗖̧𝗔̃𝗢 𝗗𝗔 𝗧𝗢𝗡𝗧𝗨𝗥𝗔 ✦\n_Visão embaçada! O inimigo tem 60% de chance de errar ataques básicos por 2 turnos!_`;
            }
            else if (sp === 'carioca') {
                if (defender.potions > 0) {
                    defender.potions--; // Subtrai uma poção do inimigo
                    attacker.potions++; // Soma uma poção no bolso do Carioca
                    result.narration += `🔫 ✦ 𝗗𝗢𝗜𝗦 𝗖𝗔𝗥𝗔 𝗡𝗨𝗠𝗔 𝗠𝗢𝗧𝗢 ✦\n_"Passa a poção, perdeu!" O Carioca ASSALTOU o inimigo e roubou 1 poção! (Agora tem ${attacker.potions})_`;
                } else {
                    let dmg = 20;
                    if (defender.specie === 'celestial') dmg = Math.floor(dmg * 0.85);

                    if (defender.buffs.shielded) {
                        defender.buffs.shielded = false;
                        result.narration += `🔫 ✦ 𝗗𝗢𝗜𝗦 𝗖𝗔𝗥𝗔 𝗡𝗨𝗠𝗔 𝗠𝗢𝗧𝗢 ✦\n_"Mão na cabeça!" O Escudo bloqueou o tiro à queima roupa!_`;
                    } else {
                        if (defender.buffs.boneShield > 0) {
                            if (dmg <= defender.buffs.boneShield) {
                                defender.buffs.boneShield -= dmg;
                                dmg = 0;
                            } else {
                                dmg -= defender.buffs.boneShield;
                                defender.buffs.boneShield = 0;
                            }
                        }
                        defender.hp = Math.max(0, defender.hp - dmg);
                        result.damage = dmg;
                        result.narration += `🔫 ✦ 𝗗𝗢𝗜𝗦 𝗖𝗔𝗥𝗔 𝗡𝗨𝗠𝗔 𝗠𝗢𝗧𝗢 ✦\n_"Cade a poção viado!" Inimigo não tinha, tomou tiro: ${dmg} de dano!_`;
                    }
                }
            }
            else if (sp === 'baiano') {
                let heal = 60;
                if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
                result.healed = heal;
                attacker.buffs.sleeping = 1;
                result.narration += `🛌 ✦ 𝗖𝗢𝗖𝗛𝗜𝗟𝗢 𝗧𝗔́𝗧𝗜𝗖𝗢 ✦\n_Bateu aquela preguiça... Curou ${heal} HP, mas VAI DORMIR no próximo turno sem agir!_`;
            }
            break;
        }

        case 'pocao': {
            if (attacker.buffs.silenced > 0) {
                result.success = false;
                result.message = 'Você está SILENCIADO! Concentre-se no combate corpo a corpo.';
                return result;
            }
            if (attacker.potions <= 0) {
                result.success = false;
                result.message = 'Você não tem mais poções nesta batalha!';
                return result;
            }
            let heal = 30;
            if (defender.specie === 'bruxa') heal = Math.floor(heal * 0.5);
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
            attacker.potions--;
            result.healed = heal;
            result.narration += `🧪 _Bebe uma poção e recupera ${heal} HP! (${attacker.potions} restante(s))_`;
            attacker.consecutiveAttacks = 0;
            break;
        }

        default:
            result.success = false;
            result.message = 'Ação inválida! Use: atacar, defender, especial ou poção';
            return result;
    }

    // Reset def temporária
    if (action !== 'defender' && attacker._originalDef) {
        attacker.def = attacker._originalDef;
        delete attacker._originalDef;
    }

    // Tracking de ação para sistema de combo
    attacker.lastAction = action;
    if (action !== 'atacar') {
        attacker.consecutiveAttacks = 0;
    }

    // Checar morte
    if (defender.hp <= 0) {
        if (defender.hasRevive) {
            defender.hp = 15;
            defender.hasRevive = false;
            result.narration += `\n\n💀 ✦ 𝗣𝗔𝗖𝗧𝗢 𝗗𝗔 𝗠𝗢𝗥𝗧𝗘 ✦\n_A morte recusou o Morto-Vivo! Reviveu com 15 HP!_`;
        } else {
            result.gameOver = true;
            result.winner = playerJid;
            result.loser = defenderJid;
            result.narration += `\n\n${pick(KILL_NARRATIONS)}`;
            _finishGame(groupJid, result.winner, result.loser);
        }
    } else {
        // Próximo turno
        game.turn = defenderJid;
        game.turnCount++;

        // Decrementar duração do Silêncio no final do turno para durar as instâncias corretas
        if (attacker.buffs.silenced > 0) {
            attacker.buffs.silenced--;
            if (attacker.buffs.silenced === 0) {
                result.narration += `\n🔌 _Os sistemas voltaram. Você não está mais silenciado!_`;
            }
        }
    }

    // Atualizar timestamp de última atividade
    game.lastActivity = Date.now();

    saveGames();

    return result;
}

function _finishGame(groupJid, winnerJid, loserJid) {
    const game = activeGames[groupJid];
    if (!game) return;

    game.status = 'finished';

    // Se a partida tiver uma classe ou espécie secreta (meme), não altera os stats de NINGUÉM
    const winnerP = game.players[winnerJid];
    const loserP = game.players[loserJid];

    const isMemeBattle =
        (winnerP && (CLASSES[winnerP.class]?.hidden || ESPECIES[winnerP.specie]?.hidden)) ||
        (loserP && (CLASSES[loserP.class]?.hidden || ESPECIES[loserP.specie]?.hidden));

    if (isMemeBattle) {
        // Limpar jogo após 10 segundos sem salvar stats
        setTimeout(() => {
            if (activeGames[groupJid]?.status === 'finished') {
                delete activeGames[groupJid];
                saveGames();
            }
        }, 10000);
        return; // Sai antes de gravar stats
    }

    // Stats do vencedor
    if (!dueloStats[winnerJid]) {
        dueloStats[winnerJid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {} };
    }
    dueloStats[winnerJid].wins++;
    dueloStats[winnerJid].streak++;
    if (dueloStats[winnerJid].streak > dueloStats[winnerJid].maxStreak) {
        dueloStats[winnerJid].maxStreak = dueloStats[winnerJid].streak;
    }
    const winnerClass = game.players[winnerJid]?.class || 'unknown';
    if (!dueloStats[winnerJid].classWins[winnerClass]) {
        dueloStats[winnerJid].classWins[winnerClass] = 0;
    }
    dueloStats[winnerJid].classWins[winnerClass]++;

    // Stats do perdedor
    if (!dueloStats[loserJid]) {
        dueloStats[loserJid] = { wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {} };
    }
    dueloStats[loserJid].losses++;
    dueloStats[loserJid].streak = 0;

    // Distribuir XP
    const winnerXpResult = gainXp(winnerJid, 50);
    const loserXpResult = gainXp(loserJid, 10);

    // Gurdar os resultados para leitura do bot principal
    game.xpResults = {
        winner: winnerXpResult,
        loser: loserXpResult
    };

    saveStats();

    // Limpar jogo após 10 segundos
    setTimeout(() => {
        if (activeGames[groupJid]?.status === 'finished') {
            delete activeGames[groupJid];
            saveGames();
        }
    }, 10000);
}

function getGame(groupJid) {
    return activeGames[groupJid] || null;
}

function deleteGame(groupJid) {
    delete activeGames[groupJid];
    saveGames();
}

function getStats(jid) {
    if (!dueloStats[jid]) {
        dueloStats[jid] = {
            wins: 0, losses: 0, streak: 0, maxStreak: 0, classWins: {},
            level: 1, xp: 0, pointsToUse: 0, allocatedStats: { hp: 0, atk: 0, def: 0 }
        };
    } else {
        // Retrocompatibilidade para quem já existe
        if (dueloStats[jid].level === undefined) {
            dueloStats[jid].level = 1;
            dueloStats[jid].xp = 0;
            dueloStats[jid].pointsToUse = 0;
            dueloStats[jid].allocatedStats = { hp: 0, atk: 0, def: 0 };
        }
    }
    return dueloStats[jid];
}

function getTopPlayers(limit = 10) {
    return Object.entries(dueloStats)
        .sort(([, a], [, b]) => b.wins - a.wins)
        .slice(0, limit)
        .map(([jid, stats]) => ({ jid, ...stats }));
}

function getXpForNextLevel(currentLevel) {
    // Curva de XP simples (linear crescente: 100, 150, 200...)
    return 100 + (currentLevel * 50);
}

function gainXp(jid, amount) {
    const stats = getStats(jid);
    let leveledUp = false;
    let oldLevel = stats.level;
    let levelsGained = 0;

    stats.xp += amount;

    let xpNeeded = getXpForNextLevel(stats.level);
    while (stats.xp >= xpNeeded && stats.level < 100) { // Max Level 100
        stats.xp -= xpNeeded;
        stats.level++;
        stats.pointsToUse += 3; // +3 stat points per level
        levelsGained++;
        leveledUp = true;
        xpNeeded = getXpForNextLevel(stats.level);
    }

    saveStats();
    return { leveledUp, newLevel: stats.level, levelsGained, pointsEarned: levelsGained * 3 };
}

function allocatePoints(jid, statName, amount) {
    const stats = getStats(jid);
    const validStats = ['hp', 'atk', 'def'];
    const lowerStat = statName.toLowerCase();

    if (!validStats.includes(lowerStat)) {
        return { success: false, message: 'Atributo inválido. Use: hp, atk ou def.' };
    }

    const amtNum = parseInt(amount, 10);
    if (isNaN(amtNum) || amtNum <= 0) {
        return { success: false, message: 'Quantidade inválida para distribuir.' };
    }

    if (stats.pointsToUse < amtNum) {
        return { success: false, message: `Você não tem pontos suficientes! Pontos disponíveis: ${stats.pointsToUse}` };
    }

    stats.pointsToUse -= amtNum;
    stats.allocatedStats[lowerStat] += amtNum;
    saveStats();

    return { success: true, newTotal: stats.allocatedStats[lowerStat], remaining: stats.pointsToUse };
}

// Limpar duelos expirados (10 min sem ação)
setInterval(() => {
    const now = Date.now();
    for (const [groupJid, game] of Object.entries(activeGames)) {
        if (game.status !== 'finished' && now - (game.lastActivity || game.createdAt) > 10 * 60 * 1000) {
            delete activeGames[groupJid];
            saveGames();
            console.log(`[DueloManager] Duelo expirado em ${groupJid}`);
        }
    }
}, 60000);

module.exports = {
    CLASSES,
    ESPECIES,
    ATTACK_NARRATIONS,
    CRITICAL_NARRATIONS,
    DODGE_NARRATIONS,
    DEFEND_NARRATIONS,
    KILL_NARRATIONS,
    COUNTER_NARRATIONS,
    LAST_BREATH_NARRATIONS,
    COMBO_NARRATIONS,
    createGame,
    acceptChallenge,
    setSpecie,
    selectBuild,
    performAction,
    getGame,
    deleteGame,
    getStats,
    getTopPlayers,
    hpBar,
    pick,
    rand,
    getXpForNextLevel,
    gainXp,
    allocatePoints
};
