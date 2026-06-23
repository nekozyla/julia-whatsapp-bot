

async function handleCoinFlipCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        const result = Math.floor(Math.random() * 2);
        const side = result === 0 ? 'Cara' : 'Coroa';
        const emoji = result === 0 ? '🤴' : '👑';

        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗠𝗢𝗘𝗗𝗔 ❫━━\n┃\n┃ ➢ 𝗥𝗲𝘀𝘂𝗹𝘁𝗮𝗱𝗼 › ${emoji} *${side}*\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });

    } catch (error) {
        console.error("Erro no comando /moeda:", error);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao jogar moeda\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }

    return true;
}

module.exports = handleCoinFlipCommand;


module.exports.commandData = {
    name: "moeda",
    description: "Cara ou coroa.",
    category: "diversao",
    usage: "/moeda",
    aliases: ["/c", "/coin", "/cara", "/coroa"]
};
