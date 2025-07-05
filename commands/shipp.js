// commands/shipp.js
const { sendJuliaError } = require('../utils'); // Reutilizando a função de erro

async function handleShippCommand(sock, msg, msgDetails) {
    const { sender, pushName, commandText } = msgDetails;
    const isGroup = sender.endsWith('@g.us');

    // 1. O comando só funciona em grupos
    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    
    let person1, person2;

    // 2. Define os "alvos" do shipp baseado na quantidade de menções
    if (mentionedJids.length === 1) {
        // Se só uma pessoa for marcada, o shipp é entre quem mandou e a pessoa marcada
        person1 = commandSenderJid;
        person2 = mentionedJids[0];

        // Evita que a pessoa se "shippe" com ela mesma
        if (person1 === person2) {
             await sock.sendMessage(sender, { text: `Ok, ${pushName}, entendi que você se ama, e isso é ótimo! Mas pra shippar, preciso de outra pessoa. 😉` }, { quoted: msg });
             return true;
        }

    } else if (mentionedJids.length === 2) {
        // Se duas pessoas forem marcadas, o shipp é entre elas
        [person1, person2] = mentionedJids;

    } else {
        // Se nenhuma ou mais de duas pessoas forem marcadas, envia as instruções
        await sock.sendMessage(sender, { text: "Para 'shippar', marque uma ou duas pessoas no comando.\n\n*Exemplos:*\n`!shipp @Amigo`\n`!shipp @Amigo1 @Amiga2`" }, { quoted: msg });
        return true;
    }

    // 3. Gera a porcentagem de compatibilidade aleatória
    const compatibility = Math.floor(Math.random() * 101); // De 0 a 100

    // 4. Cria uma mensagem divertida baseada na porcentagem
    let heartIcon = '💔';
    let message = 'Hmm, talvez seja melhor serem apenas amigos...';

    if (compatibility >= 40 && compatibility < 70) {
        heartIcon = '🤔';
        message = 'Existe uma chance! Por que não tentam?';
    } else if (compatibility >= 70 && compatibility < 90) {
        heartIcon = '❤️';
        message = 'Uau, que combinação! Isso tem futuro!';
    } else if (compatibility >= 90) {
        heartIcon = '💖';
        message = 'ALMAS GÊMEAS! A combinação é perfeita!';
    }

    try {
        // 5. Monta o texto final e envia
        let finalMessage = `✨ *CÁLCULO DE COMPATIBILIDADE* ✨\n\n`;
        finalMessage += `Analisando a conexão entre @${person1.split('@')[0]} e @${person2.split('@')[0]}...\n\n`;
        finalMessage += `Compatibilidade de: *${compatibility}%* ${heartIcon}\n\n`;
        finalMessage += `_${message}_`;
        
        console.log(`[Shipp] ${pushName} 'shippou' dois usuários no grupo.`);

        await sock.sendMessage(sender, {
            text: finalMessage,
            mentions: [person1, person2] // Garante que as duas pessoas sejam notificadas
        });

    } catch (error) {
        await sendJuliaError(sock, sender, msg, error);
    }

    return true; // Indica que o comando foi processado
}

module.exports = handleShippCommand;
