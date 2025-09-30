// commands/capa.js
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const axios = require('axios');

// --- LÓGICA DO SELO PARENTAL ADVISORY ---

const parentalAdvisoryUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Parental_Advisory_label.svg/523px-Parental_Advisory_label.svg.png';
// Guarda não só o buffer, mas também as dimensões do selo para o cálculo da margem
let parentalAdvisory = {
    buffer: null,
    width: 0,
    height: 0
};

/**
 * Descarrega e prepara o selo "Parental Advisory".
 */
async function loadParentalAdvisoryLabel() {
    try {
        const response = await axios.get(parentalAdvisoryUrl, { responseType: 'arraybuffer' });
        
        // Redimensiona o selo para um tamanho menor e guarda o buffer
        const resizedLabelBuffer = await sharp(response.data)
            .resize({ width: 120 }) // <-- Tamanho do selo reduzido de 150 para 120
            .toBuffer();
        
        // Extrai as dimensões do selo redimensionado
        const metadata = await sharp(resizedLabelBuffer).metadata();

        parentalAdvisory = {
            buffer: resizedLabelBuffer,
            width: metadata.width,
            height: metadata.height
        };
        
        console.log('[Capa] Selo Parental Advisory carregado e preparado com sucesso.');
    } catch (error) {
        console.error('[Capa] Erro fatal ao carregar o selo Parental Advisory:', error.message);
        parentalAdvisory.buffer = null;
    }
}

// Carrega o selo assim que o bot inicia
loadParentalAdvisoryLabel();

// --- FIM DA LÓGICA DO SELO ---


// --- HANDLER PRINCIPAL DO COMANDO ---
async function handleCapaCommand(sock, msg, msgDetails) {
    const { sender, messageType, quotedMsgInfo } = msgDetails;
    const usageText = "Para usar, envie ou responda a uma imagem com o comando `/capa`.";

    if (!parentalAdvisory.buffer) {
        await sock.sendMessage(sender, { text: "Desculpe, estou com um problema para carregar o selo 'Parental Advisory'. Tente novamente mais tarde ou avise o meu desenvolvedor." });
        return;
    }

    let targetMessage = null;
    let isStickerInput = false;

    if (messageType === 'imageMessage') {
        targetMessage = msg;
    } else if (quotedMsgInfo) {
        const quotedType = getContentType(quotedMsgInfo);
        if (quotedType === 'imageMessage') {
            targetMessage = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
        } else if (quotedType === 'stickerMessage') {
            if (quotedMsgInfo.stickerMessage?.isAnimated) {
                await sock.sendMessage(sender, { text: "Não consigo aplicar a capa em figurinhas animadas, apenas em imagens ou figurinhas estáticas." }, { quoted: msg });
                return;
            }
            targetMessage = { key: msg.message.extendedTextMessage.contextInfo.quotedMessage.key, message: quotedMsgInfo };
            isStickerInput = true;
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, { text: usageText }, { quoted: msg });
        return true;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '📸', key: msg.key } });

        let imageBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });

        if (isStickerInput) {
            imageBuffer = await sharp(imageBuffer).toFormat('png').toBuffer();
        }

        // --- NOVA LÓGICA DE POSICIONAMENTO COM MARGENS ---
        const imageSize = 512;
        const margin = 20; // Distância da borda
        const label = parentalAdvisory;

        const positions = [
            { top: margin, left: margin }, // Canto Superior Esquerdo
            { top: margin, left: imageSize - label.width - margin }, // Canto Superior Direito
            { top: imageSize - label.height - margin, left: imageSize - label.width - margin }, // Canto Inferior Direito
            { top: imageSize - label.height - margin, left: margin }  // Canto Inferior Esquerdo
        ];
        
        const randomPosition = positions[Math.floor(Math.random() * positions.length)];

        // Processa a imagem final
        const finalImageBuffer = await sharp(imageBuffer)
            .resize(imageSize, imageSize, { fit: 'cover' }) // Corta a imagem para ficar quadrada
            .composite([
                {
                    input: label.buffer,
                    top: randomPosition.top,
                    left: randomPosition.left
                }
            ])
            .jpeg() // Converte para JPEG para enviar como imagem
            .toBuffer();

        await sock.sendMessage(sender, { image: finalImageBuffer, caption: "✅ Capa gerada!" }, { quoted: msg });

    } catch (error) {
        console.error('[Capa] Erro ao gerar a capa:', error);
        await sock.sendMessage(sender, { text: 'Ocorreu um erro ao criar a sua capa. 😕' }, { quoted: msg });
    }
    
    return true;
}

module.exports = handleCapaCommand;
