const reminderManager = require('../managers/reminderManager');

const TIME_REGEX = /^(\d+)\s*(s|seg|segundo|segundos|m|min|minuto|minutos|h|hora|horas|d|dia|dias)$/i;

function parseTime(args) {
    // Try patterns like "30 min", "2 horas", "1d"
    const joined = args.join(' ');

    // Pattern: "30min", "2h", "1d", "45s"
    const compactMatch = joined.match(/^(\d+)(s|m|h|d)\b/i);
    if (compactMatch) {
        const value = parseInt(compactMatch[1]);
        const unit = compactMatch[2].toLowerCase();
        const rest = joined.slice(compactMatch[0].length).trim();
        return { ms: toMs(value, unit), text: rest };
    }

    // Pattern: "30 minutos lembrar de algo"
    const fullMatch = joined.match(/^(\d+)\s*(s|seg|segundo|segundos|m|min|minuto|minutos|h|hora|horas|d|dia|dias)\s*(.*)/i);
    if (fullMatch) {
        const value = parseInt(fullMatch[1]);
        const unit = normalizeUnit(fullMatch[2]);
        const text = fullMatch[3].trim();
        return { ms: toMs(value, unit), text };
    }

    return null;
}

function normalizeUnit(unit) {
    unit = unit.toLowerCase();
    if (['s', 'seg', 'segundo', 'segundos'].includes(unit)) return 's';
    if (['m', 'min', 'minuto', 'minutos'].includes(unit)) return 'm';
    if (['h', 'hora', 'horas'].includes(unit)) return 'h';
    if (['d', 'dia', 'dias'].includes(unit)) return 'd';
    return 'm';
}

function toMs(value, unit) {
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return value * 60 * 1000;
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min`;
    return `${seconds}s`;
}

async function handleLembreteCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;
    const commandSenderJid = msg.key.participant || msg.key.remoteJid;

    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();

    // /lembrete lista
    if (subCommand === 'lista' || subCommand === 'list') {
        const userReminders = reminderManager.getUserReminders(commandSenderJid);

        if (userReminders.length === 0) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⏰ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Nenhum lembrete ativo!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        let text = `┏━━❪ ⏰ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘𝗦 ❫━━\n┃\n`;
        userReminders.forEach((r, i) => {
            text += `┃ ➢ #${r.id} › _"${r.text}"_\n`;
            text += `┃   ⏳ Em ${reminderManager.formatTimeLeft(r.triggerAt)}\n`;
        });
        text += `┃\n┃ ➢ Cancelar: ${prefix}lembrete cancelar <id>\n`;
        text += `┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    // /lembrete cancelar <id>
    if (subCommand === 'cancelar' || subCommand === 'cancel' || subCommand === 'remover') {
        const id = parseInt(args[1]);
        if (!id) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}lembrete cancelar <id>\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const success = reminderManager.cancelReminder(id);
        await sock.sendMessage(sender, {
            text: success
                ? `┏━━❪ ✅ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Lembrete #${id} cancelado!\n┃\n┗━━━━━━━━━━━━━━`
                : `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Lembrete #${id} não encontrado.\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // /lembrete <tempo> <mensagem>
    if (!subCommand) {
        const text = `┏━━❪ ⏰ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ 𝗖𝗿𝗶𝗮𝗿 ›\n┃   ${prefix}lembrete <tempo> <texto>\n┃\n┣━━❪ 𝗘𝗫𝗘𝗠𝗣𝗟𝗢𝗦 ❫━━\n┃\n┃ ➢ ${prefix}lembrete 30m estudar\n┃ ➢ ${prefix}lembrete 2h reunião\n┃ ➢ ${prefix}lembrete 1d pagar conta\n┃\n┣━━❪ 𝗢𝗣𝗖𝗢𝗘𝗦 ❫━━\n┃\n┃ ➢ ${prefix}lembrete lista\n┃ ➢ ${prefix}lembrete cancelar <id>\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    const parsed = parseTime(args);

    if (!parsed || !parsed.text) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Formato inválido!\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}lembrete <tempo> <texto>\n┃ ➢ 𝗘𝘅 › ${prefix}lembrete 30m tomar água\n┃\n┃ ➢ Tempos: s, m/min, h/hora, d/dia\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // Limits
    const MAX_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (parsed.ms > MAX_DURATION) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Máximo de 7 dias!\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    if (parsed.ms < 10000) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Mínimo de 10 segundos!\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const userReminders = reminderManager.getUserReminders(commandSenderJid);
    if (userReminders.length >= 5) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ Limite de 5 lembretes atingido!\n┃ ➢ Cancele um antes com ${prefix}lembrete cancelar <id>\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const id = reminderManager.createReminder(sock, sender, commandSenderJid, parsed.text, parsed.ms, msg);

    await sock.sendMessage(sender, {
        text: `┏━━❪ ✅ 𝗟𝗘𝗠𝗕𝗥𝗘𝗧𝗘 ❫━━\n┃\n┃ ➢ 𝗜𝗗 › #${id}\n┃ ➢ 𝗧𝗲𝘅𝘁𝗼 › _"${parsed.text}"_\n┃ ➢ 𝗘𝗺 › *${formatDuration(parsed.ms)}*\n┃\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });

    return true;
}

module.exports = handleLembreteCommand;

module.exports.commandData = {
    name: "lembrete",
    description: "Cria lembretes com temporizador.",
    category: "util",
    usage: "/lembrete <tempo> <texto>",
    aliases: ["/reminder", "/lembrar", "/timer", "/alarme"]
};
