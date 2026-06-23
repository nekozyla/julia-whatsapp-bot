
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const { sendGiratinaError } = require('../utils/utils');
const { Image } = require('node-webpmux');


async function addExif(buffer, options) {
    const stickerPackId = crypto.randomBytes(16).toString('hex');
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': options.pack,
        'sticker-pack-publisher': options.author,
        'emojis': options.categories || [],
    };

    const exif = Buffer.concat([
        Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]),
        Buffer.from(JSON.stringify(json), 'utf-8'),
    ]);
    exif.writeUIntLE(Buffer.from(JSON.stringify(json), 'utf-8').length, 14, 4);

    const image = new Image();
    await image.load(buffer);
    image.exif = exif;
    return await image.save(null);
}

async function handleRenameCommand(sock, msg, msgDetails) {
    const { sender, commandText, quotedMsgInfo, prefix, commandName } = msgDetails;

    const quotedType = quotedMsgInfo ? getContentType(quotedMsgInfo) : null;

    // Recusa silenciosamente se for Lottie
    if (quotedType === 'lottieStickerMessage' || (quotedType === 'stickerMessage' && (quotedMsgInfo.stickerMessage?.isLottie || quotedMsgInfo.stickerMessage?.mimetype === 'application/was'))) {
        return true;
    }

    if (!quotedMsgInfo || quotedType !== 'stickerMessage') {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗥𝗘𝗡𝗔𝗠𝗘 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › Responda uma figurinha\n┃\n┣━━❪ ⚙️ 𝗢𝗽çõ𝗲𝘀 ❫━━\n┃\n┃ ➢ ${prefix}${commandName} "Pack" "Autor"\n┃ ➢ ${prefix}${commandName} "Só o Pack"\n┃ ➢ ${prefix}${commandName} (limpar)\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    const options = { pack: '', author: '' };

    // Sintaxe simples: "Pack" "Autor"
    const quotedMatches = [...argsString.matchAll(/(?:"([^"]*)"|'([^']*)')/g)];
    if (quotedMatches.length >= 1 && !argsString.includes('pack:') && !argsString.includes('autor:')) {
        options.pack = quotedMatches[0]?.[1] ?? quotedMatches[0]?.[2] ?? '';
        options.author = quotedMatches[1]?.[1] ?? quotedMatches[1]?.[2] ?? '';
    } else {
        // Retrocompatível com pack:"..." autor:"..."
        const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
        const authorRegex = /autor:(?:"([^"]+)"|'([^']+)')/i;
        const packMatch = argsString.match(packRegex);
        const authorMatch = argsString.match(authorRegex);
        if (packMatch) options.pack = packMatch[1] || packMatch[2] || '';
        if (authorMatch) options.author = authorMatch[1] || authorMatch[2] || '';
    }

    try {
        await sock.sendPresenceUpdate('composing', sender);

        const buffer = await downloadMediaMessage({ key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo }, 'buffer', {}, { logger: undefined });

        const bufferWithExif = await addExif(buffer, options);

        await sock.sendMessage(sender, { sticker: bufferWithExif });

    } catch (err) {
        console.error('[Renomear] Erro ao recriar figurinha:', err);
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao renomear figurinha\n┃ ➢ 𝗗𝗶𝗰𝗮 › Tente novamente\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    }

    return true;
}

module.exports = handleRenameCommand;


module.exports.commandData = {
    name: "renomear",
    description: "Renomeia pacote/autor de figurinha.",
    category: "midia",
    usage: "/renomear \"Pack\" \"Autor\"",
    aliases: ["/rename", "/nome", "/r"]
};
