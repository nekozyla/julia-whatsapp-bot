// commands/mudar.js (usando generateContentStream)
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { imageModel } = require('../geminiClient');
const { extractCommandText } = require('../utils');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, messageType, quotedMsgInfo } = msgDetails;

    const prompt = extractCommandText(commandText, '!mudar');
    if (!prompt) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer o que mudar! Ex: `!mudar adicione um chapéu de pirata`" });
        return true;
    }

    let mediaBuffer = null;
    let mimeType = null;
    let outputAsSticker = false;

    if (quotedMsgInfo) {
        if (quotedMsgInfo.imageMessage) {
            const quotedMsg = { message: { imageMessage: quotedMsgInfo.imageMessage } };
            mediaBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            mimeType = quotedMsgInfo.imageMessage.mimetype;
            outputAsSticker = false;
        } else if (quotedMsgInfo.stickerMessage) {
            const quotedMsg = { message: { stickerMessage: quotedMsgInfo.stickerMessage } };
            mediaBuffer = await downloadMediaMessage(quotedMsg, 'buffer', {});
            mimeType = 'image/webp';
            outputAsSticker = true;
        }
    } else if (messageType === 'imageMessage') {
        mediaBuffer = await downloadMediaMessage(msg, 'buffer', {});
        mimeType = msg.message.imageMessage.mimetype;
        outputAsSticker = false;
    }

    if (!mediaBuffer) {
        await sock.sendMessage(sender, { text: "Por favor, responda a uma imagem ou sticker, ou envie uma imagem com o comando `!mudar [o que mudar]`." });
        return true;
    }

    await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

    try {
        const imagePart = {
            inlineData: {
                data: mediaBuffer.toString('base64'),
                mimeType: mimeType
            }
        };

        // --- NOVA LÓGICA DE STREAMING ---
        const resultStream = await imageModel.generateContentStream([
            imagePart,
            { text: prompt }
        ]);

        let generatedImageBuffer = null;
        let responseText = '';

        // Processa a resposta em pedaços (chunks)
        for await (const chunk of resultStream) {
            // Se um pedaço contiver texto, adicione à nossa variável de texto
            const chunkText = chunk.text && typeof chunk.text === 'function' ? chunk.text() : '';
            if (chunkText) {
                responseText += chunkText;
            }
            
            // Procura por dados de imagem no pedaço
            const imageParts = chunk.candidates?.[0]?.content?.parts?.filter(part => part.inlineData);
            if (!generatedImageBuffer && imageParts && imageParts.length > 0) {
                const imageBase64 = imageParts[0].inlineData.data;
                generatedImageBuffer = Buffer.from(imageBase64, 'base64');
            }
        }
        // --- FIM DA LÓGICA DE STREAMING ---

        // Após o stream terminar, decide o que enviar
        if (generatedImageBuffer) {
            // Se recebemos uma imagem, envia no formato correto
            if (outputAsSticker) {
                const sticker = new Sticker(generatedImageBuffer, {
                    pack: 'Criado pela Julia', author: 'Bot', type: StickerTypes.FULL, quality: 90,
                });
                await sock.sendMessage(sender, await sticker.toMessage());
            } else {
                await sock.sendMessage(sender, {
                    image: generatedImageBuffer,
                    caption: responseText || "Aqui está sua imagem modificada ✨" // Envia texto junto se houver
                });
            }
            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
        } else if (responseText) {
            // Se não recebemos imagem, mas recebemos texto, envia o texto
            await sock.sendMessage(sender, { text: `A IA respondeu:\n\n${responseText}` });
            await sock.sendMessage(sender, { react: { text: '💬', key: msg.key } });
        } else {
            // Se não recebemos nada, envia um erro padrão
            await sock.sendMessage(sender, { text: "Não consegui gerar uma resposta com base no seu pedido. Tente ser mais específico." });
            await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        }

    } catch (e) {
        console.error("Erro ao modificar imagem com Gemini Vision:", e);
        // Personaliza a mensagem de erro se for de cota
        const errorMessage = e.message.includes('quota') 
            ? "Atingi meu limite de uso da IA de imagens por hoje. Tente novamente amanhã! 😅"
            : "Ocorreu um erro. A IA pode estar ocupada ou a imagem pode não ser compatível. Tente novamente.";
        await sock.sendMessage(sender, { text: errorMessage });
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
    }
    
    return true;
};
