
const { sendJuliaError } = require('../utils/utils.js');
const authManager = require('../managers/authManager.js');
const config = require('../../config/config.js');

async function handleAuraCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;

    

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let personToCheck = commandSenderJid; 
    let targetName = pushName;

    
    if (mentionedJids.length > 0) {
        personToCheck = mentionedJids[0];
        targetName = `@${personToCheck.split('@')[0]}`;
    }

    
    const min = -10000;
    const max = 10000;
    let auraPoints = Math.floor(Math.random() * (max - min + 1)) + min;

    
    if (authManager.isSuperAdmin(personToCheck)) {
        auraPoints = 10000;
    }
    

    
    let responseMessage;
    let icon = '✨';

    if (auraPoints <= -5000) {
        responseMessage = 'Aura negativa absurda! Você drenou a energia de todos ao redor. 💀';
        icon = '💀';
    } else if (auraPoints < 0) {
        responseMessage = 'Perdeu aura recentemente... Precisa de fazer boas ações. 📉';
        icon = '📉';
    } else if (auraPoints <= 5000) {
        responseMessage = 'Aura estável. Nem sigma, nem beta. Apenas existindo. 😐';
        icon = '😐';
    } else if (auraPoints <= 9000) {
        responseMessage = 'Aura poderosa! Sua presença impõe respeito. 🗿';
        icon = '🗿';
    } else {
        responseMessage = 'AURA INFINITA! Você transcendeu a realidade! 🌟👑';
        icon = '🌟';
    }

    try {
        
        let finalMessage = `🔮 *MEDIDOR DE AURA* 🔮\n\n`;
        finalMessage += `Lendo a aura de ${targetName}...\n\n`;
        finalMessage += `Pontuação: *${auraPoints.toLocaleString('pt-BR')}* ${icon}\n\n`;
        finalMessage += `_"${responseMessage}"_`;

        let mentions = personToCheck === commandSenderJid ? [] : [personToCheck];

        await sock.sendMessage(sender, {
            text: finalMessage,
            mentions: mentions
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleAuraCommand;


module.exports.commandData = {
    name: "aura",
    description: "Mede a aura (+/-).",
    category: "diversao",
    usage: "/aura",
    aliases: ["/aura","/vibe","/pontos"]
};
