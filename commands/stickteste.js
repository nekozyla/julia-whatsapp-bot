// commands/sticker.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

/**
 * Lida com a criação de stickers a partir de imagens ou vídeos.
 * @param {import('@whiskeysockets/baileys').WASocket} sock - A instância do socket Baileys.
 * @param {import('@whiskeysockets/baileys').WAMessage} msg - A mensagem recebida.
 * @param {object} msgDetails - Detalhes pré-processados da mensagem.
 */
async function handleStickerCreationCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;

    // Determina qual mensagem contém a mídia (a atual ou a respondida)
    const messageWithMedia = msg.message?.imageMessage || msg.message?.videoMessage ? msg :
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ? { message: msg.message.extendedTextMessage.contextInfo.quotedMessage } :
        null;

    if (!messageWithMedia) {
        await sock.sendMessage(sender, { text: 'Para usar o `/sticker`, envie uma imagem/vídeo ou responda a um com o comando.' }, { quoted: msg });
        return true;
    }

    const messageType = getContentType(messageWithMedia.message);

    if (messageType !== 'imageMessage' && messageType !== 'videoMessage') {
        await sock.sendMessage(sender, { text: 'Por favor, envie ou responda a uma imagem ou vídeo para criar um sticker.' }, { quoted: msg });
        return true;
    }

    // Envia uma reação para indicar que o processo começou
    try {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
    } catch (reactError) {
        console.error('[Reação] Falha ao enviar a reação:', reactError);
    }
    
    try {
        // --- PARTE CENTRAL DA LÓGICA ---
        // 1. Baixa a mídia diretamente para um buffer
        const buffer = await downloadMediaMessage(messageWithMedia, 'buffer', {});

        // 2. Processa os argumentos do comando (pack e tipo)
        const argsString = (commandText || '').substring(msgDetails.command.length).trim();
        
        let packName = 'Criado por Jul.ia'; // Nome do pack padrão
        let stickerType = StickerTypes.FULL; // Tipo padrão (imagem inteira)

        // Extrai o nome do pack usando regex
        const packMatch = argsString.match(/pack:(?:"([^"]+)"|'([^']+)')/i);
        if (packMatch) {
            packName = packMatch[1] || packMatch[2] || packName;
        }

        // Verifica se outros tipos foram especificados
        const lowerArgs = argsString.toLowerCase();
        if (lowerArgs.includes('quadrado') || lowerArgs.includes('crop')) {
            stickerType = StickerTypes.CROPPED; // Corta para caber em um quadrado
        } else if (lowerArgs.includes('circulo') || lowerArgs.includes('circle')) {
            stickerType = StickerTypes.CIRCLE;
        } else if (lowerArgs.includes('redondo') || lowerArgs.includes('rounded')) {
            stickerType = StickerTypes.ROUNDED;
        }

        // 3. Monta as opções do sticker para a biblioteca
        const stickerOptions = {
            pack: packName,
            author: '@nekozylajs',
            type: stickerType,
            quality: 50, // Qualidade padrão para manter o tamanho do arquivo baixo
            background: { r: 0, g: 0, b: 0, alpha: 0 } // Fundo transparente
        };

        console.log(`[Sticker] Criando sticker com as opções: ${JSON.stringify(stickerOptions)}`);

        // 4. Cria o sticker usando a biblioteca
        const sticker = await new Sticker(buffer, stickerOptions)
            .toMessage(); // Gera o objeto de mensagem compatível com Baileys

        // 5. Envia o sticker
        await sock.sendMessage(sender, sticker);

    } catch (err) {
        console.error('[Sticker] Erro ao processar sticker:', err);
        await sock.sendMessage(
            sender, 
            { text: `Tive um probleminha pra fazer essa figurinha 😕.\n\n_${err.message}_` }, 
            { quoted: msg }
        );
    }

    return true;
}

module.exports = handleStickerCreationCommand;
