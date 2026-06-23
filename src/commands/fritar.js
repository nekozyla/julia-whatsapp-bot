
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { sendGiratinaError } = require('../utils/utils.js');


async function handleFritarCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const usageText = "Para usar, responda a uma imagem ou figurinha estática com `/fritar [qualidade]`.\n\nA qualidade é um número de 1 (pior) a 100 (melhor). O padrão é 5.";

    let targetMessage = null;
    let isStickerInput = false;

    
    if (msg.message.imageMessage) {
        targetMessage = msg;
    } else if (quotedMsgInfo) {
        const quotedType = getContentType(quotedMsgInfo);
        if (quotedType === 'imageMessage') {
            targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
        } else if (quotedType === 'stickerMessage') {
            if (quotedMsgInfo.stickerMessage?.isAnimated) {
                await sock.sendMessage(sender, { text: "Não consigo fritar figurinhas animadas, apenas imagens ou figurinhas estáticas." }, { quoted: msg });
                return;
            }
            targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
            isStickerInput = true;
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    
    const args = commandText.split(' ').slice(1);
    let quality = parseInt(args[0], 10);
    if (isNaN(quality)) {
        quality = 5; 
    }
    
    quality = Math.max(1, Math.min(100, quality));

    try {
        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

        let imageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });

        
        if (isStickerInput) {
            imageBuffer = await sharp(imageBuffer).toFormat('png').toBuffer();
        }

        
        const friedBuffer = await sharp(imageBuffer)
            .modulate({ saturation: 20, brightness: 1.2 }) 
            .sharpen(8) 
            .jpeg({ 
                quality: quality, 
                force: true 
            })
            .toBuffer();

        await sock.sendMessage(sender, { image: friedBuffer, caption: `Imagem fritada com qualidade: ${quality}%` }, { quoted: msg });

    } catch (error) {
        console.error('[Fritar] Erro ao processar imagem:', error);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleFritarCommand;


module.exports.commandData = {
    name: "fritar",
    description: "Aplica efeito deep fry.",
    category: "midia",
    usage: "/fritar",
    aliases: ["/deepfry","/frita"]
};
