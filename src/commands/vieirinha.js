const answers = [
    // Positivas
    { text: 'Com certeza sim!', emoji: '✅' },
    { text: 'As estrelas dizem que sim!', emoji: '⭐' },
    { text: 'Definitivamente!', emoji: '💯' },
    { text: 'Sem dúvida nenhuma!', emoji: '🎯' },
    { text: 'Pode apostar que sim!', emoji: '🎰' },
    { text: 'SIM SIM SIM!', emoji: '🙌' },
    { text: 'Eu acredito que sim.', emoji: '🤔' },
    { text: 'Tudo indica que sim!', emoji: '📊' },
    { text: 'Os astros confirmam!', emoji: '🌟' },
    { text: 'Parece muito provável!', emoji: '🔮' },

    // Neutras
    { text: 'Hmm... talvez.', emoji: '🤷' },
    { text: 'Pergunte novamente mais tarde.', emoji: '⏳' },
    { text: 'Não consigo prever agora...', emoji: '🌫️' },
    { text: 'O destino ainda não decidiu.', emoji: '⚖️' },
    { text: 'As forças cósmicas estão confusas.', emoji: '🌀' },
    { text: 'Concentre-se e pergunte de novo.', emoji: '🧘' },
    { text: 'Melhor não te responder agora...', emoji: '😶' },
    { text: 'É incerto no momento.', emoji: '❓' },

    // Negativas
    { text: 'Não conte com isso.', emoji: '❌' },
    { text: 'As chances são bem baixas...', emoji: '📉' },
    { text: 'Minha resposta é não.', emoji: '🚫' },
    { text: 'Definitivamente não.', emoji: '💀' },
    { text: 'Nem em um milhão de anos.', emoji: '🙅' },
    { text: 'A bola de cristal diz NÃO.', emoji: '🔴' },
    { text: 'Desista enquanto é tempo.', emoji: '🏳️' },
    { text: 'Não vai rolar, amigo.', emoji: '😬' },
    { text: 'Os sinais apontam que não.', emoji: '⬇️' },
    { text: 'Seria melhor não...', emoji: '😅' },

    // Engraçadas
    { text: 'Meu advogado me aconselhou a não responder.', emoji: '👨‍⚖️' },
    { text: 'Eu sei a resposta mas não vou falar.', emoji: '🤐' },
    { text: 'Isso é confidencial.', emoji: '🔒' },
    { text: 'A Vieirinha está em manutenção, volte depois.', emoji: '🔧' },
    { text: 'Depende. Você tem dinheiro?', emoji: '💰' },
    { text: 'Joga um dado e descobre.', emoji: '🎲' },
    { text: 'Pergunta pro Google.', emoji: '🤖' },
    { text: 'Isso é pegadinha do Faustão?', emoji: '📺' },
];

async function handleVieirinhaCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const question = commandText.split(' ').slice(1).join(' ').trim();

    if (!question) {
        const text = `┏━━❪ 🔮 𝗩𝗜𝗘𝗜𝗥𝗜𝗡𝗛𝗔 ❫━━\n┃\n┃ ➢ Faça uma pergunta ao oráculo!\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <pergunta>\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} vou ser rico?\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    const answer = answers[Math.floor(Math.random() * answers.length)];

    const text = `┏━━❪ 🔮 𝗩𝗜𝗘𝗜𝗥𝗜𝗡𝗛𝗔 ❫━━\n┃\n┃ ➢ 𝗣𝗲𝗿𝗴𝘂𝗻𝘁𝗮 › _"${question}"_\n┃\n┣━━❪ ${answer.emoji} 𝗥𝗘𝗦𝗣𝗢𝗦𝗧𝗔 ❫━━\n┃\n┃ ➢ *${answer.text}*\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleVieirinhaCommand;

module.exports.commandData = {
    name: "vieirinha",
    description: "Pergunte ao oráculo Vieirinha!",
    category: "diversao",
    usage: "/vieirinha <pergunta>",
    aliases: ["/8ball", "/oraculo", "/bola8", "/boladecristal"]
};
