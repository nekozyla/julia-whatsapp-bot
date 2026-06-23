/**
 * Reminder Manager — Manages user-created reminders.
 * In-memory with timeouts. Resets on bot restart.
 */

const reminders = new Map(); // key: uniqueId, value: { jid, chatJid, text, timestamp, timeout }
let idCounter = 0;

function createReminder(sock, chatJid, userJid, text, delayMs, msg) {
    const id = ++idCounter;

    const timeout = setTimeout(async () => {
        try {
            await sock.sendMessage(chatJid, {
                text: `┏━━❪ ⏰ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ @${userJid.split('@')[0]}\n┃ ➢ _"${text}"_\n┃\n┗━━━━━━━━━━━━━━`,
                mentions: [userJid]
            });
        } catch (e) {
            console.error('[Reminder] Erro ao enviar lembrete:', e);
        }
        reminders.delete(id);
    }, delayMs);

    reminders.set(id, {
        id,
        userJid,
        chatJid,
        text,
        createdAt: Date.now(),
        triggerAt: Date.now() + delayMs,
        timeout
    });

    return id;
}

function cancelReminder(id) {
    const reminder = reminders.get(id);
    if (reminder) {
        clearTimeout(reminder.timeout);
        reminders.delete(id);
        return true;
    }
    return false;
}

function getUserReminders(userJid) {
    const result = [];
    for (const [id, r] of reminders.entries()) {
        if (r.userJid === userJid) {
            result.push(r);
        }
    }
    return result;
}

function formatTimeLeft(triggerAt) {
    const diff = triggerAt - Date.now();
    if (diff <= 0) return 'agora';
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min`;
    return `${seconds}s`;
}

module.exports = { createReminder, cancelReminder, getUserReminders, formatTimeLeft };
