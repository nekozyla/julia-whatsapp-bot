// commands/gado.js
const { sendJuliaError } = require('../utils');

async function handleGadoCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    if (!isGroup) {
        // O comando pode funcionar no privado também, então não vamos restringir
    }

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let personToCheck = commandSenderJid; // Por padrão, mede quem enviou o comando
    let targetName = pushName;

    // Se alguém for marcado, o alvo muda para a pessoa marcada
    if (mentionedJids.length > 0) {
        personToCheck = mentionedJids[0];
        // Precisamos buscar o nome da pessoa marcada, mas para simplificar, usaremos a menção
        targetName = `@${personToCheck.split('@')[0]}`;
    }
    
    // Gera a porcentagem aleatória de "gado"
    const gadoLevel = Math.floor(Math.random() * 101); // De 0 a 100

    // Cria uma mensagem e um ícone baseados no nível
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
        // Monta o texto final e envia
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
