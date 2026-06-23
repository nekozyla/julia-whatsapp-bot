/**
 * ticketManager.js — Gerencia tickets de uso do bot no PV.
 *
 * Cada ticket é um código alfanumérico que concede X dias de uso.
 * Apenas o super admin pode gerar tickets.
 * O usuário resgata o código no PV e ganha acesso temporário.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const TICKETS_FILE = path.join(__dirname, '..', '..', 'data', 'tickets.json');
const USER_ACCESS_FILE = path.join(__dirname, '..', '..', 'data', 'ticket_access.json');

// Tickets pendentes { code: { days, createdAt, createdBy } }
let pendingTickets = {};

// Acessos de usuários { jid: { expiresAt (timestamp ms), activatedCodes: [...] } }
let userAccess = {};

// ── Persistência ──────────────────────────────────────────

async function loadTickets() {
    try {
        const data = await fs.readFile(TICKETS_FILE, 'utf-8');
        pendingTickets = JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') {
            await saveTickets();
        } else {
            console.error('[Ticket] Erro ao carregar tickets:', e);
        }
    }
}

async function saveTickets() {
    try {
        await fs.writeFile(TICKETS_FILE, JSON.stringify(pendingTickets, null, 2));
    } catch (e) {
        console.error('[Ticket] Erro ao salvar tickets:', e);
    }
}

async function loadUserAccess() {
    try {
        const data = await fs.readFile(USER_ACCESS_FILE, 'utf-8');
        userAccess = JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') {
            await saveUserAccess();
        } else {
            console.error('[Ticket] Erro ao carregar acessos:', e);
        }
    }
}

async function saveUserAccess() {
    try {
        await fs.writeFile(USER_ACCESS_FILE, JSON.stringify(userAccess, null, 2));
    } catch (e) {
        console.error('[Ticket] Erro ao salvar acessos:', e);
    }
}

async function loadAll() {
    await loadTickets();
    await loadUserAccess();

}

// ── Geração de ticket ─────────────────────────────────────

function generateCode() {
    // Gera código no formato XXXX-XXXX-XXXX (alfanumérico maiúsculo)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1 para evitar confusão
    let code = '';
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) code += '-';
        code += chars[crypto.randomInt(chars.length)];
    }
    return code;
}

async function createTicket(days, createdByJid) {
    const code = generateCode();
    pendingTickets[code] = {
        days,
        createdAt: Date.now(),
        createdBy: createdByJid
    };
    await saveTickets();
    return code;
}

// ── Resgate de ticket ─────────────────────────────────────

async function redeemTicket(code, userJid) {
    const normalized = code.toUpperCase().trim();

    if (!pendingTickets[normalized]) {
        return { success: false, reason: 'invalid' };
    }

    const ticket = pendingTickets[normalized];
    const daysToAdd = ticket.days;
    const msToAdd = daysToAdd * 24 * 60 * 60 * 1000;

    // Se o user já tem acesso ativo, soma os dias a partir da expiração atual
    const now = Date.now();
    const existing = userAccess[userJid];
    let baseTimestamp = now;

    if (existing && existing.expiresAt > now) {
        baseTimestamp = existing.expiresAt; // soma em cima do tempo restante
    }

    userAccess[userJid] = {
        expiresAt: baseTimestamp + msToAdd,
        activatedCodes: [...(existing?.activatedCodes || []), normalized]
    };

    // Remove ticket do pool de pendentes
    delete pendingTickets[normalized];

    await saveTickets();
    await saveUserAccess();

    return {
        success: true,
        days: daysToAdd,
        expiresAt: userAccess[userJid].expiresAt
    };
}

// ── Verificação de acesso ─────────────────────────────────

function hasActiveAccess(userJid) {
    const entry = userAccess[userJid];
    if (!entry) return false;
    return entry.expiresAt > Date.now();
}

function getAccessInfo(userJid) {
    const entry = userAccess[userJid];
    if (!entry) return null;

    const now = Date.now();
    const remaining = entry.expiresAt - now;

    return {
        active: remaining > 0,
        expiresAt: entry.expiresAt,
        remainingMs: Math.max(0, remaining),
        activatedCodes: entry.activatedCodes || []
    };
}

// ── Administração ─────────────────────────────────────────

function listPendingTickets() {
    return Object.entries(pendingTickets).map(([code, info]) => ({
        code,
        days: info.days,
        createdAt: info.createdAt,
        createdBy: info.createdBy
    }));
}

async function revokeTicket(code) {
    const normalized = code.toUpperCase().trim();
    if (!pendingTickets[normalized]) return false;
    delete pendingTickets[normalized];
    await saveTickets();
    return true;
}

async function revokeUserAccess(userJid) {
    if (!userAccess[userJid]) return false;
    delete userAccess[userJid];
    await saveUserAccess();
    return true;
}

function getAllActiveUsers() {
    const now = Date.now();
    return Object.entries(userAccess)
        .filter(([_, info]) => info.expiresAt > now)
        .map(([jid, info]) => ({
            jid,
            expiresAt: info.expiresAt,
            remainingMs: info.expiresAt - now
        }));
}

module.exports = {
    loadAll,
    createTicket,
    redeemTicket,
    hasActiveAccess,
    getAccessInfo,
    listPendingTickets,
    revokeTicket,
    revokeUserAccess,
    getAllActiveUsers
};
