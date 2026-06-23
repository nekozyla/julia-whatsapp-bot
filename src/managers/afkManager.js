/**
 * AFK Manager — Tracks users who are Away From Keyboard.
 * Stored in-memory (resets on restart). 
 */

const afkUsers = new Map(); // key: jid, value: { reason, timestamp }

function setAfk(jid, reason = '') {
    afkUsers.set(jid, {
        reason: reason || '',
        timestamp: Date.now()
    });
}

function removeAfk(jid) {
    const was = afkUsers.get(jid);
    afkUsers.delete(jid);
    return was || null;
}

function isAfk(jid) {
    return afkUsers.has(jid);
}

function getAfk(jid) {
    return afkUsers.get(jid) || null;
}

function getTimeSince(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min`;
    return `${seconds}s`;
}

module.exports = { setAfk, removeAfk, isAfk, getAfk, getTimeSince };
