const { generateSummary } = require('./perdihoje.js');

module.exports = async function handleMemoriaCommand(sock, msg, msgDetails) {
    const { sender, isGroup, args } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: 'Memória de grupo só funciona em grupo. Chocante, eu sei.' }, { quoted: msg });
        return true;
    }

    const mode = (args[0] || '24h').toLowerCase();
    let hours = 24;
    if (mode === 'hoje') {
        const now = new Date();
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        hours = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (60 * 60 * 1000)));
    } else if (/^\d+h?$/.test(mode)) {
        hours = Math.min(72, Math.max(1, parseInt(mode, 10)));
    } else if (mode !== '24h' && mode !== 'auto') {
        hours = 24;
    }

    const summary = await generateSummary(sender, hours);

    await sock.sendMessage(sender, { text: `🧠 *Memória do grupo*\n\n${summary}` }, { quoted: msg });
    return true;
};

module.exports.commandData = {
    name: 'memoria',
    description: 'Resume o que você perdeu no grupo.',
    category: 'util',
    usage: '/memoria [hoje|24h]',
    aliases: ['/memória', '/oqueperdi', '/resumohoje']
};
