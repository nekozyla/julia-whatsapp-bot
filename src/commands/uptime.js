const START_TIME = Date.now();

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const d = days;
    const h = hours % 24;
    const m = minutes % 60;
    const s = seconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);

    return parts.join(' ');
}

async function handleUptime(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    const uptimeMs = Date.now() - START_TIME;
    const uptimeStr = formatDuration(uptimeMs);

    const startDate = new Date(START_TIME);
    const dateStr = startDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const text = `┏━━❪ 𝗨𝗣𝗧𝗜𝗠𝗘 ❫━━\n┃\n┃ ➢ 𝗧𝗲𝗺𝗽𝗼 𝗼𝗻𝗹𝗶𝗻𝗲 › ${uptimeStr}\n┃ ➢ 𝗗𝗲𝘀𝗱𝗲 › ${dateStr}\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
}

module.exports = handleUptime;

module.exports.commandData = {
    name: "uptime",
    description: "Mostra ha quanto tempo o bot esta online.",
    category: "util",
    usage: "/uptime",
    aliases: ["/tempo", "/online"]
};
