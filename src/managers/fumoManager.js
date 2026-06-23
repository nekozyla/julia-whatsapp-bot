const fs = require('fs').promises;
const path = require('path');

const DATA_FILE       = path.join(__dirname, '..', '..', 'data', 'fumo_counts.json');
const DAILY_DATA_FILE = path.join(__dirname, '..', '..', 'data', 'fumo_daily.json');

// { [groupJid]: { unknownBaseline: number, users: { [userJid]: { cigarro, tabaco, beck, tabeck } } } }
let fumoData = {};

// { date: "YYYY-MM-DD", groups: { [groupJid]: { [userJid]: { cigarro, tabaco, beck, tabeck } } } }
let dailyData = { date: '', groups: {} };

// ── Horário de Brasília ────────────────────────────────────────────
function getBrasiliaDateString() {
    // Brasília = UTC-3 (sem horário de verão desde 2019)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    return brt.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function getMsUntilMidnightBrasilia() {
    const now = new Date();
    // Meia-noite BRT (UTC-3) = 03:00 UTC
    const nextMidnight = new Date(now);
    nextMidnight.setUTCHours(3, 0, 0, 0);
    // Se já passou, agenda para amanhã
    if (nextMidnight.getTime() <= now.getTime()) {
        nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
    }
    return nextMidnight.getTime() - now.getTime();
}

const POINTS = {
    cigarro: 1,
    tabaco: 2,
    beck: 3,
    tabeck: 5,
};

async function load() {
    try {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        const raw = await fs.readFile(DATA_FILE, 'utf-8');
        fumoData = JSON.parse(raw);
    } catch (e) {
        if (e.code === 'ENOENT') fumoData = {};
        else console.error('[FumoManager] Erro ao carregar dados:', e);
    }
}

async function save() {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(fumoData, null, 2));
    } catch (e) {
        console.error('[FumoManager] Erro ao salvar dados:', e);
    }
}

// ── Dados diários ─────────────────────────────────────────────────
async function loadDaily() {
    try {
        const raw = await fs.readFile(DAILY_DATA_FILE, 'utf-8');
        dailyData = JSON.parse(raw);
    } catch (e) {
        if (e.code === 'ENOENT') dailyData = { date: getBrasiliaDateString(), groups: {} };
        else console.error('[FumoManager] Erro ao carregar daily:', e);
    }
}

async function saveDaily() {
    try {
        await fs.writeFile(DAILY_DATA_FILE, JSON.stringify(dailyData, null, 2));
    } catch (e) {
        console.error('[FumoManager] Erro ao salvar daily:', e);
    }
}

function checkAndResetDaily() {
    const today = getBrasiliaDateString();
    if (dailyData.date !== today) {
        console.log(`[FumoManager] Reset diário (${dailyData.date} → ${today})`);
        dailyData = { date: today, groups: {} };
        saveDaily().catch(e => console.error('[FumoManager] Erro ao salvar reset:', e));
    }
}

function ensureDailyUser(groupJid, userJid) {
    checkAndResetDaily();
    if (!dailyData.groups[groupJid]) dailyData.groups[groupJid] = {};
    if (!dailyData.groups[groupJid][userJid]) {
        dailyData.groups[groupJid][userJid] = { cigarro: 0, tabaco: 0, beck: 0, tabeck: 0 };
    }
}

// Agenda reset automático na meia-noite de Brasília
function scheduleMidnightReset() {
    const ms = getMsUntilMidnightBrasilia();
    // Segurança: nunca agendar com menos de 10s para evitar loop
    const delay = Math.max(ms, 10000) + 1000;
    console.log(`[FumoManager] Próximo reset diário em ${Math.round(delay / 60000)} min`);
    setTimeout(() => {
        checkAndResetDaily();
        scheduleMidnightReset();
    }, delay);
}

function ensureGroup(groupJid) {
    if (!fumoData[groupJid]) {
        fumoData[groupJid] = { unknownBaseline: 0, users: {} };
    }
}

function ensureUser(groupJid, userJid) {
    ensureGroup(groupJid);
    if (!fumoData[groupJid].users[userJid]) {
        fumoData[groupJid].users[userJid] = { cigarro: 0, tabaco: 0, beck: 0, tabeck: 0 };
    }
}

// Registra um fumo e salva
async function recordSmoke(groupJid, userJid, type) {
    if (!POINTS[type]) throw new Error(`Tipo inválido: ${type}`);
    ensureUser(groupJid, userJid);
    fumoData[groupJid].users[userJid][type]++;
    // diário
    ensureDailyUser(groupJid, userJid);
    dailyData.groups[groupJid][userJid][type]++;
    await Promise.all([save(), saveDaily()]);
}

// Ajusta N unidades de um tipo (delta positivo = adiciona, negativo = remove, mínimo 0)
async function adjustSmoke(groupJid, userJid, type, delta) {
    if (!POINTS[type]) throw new Error(`Tipo inválido: ${type}`);
    ensureUser(groupJid, userJid);
    const current = fumoData[groupJid].users[userJid][type];
    fumoData[groupJid].users[userJid][type] = Math.max(0, current + delta);
    // diário
    ensureDailyUser(groupJid, userJid);
    const dCurrent = dailyData.groups[groupJid][userJid][type];
    dailyData.groups[groupJid][userJid][type] = Math.max(0, dCurrent + delta);
    await Promise.all([save(), saveDaily()]);
}

// Remove um fumo (mínimo 0)
async function removeSmoke(groupJid, userJid, type) {
    if (!POINTS[type]) throw new Error(`Tipo inválido: ${type}`);
    ensureUser(groupJid, userJid);
    if (fumoData[groupJid].users[userJid][type] > 0) {
        fumoData[groupJid].users[userJid][type]--;
    }
    await save();
}

// Retorna o primeiro JID da lista de candidatos que tem dados no grupo
function findStoredJid(groupJid, candidates) {
    if (!fumoData[groupJid]) return candidates[0];
    for (const jid of candidates) {
        if (fumoData[groupJid].users?.[jid]) return jid;
    }
    return candidates[0];
}

// Define a baseline de desconhecidos (unidades, não pontos)
async function setUnknownBaseline(groupJid, value) {
    ensureGroup(groupJid);
    fumoData[groupJid].unknownBaseline = value;
    await save();
}

// Retorna total de pontos fumados no grupo + baseline
function getGroupTotal(groupJid) {
    if (!fumoData[groupJid]) return 0;
    const { users, unknownBaseline = 0 } = fumoData[groupJid];
    let total = unknownBaseline;
    for (const counts of Object.values(users)) {
        total += counts.cigarro * POINTS.cigarro +
                 counts.tabaco  * POINTS.tabaco  +
                 counts.beck    * POINTS.beck    +
                 counts.tabeck  * POINTS.tabeck;
    }
    return total;
}

// Retorna pontuação total de um usuário
function getUserPoints(groupJid, userJid) {
    const u = fumoData[groupJid]?.users?.[userJid];
    if (!u) return 0;
    return u.cigarro * POINTS.cigarro +
           u.tabaco * POINTS.tabaco +
           u.beck * POINTS.beck +
           u.tabeck * POINTS.tabeck;
}

// Retorna total de unidades de um usuário
function getUserUnits(groupJid, userJid) {
    const u = fumoData[groupJid]?.users?.[userJid];
    if (!u) return 0;
    return u.cigarro + u.tabaco + u.beck + u.tabeck;
}

// Retorna breakdown de counts por tipo de um usuário
function getUserCounts(groupJid, userJid) {
    return fumoData[groupJid]?.users?.[userJid] || { cigarro: 0, tabaco: 0, beck: 0, tabeck: 0 };
}

// Retorna ranking do grupo ordenado por pontos
function getGroupRanking(groupJid) {
    if (!fumoData[groupJid]) return [];
    return Object.entries(fumoData[groupJid].users)
        .map(([jid, counts]) => ({
            jid,
            points: counts.cigarro * POINTS.cigarro + counts.tabaco * POINTS.tabaco + counts.beck * POINTS.beck + counts.tabeck * POINTS.tabeck,
            units: counts.cigarro + counts.tabaco + counts.beck + counts.tabeck,
            counts,
        }))
        .filter(u => u.units > 0)
        .sort((a, b) => b.points - a.points);
}

function getUnknownBaseline(groupJid) {
    return fumoData[groupJid]?.unknownBaseline || 0;
}

// Retorna estatísticas por categoria: total de unidades, total de pontos e média por fumante ativo
function getGroupCategoryStats(groupJid) {
    const users = fumoData[groupJid]?.users || {};
    const types = Object.keys(POINTS);
    const stats = {};

    for (const type of types) {
        let totalUnits = 0;
        let activeFumantes = 0;
        for (const counts of Object.values(users)) {
            if (counts[type] > 0) {
                totalUnits += counts[type];
                activeFumantes++;
            }
        }
        stats[type] = {
            totalUnits,
            totalPoints: totalUnits * POINTS[type],
            activeFumantes,
            avgUnitsPerFumante: activeFumantes > 0 ? +(totalUnits / activeFumantes).toFixed(2) : 0,
        };
    }
    return stats;
}

// ── Getters diários ───────────────────────────────────────────────
function getDailyUserCounts(groupJid, userJid) {
    checkAndResetDaily();
    return dailyData.groups[groupJid]?.[userJid] || { cigarro: 0, tabaco: 0, beck: 0, tabeck: 0 };
}

function getDailyUserUnits(groupJid, userJid) {
    const c = getDailyUserCounts(groupJid, userJid);
    return c.cigarro + c.tabaco + c.beck + c.tabeck;
}

function getDailyUserPoints(groupJid, userJid) {
    const c = getDailyUserCounts(groupJid, userJid);
    return c.cigarro * POINTS.cigarro + c.tabaco * POINTS.tabaco + c.beck * POINTS.beck + c.tabeck * POINTS.tabeck;
}

function getDailyGroupRanking(groupJid) {
    checkAndResetDaily();
    const groupDay = dailyData.groups[groupJid] || {};
    return Object.entries(groupDay)
        .map(([jid, counts]) => ({
            jid,
            points: counts.cigarro * POINTS.cigarro + counts.tabaco * POINTS.tabaco + counts.beck * POINTS.beck + counts.tabeck * POINTS.tabeck,
            units: counts.cigarro + counts.tabaco + counts.beck + counts.tabeck,
            counts,
        }))
        .filter(u => u.units > 0)
        .sort((a, b) => b.points - a.points);
}

function getDailyDate() {
    return dailyData.date || getBrasiliaDateString();
}

load();
loadDaily();
scheduleMidnightReset();

module.exports = {
    POINTS,
    recordSmoke,
    removeSmoke,
    adjustSmoke,
    findStoredJid,
    setUnknownBaseline,
    getGroupTotal,
    getUserPoints,
    getUserUnits,
    getUserCounts,
    getGroupRanking,
    getUnknownBaseline,
    getGroupCategoryStats,
    getDailyUserCounts,
    getDailyUserUnits,
    getDailyUserPoints,
    getDailyGroupRanking,
    getDailyDate,
};
