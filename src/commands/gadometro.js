
const { sendGiratinaError } = require('../utils/utils.js');

async function handleGadoCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText, prefix, commandName } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let personToCheck = commandSenderJid;
    let targetName = pushName;

    if (mentionedJids.length > 0) {
        personToCheck = mentionedJids[0];
        targetName = `@${personToCheck.split('@')[0]}`;
    }

    const gadoLevel = Math.floor(Math.random() * 101);

    let responseMessage;

    if (gadoLevel <= 10) {
        responseMessage = 'Zero risco, coração de pedra!';
    } else if (gadoLevel <= 40) {
        responseMessage = 'Até que é bem controlado(a).';
    } else if (gadoLevel <= 70) {
        responseMessage = 'Cuidado, já está mugindo...';
    } else if (gadoLevel <= 99) {
        responseMessage = 'O chifre já está aparecendo!';
    } else {
        responseMessage = 'GADO(A) SUPREMO! Dono(a) do pasto inteiro!';
    }

    try {
        let mentions = personToCheck === commandSenderJid ? [] : [personToCheck];

        await sock.sendMessage(sender, {
            text: `┏━━❪ 🐂 𝗚𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗡𝗶𝘃𝗲𝗹 › *${gadoLevel}%*\n┃\n┣━━❪ 𝗩𝗘𝗥𝗗𝗜𝗖𝗧𝗢 ❫━━\n┃\n┃ ➢ _"${responseMessage}"_\n┃\n┗━━━━━━━━━━━━━━`,
            mentions: mentions
        }, { quoted: msg });

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleGadoCommand;


module.exports.commandData = {
    name: "gadometro",
    description: "Mede o nível de gado.",
    category: "diversao",
    usage: "/gadometro [@user]",
    aliases: ["/gado", "/boi", "/corno"]
};
