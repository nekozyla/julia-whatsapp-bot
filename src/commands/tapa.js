const { handleInteraction } = require('../helpers/interactionHandler');

async function handleSlapCommand(sock, msg, msgDetails) {
    const actionName = 'tapa';
    const searchQuery = 'anime slap gif';

    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) {
            return `🤦‍♂️ ${senderName} deu um tapa na própria cara! Acorda!`;
        } else {
            return `👋 ${senderName} deu um tapa em ${targetName}! Toma essa!`;
        }
    };

    await handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator);
}

module.exports = handleSlapCommand;

module.exports.commandData = {
    name: "tapa",
    description: "Dá um tapa em alguém.",
    category: "diversao",
    usage: "/tapa",
    aliases: []
};

