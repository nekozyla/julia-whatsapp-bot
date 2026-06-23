const adviceByTheme = {
    amor: [
        'Se a conversa parece jogo de adivinhacao, talvez falte combinarem as regras.',
        'Nao confunda frio na barriga com falta de paz.',
        'Quem quer ficar encontra assunto ate no silencio.'
    ],
    estudo: [
        'Vinte minutos focados vencem duas horas fingindo que vai comecar.',
        'Se esta dificil, reduza o tamanho da tarefa ate ela parar de assustar.',
        'Ensine o conteudo para uma cadeira. Se travar, achou o ponto que precisa revisar.'
    ],
    trabalho: [
        'Antes de acelerar, confirme se voce esta correndo na direcao certa.',
        'Uma mensagem clara hoje evita uma reuniao confusa amanha.',
        'Se tudo e urgente, nada esta priorizado.'
    ],
    vida: [
        'Nem todo atraso e derrota; as vezes e so o roteiro pedindo revisao.',
        'Beba agua, responda uma pendencia pequena e finja que foi estrategia.',
        'O melhor plano de hoje e aquele que voce consegue realmente executar.'
    ]
};

const defaultAdvice = [
    ...adviceByTheme.amor,
    ...adviceByTheme.estudo,
    ...adviceByTheme.trabalho,
    ...adviceByTheme.vida
];

function pickRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function normalizeTheme(theme) {
    return String(theme || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

async function handleConselhoCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const rawTheme = args[0];
    const theme = normalizeTheme(rawTheme);

    if (theme && !adviceByTheme[theme]) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 🔮 𝗖𝗢𝗡𝗦𝗘𝗟𝗛𝗢 ❫━━\n┃\n┃ ➢ 𝗧𝗲𝗺𝗮 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗼 › ${rawTheme}\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [amor|estudo|trabalho|vida]\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} estudo\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const adviceList = theme ? adviceByTheme[theme] : defaultAdvice;
    const advice = pickRandom(adviceList);
    const label = theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'Aleatorio';

    const text = `┏━━❪ 🔮 𝗖𝗢𝗡𝗦𝗘𝗟𝗛𝗢 ❫━━\n┃\n┃ ➢ 𝗧𝗲𝗺𝗮 › ${label}\n┃ ➢ 𝗖𝗼𝗻𝘀𝗲𝗹𝗵𝗼 › ${advice}\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleConselhoCommand;

module.exports.commandData = {
    name: "conselho",
    description: "Envia um conselho aleatorio por tema.",
    category: "diversao",
    usage: "/conselho [amor|estudo|trabalho|vida]",
    aliases: ["/oracle", "/dica", "/sabedoria"]
};
