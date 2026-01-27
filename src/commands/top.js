
const { sendJuliaError } = require('../utils/utils');
const settingsManager = require('../managers/groupSettingsManager');


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function handleTopXCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    
    const args = commandText.substring(command.length).trim().split(' ');
    let topSize = parseInt(args[0], 10);
    const topTitle = args.slice(1).join(' ');

    
    if (isNaN(topSize) || topSize <= 0) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer do que é o Top X e qual o tamanho do top!\n\n*Exemplo:* `!top 5 Pessoas mais legais do grupo`" }, { quoted: msg });
        return true;
    }

    if (!topTitle) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer do que é o Top X!\n\n*Exemplo:* `!top 5 Pessoas mais legais do grupo`" }, { quoted: msg });
        return true;
    }

    try {
        
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;

        
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const optedOutUsers = settingsManager.getSetting(sender, 'optedOutUsers', []);

        let userParticipants = participants
            .map(p => p.id)
            .filter(id => id !== botJid && !optedOutUsers.includes(id));

        
        if (topSize > userParticipants.length) {
            topSize = userParticipants.length;
        }

        
        userParticipants = shuffleArray(userParticipants);
        const topParticipants = userParticipants.slice(0, topSize);

        
        if (topParticipants.length === 0) {
            await sock.sendMessage(sender, { text: "Não há participantes suficientes para a brincadeira. 😢" }, { quoted: msg });
            return true;
        }

        
        let messageText = `🏆 *TOP ${topParticipants.length} - ${topTitle.toUpperCase()}* 🏆\n\n`;
        const mentions = [];
        topParticipants.forEach((jid, index) => {
            messageText += `${index + 1}º - @${jid.split('@')[0]}\n`;
            mentions.push(jid);
        });

        console.log(`[TopX] ${pushName} gerou um Top ${topParticipants.length} no grupo ${groupMetadata.subject}.`);

        
        await sock.sendMessage(sender, {
            text: messageText.trim(),
            mentions: mentions
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; 
}

module.exports = handleTopXCommand;


module.exports.commandData = {
    name: "top",
    description: "Ranking aleatório.",
    category: "diversao",
    usage: "/top",
    aliases: ["/top10","/ranking","/lista"]
};
