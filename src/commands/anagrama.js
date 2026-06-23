async function handleAnagramaCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const input = commandText.split(' ').slice(1).join(' ').trim();

    if (!input) {
        const text = `┏━━❪ 🔀 𝗔𝗡𝗔𝗚𝗥𝗔𝗠𝗔 ❫━━\n┃\n┃ ➢ Embaralhe as letras de um texto!\n┃ ➢ Perfeito pra ser misterioso 🕵️\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <texto>\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} hello world\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (input.length > 500) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗔𝗡𝗔𝗚𝗥𝗔𝗠𝗔 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Texto muito longo! (máx 500)\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // Shuffle each word individually, maintaining word positions
    const anagram = input.split(' ').map(word => {
        if (word.length <= 2) return word;
        const chars = [...word];
        // Fisher-Yates shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        // If accidentally same as original, swap first two chars
        if (chars.join('') === word && chars.length > 1) {
            [chars[0], chars[1]] = [chars[1], chars[0]];
        }
        return chars.join('');
    }).join(' ');

    const text = `┏━━❪ 🔀 𝗔𝗡𝗔𝗚𝗥𝗔𝗠𝗔 ❫━━\n┃\n┃ ➢ 𝗢𝗿𝗶𝗴𝗶𝗻𝗮𝗹 › _${input}_\n┃ ➢ 𝗔𝗻𝗮𝗴𝗿𝗮𝗺𝗮 › *${anagram}*\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleAnagramaCommand;

module.exports.commandData = {
    name: "anagrama",
    description: "Cria um anagrama embaralhando letras.",
    category: "diversao",
    usage: "/anagrama <texto>",
    aliases: ["/anagram", "/embaralhar", "/shuffle"]
};
