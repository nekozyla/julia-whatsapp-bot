// commands/modomeme.js
const settingsManager = require('../groupSettingsManager');

// A nova lista de emojis, muito maior e mais caótica
const memeEmojis = [
    '😂', '💀', '😭', '🤣', '🔥', '💯', '🤡', '🤯', '🤔', '🤪', '🗿', '🙏', '🤨', 
    '👀', '🍿', '💅', '✨', '🎉', '🎈', '❤️', '💔', '💩', '👍', '👎', '👋', '👻', 
    '👽', '🤖', '🎃', '👑', '💎', '💰', '📈', '📉', '🚀', '💥', '🌟', '💫', '⚰️',
    '🐸', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '�',
    '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
    '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳',
    '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫',
    '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕',
    '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🦢', '🐓', '🦃', '🕊️', '🐇', '🦝', '🦨', '🦦',
    '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴',
    '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🕸️', '🌎',
    '🌍', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌚', '🌝', '🌞',
    '🌛', '🌜', '🌡️', '☀️', '🌤️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️',
    '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️', '😄', '😁', '😆',
    '😅', '🥹', '😂', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍',
    '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
    '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵',
    '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫',
    '🫠', '🤥', '😶', '🫥', '😐', '🫤', '😑', '😬', '🙄', '😯', '😦', '😧', '😮',
    '😲', '🥱', '😴', '🤤', '😪', '😮‍💨', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧',
    '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀',
    '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
    '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕',
    '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎',
    '🖤', '🤍', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️',
    '🗨️', '🗯️', '💭', '💤'
];

async function handleMemeModeCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup } = msgDetails;

    // O comando continua a funcionar apenas em grupos
    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const argument = (commandText || '').split(' ')[1]?.toLowerCase();

        if (argument === 'on') {
            await settingsManager.setSetting(sender, 'memeMode', 'on');
            // Reage à própria mensagem de ativação para dar um feedback divertido
            await sock.sendMessage(sender, { react: { text: '🤡', key: msg.key } });
            await sock.sendMessage(sender, { text: "✅ *Modo Meme ATIVADO!* A zoeira foi libertada." });
        } else if (argument === 'off') {
            await settingsManager.setSetting(sender, 'memeMode', 'off');
            await sock.sendMessage(sender, { react: { text: '🫡', key: msg.key } });
            await sock.sendMessage(sender, { text: "✅ *Modo Meme DESATIVADO*. A paz voltou a reinar." });
        } else {
            const currentMode = settingsManager.getSetting(sender, 'memeMode', 'off');
            await sock.sendMessage(sender, { text: `Uso incorreto. Use \`!modomeme on\` ou \`!modomeme off\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[Modo Meme] Erro ao ativar/desativar o modo:", error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro ao tentar configurar o Modo Meme." }, { quoted: msg });
    }

    return true;
}

// Exporta tanto a função do comando quanto a lista de emojis
module.exports = handleMemeModeCommand;
module.exports.memeEmojis = memeEmojis;
