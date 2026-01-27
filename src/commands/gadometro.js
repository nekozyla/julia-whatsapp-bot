
const { sendJuliaError } = require('../utils/utils.js');

async function handleGadoCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    if (!isGroup) {
        
    }

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
    const icon = '🐂';

    if (gadoLevel <= 10) {
        responseMessage = 'Zero risco, coração de pedra!';
    } else if (gadoLevel <= 40) {
        responseMessage = 'Até que é bem controlado(a).';
    } else if (gadoLevel <= 70) {
        responseMessage = 'Cuidado, já está mugindo um pouco...';
    } else if (gadoLevel <= 99) {
        responseMessage = 'É oficial, o chifre já está aparecendo!';
    } else {
        responseMessage = 'GADO(A) DEMAIS! Impossível não ser, proprietário(a) de todo o pasto!';
    }

    try {
        
        let finalMessage = `🔍 *GADÔMETRO 3000* 🔍\n\n`;
        finalMessage += `Analisando o nível de gado de ${targetName}...\n\n`;
        finalMessage += `Resultado: *${gadoLevel}% Gado(a)!* ${icon}\n\n`;
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

module.exports = handleGadoCommand;


module.exports.commandData = {
    name: "gadometro",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/gadometro",
    aliases: ["/gado", "/boi", "/corno"]
};
