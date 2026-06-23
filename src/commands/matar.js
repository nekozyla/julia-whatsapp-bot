const { handleInteraction } = require('../helpers/interactionHandler');

async function handleKillCommand(sock, msg, msgDetails) {
    const actionName = 'matar';
    const searchQuery = (isSelf) => isSelf ? 'anime kill self gif' : 'anime gore kill gif';

    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) {
            const selfMessages = [
                `💀 ${senderName} decidiu se matar... Dramático!`,
                `☠️ ${senderName} tentou se matar mas errou o golpe. Que incompetente!`,
                `💀 ${senderName} cometeu suicídio anime. RIP eu acho...`,
            ];
            return selfMessages[Math.floor(Math.random() * selfMessages.length)];
        } else {
            const killMessages = [
                `⚔️ ${senderName} matou ${targetName}! Sem dó nem piedade!`,
                `💀 ${senderName} eliminou ${targetName} do mapa!`,
                `☠️ ${senderName} mandou ${targetName} para o outro mundo!`,
                `🗡️ ${senderName} atravessou ${targetName} com sua espada!`,
                `💀 ${targetName} foi assassinado(a) por ${senderName}. DEP!`,
            ];
            return killMessages[Math.floor(Math.random() * killMessages.length)];
        }
    };

    await handleInteraction(sock, msg, msgDetails, actionName, searchQuery, captionGenerator);
}

module.exports = handleKillCommand;

module.exports.commandData = {
    name: "matar",
    description: "Mata alguém (em anime, claro).",
    category: "diversao",
    usage: "/matar @usuario",
    aliases: ["/kill", "/assassinar"]
};
