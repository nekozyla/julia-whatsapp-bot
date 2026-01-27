

async function handleCoinFlipCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        
        const result = Math.floor(Math.random() * 2); 
        const side = result === 0 ? 'Cara' : 'Coroa';
        const emoji = result === 0 ? '🤴' : '👑';

        const responseText = `${emoji} A moeda girou no ar e... deu **${side}**!`;

        await sock.sendMessage(sender, { text: responseText }, { quoted: msg });

    } catch (error) {
        console.error("Erro no comando /moeda:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao jogar a moeda. 😥" });
    }

    return true;
}

module.exports = handleCoinFlipCommand;


module.exports.commandData = {
    name: "moeda",
    description: "Cara ou coroa.",
    category: "diversao",
    usage: "/moeda",
    aliases: ["/c","/coin","/cara","/coroa"]
};
