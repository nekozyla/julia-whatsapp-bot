

async function handleDiceRollCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const diceNotation = args[0] || '1d6';

    const diceRegex = /^(\d+)?d(\d+)$/i;
    const match = diceNotation.match(diceRegex);

    if (!match) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗗𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Formato inválido\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [XdY]\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} 2d6\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const numberOfDice = match[1] ? parseInt(match[1], 10) : 1;
    const numberOfSides = parseInt(match[2], 10);

    if (numberOfDice > 100) {
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Máximo de 100 dados\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return true;
    }
    if (numberOfSides > 1000) {
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Máximo de 1000 lados\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return true;
    }
    if (numberOfDice === 0 || numberOfSides < 1) {
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Valores inválidos\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return true;
    }

    try {
        const rolls = [];
        let total = 0;

        for (let i = 0; i < numberOfDice; i++) {
            const roll = Math.floor(Math.random() * numberOfSides) + 1;
            rolls.push(roll);
            total += roll;
        }

        let text = `┏━━❪ 🎲 𝗗𝗔𝗗𝗢 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗥𝗼𝗹𝗮𝗻𝗱𝗼 › *${numberOfDice}d${numberOfSides}*\n`;

        if (numberOfDice === 1) {
            text += `┃ ➢ 𝗥𝗲𝘀𝘂𝗹𝘁𝗮𝗱𝗼 › *${total}*\n`;
        } else {
            text += `┃ ➢ 𝗗𝗮𝗱𝗼𝘀 › [${rolls.join(', ')}]\n`;
            text += `┃ ➢ 𝗧𝗼𝘁𝗮𝗹 › *${total}*\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text }, { quoted: msg });

    } catch (error) {
        console.error("Erro no comando /dado:", error);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao rolar dado\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    return true;
}

module.exports = handleDiceRollCommand;


module.exports.commandData = {
    name: "dado",
    description: "Rola um dado (ex: 2d6).",
    category: "diversao",
    usage: "/dado [XdY]",
    aliases: ["/d", "/dice", "/rolar"]
};
