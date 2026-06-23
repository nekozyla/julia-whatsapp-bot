async function handleEscolherCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    // Support both comma-separated and "ou" separated
    const rawArgs = commandText.split(' ').slice(1).join(' ').trim();

    if (!rawArgs) {
        const text = `┏━━❪ 🎯 𝗘𝗦𝗖𝗢𝗟𝗛𝗘𝗥 ❫━━\n┃\n┃ ➢ Precisa de ajuda pra decidir?\n┃ ➢ Deixa comigo!\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <opção1>, <opção2>, ...\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} pizza, hamburguer, sushi\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} estudar ou dormir\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    // Split by comma, "ou", or "|"
    let options = rawArgs.split(/,|\bou\b|\|/i)
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);

    if (options.length < 2) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗘𝗦𝗖𝗢𝗟𝗛𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Preciso de pelo menos 2 opções!\n┃ ➢ 𝗗𝗶𝗰𝗮 › Separe com vírgula ou "ou"\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const chosen = options[Math.floor(Math.random() * options.length)];

    const reactions = [
        'Minha escolha é clara!',
        'Nem precisei pensar muito.',
        'O destino decidiu!',
        'Depois não diz que eu não ajudei.',
        'Confie no oráculo!',
        'Escolhi de olhos fechados!',
        'A sorte está lançada!',
        'Foi difícil mas decidi.'
    ];
    const reaction = reactions[Math.floor(Math.random() * reactions.length)];

    let optionsList = options.map((opt, i) => `┃ ➢ ${i + 1}. ${opt}`).join('\n');

    const text = `┏━━❪ 🎯 𝗘𝗦𝗖𝗢𝗟𝗛𝗘𝗥 ❫━━\n┃\n${optionsList}\n┃\n┣━━❪ ✨ 𝗘𝗦𝗖𝗢𝗟𝗛𝗔 ❫━━\n┃\n┃ ➢ *${chosen}*\n┃ ➢ _"${reaction}"_\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleEscolherCommand;

module.exports.commandData = {
    name: "escolher",
    description: "Escolhe aleatoriamente entre opções.",
    category: "util",
    usage: "/escolher <opção1>, <opção2>, ...",
    aliases: ["/choose", "/decidir", "/pick", "/sorteio_rapido"]
};
