// src/commands/fritar.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const { sendJuliaError } = require('../utils/utils.js');

/**
 * Aplica um efeito "deep fry" a uma imagem.
 */
async function handleFritarCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const usageText = "Para usar, responda a uma imagem ou figurinha estática com `/fritar [qualidade]`.\n\nA qualidade é um número de 1 (pior) a 100 (melhor). O padrão é 5.";

    let targetMessage = null;
    let isStickerInput = false;

    // Detecção de imagem ou figurinha estática
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

    // Parse do nível de qualidade (1-100)
    const args = commandText.split(' ').slice(1);
    let quality = parseInt(args[0], 10);
    if (isNaN(quality)) {
        quality = 5; // Valor padrão se nenhum número for fornecido
    }
    // Garante que a qualidade esteja dentro dos limites
    quality = Math.max(1, Math.min(100, quality));

    try {
        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

        let imageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });

        // Se a entrada for uma figurinha, converte para PNG primeiro
        if (isStickerInput) {
            imageBuffer = await sharp(imageBuffer).toFormat('png').toBuffer();
        }

        // Aplica o efeito "Deep Fry"
        const friedBuffer = await sharp(imageBuffer)
            .modulate({ saturation: 20, brightness: 1.2 }) // Aumenta a saturação
            .sharpen(8) // Aumenta a nitidez para realçar os artefactos
            .jpeg({ 
                quality: quality, // Aplica a qualidade definida pelo utilizador
                force: true // Força a recompressão mesmo que a entrada seja JPEG
            })
            .toBuffer();

        await sock.sendMessage(sender, { image: friedBuffer, caption: `Imagem fritada com qualidade: ${quality}%` }, { quoted: msg });

    } catch (error) {
        console.error('[Fritar] Erro ao processar imagem:', error);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleFritarCommand;
