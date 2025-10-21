// src/commands/lowres.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
// const { spawn } = require('child_process'); // Removido - Não precisamos mais do ffmpeg
const { sendJuliaError } = require('../utils/utils.js');

// A função fryVideo() foi completamente removida.

/**
 * Aplica um efeito "lowres" (deep fry) a uma imagem ou figurinha ESTÁTICA.
 */
async function handleFritarCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const quotedMsgInfo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
    // Texto de ajuda atualizado para refletir apenas mídias estáticas
    const usageText = "Para usar, responda a uma imagem ou figurinha ESTÁTICA com `/lowres [escala]`.\n\nA escala é um número de 1 (pior/menor) a 100 (original). O padrão é 5.";

    let targetMessage = null;
    let isStickerInput = false;
    // let isAnimatedInput = false; // Removido
    // let isVideoInput = false; // Removido

    // Função para checar a mensagem (atual ou quotada) - SIMPLIFICADA
    const checkMessage = (msgObj) => {
        if (!msgObj) return { isMedia: false };
        const type = getContentType(msgObj);

        if (type === 'imageMessage') {
            return { isMedia: true, isAnimated: false, isSticker: false };
        }
        
        if (type === 'stickerMessage') {
            // Se for figurinha, verificamos se é animada
            if (msgObj.stickerMessage?.isAnimated) {
                // É animada, retornamos isMedia: false para ignorar
                return { isMedia: false, isAnimated: true, isSticker: true };
            }
            // É estática
            return { isMedia: true, isAnimated: false, isSticker: true };
        }

        // Ignora videoMessage e outros tipos
        return { isMedia: false };
    };

    // Verifica a mensagem atual
    let mediaInfo = checkMessage(msg.message);
    if (mediaInfo.isMedia) {
        targetMessage = msg;
        isStickerInput = mediaInfo.isSticker;
    } 
    // Se não houver mídia na msg atual, verifica a mensagem respondida (quoted)
    else if (quotedMsgInfo) {
        mediaInfo = checkMessage(quotedMsgInfo);
        if (mediaInfo.isMedia) {
            targetMessage = { key: msg.key.remoteJid, message: quotedMsgInfo };
            isStickerInput = mediaInfo.isSticker;
        } else if (mediaInfo.isAnimated) {
            // Se a mídia respondida for animada (vídeo, gif, sticker animado), avisa o usuário
            await sock.sendMessage(sender, { text: "Não consigo aplicar /lowres em mídias animadas (vídeos, GIFs ou figurinhas animadas). Apenas imagens estáticas." }, { quoted: msg });
            return true;
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    // Parse do nível de escala/qualidade (1-100)
    const args = commandText.split(' ').slice(1);
    let scalePercent = parseInt(args[0], 10);
    if (isNaN(scalePercent)) {
        scalePercent = 5; // Valor padrão se nenhum número for fornecido
    }
    // Garante que a escala esteja dentro dos limites
    scalePercent = Math.max(1, Math.min(100, scalePercent));

    try {
        await sock.sendMessage(sender, { react: { text: '🔥', key: msg.key } });

        const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });
        const caption = `LowRes aplicado! Nível: ${scalePercent}%`;
        let friedBuffer;

        // --- LÓGICA SIMPLIFICADA ---
        // Agora só existe o CASO 3 (Imagem estática ou FigurinHa estática)
        
        let staticBuffer = mediaBuffer;
        // Se for figurinha estática (WebP), converte para PNG primeiro
        if (isStickerInput) {
            staticBuffer = await sharp(mediaBuffer).png().toBuffer();
        }

        const sharpInstance = sharp(staticBuffer);
        const metadata = await sharpInstance.metadata();
        // Usamos 512 como fallback caso os metadados falhem
        const finalWidth = Math.max(1, Math.round((metadata.width || 512) * (scalePercent / 100)));
        const finalHeight = Math.max(1, Math.round((metadata.height || 512) * (scalePercent / 100)));

        friedBuffer = await sharpInstance
            .resize(finalWidth, finalHeight, { kernel: sharp.kernel.nearest, fit: 'contain' })
            .jpeg({ quality: scalePercent, force: true })
            .toBuffer();

        // A saída é sempre uma imagem estática
        await sock.sendMessage(sender, { image: friedBuffer, caption: caption }, { quoted: msg });
        

    } catch (error) {
        console.error('[Lowres] Erro ao processar mídia estática:', error); // <-- Log atualizado
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        
        // Mensagem de erro simplificada, já que ffmpeg não existe mais
        let errorMsg = "Não consegui aplicar o /lowres nessa mídia. Tente com outra imagem ou figurinha estática.";
        
        await sendJuliaError(sock, sender, msg, error, errorMsg);
    }

    return true;
}

module.exports = handleFritarCommand;
