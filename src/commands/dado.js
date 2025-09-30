// commands/dado.js

async function handleDiceRollCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const diceNotation = args[0] || '1d6'; // Se não houver argumentos, o padrão é 1d6

    // Expressão regular para validar e extrair os números da notação (ex: "2d8", "d20")
    const diceRegex = /^(\d+)?d(\d+)$/i;
    const match = diceNotation.match(diceRegex);

    if (!match) {
        await sock.sendMessage(sender, { text: "Formato inválido. Use a notação padrão de dados, como `2d6`, `d20`, etc." }, { quoted: msg });
        return true;
    }

    // Extrai os números, define 1 como padrão para o número de dados se for omitido (ex: d20)
    const numberOfDice = match[1] ? parseInt(match[1], 10) : 1;
    const numberOfSides = parseInt(match[2], 10);

    // Limites para evitar spam ou sobrecarga
    if (numberOfDice > 100) {
        await sock.sendMessage(sender, { text: "Não consigo rolar mais de 100 dados de uma vez! 😅" }, { quoted: msg });
        return true;
    }
    if (numberOfSides > 1000) {
        await sock.sendMessage(sender, { text: "Esse dado é grande demais! O máximo de lados é 1000." }, { quoted: msg });
        return true;
    }
    if (numberOfDice === 0 || numberOfSides < 1) {
        await sock.sendMessage(sender, { text: "Não posso rolar um dado com 0 lados ou 0 vezes." }, { quoted: msg });
       return true;
   }

    try {
        const rolls = [];
        let total = 0;

        for (let i = 0; i < numberOfDice; i++) {
            const roll = Math.floor(Math.random() * numberOfSides) + 1;
            rolls.push(roll);
            total += roll;
        }

        let responseText = `🎲 Rolando *${numberOfDice}d${numberOfSides}*...\n\n`;

        if (numberOfDice === 1) {
            responseText += `O resultado é: **${total}**`;
        } else {
            responseText += `Resultados: [${rolls.join(', ')}]\nTotal: **${total}**`;
        }

        await sock.sendMessage(sender, { text: responseText }, { quoted: msg });

    } catch (error) {
        console.error("Erro no comando /dado:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao rolar o dado. 😥" });
    }
    
    return true;
}

module.exports = handleDiceRollCommand;
