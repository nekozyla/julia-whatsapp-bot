const MORSE_MAP = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
    '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
    ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-',
    '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.', ' ': '/'
};

const REVERSE_MORSE = {};
for (const [key, value] of Object.entries(MORSE_MAP)) {
    REVERSE_MORSE[value] = key;
}

function textToMorse(text) {
    return text.toUpperCase().split('').map(char => {
        return MORSE_MAP[char] || char;
    }).join(' ');
}

function morseToText(morse) {
    return morse.split(' ').map(code => {
        if (code === '/' || code === '') return ' ';
        return REVERSE_MORSE[code] || '?';
    }).join('').replace(/\s+/g, ' ').trim();
}

function isMorse(text) {
    return /^[.\-\s/]+$/.test(text.trim());
}

async function handleMorseCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();
    const input = args.slice(1).join(' ').trim();

    // Auto-detect mode if no subcommand given
    if (!subCommand) {
        const text = `┏━━❪ 📡 𝗠𝗢𝗥𝗦𝗘 ❫━━\n┃\n┃ ➢ 𝗖𝗼𝗱𝗶𝗳𝗶𝗰𝗮𝗿 › ${prefix}${commandName} para <texto>\n┃ ➢ 𝗗𝗲𝗰𝗼𝗱𝗶𝗳𝗶𝗰𝗮𝗿 › ${prefix}${commandName} de <morse>\n┃ ➢ 𝗔𝘂𝘁𝗼 › ${prefix}${commandName} <texto ou morse>\n┃\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} para oi mundo\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} de --- .. / -- ..-\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    let mode, textInput;

    if (subCommand === 'para' || subCommand === 'encode' || subCommand === 'codificar') {
        mode = 'encode';
        textInput = input;
    } else if (subCommand === 'de' || subCommand === 'decode' || subCommand === 'decodificar') {
        mode = 'decode';
        textInput = input;
    } else {
        // Auto-detect: recombine everything
        textInput = [subCommand, ...args.slice(1)].join(' ');
        mode = isMorse(textInput) ? 'decode' : 'encode';
    }

    if (!textInput) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚠️ 𝗠𝗢𝗥𝗦𝗘 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Forneça um texto ou código morse!\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    let result;
    let modeLabel;

    if (mode === 'encode') {
        result = textToMorse(textInput);
        modeLabel = 'Texto → Morse';
    } else {
        result = morseToText(textInput);
        modeLabel = 'Morse → Texto';
    }

    if (result.length > 2000) {
        result = result.substring(0, 2000) + '...';
    }

    const text = `┏━━❪ 📡 𝗠𝗢𝗥𝗦𝗘 ❫━━\n┃\n┃ ➢ 𝗠𝗼𝗱𝗼 › ${modeLabel}\n┃\n┣━━❪ 𝗥𝗘𝗦𝗨𝗟𝗧𝗔𝗗𝗢 ❫━━\n┃\n┃ ${result}\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = handleMorseCommand;

module.exports.commandData = {
    name: "morse",
    description: "Codifica/decodifica código Morse.",
    category: "util",
    usage: "/morse <para|de> <texto>",
    aliases: ["/codigomorse", "/morsecode"]
};
