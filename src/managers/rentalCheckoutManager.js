const fs = require('fs').promises;
const path = require('path');

const STATE_FILE = path.join(__dirname, '..', '..', 'data', 'rental_checkout_state.json');

const defaultState = {
    seq: 0,
    checkouts: {}
};

const DEFAULT_EXPIRE_HOURS = Math.max(1, Number(process.env.RENTAL_TICKET_EXPIRE_HOURS || 24));

let state = { ...defaultState };

function ensureState() {
    if (!state || typeof state !== 'object') state = { ...defaultState };
    if (!Number.isFinite(state.seq)) state.seq = 0;
    if (!state.checkouts || typeof state.checkouts !== 'object' || Array.isArray(state.checkouts)) {
        state.checkouts = {};
    }
}

async function saveState() {
    ensureState();
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

async function loadState() {
    try {
        const raw = await fs.readFile(STATE_FILE, 'utf-8');
        state = JSON.parse(raw);
        ensureState();
    } catch (error) {
        if (error.code === 'ENOENT') {
            state = { ...defaultState };
            await saveState();
            return;
        }
        console.error('[RentalCheckout] Erro ao carregar estado:', error);
    }
}

function nextTicketId() {
    state.seq += 1;
    const id = `ALQ-${String(state.seq).padStart(6, '0')}`;
    return id;
}

function getTicket(ticketId) {
    if (!ticketId) return null;
    return state.checkouts[ticketId] || null;
}

function expireStaleTickets(maxHours = DEFAULT_EXPIRE_HOURS) {
    ensureState();
    const maxMs = Math.max(1, Number(maxHours || DEFAULT_EXPIRE_HOURS)) * 60 * 60 * 1000;
    const now = Date.now();
    const changed = [];

    for (const ticket of Object.values(state.checkouts)) {
        if (!ticket || ticket.status !== 'awaiting_proof') continue;
        if ((now - ticket.createdAt) < maxMs) continue;

        ticket.status = 'expired';
        ticket.updatedAt = now;
        ticket.closedAt = now;
        changed.push(ticket.id);
    }

    return changed;
}

function listTicketsByStatus(status) {
    const changed = expireStaleTickets();
    if (changed.length > 0) saveState().catch(() => { });

    return Object.values(state.checkouts)
        .filter(item => item.status === status)
        .sort((a, b) => b.createdAt - a.createdAt);
}

function listTicketsByUser(userJid) {
    const changed = expireStaleTickets();
    if (changed.length > 0) saveState().catch(() => { });

    return Object.values(state.checkouts)
        .filter(item => item.userJid === userJid)
        .sort((a, b) => b.createdAt - a.createdAt);
}

function getOpenTicketByUser(userJid) {
    const changed = expireStaleTickets();
    if (changed.length > 0) saveState().catch(() => { });

    const openStatuses = new Set(['awaiting_proof', 'pending_human_review', 'approved_waiting_group_link']);
    return Object.values(state.checkouts)
        .filter(item => item.userJid === userJid && openStatuses.has(item.status))
        .sort((a, b) => b.createdAt - a.createdAt)[0] || null;
}

async function closeOpenTicketsByUser(userJid, reason = 'replaced_by_new_checkout') {
    ensureState();
    const now = Date.now();
    const openStatuses = new Set(['awaiting_proof', 'pending_human_review', 'approved_waiting_group_link']);
    const closedIds = [];

    for (const ticket of Object.values(state.checkouts)) {
        if (!ticket || ticket.userJid !== userJid) continue;
        if (!openStatuses.has(ticket.status)) continue;

        ticket.status = 'cancelled';
        ticket.updatedAt = now;
        ticket.closedAt = now;
        ticket.cancelReason = reason;
        closedIds.push(ticket.id);
    }

    if (closedIds.length > 0) {
        await saveState();
    }

    return closedIds;
}

async function createTicket(payload) {
    ensureState();
    const id = nextTicketId();
    const now = Date.now();

    state.checkouts[id] = {
        id,
        userJid: payload.userJid,
        userPushName: payload.userPushName || null,
        planDays: payload.planDays,
        amountCents: payload.amountCents,
        fullAmountCents: payload.fullAmountCents || payload.amountCents,
        discountPercent: payload.discountPercent || 0,
        pixPayload: payload.pixPayload,
        pixKey: payload.pixKey,
        pixReceiver: payload.pixReceiver,
        status: 'awaiting_proof',
        createdAt: now,
        updatedAt: now,
        proof: null,
        review: null,
        invite: null,
        joinedGroupJid: null,
        closedAt: null
    };

    await saveState();
    return state.checkouts[id];
}

async function attachProof(ticketId, proof) {
    const ticket = getTicket(ticketId);
    if (!ticket) return null;

    ticket.proof = {
        submittedAt: Date.now(),
        mediaType: proof.mediaType || 'unknown',
        sourceMessageId: proof.sourceMessageId || null,
        sourceChatJid: proof.sourceChatJid || null,
        note: proof.note || ''
    };
    ticket.status = 'pending_human_review';
    ticket.updatedAt = Date.now();

    await saveState();
    return ticket;
}

async function approveTicket(ticketId, adminJid, note = '') {
    const ticket = getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = 'approved_waiting_group_link';
    ticket.updatedAt = Date.now();
    ticket.review = {
        decision: 'approved',
        by: adminJid,
        note,
        decidedAt: Date.now()
    };

    await saveState();
    return ticket;
}

async function rejectTicket(ticketId, adminJid, note = '') {
    const ticket = getTicket(ticketId);
    if (!ticket) return null;

    ticket.status = 'rejected';
    ticket.updatedAt = Date.now();
    ticket.closedAt = Date.now();
    ticket.review = {
        decision: 'rejected',
        by: adminJid,
        note,
        decidedAt: Date.now()
    };

    await saveState();
    return ticket;
}

async function setGroupInvite(ticketId, inviteLink, inviteCode) {
    const ticket = getTicket(ticketId);
    if (!ticket) return null;

    ticket.invite = {
        link: inviteLink,
        code: inviteCode,
        submittedAt: Date.now()
    };
    ticket.updatedAt = Date.now();

    await saveState();
    return ticket;
}

async function markJoined(ticketId, groupJid) {
    const ticket = getTicket(ticketId);
    if (!ticket) return null;

    ticket.joinedGroupJid = groupJid;
    ticket.status = 'completed';
    ticket.updatedAt = Date.now();
    ticket.closedAt = Date.now();

    await saveState();
    return ticket;
}

module.exports = {
    loadState,
    saveState,
    expireStaleTickets,
    getTicket,
    listTicketsByStatus,
    listTicketsByUser,
    getOpenTicketByUser,
    closeOpenTicketsByUser,
    createTicket,
    attachProof,
    approveTicket,
    rejectTicket,
    setGroupInvite,
    markJoined
};
