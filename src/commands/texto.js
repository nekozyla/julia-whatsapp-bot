async function handleTextoCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const args = commandText.split(' ');
    const subCommand = args[1]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '');
    const inputText = args.slice(2).join(' ');

    if (!subCommand || !inputText) {
        const text = `┏━━❪ 📝 𝗧𝗘𝗫𝗧𝗢 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <modo> <texto>\n┃\n┣━━❪ 𝗠𝗢𝗗𝗢𝗦 ❫━━\n┃\n┃ ➢ *vaporwave* › ａｅｓｔｈｅｔｉｃｓ\n┃ ➢ *zombar* › ZoMbAr dE AlGuEm\n┃ ➢ *palmas* › 👏entre👏palmas\n┃ ➢ *qualidade* › Q U A L I D A D E\n┃ ➢ *maiusculo* › TEXTO GRANDE\n┃ ➢ *minusculo* › texto pequeno\n┃ ➢ *invertido* › oditrevni otxet\n┃ ➢ *emojify* › converte pra emojis\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    let result;

    switch (subCommand) {
        case 'vaporwave':
        case 'vapor':
        case 'aesthetic': {
            result = inputText.split('').map(char => {
                const code = char.charCodeAt(0);
                if (code >= 33 && code <= 126) {
                    return String.fromCharCode(code + 0xFEE0);
                }
                if (char === ' ') return '\u3000';
                return char;
            }).join('');
            break;
        }

        case 'zombar':
        case 'mock':
        case 'spongebob': {
            result = inputText.split('').map((char, i) =>
                i % 2 === 0 ? char.toLowerCase() : char.toUpperCase()
            ).join('');
            break;
        }

        case 'palmas':
        case 'clap': {
            result = inputText.split(' ').join(' 👏 ');
            result = `👏 ${result} 👏`;
            break;
        }

        case 'qualidade':
        case 'quality':
        case 'espacado': {
            result = inputText.toUpperCase().split('').join(' ');
            break;
        }

        case 'maiusculo':
        case 'upper':
        case 'caps': {
            result = inputText.toUpperCase();
            break;
        }

        case 'minusculo':
        case 'lower': {
            result = inputText.toLowerCase();
            break;
        }

        case 'invertido':
        case 'reverse':
        case 'inverter': {
            result = [...inputText].reverse().join('');
            break;
        }

        case 'emojify':
        case 'emoji': {
            result = inputText.toLowerCase().split('').map(char => {
                if (char >= 'a' && char <= 'z') {
                    return String.fromCodePoint(0x1F1E6 + char.charCodeAt(0) - 97) + ' ';
                }
                if (char >= '0' && char <= '9') {
                    const numEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
                    return numEmojis[parseInt(char)] + ' ';
                }
                if (char === ' ') return '   ';
                if (char === '!') return '❗ ';
                if (char === '?') return '❓ ';
                return char;
            }).join('');
            break;
        }

        case 'vaporqualidade':
        case 'vaporquality': {
            const spaced = inputText.toUpperCase().split('').join(' ');
            result = spaced.split('').map(char => {
                const code = char.charCodeAt(0);
                if (code >= 33 && code <= 126) {
                    return String.fromCharCode(code + 0xFEE0);
                }
                if (char === ' ') return '\u3000';
                return char;
            }).join('');
            break;
        }

        case 'vemdezap':
        case 'zap': {
            const zapEmojis = ['😍', '🥰', '😘', '💕', '❤️', '🌹', '✨', '💖', '🙏', '😂', '👉👈'];
            result = inputText.split(' ').map(word => {
                const emoji = zapEmojis[Math.floor(Math.random() * zapEmojis.length)];
                return `${word} ${emoji}`;
            }).join(' ');
            break;
        }

        default: {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚠️ 𝗧𝗘𝗫𝗧𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Modo "${subCommand}" não existe\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use ${prefix}${commandName} pra ver os modos\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }
    }

    if (result && result.length > 0) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 📝 𝗧𝗘𝗫𝗧𝗢 ❫━━\n┃\n┃ ${result}\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }

    return true;
}

module.exports = handleTextoCommand;

module.exports.commandData = {
    name: "texto",
    description: "Transforma texto em vários estilos divertidos.",
    category: "diversao",
    usage: "/texto <modo> <texto>",
    aliases: ["/text", "/txt", "/vaporwave", "/zombar"]
};
