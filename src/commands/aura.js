
const { sendGiratinaError } = require('../utils/utils.js');
const authManager = require('../managers/authManager.js');

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
        responseMessage = 'Aura negativa absurda. Drenou todos ao redor.';
        icon = '💀';
    } else if (auraPoints < 0) {
        responseMessage = 'Perdeu aura. Precisa de boas ações.';
        icon = '📉';
    } else if (auraPoints <= 5000) {
        responseMessage = 'Aura estável. Nem sigma, nem beta.';
        icon = '😐';
    } else if (auraPoints <= 9000) {
        responseMessage = 'Aura poderosa! Presença impõe respeito.';
        icon = '🗿';
    } else {
        responseMessage = 'AURA INFINITA! Transcendeu a realidade!';
        icon = '🌟';
    }

    try {
        let mentions = personToCheck === commandSenderJid ? [] : [personToCheck];

        await sock.sendMessage(sender, {
            text: `┏━━❪ ${icon} 𝗔𝗨𝗥𝗔 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗣𝗼𝗻𝘁𝗼𝘀 › *${auraPoints.toLocaleString('pt-BR')}*\n┃\n┣━━❪ 𝗩𝗘𝗥𝗗𝗜𝗖𝗧𝗢 ❫━━\n┃\n┃ ➢ _"${responseMessage}"_\n┃\n┗━━━━━━━━━━━━━━`,
            mentions: mentions
        }, { quoted: msg });

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleAuraCommand;


module.exports.commandData = {
    name: "aura",
    description: "Mede a aura (+/-).",
    category: "diversao",
    usage: "/aura [@user]",
    aliases: ["/aura", "/vibe", "/pontos"]
};
