const { handleInteraction } = require('../helpers/interactionHandler');

async function handlePunchCommand(sock, msg, msgDetails) {
    const actionName = 'soco';
    const searchQuery = 'anime punch gif';

    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) {
            return `😳 ${senderName} deu um soco... em si mesmo? Que masoquismo! 👊`;
        } else {
            return `👊 ${senderName} deu um soco em ${targetName}!`;
        }
    };

    await handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator);
}

module.exports = handlePunchCommand;

module.exports.commandData = {
    name: "soco",
    description: "Dá um soco em alguém.",
    category: "diversao",
    usage: "/soco",
    aliases: ["/punch", "/socar"]
};

