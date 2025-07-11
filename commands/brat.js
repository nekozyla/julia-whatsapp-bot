// commands/brat.js
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const sharp = require('sharp');

/**
 * Quebra o texto em múltiplas linhas para caber na imagem.
 * @param {string} text - O texto a ser quebrado.
 * @param {number} maxCharsPerLine - Máximo de caracteres por linha.
 * @returns {string[]} - Um array com as linhas de texto.
 */
function wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

async function handleBratCommand(sock, msg, msgDetails) {
    const { sender, command, commandText, pushName } = msgDetails;

    const textForSticker = commandText.substring(command.length).trim();

    if (!textForSticker) {
        await sock.sendMessage(sender, { text: "Qual foi, porra? Tu tem que me dizer o que escrever. Manda o comando e o texto, caralho." }, { quoted: msg });
        return true;
    }
    
    console.log(`[Brat] ${pushName} pediu um sticker com o texto: "${textForSticker}"`);

    try {
        await sock.sendPresenceUpdate('composing', sender);

        const bratGreen = '#7CFC00';
        const textColor = '#000000';
        const imageWidth = 512;
        const imageHeight = 512;
        
        let fontSize, maxCharsPerLine;
        if (textForSticker.length < 15) { fontSize = 85; maxCharsPerLine = 10; }
        else if (textForSticker.length < 40) { fontSize = 70; maxCharsPerLine = 15; }
        else if (textForSticker.length < 90) { fontSize = 55; maxCharsPerLine = 20; }
        else { fontSize = 45; maxCharsPerLine = 25; }

        const lines = wrapText(textForSticker, maxCharsPerLine);
        const lineHeight = fontSize * 1.1;

        const svgTspans = lines.map((line, index) => {
            const escapedLine = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            return `<tspan x="50%" dy="${index === 0 ? 0 : lineHeight}px">${escapedLine}</tspan>`;
        }).join('');
        
        const totalTextHeight = (lines.length -1) * lineHeight;
        const startY = (imageHeight / 2) - (totalTextHeight / 2);

        const svgText = `
        <svg width="${imageWidth}" height="${imageHeight}">
            <style>
                .title {
                    fill: "${textColor}";
                    font-size: ${fontSize}px;
                    font-family: 'Arial Narrow', Impact, sans-serif;
                    font-weight: 700;
                    text-anchor: middle;
                    dominant-baseline: middle;
                }
            </style>
            <text y="${startY}" class="title">${svgTspans}</text>
        </svg>
        `;

        const imageBuffer = await sharp({
            create: {
                width: imageWidth,
                height: imageHeight,
                channels: 4,
                background: bratGreen
            }
        })
        .composite([{ input: Buffer.from(svgText) }])
        .blur(40) // BLUR AUMENTADO AINDA MAIS
        .webp({ quality: 15 })
        .toBuffer();

        const sticker = new Sticker(imageBuffer, {
            pack: 'Brat',
            author: "Jul.ia by @nekozylajs",
            type: StickerTypes.FULL,
            quality: 15,
        });
        
        const stickerMessage = await sticker.toMessage();
        
        await sock.sendMessage(sender, stickerMessage, { quoted: msg });

    } catch (err) {
        console.error('[Brat] Erro ao criar figurinha:', err);
        await sock.sendMessage(sender, { text: `Deu merda pra fazer essa figurinha, caralho. Tenta de novo.` });
    }
    
    return true; 
}

module.exports = handleBratCommand;
