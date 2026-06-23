const fs = require('fs').promises;
const path = require('path');

const RENTAL_STATE_FILE = path.join(__dirname, '..', '..', 'data', 'group_rentals.json');
const EXPIRED_NOTICE_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const state = {
    enforcementEnabled: false,
    groups: {}
};

const lastExpiredNoticeMap = new Map();

function normalizeGroupJid(groupJid) {
    if (!groupJid || typeof groupJid !== 'string') return null;
    const jid = groupJid.trim();
    return jid.endsWith('@g.us') ? jid : null;
}

function ensureStateShape() {
    if (typeof state.enforcementEnabled !== 'boolean') {
        state.enforcementEnabled = false;
    }

    if (!state.groups || typeof state.groups !== 'object' || Array.isArray(state.groups)) {
        state.groups = {};
    }

    for (const [groupJid, groupData] of Object.entries(state.groups)) {
        if (!normalizeGroupJid(groupJid)) {
            delete state.groups[groupJid];
            continue;
        }

        if (!groupData || typeof groupData !== 'object') {
            state.groups[groupJid] = {
                expiresAt: 0,
                addedAt: Date.now(),
                addedBy: null,
                updatedAt: Date.now(),
                updatedBy: null
            };
            continue;
        }

        if (!Number.isFinite(groupData.expiresAt)) {
            groupData.expiresAt = 0;
        }

        if (!Number.isFinite(groupData.addedAt)) {
            groupData.addedAt = Date.now();
        }

        if (!Number.isFinite(groupData.updatedAt)) {
            groupData.updatedAt = groupData.addedAt;
        }
    }
}

async function saveState() {
    ensureStateShape();
    await fs.writeFile(RENTAL_STATE_FILE, JSON.stringify(state, null, 2));
}

async function loadState() {
    try {
        const raw = await fs.readFile(RENTAL_STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        state.enforcementEnabled = parsed.enforcementEnabled === true;
        state.groups = parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {};
        ensureStateShape();
    } catch (error) {
        if (error.code === 'ENOENT') {
            await saveState();
            return;
        }

        console.error('[Rental] Erro ao carregar estado:', error);
    }
}

function isEnforcementEnabled() {
    return state.enforcementEnabled === true;
}

async function setEnforcementEnabled(enabled, actorJid = null) {
    state.enforcementEnabled = enabled === true;
    if (actorJid) {
        state.updatedBy = actorJid;
    }
    state.updatedAt = Date.now();
    await saveState();
    return state.enforcementEnabled;
}

function getRental(groupJid) {
    const normalized = normalizeGroupJid(groupJid);
    if (!normalized) return null;
    return state.groups[normalized] || null;
}

function getRentalStatus(groupJid) {
    const rental = getRental(groupJid);
    if (!rental) {
        return {
            exists: false,
            active: false,
            expiresAt: null,
            remainingMs: 0
        };
    }

    const now = Date.now();
    const remainingMs = Math.max(0, rental.expiresAt - now);

    return {
        exists: true,
        active: remainingMs > 0,
        expiresAt: rental.expiresAt,
        remainingMs,
        addedAt: rental.addedAt,
        addedBy: rental.addedBy,
        updatedAt: rental.updatedAt,
        updatedBy: rental.updatedBy
    };
}

async function addOrExtendRental(groupJid, days, actorJid = null) {
    const normalized = normalizeGroupJid(groupJid);
    if (!normalized) {
        return { ok: false, reason: 'invalid_group' };
    }

    const parsedDays = Number(days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
        return { ok: false, reason: 'invalid_days' };
    }

    const daysMs = Math.floor(parsedDays * 24 * 60 * 60 * 1000);
    const now = Date.now();

    const existing = state.groups[normalized] || null;
    const previousExpiresAt = existing?.expiresAt || 0;
    const baseTs = Math.max(now, previousExpiresAt);
    const newExpiresAt = baseTs + daysMs;

    state.groups[normalized] = {
        expiresAt: newExpiresAt,
        addedAt: existing?.addedAt || now,
        addedBy: existing?.addedBy || actorJid,
        updatedAt: now,
        updatedBy: actorJid
    };

    await saveState();

    return {
        ok: true,
        created: !existing,
        previousExpiresAt,
        newExpiresAt,
        addedDays: parsedDays
    };
}

async function removeRental(groupJid) {
    const normalized = normalizeGroupJid(groupJid);
    if (!normalized) return false;
    if (!state.groups[normalized]) return false;

    delete state.groups[normalized];
    await saveState();
    return true;
}

function listRentals({ includeExpired = true } = {}) {
    const now = Date.now();
    const entries = Object.entries(state.groups)
        .map(([groupJid, rental]) => {
            const remainingMs = Math.max(0, rental.expiresAt - now);
            return {
                groupJid,
                expiresAt: rental.expiresAt,
                remainingMs,
                active: remainingMs > 0,
                addedAt: rental.addedAt,
                addedBy: rental.addedBy,
                updatedAt: rental.updatedAt,
                updatedBy: rental.updatedBy
            };
        })
        .filter(item => includeExpired || item.active)
        .sort((a, b) => a.expiresAt - b.expiresAt);

    return entries;
}

function formatRemainingMs(ms) {
    const safeMs = Math.max(0, Number(ms) || 0);
    const totalSeconds = Math.floor(safeMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes}min`;
}

function shouldNotifyExpired(groupJid) {
    const normalized = normalizeGroupJid(groupJid);
    if (!normalized) return false;

    const now = Date.now();
    const lastNotice = lastExpiredNoticeMap.get(normalized) || 0;
    if ((now - lastNotice) < EXPIRED_NOTICE_COOLDOWN_MS) {
        return false;
    }

    lastExpiredNoticeMap.set(normalized, now);
    return true;
}

module.exports = {
    loadState,
    saveState,
    isEnforcementEnabled,
    setEnforcementEnabled,
    getRental,
    getRentalStatus,
    addOrExtendRental,
    removeRental,
    listRentals,
    formatRemainingMs,
    shouldNotifyExpired
};
