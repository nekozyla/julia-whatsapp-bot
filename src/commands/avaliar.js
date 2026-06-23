const contactManager = require('../managers/contactManager');

const waifuTraits = [
    'tsundere', 'yandere', 'dandere', 'kuudere', 'deredere',
    'fofa', 'misteriosa', 'enérgica', 'tímida', 'dominadora',
    'protetora', 'ciumenta', 'carinhosa', 'badass', 'intelectual',
    'brincalhona', 'elegante', 'desastrada', 'popular', 'gótica',
    'otaku', 'gamer', 'artista', 'cozinheira', 'atleta'
];

const husbandoTraits = [
    'sigma', 'chad', 'tímido', 'misterioso', 'brincalhão',
    'protetor', 'gentleman', 'rebelde', 'nerd', 'atlético',
    'artístico', 'romântico', 'sarcástico', 'leal', 'carismático',
    'introvertido', 'aventureiro', 'workaholic', 'cozinheiro', 'gamer'
];

const ratings = [
    { min: 0, max: 10, msg: 'Horrível... Desista enquanto há tempo.', emoji: '💀' },
    { min: 11, max: 25, msg: 'Péssimo. Precisa de muito trabalho.', emoji: '😬' },
    { min: 26, max: 40, msg: 'Meh... poderia ser pior (mas não muito).', emoji: '😐' },
    { min: 41, max: 55, msg: 'Mediano. Comum como pão de forma.', emoji: '🤷' },
    { min: 56, max: 70, msg: 'Até que não é ruim! Tem potencial.', emoji: '😊' },
    { min: 71, max: 85, msg: 'Boa escolha! Gostei!', emoji: '😍' },
    { min: 86, max: 95, msg: 'EXCELENTE! S-tier sem dúvida!', emoji: '🔥' },
    { min: 96, max: 100, msg: 'PERFEIÇÃO ABSOLUTA! GOD TIER! 👑', emoji: '🏆' },
];

function getStars(score) {
    const filled = Math.round(score / 20);
    return '⭐'.repeat(filled) + '☆'.repeat(5 - filled);
}

async function handleAvaliarCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName, pushName } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '');
    const target = args.slice(1).join(' ').trim();

    if (!subCommand) {
        const text = `┏━━❪ 📊 𝗔𝗩𝗔𝗟𝗜𝗔𝗥 ❫━━\n┃\n┃ ➢ 𝗠𝗼𝗱𝗼𝘀:\n┃\n┃ ➢ ${prefix}avaliar waifu [nome]\n┃ ➢ ${prefix}avaliar husbando [nome]\n┃ ➢ ${prefix}avaliar ship <nome1> x <nome2>\n┃ ➢ ${prefix}avaliar poder [@user]\n┃ ➢ ${prefix}avaliar beleza [@user]\n┃ ➢ ${prefix}avaliar qi [@user]\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let targetName = target || pushName || 'Alguém';
    let mentions = [];

    if (mentionedJids.length > 0) {
        targetName = contactManager.getNickname(mentionedJids[0]) || `@${mentionedJids[0].split('@')[0]}`;
        mentions = [mentionedJids[0]];
    }

    const score = Math.floor(Math.random() * 101);
    const rating = ratings.find(r => score >= r.min && score <= r.max);
    const stars = getStars(score);

    switch (subCommand) {
        case 'waifu': {
            const trait1 = waifuTraits[Math.floor(Math.random() * waifuTraits.length)];
            const trait2 = waifuTraits.filter(t => t !== trait1)[Math.floor(Math.random() * (waifuTraits.length - 1))];

            const text = `┏━━❪ 💕 𝗔𝗩𝗔𝗟𝗜𝗔𝗥 𝗪𝗔𝗜𝗙𝗨 ❫━━\n┃\n┃ ➢ 𝗪𝗮𝗶𝗳𝘂 › ${targetName || 'Sua waifu'}\n┃ ➢ 𝗡𝗼𝘁𝗮 › *${score}/100* ${rating.emoji}\n┃ ➢ ${stars}\n┃\n┃ ➢ 𝗧𝗿𝗮𝗶𝘁𝘀 › ${trait1}, ${trait2}\n┃ ➢ _"${rating.msg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
            break;
        }

        case 'husbando': {
            const trait1 = husbandoTraits[Math.floor(Math.random() * husbandoTraits.length)];
            const trait2 = husbandoTraits.filter(t => t !== trait1)[Math.floor(Math.random() * (husbandoTraits.length - 1))];

            const text = `┏━━❪ 💙 𝗔𝗩𝗔𝗟𝗜𝗔𝗥 𝗛𝗨𝗦𝗕𝗔𝗡𝗗𝗢 ❫━━\n┃\n┃ ➢ 𝗛𝘂𝘀𝗯𝗮𝗻𝗱𝗼 › ${targetName || 'Seu husbando'}\n┃ ➢ 𝗡𝗼𝘁𝗮 › *${score}/100* ${rating.emoji}\n┃ ➢ ${stars}\n┃\n┃ ➢ 𝗧𝗿𝗮𝗶𝘁𝘀 › ${trait1}, ${trait2}\n┃ ➢ _"${rating.msg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
            break;
        }

        case 'ship': {
            const parts = target.split(/\s*x\s*/i);
            if (parts.length < 2) {
                await sock.sendMessage(sender, {
                    text: `┏━━❪ ⚠️ ❫━━\n┃\n┃ ➢ Use: ${prefix}avaliar ship nome1 x nome2\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
                break;
            }
            const shipScore = Math.floor(Math.random() * 101);
            const shipRating = ratings.find(r => shipScore >= r.min && shipScore <= r.max);
            const shipName = parts[0].trim().slice(0, 3) + parts[1].trim().slice(-3);

            const text = `┏━━❪ 💘 𝗦𝗛𝗜𝗣 ❫━━\n┃\n┃ ➢ ${parts[0].trim()} x ${parts[1].trim()}\n┃ ➢ 𝗡𝗼𝗺𝗲 › *${shipName}*\n┃ ➢ 𝗖𝗼𝗺𝗽𝗮𝘁 › *${shipScore}%* ${shipRating.emoji}\n┃ ➢ ${getStars(shipScore)}\n┃\n┃ ➢ _"${shipRating.msg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            break;
        }

        case 'poder':
        case 'power': {
            const power = Math.floor(Math.random() * 10001);
            let powerRank;
            if (power <= 1000) powerRank = 'Humano comum 🧍';
            else if (power <= 3000) powerRank = 'Guerreiro 🗡️';
            else if (power <= 5000) powerRank = 'Super-herói 🦸';
            else if (power <= 7000) powerRank = 'Saiyajin 💪';
            else if (power <= 9000) powerRank = 'Over 9000! 🔥';
            else powerRank = 'DEUS SUPREMO 👑';

            const text = `┏━━❪ ⚡ 𝗣𝗢𝗗𝗘𝗥 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗣𝗼𝗱𝗲𝗿 › *${power.toLocaleString('pt-BR')}*\n┃ ➢ 𝗥𝗮𝗻𝗸 › ${powerRank}\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
            break;
        }

        case 'beleza':
        case 'beauty': {
            let beautyMsg;
            if (score <= 20) beautyMsg = 'Investe num skincare urgente...';
            else if (score <= 40) beautyMsg = 'Beleza interior é o que importa...(?)';
            else if (score <= 60) beautyMsg = 'Mediano, nada a declarar.';
            else if (score <= 80) beautyMsg = 'Bonito(a)! Gatíssimo(a)!';
            else if (score <= 95) beautyMsg = 'Modelo da Vogue? É você?';
            else beautyMsg = 'É proibido ser tão bonito(a) assim!';

            const text = `┏━━❪ 💎 𝗕𝗘𝗟𝗘𝗭𝗔 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗡𝗼𝘁𝗮 › *${score}/100*\n┃ ➢ ${stars}\n┃ ➢ _"${beautyMsg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
            break;
        }

        case 'qi':
        case 'iq': {
            const iq = Math.floor(Math.random() * 200) + 20;
            let iqMsg;
            if (iq <= 70) iqMsg = 'Hmm... na dúvida, não fale nada.';
            else if (iq <= 90) iqMsg = 'Abaixo da média. Leia mais livros!';
            else if (iq <= 110) iqMsg = 'Normal. Igual a maioria das pessoas.';
            else if (iq <= 130) iqMsg = 'Acima da média! Esperto(a)!';
            else if (iq <= 160) iqMsg = 'Gênio! Einstein ficaria orgulhoso!';
            else iqMsg = 'QI impossível! Você hackeou o bot?!';

            const text = `┏━━❪ 🧠 𝗤𝗜 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${targetName}\n┃ ➢ 𝗤𝗜 › *${iq}*\n┃ ➢ _"${iqMsg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
            break;
        }

        default: {
            // Avaliar qualquer coisa genérica
            const thing = args.join(' ') || 'essa coisa';
            const text = `┏━━❪ 📊 𝗔𝗩𝗔𝗟𝗜𝗔𝗥 ❫━━\n┃\n┃ ➢ 𝗔𝗹𝘃𝗼 › ${thing}\n┃ ➢ 𝗡𝗼𝘁𝗮 › *${score}/100* ${rating.emoji}\n┃ ➢ ${stars}\n┃ ➢ _"${rating.msg}"_\n┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            break;
        }
    }

    return true;
}

module.exports = handleAvaliarCommand;

module.exports.commandData = {
    name: "avaliar",
    description: "Avalia waifu, husbando, poder, beleza, QI e mais!",
    category: "diversao",
    usage: "/avaliar <modo> [alvo]",
    aliases: ["/rate", "/nota", "/waifu", "/husbando"]
};
