// commands/top10.js
const { sendJuliaError } = require('../utils'); // Reutilizando a função de erro

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

async function handleTop10Command(sock, msg, msgDetails) {
    const { sender, pushName, command, commandText } = msgDetails;

    // 1. O comando só funciona em grupos
    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    // 2. Extrai o "título" do top 10
    const top10Title = commandText.substring(command.length).trim();
    if (!top10Title) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer do que é o Top 10!\n\n*Exemplo:* `!top10 Pessoas mais legais do grupo`" }, { quoted: msg });
        return true;
    }

    try {
        // 3. Busca os metadados do grupo para obter a lista de participantes
        const groupMetadata = await sock.groupMetadata(sender);
        const participants = groupMetadata.participants;
        
        // 4. Filtra o próprio bot da lista e pega apenas os JIDs
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        let userParticipants = participants.map(p => p.id).filter(id => id !== botJid);

        // 5. Embaralha os participantes e seleciona os 10 primeiros
        userParticipants = shuffleArray(userParticipants);
        const top10Participants = userParticipants.slice(0, 10);
        
        // 6. Monta a mensagem final do Top 10
        let messageText = `🏆 *TOP 10 ${top10Title.toUpperCase()}* 🏆\n\n`;
        
        const mentions = [];
        top10Participants.forEach((jid, index) => {
            messageText += `${index + 1}º - @${jid.split('@')[0]}\n`;
            mentions.push(jid);
        });

        console.log(`[Top10] ${pushName} gerou um Top 10 no grupo ${groupMetadata.subject}.`);

        // 7. Envia a mensagem com as menções
        await sock.sendMessage(sender, {
            text: messageText.trim(),
            mentions: mentions // Este campo notifica os usuários
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleTop10Command;
