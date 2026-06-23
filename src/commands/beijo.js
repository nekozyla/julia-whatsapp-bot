const { handleInteraction } = require('../helpers/interactionHandler');

async function handleKissCommand(sock, msg, msgDetails) {
    const actionName = 'beijo';
    const searchQuery = 'anime kiss gif';

    // Passa função sem executar
    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) {
            return `😳 ${senderName} beijou... o espelho? Que amor próprio! 😘`;
        } else {
            return `😘 ${senderName} deu um beijo em ${targetName}!`;
        }
    };

    await handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator);
}

module.exports = handleKissCommand;

module.exports.commandData = {
    name: "beijo",
    description: "Beija alguém.",
    category: "diversao",
    usage: "/beijo",
    aliases: []
};

