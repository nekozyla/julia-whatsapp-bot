// commands/renomear.js (Versão Final sem wa-sticker-formatter)
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils/utils');
const { Image } = require('node-webpmux');

/**
 * Adiciona metadados EXIF a um buffer de imagem WebP.
 * @param {Buffer} buffer - O buffer do sticker .webp.
 * @param {object} options - As opções com pack e autor.
 * @returns {Promise<Buffer>} - O buffer do sticker com novos metadados.
 */
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
    const { sender, commandText, quotedMsgInfo } = msgDetails;
    const usageText = "Para usar, responda a uma figurinha com `!renomear` e as opções.\n\n*Exemplos:*\n- Para limpar: `!renomear`\n- Para novo pacote: `!renomear pack:\"Meu Pacote\"`\n- Para novo autor: `!renomear autor:\"Meu Nome\"`";

    if (!quotedMsgInfo || getContentType(quotedMsgInfo) !== 'stickerMessage') {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    const argsString = (commandText || '').substring(msgDetails.command.length).trim();
    const options = { pack: '', author: '' };
    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const authorRegex = /autor:(?:"([^"]+)"|'([^']+)')/i;
    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    if (packMatch) options.pack = packMatch[1] || packMatch[2] || '';
    if (authorMatch) options.author = authorMatch[1] || authorMatch[2] || '';
    
    try {
        await sock.sendPresenceUpdate('composing', sender);
        
        const buffer = await downloadMediaMessage({ key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo }, 'buffer', {}, { logger: undefined });
        
        const bufferWithExif = await addExif(buffer, options);
        
        await sock.sendMessage(sender, { sticker: bufferWithExif });

    } catch (err) {
        console.error('[Renomear] Erro ao recriar figurinha:', err);
        await sendJuliaError(sock, sender, msg, err);
    }
    
    return true; 
}

module.exports = handleRenameCommand;
