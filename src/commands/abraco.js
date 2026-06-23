const { handleInteraction } = require('../helpers/interactionHandler');

async function handleHugCommand(sock, msg, msgDetails) {
    const actionName = 'abraco';
    const searchQuery = 'anime hug gif';

    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) {
            return `🤗 ${senderName} se abraçou! Às vezes a gente só precisa de um pouco de carinho.`;
        } else {
            return `🤗 ${senderName} deu um abraço apertado em ${targetName}!`;
        }
    };

    await handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator);
}

module.exports = handleHugCommand;

module.exports.commandData = {
    name: "abraco",
    description: "Abraça alguém.",
    category: "diversao",
    usage: "/abraco",
    aliases: []
};

