async function handleConquistaCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const input = commandText.split(' ').slice(1).join(' ').trim();

    if (!input) {
        const text = `┏━━❪ 🏆 𝗖𝗢𝗡𝗤𝗨𝗜𝗦𝗧𝗔 ❫━━\n┃\n┃ ➢ Crie uma conquista personalizada!\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <texto>\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} Sobreviveu a segunda-feira\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} Mandou áudio de 10min\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (input.length > 100) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ ❫━━\n┃\n┃ ➢ Texto muito longo! (máx 100 chars)\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const icons = ['⚔️', '🛡️', '🏹', '🗡️', '💎', '🔮', '🌟', '🏅', '🎖️', '📜', '🔑', '🧭', '🎯', '🎪', '⚡', '🔥', '💀', '👑', '🦾', '🧩'];
    const rarities = [
        { name: 'Comum', banner: '░', chance: 0.35 },
        { name: 'Incomum', banner: '▒', chance: 0.30 },
        { name: 'Raro', banner: '▓', chance: 0.20 },
        { name: 'Épico', banner: '█', chance: 0.10 },
        { name: 'Lendário', banner: '◆', chance: 0.05 },
    ];

    // Weighted random rarity
    const roll = Math.random();
    let cumulative = 0;
    let rarity = rarities[0];
    for (const r of rarities) {
        cumulative += r.chance;
        if (roll <= cumulative) {
            rarity = r;
            break;
        }
    }

    const icon = icons[Math.floor(Math.random() * icons.length)];
    const xpGain = Math.floor(Math.random() * 500) + 50;
    const date = new Date().toLocaleDateString('pt-BR');

    const rarityColors = {
        'Comum': '⬜',
        'Incomum': '🟩',
        'Raro': '🟦',
        'Épico': '🟪',
        'Lendário': '🟨',
    };
    const rarityEmoji = rarityColors[rarity.name] || '⬜';

    const border = rarity.banner.repeat(14);

    const text = `${border}\n\n   ${icon}  *𝗖𝗢𝗡𝗤𝗨𝗜𝗦𝗧𝗔 𝗗𝗘𝗦𝗕𝗟𝗢𝗤𝗨𝗘𝗔𝗗𝗔!*\n\n   📜 _${input}_\n\n   ${rarityEmoji} Raridade: *${rarity.name}*\n   ⭐ XP: +${xpGain}\n   📅 ${date}\n\n${border}`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleConquistaCommand;

module.exports.commandData = {
    name: "conquista",
    description: "Cria uma conquista/achievement personalizada!",
    category: "diversao",
    usage: "/conquista <texto>",
    aliases: ["/achievement", "/badge", "/medalha"]
};
