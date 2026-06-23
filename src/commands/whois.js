const contactManager = require('../managers/contactManager');

function normalizeToJid(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;

    if (trimmed.endsWith('@s.whatsapp.net')) {
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;

    return `${digits}@s.whatsapp.net`;
}

async function whois(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args, prefix, commandName } = msgDetails;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo || {};
    const mentionedJid = contextInfo.mentionedJid?.[0];
    const quotedParticipant = contextInfo.participant;

    const rawQuery = args.join(' ').trim();
    const queryNoAt = rawQuery.replace(/^@+/, '').trim();

    const targetFromContext = mentionedJid || quotedParticipant || null;
    const targetFromNumber = normalizeToJid(rawQuery);
    const shouldUseNumberLookup = !targetFromContext && rawQuery.length > 0 && /\d/.test(rawQuery) && !rawQuery.includes(' ');

    const targetJid = targetFromContext || (shouldUseNumberLookup ? targetFromNumber : null) || (!rawQuery ? commandSenderJid : null);

    if (targetJid) {
        const nickname = contactManager.getNickname(targetJid);

        if (!nickname) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝘂𝗮́𝗿𝗶𝗼 › @${targetJid.split('@')[0]}\n┃ ➢ 𝗡𝗶𝗰𝗸 › Não definido\n┃ ➢ 𝗝𝗜𝗗 › \`\`\`${targetJid}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`,
                mentions: [targetJid]
            }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝘂𝗮́𝗿𝗶𝗼 › @${targetJid.split('@')[0]}\n┃ ➢ 𝗡𝗶𝗰𝗸 › *${nickname}*\n┃ ➢ 𝗝𝗜𝗗 › \`\`\`${targetJid}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`,
            mentions: [targetJid]
        }, { quoted: msg });
        return true;
    }

    if (!queryNoAt) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} @usuario\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [nickname]\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [numero]\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const ownerJid = contactManager.getJidByNickname(queryNoAt);

    if (ownerJid) {
        const exactNick = contactManager.getNickname(ownerJid) || queryNoAt;
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗡𝗶𝗰𝗸 › *${exactNick}*\n┃ ➢ 𝗗𝗼𝗻𝗼 › @${ownerJid.split('@')[0]}\n┃ ➢ 𝗝𝗜𝗗 › \`\`\`${ownerJid}\`\`\`\n┃\n┗━━━━━━━━━━━━━━`,
            mentions: [ownerJid]
        }, { quoted: msg });
        return true;
    }

    const allNicknames = contactManager.getAllNicknames();
    const partialMatches = Object.entries(allNicknames)
        .filter(([, nick]) => String(nick).toLowerCase().includes(queryNoAt.toLowerCase()))
        .slice(0, 5);

    if (partialMatches.length > 0) {
        const mentions = partialMatches.map(([jid]) => jid);
        const lines = partialMatches
            .map(([jid, nick]) => `┃ ➢ *${nick}* › @${jid.split('@')[0]}`)
            .join('\n');

        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗦𝘂𝗴𝗲𝘀𝘁𝗼̃𝗲𝘀\n${lines}\n┃\n┗━━━━━━━━━━━━━━`,
            mentions
        }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(sender, {
        text: `┏━━❪ 𝗪𝗛𝗢𝗜𝗦 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não encontrei esse nickname\n┃\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });

    return true;
}

module.exports = whois;

module.exports.commandData = {
    name: 'whois',
    description: 'Mostra dono do nickname ou nickname da pessoa.',
    category: 'util',
    usage: '/whois [@usuario|nickname|numero]',
    aliases: ['/quemnick', '/nickde']
};
