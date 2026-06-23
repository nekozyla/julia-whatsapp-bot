const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const { Image } = require('node-webpmux');
const crypto = require('crypto');
const userPresetManager = require('../managers/userPresetManager.js');


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

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, quotedMsgInfo } = msgDetails;

    
    if (!quotedMsgInfo) {
        await sock.sendMessage(sender, { text: '⚠️ Por favor, responda a uma figurinha com este comando para roubá-la.' }, { quoted: msg });
        return;
    }

    
    const quotedType = getContentType(quotedMsgInfo);
    
    // Recusa silenciosamente figurinhas Lottie
    if (quotedType === 'lottieStickerMessage' || (quotedType === 'stickerMessage' && (quotedMsgInfo.stickerMessage?.isLottie || quotedMsgInfo.stickerMessage?.mimetype === 'application/was'))) {
        return;
    }

    if (quotedType !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: '⚠️ Isso não é uma figurinha! Responda a uma figurinha.' }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🕵️', key: msg.key } });

        
        const currentPreset = userPresetManager.getPreset(sender, commandSenderJid);
        const pack = currentPreset.pack !== undefined ? (currentPreset.pack ?? '') : 'Criado com Jul.ia';
        const author = currentPreset.author !== undefined ? (currentPreset.author ?? '') : 'by @nekozylajs';

        
        const stream = await downloadContentFromMessage(quotedMsgInfo.stickerMessage, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        
        const newSticker = await addExif(buffer, { pack, author });

        
        await sock.sendMessage(sender, { sticker: newSticker });
        await sock.sendMessage(sender, { react: { text: '😈', key: msg.key } });

    } catch (error) {
        console.error('[Roubar] Erro ao roubar sticker:', error);
        await sock.sendMessage(sender, { text: 'Falha ao roubar a figurinha. Talvez ela esteja protegida ou corrompida.' }, { quoted: msg });
    }
};


module.exports.commandData = {
    name: "roubar",
    description: "Sem descrição disponível.",
    category: "midia",
    usage: "/roubar",
    aliases: []
};
