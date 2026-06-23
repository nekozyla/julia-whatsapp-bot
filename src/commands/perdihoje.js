const { textModel } = require('../managers/geminiClient.js');
const chatLogManager = require('../managers/chatLogManager.js');

function buildFallbackSummary(logs) {
    const authors = {};
    for (const log of logs) {
        authors[log.pushName] = (authors[log.pushName] || 0) + 1;
    }

    const topAuthors = Object.entries(authors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, count]) => `${name} (${count})`)
        .join(', ');

    const highlights = logs.slice(-6).map(item => `• ${item.pushName}: ${item.text}`);

    return `Resumo rápido:\n- ${logs.length} mensagens registradas no período.\n- Mais ativos: ${topAuthors || 'ninguém se destacou'}.\n- Momentos finais:\n${highlights.join('\n')}`;
}

async function generateSummary(groupJid, hours = 24) {
    const logs = chatLogManager.getRecentLogs(groupJid, hours, 120);
    if (logs.length === 0) {
        return '📭 Nada relevante foi registrado nesse período.';
    }

    const transcript = logs
        .slice(-80)
        .map(item => `[${item.pushName}] ${item.text}`)
        .join('\n');

    const prompt = [
        `Resuma o que aconteceu em um grupo de WhatsApp nas últimas ${hours} horas.`,
        'Fale em português do Brasil.',
        'Formato: 3 blocos curtos — assunto geral, momentos importantes, clima do grupo.',
        'Se houver piadas internas, cite sem inventar contexto externo.',
        'Seja útil para alguém que ficou offline e perguntou: o que perdi hoje?',
        transcript
    ].join('\n\n');

    try {
        const result = await textModel.generateContent(prompt);
        const text = result.response.text().trim();
        return text || buildFallbackSummary(logs);
    } catch (error) {
        console.error('[PerdiHoje] Erro ao gerar resumo:', error.message);
        return buildFallbackSummary(logs);
    }
}

async function handlePerdiHojeCommand(sock, msg, msgDetails) {
    const { sender, isGroup, args } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: '❌ Esse comando só funciona em grupos.' }, { quoted: msg });
        return true;
    }

    const hours = Math.min(72, Math.max(1, parseInt(args[0], 10) || 24));
    const summary = await generateSummary(sender, hours);

    await sock.sendMessage(sender, {
        text: `🧠 *O que você perdeu nas últimas ${hours}h:*\n\n${summary}`
    }, { quoted: msg });
    return true;
}

module.exports = handlePerdiHojeCommand;
module.exports.generateSummary = generateSummary;

module.exports.commandData = {
    name: 'perdihoje',
    description: 'Resume o que rolou no grupo enquanto você estava fora.',
    category: 'util',
    usage: '/perdihoje [horas]',
    aliases: ['/oqueperdi', '/resumohoje', '/offline']
};
