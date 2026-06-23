// ═══════════════════════════════════════════════════════════════════
//  🏰 RPG Manager — AI Dungeon Master: RPG Interativo com IA
//  Aventuras dinâmicas geradas por IA com mecânicas reais de RPG
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CHARACTERS_FILE = path.join(DATA_DIR, 'rpg_characters.json');
const ADVENTURES_FILE = path.join(DATA_DIR, 'rpg_adventures.json');
const WORLD_FILE = path.join(DATA_DIR, 'rpg_world.json');

// ═══════════════════════════════════════════════════════════════════
//  📖 CONSTANTES DE JOGO
// ═══════════════════════════════════════════════════════════════════

const CLASSES = {
    guerreiro: {
        name: 'Guerreiro', emoji: '⚔️',
        description: 'Mestre do combate corpo a corpo. Alta vida e força.',
        baseStats: { forca: 16, destreza: 12, inteligencia: 8, constituicao: 15, sabedoria: 10, carisma: 10 },
        hpPerLevel: 12, mpPerLevel: 3,
        skills: [
            { id: 'golpe_brutal', name: 'Golpe Brutal', desc: 'Ataque devastador com +50% de dano', cost: 5, dmgMult: 1.5, type: 'physical', unlockLv: 1 },
            { id: 'provocar', name: 'Provocar', desc: 'Força inimigos a atacar você por 2 turnos', cost: 3, type: 'taunt', unlockLv: 3 },
            { id: 'furia', name: 'Fúria', desc: 'Aumenta ATK em 40% por 3 turnos', cost: 8, type: 'buff', stat: 'atk', mult: 1.4, turns: 3, unlockLv: 5 },
            { id: 'terremoto', name: 'Terremoto', desc: 'Ataque em área que atinge todos os inimigos', cost: 15, dmgMult: 0.8, type: 'aoe_physical', unlockLv: 8 },
            { id: 'laminamortal', name: 'Lâmina Mortal', desc: 'Golpe com chance de 25% de crítico triplo', cost: 20, dmgMult: 2.0, critChance: 0.25, critMult: 3, type: 'physical', unlockLv: 12 },
            { id: 'avatar_guerra', name: 'Avatar da Guerra', desc: 'Forma definitiva: +60% ATK e DEF por 5 turnos', cost: 30, type: 'buff', stat: 'all', mult: 1.6, turns: 5, unlockLv: 15 },
        ]
    },
    mago: {
        name: 'Mago', emoji: '🔮',
        description: 'Domina magias arcanas. Alto dano mágico e controle.',
        baseStats: { forca: 6, destreza: 10, inteligencia: 18, constituicao: 8, sabedoria: 14, carisma: 12 },
        hpPerLevel: 6, mpPerLevel: 12,
        skills: [
            { id: 'bola_fogo', name: 'Bola de Fogo', desc: 'Projétil flamejante que causa dano em área', cost: 8, dmgMult: 1.6, type: 'magic_aoe', unlockLv: 1 },
            { id: 'escudo_arcano', name: 'Escudo Arcano', desc: 'Barreira mágica que absorve dano', cost: 6, type: 'shield', amount: 30, unlockLv: 3 },
            { id: 'raio', name: 'Raio', desc: 'Descarga elétrica com alto dano em um alvo', cost: 12, dmgMult: 2.2, type: 'magic', unlockLv: 5 },
            { id: 'congelar', name: 'Congelar', desc: 'Congela um inimigo por 2 turnos', cost: 10, type: 'cc', turns: 2, unlockLv: 8 },
            { id: 'meteoro', name: 'Meteoro', desc: 'Invoca uma chuva de meteoros devastadora', cost: 25, dmgMult: 2.5, type: 'magic_aoe', unlockLv: 12 },
            { id: 'parar_tempo', name: 'Parar o Tempo', desc: 'Congela o tempo: ganha 2 turnos extras', cost: 35, type: 'extra_turns', turns: 2, unlockLv: 15 },
        ]
    },
    arqueiro: {
        name: 'Arqueiro', emoji: '🏹',
        description: 'Atirador preciso à distância. Alta destreza e crítico.',
        baseStats: { forca: 10, destreza: 18, inteligencia: 10, constituicao: 10, sabedoria: 12, carisma: 10 },
        hpPerLevel: 8, mpPerLevel: 6,
        skills: [
            { id: 'tiro_preciso', name: 'Tiro Preciso', desc: 'Disparo certeiro com +30% de chance de crítico', cost: 5, dmgMult: 1.3, critChance: 0.3, type: 'physical', unlockLv: 1 },
            { id: 'chuva_flechas', name: 'Chuva de Flechas', desc: 'Dispara flechas em área', cost: 10, dmgMult: 0.7, type: 'aoe_physical', unlockLv: 3 },
            { id: 'tiro_venenoso', name: 'Tiro Venenoso', desc: 'Flecha envenenada: dano + veneno por 3 turnos', cost: 8, dmgMult: 1.0, type: 'poison', turns: 3, poisonDmg: 10, unlockLv: 5 },
            { id: 'evasao', name: 'Evasão', desc: 'Esquiva perfeita: evita o próximo ataque', cost: 6, type: 'dodge', unlockLv: 8 },
            { id: 'flecha_perfurante', name: 'Flecha Perfurante', desc: 'Ignora 50% da defesa inimiga', cost: 15, dmgMult: 1.8, armorPen: 0.5, type: 'physical', unlockLv: 12 },
            { id: 'tempestade', name: 'Tempestade de Flechas', desc: '5 disparos rápidos em alvos aleatórios', cost: 25, dmgMult: 0.6, hits: 5, type: 'multi_physical', unlockLv: 15 },
        ]
    },
    ladino: {
        name: 'Ladino', emoji: '🗡️',
        description: 'Assassino furtivo. Altíssimo dano crítico e evasão.',
        baseStats: { forca: 12, destreza: 16, inteligencia: 12, constituicao: 10, sabedoria: 10, carisma: 14 },
        hpPerLevel: 8, mpPerLevel: 6,
        skills: [
            { id: 'ataquefurtivo', name: 'Ataque Furtivo', desc: 'Golpe traíras com dano dobrado', cost: 6, dmgMult: 2.0, type: 'physical', unlockLv: 1 },
            { id: 'envenenar', name: 'Envenenar Lâmina', desc: 'Próximos 3 ataques causam veneno', cost: 5, type: 'poison_buff', turns: 3, poisonDmg: 8, unlockLv: 3 },
            { id: 'sombra', name: 'Caminhar nas Sombras', desc: 'Fica invisível por 2 turnos (não pode ser alvo)', cost: 8, type: 'stealth', turns: 2, unlockLv: 5 },
            { id: 'roubar', name: 'Roubar', desc: 'Rouba gold do inimigo durante combate', cost: 4, type: 'steal', unlockLv: 8 },
            { id: 'execucao', name: 'Execução', desc: 'Dano triplo contra inimigos com <30% HP', cost: 15, dmgMult: 3.0, hpThreshold: 0.3, type: 'physical', unlockLv: 12 },
            { id: 'marca_morte', name: 'Marca da Morte', desc: 'Marca alvo: todo dano recebido é dobrado por 3 turnos', cost: 20, type: 'debuff', mult: 2, turns: 3, unlockLv: 15 },
        ]
    },
    clerigo: {
        name: 'Clérigo', emoji: '✨',
        description: 'Curandeiro sagrado. Mantém o grupo vivo e abençoado.',
        baseStats: { forca: 10, destreza: 8, inteligencia: 12, constituicao: 14, sabedoria: 18, carisma: 12 },
        hpPerLevel: 10, mpPerLevel: 10,
        skills: [
            { id: 'curar', name: 'Curar', desc: 'Restaura HP de um aliado', cost: 6, healMult: 1.5, type: 'heal', unlockLv: 1 },
            { id: 'benção', name: 'Bênção', desc: 'Aumenta ATK e DEF do grupo em 20%', cost: 10, type: 'party_buff', stat: 'all', mult: 1.2, turns: 3, unlockLv: 3 },
            { id: 'luz_sagrada', name: 'Luz Sagrada', desc: 'Dano sagrado a mortos-vivos (2x) ou normal', cost: 8, dmgMult: 1.4, type: 'holy', unlockLv: 5 },
            { id: 'purificar', name: 'Purificar', desc: 'Remove todos os debuffs de um aliado', cost: 5, type: 'cleanse', unlockLv: 8 },
            { id: 'ressurreicao', name: 'Ressurreição', desc: 'Revive um aliado caído com 50% HP', cost: 25, type: 'revive', hpPercent: 0.5, unlockLv: 12 },
            { id: 'anjo', name: 'Invocação Angelical', desc: 'Invoca um anjo que cura todo o grupo e causa dano sagrado', cost: 35, healMult: 2, dmgMult: 2.0, type: 'holy_aoe', unlockLv: 15 },
        ]
    },
    necromante: {
        name: 'Necromante', emoji: '💀',
        description: 'Senhor da morte. Controla mortos e drena vida.',
        baseStats: { forca: 8, destreza: 10, inteligencia: 16, constituicao: 10, sabedoria: 14, carisma: 8 },
        hpPerLevel: 7, mpPerLevel: 11,
        skills: [
            { id: 'drenar_vida', name: 'Drenar Vida', desc: 'Drena HP do inimigo e cura a si mesmo', cost: 7, dmgMult: 1.2, type: 'drain', unlockLv: 1 },
            { id: 'invocar_esqueleto', name: 'Invocar Esqueleto', desc: 'Invoca um aliado esqueleto que luta por você', cost: 10, type: 'summon', summonHp: 40, summonAtk: 15, unlockLv: 3 },
            { id: 'maldição', name: 'Maldição', desc: 'Reduz ATK e DEF do inimigo em 30%', cost: 8, type: 'debuff', mult: 0.7, turns: 3, unlockLv: 5 },
            { id: 'explosao_cadaver', name: 'Explosão de Cadáver', desc: 'Explode mortos em campo para dano em área', cost: 12, dmgMult: 1.8, type: 'magic_aoe', unlockLv: 8 },
            { id: 'pacto_sombrio', name: 'Pacto Sombrio', desc: 'Sacrifica 30% do HP para dobrar MP', cost: 0, type: 'sacrifice', hpCost: 0.3, unlockLv: 12 },
            { id: 'exercito_mortos', name: 'Exército dos Mortos', desc: 'Invoca 3 esqueletos guerreiros + dano em área', cost: 30, dmgMult: 1.5, type: 'summon_army', unlockLv: 15 },
        ]
    }
};

const RACES = {
    humano: { name: 'Humano', emoji: '👤', bonus: { xpMult: 1.15 }, description: '+15% XP ganho' },
    elfo: { name: 'Elfo', emoji: '🧝', bonus: { inteligencia: 2, destreza: 2 }, description: '+2 INT, +2 DEX' },
    anao: { name: 'Anão', emoji: '⛏️', bonus: { constituicao: 3, forca: 1 }, description: '+3 CON, +1 FOR' },
    orc: { name: 'Orc', emoji: '👹', bonus: { forca: 3, carisma: -1 }, description: '+3 FOR, -1 CAR' },
    draconato: { name: 'Draconato', emoji: '🐉', bonus: { forca: 2, constituicao: 1, carisma: 1 }, description: '+2 FOR, +1 CON, +1 CAR' },
    elfoNegro: { name: 'Elfo Negro', emoji: '🌑', bonus: { destreza: 2, inteligencia: 2, sabedoria: -1 }, description: '+2 DEX, +2 INT, -1 SAB' },
};

const RARITY_ORDER = ['comum', 'incomum', 'raro', 'epico', 'lendario'];
const RARITY_EMOJI = { comum: '⚪', incomum: '🟢', raro: '🔵', epico: '🟣', lendario: '🟠' };
const RARITY_COLOR = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };

const LOOT_TABLE = [
    // Armas
    { id: 'espada_ferro', name: 'Espada de Ferro', type: 'arma', rarity: 'comum', stats: { atk: 5 }, price: 50 },
    { id: 'adaga_sombria', name: 'Adaga Sombria', type: 'arma', rarity: 'incomum', stats: { atk: 8, critChance: 0.05 }, price: 120 },
    { id: 'arco_longo', name: 'Arco Longo Élfico', type: 'arma', rarity: 'incomum', stats: { atk: 10, destreza: 2 }, price: 150 },
    { id: 'cajado_arcano', name: 'Cajado Arcano', type: 'arma', rarity: 'raro', stats: { atk: 7, magAtk: 15, inteligencia: 3 }, price: 300 },
    { id: 'machado_guerra', name: 'Machado de Guerra', type: 'arma', rarity: 'raro', stats: { atk: 18 }, price: 350 },
    { id: 'lamina_vento', name: 'Lâmina do Vento', type: 'arma', rarity: 'epico', stats: { atk: 22, destreza: 5, critChance: 0.1 }, price: 800 },
    { id: 'foice_ceifador', name: 'Foice do Ceifador', type: 'arma', rarity: 'epico', stats: { atk: 25, magAtk: 10 }, price: 900 },
    { id: 'excalibur', name: 'Excalibur', type: 'arma', rarity: 'lendario', stats: { atk: 35, forca: 5, constituicao: 3, critChance: 0.15 }, price: 5000 },
    { id: 'cajado_lich', name: 'Cajado do Lich', type: 'arma', rarity: 'lendario', stats: { magAtk: 40, inteligencia: 8, sabedoria: 4 }, price: 5000 },
    // Armaduras
    { id: 'armadura_couro', name: 'Armadura de Couro', type: 'armadura', rarity: 'comum', stats: { def: 5 }, price: 40 },
    { id: 'cota_malha', name: 'Cota de Malha', type: 'armadura', rarity: 'incomum', stats: { def: 10, constituicao: 1 }, price: 130 },
    { id: 'armadura_placas', name: 'Armadura de Placas', type: 'armadura', rarity: 'raro', stats: { def: 18, constituicao: 3 }, price: 400 },
    { id: 'manto_arcano', name: 'Manto Arcano', type: 'armadura', rarity: 'raro', stats: { def: 8, magDef: 15, inteligencia: 2 }, price: 350 },
    { id: 'armadura_dragao', name: 'Armadura de Escamas de Dragão', type: 'armadura', rarity: 'epico', stats: { def: 25, magDef: 10, constituicao: 4 }, price: 1000 },
    { id: 'manto_sombras', name: 'Manto das Sombras', type: 'armadura', rarity: 'epico', stats: { def: 12, destreza: 6, critChance: 0.08 }, price: 850 },
    { id: 'egide_celestial', name: 'Égide Celestial', type: 'armadura', rarity: 'lendario', stats: { def: 35, magDef: 20, constituicao: 5, sabedoria: 3 }, price: 5500 },
    // Acessórios
    { id: 'anel_vida', name: 'Anel da Vida', type: 'acessorio', rarity: 'comum', stats: { hpBonus: 20 }, price: 60 },
    { id: 'amuleto_sorte', name: 'Amuleto da Sorte', type: 'acessorio', rarity: 'incomum', stats: { critChance: 0.08, goldMult: 1.1 }, price: 200 },
    { id: 'anel_mana', name: 'Anel de Mana Infinita', type: 'acessorio', rarity: 'raro', stats: { mpBonus: 30, inteligencia: 2 }, price: 350 },
    { id: 'colar_furia', name: 'Colar da Fúria', type: 'acessorio', rarity: 'epico', stats: { atk: 12, forca: 4, critChance: 0.12 }, price: 750 },
    { id: 'coroa_lich', name: 'Coroa do Lich Rei', type: 'acessorio', rarity: 'lendario', stats: { magAtk: 20, inteligencia: 8, mpBonus: 50, sabedoria: 5 }, price: 6000 },
    // Consumíveis
    { id: 'pocao_hp', name: 'Poção de Vida', type: 'consumivel', rarity: 'comum', effect: 'heal', value: 50, price: 25 },
    { id: 'pocao_mp', name: 'Poção de Mana', type: 'consumivel', rarity: 'comum', effect: 'mana', value: 30, price: 25 },
    { id: 'pocao_hp_grande', name: 'Poção de Vida Grande', type: 'consumivel', rarity: 'incomum', effect: 'heal', value: 120, price: 75 },
    { id: 'elixir_ressurreicao', name: 'Elixir de Ressurreição', type: 'consumivel', rarity: 'raro', effect: 'revive', value: 0.5, price: 500 },
    { id: 'pergaminho_fuga', name: 'Pergaminho de Fuga', type: 'consumivel', rarity: 'incomum', effect: 'flee', value: 1, price: 100 },
];

const ENEMY_TEMPLATES = [
    // Andares 1-3
    { name: 'Goblin', emoji: '👺', baseHp: 30, baseAtk: 8, baseDef: 3, xp: 15, gold: 10, floor: [1, 3], type: 'normal' },
    { name: 'Rato Gigante', emoji: '🐀', baseHp: 20, baseAtk: 6, baseDef: 2, xp: 10, gold: 5, floor: [1, 2], type: 'normal' },
    { name: 'Esqueleto', emoji: '💀', baseHp: 35, baseAtk: 10, baseDef: 5, xp: 20, gold: 15, floor: [1, 4], type: 'undead' },
    { name: 'Slime', emoji: '🟢', baseHp: 25, baseAtk: 5, baseDef: 8, xp: 12, gold: 8, floor: [1, 2], type: 'normal' },
    // Andares 3-6
    { name: 'Orc Guerreiro', emoji: '👹', baseHp: 60, baseAtk: 15, baseDef: 8, xp: 35, gold: 25, floor: [3, 6], type: 'normal' },
    { name: 'Lobo Sombrio', emoji: '🐺', baseHp: 45, baseAtk: 18, baseDef: 5, xp: 30, gold: 20, floor: [3, 5], type: 'normal' },
    { name: 'Zumbi Corrompido', emoji: '🧟', baseHp: 55, baseAtk: 12, baseDef: 10, xp: 28, gold: 18, floor: [3, 6], type: 'undead' },
    { name: 'Aranha Venenosa', emoji: '🕷️', baseHp: 40, baseAtk: 14, baseDef: 4, xp: 25, gold: 20, floor: [3, 5], type: 'beast', poison: 5 },
    // Andares 5-9
    { name: 'Cavaleiro Negro', emoji: '🖤', baseHp: 90, baseAtk: 22, baseDef: 18, xp: 55, gold: 45, floor: [5, 9], type: 'normal' },
    { name: 'Feiticeiro Sombrio', emoji: '🧙', baseHp: 60, baseAtk: 28, baseDef: 8, xp: 50, gold: 40, floor: [5, 9], type: 'magic' },
    { name: 'Golem de Pedra', emoji: '🗿', baseHp: 120, baseAtk: 16, baseDef: 25, xp: 45, gold: 35, floor: [5, 8], type: 'normal' },
    { name: 'Vampiro', emoji: '🧛', baseHp: 75, baseAtk: 24, baseDef: 12, xp: 50, gold: 50, floor: [6, 9], type: 'undead', drain: true },
    // Andares 8-12
    { name: 'Demônio Menor', emoji: '👿', baseHp: 110, baseAtk: 30, baseDef: 15, xp: 70, gold: 60, floor: [8, 12], type: 'demon' },
    { name: 'Hidra', emoji: '🐍', baseHp: 150, baseAtk: 25, baseDef: 12, xp: 80, gold: 70, floor: [8, 11], type: 'beast' },
    { name: 'Elemental de Fogo', emoji: '🔥', baseHp: 100, baseAtk: 35, baseDef: 10, xp: 75, gold: 55, floor: [9, 12], type: 'elemental' },
    // BOSSES (a cada 5 andares)
    { name: 'Rei Goblin', emoji: '👑👺', baseHp: 200, baseAtk: 25, baseDef: 15, xp: 150, gold: 200, floor: [5, 5], type: 'boss', phases: 2 },
    { name: 'Dragão Sombrio', emoji: '🐉', baseHp: 400, baseAtk: 40, baseDef: 25, xp: 300, gold: 500, floor: [10, 10], type: 'boss', phases: 3 },
    { name: 'Lich Rei', emoji: '👑💀', baseHp: 600, baseAtk: 50, baseDef: 30, xp: 500, gold: 800, floor: [15, 15], type: 'boss', phases: 3, summons: true },
    { name: 'Deus da Destruição', emoji: '⚡💀', baseHp: 1000, baseAtk: 65, baseDef: 40, xp: 1000, gold: 2000, floor: [20, 20], type: 'boss', phases: 4 },
];

const XP_TABLE = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000, 7000, 9500, 13000, 17000, 22000, 28000, 35000, 43000, 52000, 65000];

// ═══════════════════════════════════════════════════════════════════
//  💾 PERSISTÊNCIA
// ═══════════════════════════════════════════════════════════════════

let characters = {};
let adventures = {};
let worldState = { bossesDefeated: {}, totalQuestsCompleted: 0, worldEvents: [] };

async function loadAll() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        try { characters = JSON.parse(await fs.readFile(CHARACTERS_FILE, 'utf-8')); } catch { characters = {}; }
        try { adventures = JSON.parse(await fs.readFile(ADVENTURES_FILE, 'utf-8')); } catch { adventures = {}; }
        try { worldState = JSON.parse(await fs.readFile(WORLD_FILE, 'utf-8')); } catch { worldState = { bossesDefeated: {}, totalQuestsCompleted: 0, worldEvents: [] }; }
    } catch (e) {
        console.error('[RPG] Erro ao carregar dados:', e);
    }
}

async function saveCharacters() {
    try { await fs.writeFile(CHARACTERS_FILE, JSON.stringify(characters, null, 2)); } catch (e) { console.error('[RPG] Erro ao salvar personagens:', e); }
}

async function saveAdventures() {
    try { await fs.writeFile(ADVENTURES_FILE, JSON.stringify(adventures, null, 2)); } catch (e) { console.error('[RPG] Erro ao salvar aventuras:', e); }
}

async function saveWorld() {
    try { await fs.writeFile(WORLD_FILE, JSON.stringify(worldState, null, 2)); } catch (e) { console.error('[RPG] Erro ao salvar mundo:', e); }
}

loadAll();

// ═══════════════════════════════════════════════════════════════════
//  🎲 UTILIDADES DE JOGO
// ═══════════════════════════════════════════════════════════════════

function rollDice(sides = 20) {
    return Math.floor(Math.random() * sides) + 1;
}

function rollDiceMultiple(count, sides = 6) {
    let total = 0;
    for (let i = 0; i < count; i++) total += rollDice(sides);
    return total;
}

function getXpForLevel(level) {
    if (level <= 0) return 0;
    if (level <= XP_TABLE.length) return XP_TABLE[level - 1];
    return XP_TABLE[XP_TABLE.length - 1] + (level - XP_TABLE.length) * 15000;
}

function calculateLevel(xp) {
    let level = 1;
    while (getXpForLevel(level + 1) <= xp && level < 99) level++;
    return level;
}

function getStatModifier(stat) {
    return Math.floor((stat - 10) / 2);
}

function calculateCharStats(char) {
    const cls = CLASSES[char.class];
    const race = RACES[char.race];
    const level = char.level;

    // Base stats from class + race bonuses
    const stats = { ...cls.baseStats };
    if (race.bonus) {
        for (const [k, v] of Object.entries(race.bonus)) {
            if (stats[k] !== undefined) stats[k] += v;
        }
    }

    // Level-up stat gains (every 3 levels, +1 to primary stats)
    const levelsGained = level - 1;
    stats.forca += Math.floor(levelsGained / 3);
    stats.destreza += Math.floor(levelsGained / 4);
    stats.inteligencia += Math.floor(levelsGained / 3);
    stats.constituicao += Math.floor(levelsGained / 4);

    // Equipment bonuses
    const equipment = char.equipment || {};
    for (const slot of ['arma', 'armadura', 'acessorio']) {
        const item = equipment[slot];
        if (item && item.stats) {
            for (const [k, v] of Object.entries(item.stats)) {
                if (stats[k] !== undefined) stats[k] = (stats[k] || 0) + v;
            }
        }
    }

    // Derived stats
    const maxHp = 50 + (cls.hpPerLevel * level) + (getStatModifier(stats.constituicao) * level);
    const maxMp = 20 + (cls.mpPerLevel * level) + (getStatModifier(stats.inteligencia) * Math.ceil(level / 2));
    const atk = Math.floor(getStatModifier(stats.forca) * 2.5 + level * 1.5) + (equipment.arma?.stats?.atk || 0);
    const magAtk = Math.floor(getStatModifier(stats.inteligencia) * 2.5 + level * 1.2) + (equipment.arma?.stats?.magAtk || 0);
    const def = Math.floor(getStatModifier(stats.constituicao) * 2 + level) + (equipment.armadura?.stats?.def || 0);
    const magDef = Math.floor(getStatModifier(stats.sabedoria) * 2 + level * 0.8) + (equipment.armadura?.stats?.magDef || 0);
    const critChance = 0.05 + (getStatModifier(stats.destreza) * 0.01) + (equipment.arma?.stats?.critChance || 0) + (equipment.acessorio?.stats?.critChance || 0);

    // HP/MP bonuses from accessories
    const hpBonus = equipment.acessorio?.stats?.hpBonus || 0;
    const mpBonus = equipment.acessorio?.stats?.mpBonus || 0;

    return { ...stats, maxHp: maxHp + hpBonus, maxMp: maxMp + mpBonus, atk, magAtk, def, magDef, critChance };
}

function getAvailableSkills(char) {
    const cls = CLASSES[char.class];
    if (!cls) return [];
    return cls.skills.filter(s => char.level >= s.unlockLv);
}

// ═══════════════════════════════════════════════════════════════════
//  👤 PERSONAGEM
// ═══════════════════════════════════════════════════════════════════

function createCharacter(jid, name, className, raceName) {
    const cls = CLASSES[className];
    const race = RACES[raceName];
    if (!cls) return { success: false, message: `Classe "${className}" não encontrada.` };
    if (!race) return { success: false, message: `Raça "${raceName}" não encontrada.` };
    if (characters[jid]) return { success: false, message: `Você já tem um personagem! Use */rpg reset* para deletar e criar outro.` };

    const level = 1;
    const stats = calculateCharStats({ class: className, race: raceName, level, equipment: {} });

    characters[jid] = {
        jid,
        name: name.substring(0, 20),
        class: className,
        race: raceName,
        level,
        xp: 0,
        hp: stats.maxHp,
        mp: stats.maxMp,
        gold: 50,
        inventory: [
            { ...LOOT_TABLE.find(i => i.id === 'pocao_hp'), quantity: 3 },
            { ...LOOT_TABLE.find(i => i.id === 'pocao_mp'), quantity: 2 },
        ],
        equipment: { arma: null, armadura: null, acessorio: null },
        buffs: [],
        debuffs: [],
        deaths: 0,
        monstersKilled: 0,
        bossesKilled: 0,
        questsCompleted: 0,
        floorsCleared: 0,
        totalDamageDealt: 0,
        totalGoldEarned: 50,
        achievements: [],
        createdAt: Date.now(),
        lastAdventure: 0,
    };

    saveCharacters();
    return { success: true, character: characters[jid] };
}

function getCharacter(jid) {
    return characters[jid] || null;
}

function deleteCharacter(jid) {
    if (!characters[jid]) return false;
    delete characters[jid];
    saveCharacters();
    return true;
}

function healCharacter(jid, amount) {
    const char = characters[jid];
    if (!char) return;
    const stats = calculateCharStats(char);
    char.hp = Math.min(char.hp + amount, stats.maxHp);
    saveCharacters();
}

function restoreMana(jid, amount) {
    const char = characters[jid];
    if (!char) return;
    const stats = calculateCharStats(char);
    char.mp = Math.min(char.mp + amount, stats.maxMp);
    saveCharacters();
}

function fullRest(jid) {
    const char = characters[jid];
    if (!char) return;
    const stats = calculateCharStats(char);
    char.hp = stats.maxHp;
    char.mp = stats.maxMp;
    char.buffs = [];
    char.debuffs = [];
    saveCharacters();
}

function addXp(jid, amount) {
    const char = characters[jid];
    if (!char) return null;

    const race = RACES[char.race];
    const multiplied = Math.floor(amount * (race.bonus?.xpMult || 1));
    char.xp += multiplied;

    const oldLevel = char.level;
    char.level = calculateLevel(char.xp);

    let leveledUp = false;
    if (char.level > oldLevel) {
        leveledUp = true;
        // Heal on level up
        const stats = calculateCharStats(char);
        char.hp = stats.maxHp;
        char.mp = stats.maxMp;
    }

    saveCharacters();
    return { xpGained: multiplied, leveledUp, oldLevel, newLevel: char.level };
}

function addGold(jid, amount) {
    const char = characters[jid];
    if (!char) return;
    char.gold += amount;
    if (amount > 0) char.totalGoldEarned += amount;
    saveCharacters();
}

function addItemToInventory(jid, itemId, quantity = 1) {
    const char = characters[jid];
    if (!char) return false;

    const template = LOOT_TABLE.find(i => i.id === itemId);
    if (!template) return false;

    const existing = char.inventory.find(i => i.id === itemId);
    if (existing) {
        existing.quantity = (existing.quantity || 1) + quantity;
    } else {
        char.inventory.push({ ...template, quantity });
    }
    saveCharacters();
    return true;
}

function removeItemFromInventory(jid, itemId, quantity = 1) {
    const char = characters[jid];
    if (!char) return false;

    const idx = char.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;

    char.inventory[idx].quantity = (char.inventory[idx].quantity || 1) - quantity;
    if (char.inventory[idx].quantity <= 0) char.inventory.splice(idx, 1);
    saveCharacters();
    return true;
}

function equipItem(jid, itemId) {
    const char = characters[jid];
    if (!char) return { success: false, message: 'Personagem não encontrado.' };

    const invIdx = char.inventory.findIndex(i => i.id === itemId);
    if (invIdx === -1) return { success: false, message: 'Item não encontrado no inventário.' };

    const item = char.inventory[invIdx];
    const slot = item.type;
    if (!['arma', 'armadura', 'acessorio'].includes(slot)) {
        return { success: false, message: 'Este item não pode ser equipado.' };
    }

    // Unequip current
    if (char.equipment[slot]) {
        addItemToInventory(jid, char.equipment[slot].id);
    }

    char.equipment[slot] = { ...item, quantity: undefined };
    removeItemFromInventory(jid, itemId);

    saveCharacters();
    return { success: true, message: `${item.name} equipado no slot de ${slot}!` };
}

function useConsumable(jid, itemId) {
    const char = characters[jid];
    if (!char) return { success: false, message: 'Personagem não encontrado.' };

    const item = char.inventory.find(i => i.id === itemId);
    if (!item) return { success: false, message: 'Item não encontrado.' };
    if (item.type !== 'consumivel') return { success: false, message: 'Este item não é consumível.' };

    let message = '';
    const stats = calculateCharStats(char);

    switch (item.effect) {
        case 'heal':
            const healed = Math.min(item.value, stats.maxHp - char.hp);
            char.hp = Math.min(char.hp + item.value, stats.maxHp);
            message = `Recuperou ${healed} HP! (${char.hp}/${stats.maxHp})`;
            break;
        case 'mana':
            const restored = Math.min(item.value, stats.maxMp - char.mp);
            char.mp = Math.min(char.mp + item.value, stats.maxMp);
            message = `Recuperou ${restored} MP! (${char.mp}/${stats.maxMp})`;
            break;
        default:
            message = 'Efeito desconhecido.';
    }

    removeItemFromInventory(jid, itemId);
    saveCharacters();
    return { success: true, message };
}

// ═══════════════════════════════════════════════════════════════════
//  ⚔️ SISTEMA DE COMBATE
// ═══════════════════════════════════════════════════════════════════

function generateEnemies(floor, partySize) {
    const eligible = ENEMY_TEMPLATES.filter(e => floor >= e.floor[0] && floor <= e.floor[1]);
    if (eligible.length === 0) {
        // Fallback — escala com o andar
        return [{
            name: 'Entidade Desconhecida',
            emoji: '❓',
            hp: 50 + floor * 20,
            maxHp: 50 + floor * 20,
            atk: 10 + floor * 4,
            def: 5 + floor * 2,
            xp: floor * 20,
            gold: floor * 15,
            type: 'normal',
            alive: true
        }];
    }

    // Boss floor check
    const bossTemplate = eligible.find(e => e.type === 'boss');
    if (bossTemplate) {
        const scaling = 1 + (partySize - 1) * 0.4;
        return [{
            ...bossTemplate,
            hp: Math.floor(bossTemplate.baseHp * scaling),
            maxHp: Math.floor(bossTemplate.baseHp * scaling),
            atk: Math.floor(bossTemplate.baseAtk * scaling),
            def: Math.floor(bossTemplate.baseDef * scaling),
            xp: Math.floor(bossTemplate.xp * scaling),
            gold: Math.floor(bossTemplate.gold * scaling),
            alive: true,
            phase: 1
        }];
    }

    // Normal enemies: 1-3 based on party size
    const numEnemies = Math.min(1 + Math.floor(partySize / 2), 3);
    const enemies = [];
    const normalEnemies = eligible.filter(e => e.type !== 'boss');

    for (let i = 0; i < numEnemies; i++) {
        const tmpl = normalEnemies[Math.floor(Math.random() * normalEnemies.length)];
        const scaling = 1 + (floor - tmpl.floor[0]) * 0.15;
        enemies.push({
            ...tmpl,
            hp: Math.floor(tmpl.baseHp * scaling),
            maxHp: Math.floor(tmpl.baseHp * scaling),
            atk: Math.floor(tmpl.baseAtk * scaling),
            def: Math.floor(tmpl.baseDef * scaling),
            xp: Math.floor(tmpl.xp * scaling),
            gold: Math.floor(tmpl.gold * scaling),
            alive: true,
            id: `enemy_${i}`
        });
    }
    return enemies;
}

function calculateDamage(attackerAtk, defenderDef, isCrit = false, critMult = 2) {
    const variance = 0.85 + Math.random() * 0.3; // 85%-115%
    let baseDmg = Math.max(1, Math.floor((attackerAtk * 2 - defenderDef) * variance));
    if (isCrit) baseDmg = Math.floor(baseDmg * critMult);
    return Math.max(1, baseDmg);
}

function generateLoot(floor, enemyType) {
    const drops = [];
    const baseChance = 0.25 + floor * 0.02;

    // Gold is always dropped (handled separately)

    // Item drop
    if (Math.random() < baseChance || enemyType === 'boss') {
        const maxRarity = enemyType === 'boss' ? 4 : Math.min(Math.floor(floor / 3), 4);
        const eligibleLoot = LOOT_TABLE.filter(item => {
            const rarityIdx = RARITY_ORDER.indexOf(item.rarity);
            return rarityIdx <= maxRarity;
        });

        if (eligibleLoot.length > 0) {
            // Weighted random (rarer = less likely)
            const weights = eligibleLoot.map(item => {
                const idx = RARITY_ORDER.indexOf(item.rarity);
                return Math.pow(0.4, idx);
            });
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let roll = Math.random() * totalWeight;
            for (let i = 0; i < eligibleLoot.length; i++) {
                roll -= weights[i];
                if (roll <= 0) {
                    drops.push(eligibleLoot[i]);
                    break;
                }
            }
        }
    }

    // Boss guaranteed epic+ drop
    if (enemyType === 'boss' && Math.random() < 0.7) {
        const epicPlus = LOOT_TABLE.filter(i => RARITY_ORDER.indexOf(i.rarity) >= 3 && !drops.find(d => d.id === i.id));
        if (epicPlus.length > 0) {
            drops.push(epicPlus[Math.floor(Math.random() * epicPlus.length)]);
        }
    }

    return drops;
}

// ═══════════════════════════════════════════════════════════════════
//  🏰 AVENTURA / DUNGEON
// ═══════════════════════════════════════════════════════════════════

function getAdventure(groupJid) {
    return adventures[groupJid] || null;
}

function createAdventure(groupJid, leaderJid) {
    const char = characters[leaderJid];
    if (!char) return { success: false, message: 'Você precisa criar um personagem primeiro! Use */rpg criar*' };

    if (adventures[groupJid]?.active) {
        return { success: false, message: 'Já existe uma aventura ativa neste grupo! Use */rpg status* para ver.' };
    }

    adventures[groupJid] = {
        active: true,
        phase: 'lobby', // lobby -> exploring -> combat -> reward -> exploring...
        party: [leaderJid],
        leader: leaderJid,
        floor: 1,
        currentScene: null,
        enemies: [],
        combatLog: [],
        turnOrder: [],
        currentTurn: 0,
        lastActivity: Date.now(),
        totalXpEarned: 0,
        totalGoldEarned: 0,
        floorsCleared: 0,
        history: [],
        summons: [], // Summoned creatures
    };

    saveAdventures();
    return { success: true, adventure: adventures[groupJid] };
}

function joinAdventure(groupJid, playerJid) {
    const adv = adventures[groupJid];
    if (!adv || !adv.active) return { success: false, message: 'Não há aventura ativa. Use */rpg aventura* para criar uma.' };
    if (adv.phase !== 'lobby') return { success: false, message: 'A aventura já começou! Espere a próxima.' };
    if (adv.party.includes(playerJid)) return { success: false, message: 'Você já está no grupo!' };
    if (adv.party.length >= 4) return { success: false, message: 'O grupo está cheio! (máx. 4 jogadores)' };

    const char = characters[playerJid];
    if (!char) return { success: false, message: 'Você precisa criar um personagem primeiro! Use */rpg criar*' };

    adv.party.push(playerJid);
    saveAdventures();
    return { success: true, char };
}

function startAdventure(groupJid, callerJid) {
    const adv = adventures[groupJid];
    if (!adv || !adv.active) return { success: false, message: 'Não há aventura ativa.' };
    if (adv.leader !== callerJid) return { success: false, message: 'Só o líder pode iniciar a aventura!' };
    if (adv.phase !== 'lobby') return { success: false, message: 'A aventura já está em andamento!' };

    adv.phase = 'exploring';
    adv.lastActivity = Date.now();
    saveAdventures();
    return { success: true };
}

function advanceFloor(groupJid) {
    const adv = adventures[groupJid];
    if (!adv || !adv.active) return null;

    adv.floor++;
    adv.phase = 'exploring';
    adv.enemies = [];
    adv.combatLog = [];
    adv.turnOrder = [];
    adv.currentTurn = 0;
    adv.summons = [];
    adv.floorsCleared++;
    adv.lastActivity = Date.now();

    // Rest party between floors (30% heal)
    for (const jid of adv.party) {
        const char = characters[jid];
        if (char) {
            const stats = calculateCharStats(char);
            char.hp = Math.min(char.hp + Math.floor(stats.maxHp * 0.3), stats.maxHp);
            char.mp = Math.min(char.mp + Math.floor(stats.maxMp * 0.2), stats.maxMp);
        }
    }

    saveAdventures();
    saveCharacters();
    return adv;
}

function startCombat(groupJid) {
    const adv = adventures[groupJid];
    if (!adv || !adv.active) return null;

    const enemies = generateEnemies(adv.floor, adv.party.length);
    adv.enemies = enemies;
    adv.phase = 'combat';
    adv.combatLog = [];
    adv.summons = [];

    // Turn order: players first, then enemies
    adv.turnOrder = [...adv.party.map(jid => ({ type: 'player', jid })), ...enemies.map((e, i) => ({ type: 'enemy', index: i }))];
    adv.currentTurn = 0;
    adv.lastActivity = Date.now();

    saveAdventures();
    return { enemies, adventure: adv };
}

function getCurrentTurnPlayer(groupJid) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return null;

    const turn = adv.turnOrder[adv.currentTurn % adv.turnOrder.length];
    return turn;
}

function processPlayerAttack(groupJid, attackerJid, targetIndex = 0) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return { success: false, message: 'Não há combate ativo.' };

    const currentTurn = getCurrentTurnPlayer(groupJid);
    if (!currentTurn || currentTurn.type !== 'player' || currentTurn.jid !== attackerJid) {
        return { success: false, message: 'Não é seu turno!' };
    }

    const char = characters[attackerJid];
    if (!char || char.hp <= 0) return { success: false, message: 'Seu personagem está morto!' };

    const target = adv.enemies[targetIndex];
    if (!target || !target.alive) {
        // Find first alive enemy
        const aliveIdx = adv.enemies.findIndex(e => e.alive);
        if (aliveIdx === -1) return { success: false, message: 'Todos os inimigos foram derrotados!' };
        return processPlayerAttack(groupJid, attackerJid, aliveIdx);
    }

    const stats = calculateCharStats(char);
    const isCrit = Math.random() < stats.critChance;
    const damage = calculateDamage(stats.atk, target.def, isCrit);

    target.hp = Math.max(0, target.hp - damage);
    if (target.hp <= 0) target.alive = false;

    char.totalDamageDealt += damage;

    const result = {
        success: true,
        type: 'attack',
        attacker: char.name,
        target: target.name,
        damage,
        isCrit,
        targetHp: target.hp,
        targetMaxHp: target.maxHp,
        targetAlive: target.alive,
    };

    adv.combatLog.push(result);
    advanceTurn(groupJid);

    saveAdventures();
    saveCharacters();
    return result;
}

function processPlayerSkill(groupJid, attackerJid, skillId, targetIndex = 0) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return { success: false, message: 'Não há combate ativo.' };

    const currentTurn = getCurrentTurnPlayer(groupJid);
    if (!currentTurn || currentTurn.type !== 'player' || currentTurn.jid !== attackerJid) {
        return { success: false, message: 'Não é seu turno!' };
    }

    const char = characters[attackerJid];
    if (!char || char.hp <= 0) return { success: false, message: 'Seu personagem está morto!' };

    const skill = getAvailableSkills(char).find(s => s.id === skillId);
    if (!skill) return { success: false, message: 'Habilidade não encontrada ou não desbloqueada.' };
    if (char.mp < skill.cost) return { success: false, message: `MP insuficiente! (${char.mp}/${skill.cost})` };

    char.mp -= skill.cost;
    const stats = calculateCharStats(char);
    const results = [];

    switch (skill.type) {
        case 'physical':
        case 'magic': {
            const target = adv.enemies.find(e => e.alive) || adv.enemies[targetIndex];
            if (!target?.alive) break;

            const atkStat = skill.type === 'magic' ? stats.magAtk : stats.atk;
            const defStat = skill.type === 'magic' ? 0 : target.def; // Magic ignores physical def
            const isCrit = Math.random() < (stats.critChance + (skill.critChance || 0));
            const damage = calculateDamage(Math.floor(atkStat * skill.dmgMult), defStat, isCrit, skill.critMult || 2);

            target.hp = Math.max(0, target.hp - damage);
            if (target.hp <= 0) target.alive = false;
            char.totalDamageDealt += damage;

            results.push({ target: target.name, damage, isCrit, targetHp: target.hp, targetMaxHp: target.maxHp, targetAlive: target.alive });
            break;
        }
        case 'aoe_physical':
        case 'magic_aoe': {
            const atkStat = skill.type === 'magic_aoe' ? stats.magAtk : stats.atk;
            for (const enemy of adv.enemies.filter(e => e.alive)) {
                const defStat = skill.type === 'magic_aoe' ? 0 : enemy.def;
                const damage = calculateDamage(Math.floor(atkStat * skill.dmgMult), defStat);
                enemy.hp = Math.max(0, enemy.hp - damage);
                if (enemy.hp <= 0) enemy.alive = false;
                char.totalDamageDealt += damage;
                results.push({ target: enemy.name, damage, targetHp: enemy.hp, targetMaxHp: enemy.maxHp, targetAlive: enemy.alive });
            }
            break;
        }
        case 'heal': {
            // Heal self or lowest HP party member
            let targetJid = attackerJid;
            let lowestHpPercent = 1;
            for (const pid of adv.party) {
                const pc = characters[pid];
                if (pc && pc.hp > 0) {
                    const pStats = calculateCharStats(pc);
                    const hpPercent = pc.hp / pStats.maxHp;
                    if (hpPercent < lowestHpPercent) {
                        lowestHpPercent = hpPercent;
                        targetJid = pid;
                    }
                }
            }
            const healTarget = characters[targetJid];
            const healStats = calculateCharStats(healTarget);
            const healAmount = Math.floor(stats.magAtk * skill.healMult);
            healTarget.hp = Math.min(healTarget.hp + healAmount, healStats.maxHp);
            results.push({ target: healTarget.name, healed: healAmount, hp: healTarget.hp, maxHp: healStats.maxHp });
            break;
        }
        case 'buff': {
            char.buffs.push({ stat: skill.stat, mult: skill.mult, turns: skill.turns, name: skill.name });
            results.push({ buffed: char.name, buff: skill.name, turns: skill.turns });
            break;
        }
        case 'drain': {
            const target = adv.enemies.find(e => e.alive);
            if (!target) break;
            const damage = calculateDamage(Math.floor(stats.magAtk * skill.dmgMult), 0);
            target.hp = Math.max(0, target.hp - damage);
            if (target.hp <= 0) target.alive = false;
            const healAmt = Math.floor(damage * 0.5);
            char.hp = Math.min(char.hp + healAmt, calculateCharStats(char).maxHp);
            char.totalDamageDealt += damage;
            results.push({ target: target.name, damage, healed: healAmt, targetHp: target.hp, targetAlive: target.alive });
            break;
        }
        case 'shield': {
            char.buffs.push({ stat: 'shield', amount: skill.amount + Math.floor(stats.magAtk * 0.5), turns: 3, name: skill.name });
            results.push({ buffed: char.name, shield: skill.amount + Math.floor(stats.magAtk * 0.5) });
            break;
        }
        case 'cc': {
            const target = adv.enemies.find(e => e.alive);
            if (target) {
                target.stunned = (target.stunned || 0) + skill.turns;
                results.push({ target: target.name, stunned: skill.turns });
            }
            break;
        }
        case 'holy':
        case 'holy_aoe': {
            const targets = skill.type === 'holy_aoe' ? adv.enemies.filter(e => e.alive) : [adv.enemies.find(e => e.alive)].filter(Boolean);
            for (const target of targets) {
                const holyMult = target.type === 'undead' ? 2 : 1;
                const damage = calculateDamage(Math.floor(stats.magAtk * skill.dmgMult * holyMult), 0);
                target.hp = Math.max(0, target.hp - damage);
                if (target.hp <= 0) target.alive = false;
                char.totalDamageDealt += damage;
                results.push({ target: target.name, damage, holy: true, targetAlive: target.alive });
            }
            // Holy AoE also heals
            if (skill.healMult) {
                for (const pid of adv.party) {
                    const pc = characters[pid];
                    if (pc && pc.hp > 0) {
                        const pStats = calculateCharStats(pc);
                        const heal = Math.floor(stats.magAtk * skill.healMult * 0.5);
                        pc.hp = Math.min(pc.hp + heal, pStats.maxHp);
                    }
                }
                results.push({ partyHealed: true });
            }
            break;
        }
        case 'multi_physical': {
            const hits = skill.hits || 3;
            for (let i = 0; i < hits; i++) {
                const aliveEnemies = adv.enemies.filter(e => e.alive);
                if (aliveEnemies.length === 0) break;
                const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
                const damage = calculateDamage(Math.floor(stats.atk * skill.dmgMult), target.def);
                target.hp = Math.max(0, target.hp - damage);
                if (target.hp <= 0) target.alive = false;
                char.totalDamageDealt += damage;
                results.push({ target: target.name, damage, hit: i + 1, targetAlive: target.alive });
            }
            break;
        }
        case 'summon': {
            adv.summons.push({
                name: 'Esqueleto',
                emoji: '💀',
                hp: skill.summonHp + Math.floor(stats.magAtk * 0.3),
                atk: skill.summonAtk + Math.floor(stats.magAtk * 0.2),
                owner: attackerJid,
                alive: true
            });
            results.push({ summoned: 'Esqueleto', hp: skill.summonHp + Math.floor(stats.magAtk * 0.3) });
            break;
        }
        default:
            results.push({ effect: skill.name, activated: true });
    }

    adv.combatLog.push({ type: 'skill', skill: skill.name, attacker: char.name, results });
    advanceTurn(groupJid);
    saveAdventures();
    saveCharacters();

    return { success: true, skill: skill.name, results };
}

function processPlayerDefend(groupJid, playerJid) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return { success: false, message: 'Não há combate ativo.' };

    const currentTurn = getCurrentTurnPlayer(groupJid);
    if (!currentTurn || currentTurn.type !== 'player' || currentTurn.jid !== playerJid) {
        return { success: false, message: 'Não é seu turno!' };
    }

    const char = characters[playerJid];
    if (!char) return { success: false, message: 'Personagem não encontrado.' };

    // Defending gives a shield buff
    char.buffs.push({ stat: 'shield', amount: Math.floor(calculateCharStats(char).def * 1.5), turns: 1, name: 'Defesa' });

    // Heal 5% HP
    const stats = calculateCharStats(char);
    char.hp = Math.min(char.hp + Math.floor(stats.maxHp * 0.05), stats.maxHp);

    adv.combatLog.push({ type: 'defend', player: char.name });
    advanceTurn(groupJid);
    saveAdventures();
    saveCharacters();

    return { success: true, message: `${char.name} se defende e recupera um pouco de HP!` };
}

function processPlayerFlee(groupJid, playerJid) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return { success: false, message: 'Não há combate ativo.' };

    // Can't flee from bosses
    if (adv.enemies.some(e => e.type === 'boss' && e.alive)) {
        return { success: false, message: 'Não é possível fugir de um BOSS!' };
    }

    const fleeChance = 0.4 + (adv.party.length * 0.1);
    const fled = Math.random() < fleeChance;

    if (fled) {
        adv.phase = 'exploring';
        adv.enemies = [];
        adv.combatLog = [];
        saveAdventures();
        return { success: true, fled: true, message: 'O grupo fugiu com sucesso!' };
    }

    advanceTurn(groupJid);
    saveAdventures();
    return { success: true, fled: false, message: 'Falha ao fugir! O inimigo ataca!' };
}

function processEnemyTurns(groupJid) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return [];

    const results = [];

    // Process all enemy turns
    while (true) {
        const turn = getCurrentTurnPlayer(groupJid);
        if (!turn || turn.type !== 'enemy') break;

        const enemy = adv.enemies[turn.index];
        if (!enemy || !enemy.alive) {
            advanceTurn(groupJid);
            continue;
        }

        // Stunned enemies skip turn
        if (enemy.stunned && enemy.stunned > 0) {
            enemy.stunned--;
            results.push({ type: 'stunned', enemy: enemy.name });
            advanceTurn(groupJid);
            continue;
        }

        // Find target (random alive party member)
        const aliveParty = adv.party.filter(jid => characters[jid] && characters[jid].hp > 0);
        if (aliveParty.length === 0) break;

        const targetJid = aliveParty[Math.floor(Math.random() * aliveParty.length)];
        const targetChar = characters[targetJid];
        const targetStats = calculateCharStats(targetChar);

        let damage = calculateDamage(enemy.atk, targetStats.def);

        // Check for shield buff
        const shieldBuff = targetChar.buffs.find(b => b.stat === 'shield');
        if (shieldBuff) {
            const absorbed = Math.min(shieldBuff.amount, damage);
            damage -= absorbed;
            shieldBuff.amount -= absorbed;
            if (shieldBuff.amount <= 0) {
                targetChar.buffs = targetChar.buffs.filter(b => b !== shieldBuff);
            }
        }

        // Check for mark of death debuff
        const markDebuff = targetChar.debuffs?.find(d => d.type === 'mark');
        if (markDebuff) {
            damage = Math.floor(damage * markDebuff.mult);
        }

        targetChar.hp = Math.max(0, targetChar.hp - damage);

        results.push({
            type: 'enemy_attack',
            enemy: enemy.name,
            enemyEmoji: enemy.emoji,
            target: targetChar.name,
            damage,
            targetHp: targetChar.hp,
            targetMaxHp: targetStats.maxHp,
            targetAlive: targetChar.hp > 0,
        });

        // Vampire drain
        if (enemy.drain) {
            const heal = Math.floor(damage * 0.3);
            enemy.hp = Math.min(enemy.hp + heal, enemy.maxHp);
            results.push({ type: 'drain', enemy: enemy.name, healed: heal });
        }

        // Poison effect
        if (enemy.poison) {
            targetChar.hp = Math.max(0, targetChar.hp - enemy.poison);
            results.push({ type: 'poison', target: targetChar.name, damage: enemy.poison });
        }

        if (targetChar.hp <= 0) {
            targetChar.deaths++;
        }

        // Summoned creatures also attack
        for (const summon of adv.summons.filter(s => s.alive)) {
            const sDmg = calculateDamage(summon.atk, enemy.def);
            enemy.hp = Math.max(0, enemy.hp - sDmg);
            if (enemy.hp <= 0) enemy.alive = false;
            results.push({ type: 'summon_attack', summon: summon.name, target: enemy.name, damage: sDmg });
        }

        advanceTurn(groupJid);
    }

    // Tick down buffs/debuffs
    for (const jid of adv.party) {
        const char = characters[jid];
        if (char) {
            if (char.buffs) {
                char.buffs = char.buffs.map(b => ({ ...b, turns: b.turns - 1 })).filter(b => b.turns > 0);
            }
            if (char.debuffs) {
                char.debuffs = char.debuffs.map(d => ({ ...d, turns: d.turns - 1 })).filter(d => d.turns > 0);
            }
        }
    }

    saveAdventures();
    saveCharacters();
    return results;
}

function advanceTurn(groupJid) {
    const adv = adventures[groupJid];
    if (!adv) return;
    adv.currentTurn = (adv.currentTurn + 1) % adv.turnOrder.length;
}

function checkCombatEnd(groupJid) {
    const adv = adventures[groupJid];
    if (!adv || adv.phase !== 'combat') return null;

    const allEnemiesDead = adv.enemies.every(e => !e.alive);
    const allPartyDead = adv.party.every(jid => !characters[jid] || characters[jid].hp <= 0);

    if (allEnemiesDead) {
        // Victory!
        let totalXp = 0;
        let totalGold = 0;
        const loot = [];

        for (const enemy of adv.enemies) {
            totalXp += enemy.xp;
            totalGold += enemy.gold;
            const drops = generateLoot(adv.floor, enemy.type);
            loot.push(...drops);
        }

        // Distribute rewards
        const xpPerPlayer = Math.floor(totalXp / adv.party.length);
        const goldPerPlayer = Math.floor(totalGold / adv.party.length);
        const levelUps = [];

        for (const jid of adv.party) {
            const char = characters[jid];
            if (!char) continue;
            const xpResult = addXp(jid, xpPerPlayer);
            addGold(jid, goldPerPlayer);
            char.monstersKilled += adv.enemies.length;
            if (adv.enemies.some(e => e.type === 'boss')) char.bossesKilled++;
            if (xpResult?.leveledUp) levelUps.push({ name: char.name, oldLevel: xpResult.oldLevel, newLevel: xpResult.newLevel });
        }

        // Give loot to random party member
        const lootRecipients = [];
        for (const item of loot) {
            const recipientJid = adv.party[Math.floor(Math.random() * adv.party.length)];
            addItemToInventory(recipientJid, item.id);
            lootRecipients.push({ item, recipient: characters[recipientJid]?.name || 'Alguém' });
        }

        adv.phase = 'reward';
        adv.totalXpEarned += totalXp;
        adv.totalGoldEarned += totalGold;

        saveAdventures();
        saveCharacters();

        return {
            result: 'victory',
            xpPerPlayer,
            goldPerPlayer,
            loot: lootRecipients,
            levelUps,
            wasBoss: adv.enemies.some(e => e.type === 'boss')
        };
    }

    if (allPartyDead) {
        // Defeat - end adventure
        adv.active = false;
        saveAdventures();
        return { result: 'defeat' };
    }

    return null; // Combat continues
}

function endAdventure(groupJid) {
    const adv = adventures[groupJid];
    if (!adv) return;

    // Small rest for survivors
    for (const jid of adv.party) {
        const char = characters[jid];
        if (char) {
            char.floorsCleared += adv.floorsCleared;
            char.questsCompleted++;
        }
    }

    adv.active = false;
    saveAdventures();
    saveCharacters();
    worldState.totalQuestsCompleted++;
    saveWorld();
}

// ═══════════════════════════════════════════════════════════════════
//  🛒 LOJA
// ═══════════════════════════════════════════════════════════════════

function getShopItems(floor = 1) {
    // Shop shows items appropriate to the character/floor
    const maxRarity = Math.min(Math.floor(floor / 3) + 1, 4);
    return LOOT_TABLE.filter(item => {
        const rarityIdx = RARITY_ORDER.indexOf(item.rarity);
        return rarityIdx <= maxRarity && item.price;
    });
}

function buyItem(jid, itemId) {
    const char = characters[jid];
    if (!char) return { success: false, message: 'Personagem não encontrado.' };

    const item = LOOT_TABLE.find(i => i.id === itemId);
    if (!item) return { success: false, message: 'Item não encontrado.' };
    if (char.gold < item.price) return { success: false, message: `Gold insuficiente! Você tem ${char.gold}G, precisa de ${item.price}G.` };

    char.gold -= item.price;
    addItemToInventory(jid, itemId);
    saveCharacters();

    return { success: true, message: `Comprou *${item.name}* por ${item.price}G! (Restante: ${char.gold}G)` };
}

function sellItem(jid, itemId) {
    const char = characters[jid];
    if (!char) return { success: false, message: 'Personagem não encontrado.' };

    const invItem = char.inventory.find(i => i.id === itemId);
    if (!invItem) return { success: false, message: 'Item não encontrado no inventário.' };

    const sellPrice = Math.floor((invItem.price || 10) * 0.4);
    removeItemFromInventory(jid, itemId);
    char.gold += sellPrice;
    saveCharacters();

    return { success: true, message: `Vendeu *${invItem.name}* por ${sellPrice}G! (Total: ${char.gold}G)` };
}

// ═══════════════════════════════════════════════════════════════════
//  📊 RANKING E ESTATÍSTICAS
// ═══════════════════════════════════════════════════════════════════

function getRanking(type = 'level') {
    const allChars = Object.values(characters);
    switch (type) {
        case 'level':
            return allChars.sort((a, b) => b.level - a.level || b.xp - a.xp).slice(0, 10);
        case 'gold':
            return allChars.sort((a, b) => b.gold - a.gold).slice(0, 10);
        case 'kills':
            return allChars.sort((a, b) => b.monstersKilled - a.monstersKilled).slice(0, 10);
        case 'damage':
            return allChars.sort((a, b) => b.totalDamageDealt - a.totalDamageDealt).slice(0, 10);
        case 'bosses':
            return allChars.sort((a, b) => b.bossesKilled - a.bossesKilled).slice(0, 10);
        default:
            return allChars.sort((a, b) => b.level - a.level).slice(0, 10);
    }
}

function getAllCharacters() {
    return characters;
}

// ═══════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Constants
    CLASSES, RACES, RARITY_EMOJI, RARITY_COLOR, RARITY_ORDER, LOOT_TABLE, ENEMY_TEMPLATES,
    // Character
    createCharacter, getCharacter, deleteCharacter, healCharacter, restoreMana, fullRest,
    addXp, addGold, addItemToInventory, removeItemFromInventory, equipItem, useConsumable,
    calculateCharStats, getAvailableSkills, calculateLevel, getXpForLevel,
    // Adventure
    getAdventure, createAdventure, joinAdventure, startAdventure, advanceFloor, startCombat,
    getCurrentTurnPlayer, processPlayerAttack, processPlayerSkill, processPlayerDefend, processPlayerFlee,
    processEnemyTurns, checkCombatEnd, endAdventure,
    // Shop
    getShopItems, buyItem, sellItem,
    // Stats
    getRanking, getAllCharacters,
    // Util
    rollDice, rollDiceMultiple,
    // Save
    saveCharacters, saveAdventures,
};
