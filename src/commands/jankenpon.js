async function handleJankenponCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const userChoice = args[0]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '');

    const choiceMap = {
        'pedra': 'pedra', 'rock': 'pedra', 'p': 'pedra', '🪨': 'pedra', '✊': 'pedra',
        'papel': 'papel', 'paper': 'papel', 'pa': 'papel', '📄': 'papel', '✋': 'papel',
        'tesoura': 'tesoura', 'scissors': 'tesoura', 't': 'tesoura', '✂️': 'tesoura', '✌️': 'tesoura'
    };

    const validChoice = choiceMap[userChoice];

    if (!validChoice) {
        const text = `┏━━❪ ✊✋✌️ 𝗝𝗢𝗞𝗘𝗡𝗣𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝘀𝗰𝗼𝗹𝗵𝗮 › pedra, papel ou tesoura\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <escolha>\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} pedra\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    const options = ['pedra', 'papel', 'tesoura'];
    const botChoice = options[Math.floor(Math.random() * options.length)];

    const emojis = { pedra: '✊', papel: '✋', tesoura: '✌️' };
    const names = { pedra: 'Pedra', papel: 'Papel', tesoura: 'Tesoura' };

    let result, icon;

    if (validChoice === botChoice) {
        result = 'EMPATE!';
        icon = '🤝';
    } else if (
        (validChoice === 'pedra' && botChoice === 'tesoura') ||
        (validChoice === 'papel' && botChoice === 'pedra') ||
        (validChoice === 'tesoura' && botChoice === 'papel')
    ) {
        result = 'VOCÊ VENCEU!';
        icon = '🏆';
    } else {
        result = 'VOCÊ PERDEU!';
        icon = '💀';
    }

    const text = `┏━━❪ ${icon} 𝗝𝗢𝗞𝗘𝗡𝗣𝗢 ❫━━\n┃\n┃ ➢ 𝗩𝗼𝗰𝗲 › ${emojis[validChoice]} ${names[validChoice]}\n┃ ➢ 𝗕𝗼𝘁 › ${emojis[botChoice]} ${names[botChoice]}\n┃\n┣━━❪ 𝗥𝗘𝗦𝗨𝗟𝗧𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ *${result}*\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleJankenponCommand;

module.exports.commandData = {
    name: "jankenpon",
    description: "Pedra, papel ou tesoura contra o bot!",
    category: "jogos",
    usage: "/jankenpon <pedra|papel|tesoura>",
    aliases: ["/jokenpo", "/ppt", "/pedrapapeltesoura", "/rps"]
};
