//top10.js
const { sendJuliaError } = require('../utils/utils');
const settingsManager = require('../managers/groupSettingsManager');

/**
 * Embaralha um array de forma aleatória.
 * @param {Array} array O array a ser embaralhado.
 * @returns {Array} O array embaralhado.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function handleTopXCommand(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    // 1. O comando só funciona em grupos
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    // 2. Extrai a quantidade e o "título" do top
    const args = commandText.substring(command.length).trim().split(' ');
    let topSize = parseInt(args[0], 10);
    const topTitle = args.slice(1).join(' ');

    // 2.1. Verifica se a quantidade é um número válido e maior que 0
    if (isNaN(topSize) || topSize <= 0) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer do que é o Top X e qual o tamanho do top!\n\n*Exemplo:* `!top 5 Pessoas mais legais do grupo`" }, { quoted: msg });
        return true;
    }

    if (!topTitle) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer do que é o Top X!\n\n*Exemplo:* `!top 5 Pessoas mais legais do grupo`" }, { quoted: msg });
        return true;
    }

    try {
        // 3. Busca os metadados do grupo para obter a lista de participantes
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;

        // 4. Filtra o próprio bot e os usuários que optaram por não participar
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const optedOutUsers = settingsManager.getSetting(sender, 'optedOutUsers', []);

        let userParticipants = participants
            .map(p => p.id)
            .filter(id => id !== botJid && !optedOutUsers.includes(id));

        // 4.1. Garante que o top não terá mais participantes do que o grupo
        if (topSize > userParticipants.length) {
            topSize = userParticipants.length;
        }

        // 5. Embaralha os participantes e seleciona até a quantidade desejada
        userParticipants = shuffleArray(userParticipants);
        const topParticipants = userParticipants.slice(0, topSize);

        // Verifica se sobraram participantes para o sorteio
        if (topParticipants.length === 0) {
            await sock.sendMessage(sender, { text: "Não há participantes suficientes para a brincadeira. 😢" }, { quoted: msg });
            return true;
        }

        // 6. Monta a mensagem final do Top
        let messageText = `🏆 *TOP ${topParticipants.length} - ${topTitle.toUpperCase()}* 🏆\n\n`;
        const mentions = [];
        topParticipants.forEach((jid, index) => {
            messageText += `${index + 1}º - @${jid.split('@')[0]}\n`;
            mentions.push(jid);
        });

        console.log(`[TopX] ${pushName} gerou um Top ${topParticipants.length} no grupo ${groupMetadata.subject}.`);

        // 7. Envia a mensagem com as menções
        await sock.sendMessage(sender, {
            text: messageText.trim(),
            mentions: mentions
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleTopXCommand;
