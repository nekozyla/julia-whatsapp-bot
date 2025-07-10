// commands/brat.js
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const sharp = require('sharp');

async function handleBratCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;

    let args = (commandText || '').substring(msgDetails.command.length).trim().split(' ');
    
    // 1. Determina o tema e o texto
    let theme = 'green'; // Tema padrão
    let textForSticker = '';

    if (args[0].toLowerCase() === 'green' || args[0].toLowerCase() === 'white') {
        theme = args[0].toLowerCase();
        textForSticker = args.slice(1).join(' ');
    } else {
        textForSticker = args.join(' ');
    }

    if (!textForSticker) {
        await sock.sendMessage(sender, { text: "Você precisa me dizer o que escrever!\n\n*Exemplos:*\n`!brat club classics`\n`!brat white a Glimmer of Hope`" }, { quoted: msg });
        return true;
    }
    
    const escapedText = textForSticker
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    console.log(`[Brat] ${pushName} solicitou uma figurinha tema '${theme}' com o texto: "${textForSticker}"`);

    try {
        await sock.sendPresenceUpdate('composing', sender);

        // 2. Define as configurações de cada tema
        let backgroundColor, textColor, fontSize, blurAmount;

        if (theme === 'white') {
            backgroundColor = '#FFFFFF'; // Branco
            textColor = '#000000';       // Preto
            fontSize = 90;
            blurAmount = 2;
        } else { // Padrão é 'green'
            backgroundColor = '#7CFC00'; // Verde "Brat"
            textColor = '#000000';       // Preto
            fontSize = 60;
            blurAmount = 1.5;
        }

        // 3. Cria a imagem base com a cor de fundo
        let image = sharp({
            create: {
                width: 512,
                height: 512,
                channels: 4,
                background: backgroundColor
            }
        });

        // 4. Cria o texto em SVG para sobrepor
        const svgText = `
        <svg width="500" height="500">
            <style>
                .title {
                    fill: ${textColor};
                    font-size: ${fontSize}px;
                    font-family: 'Arial Narrow', Impact, sans-serif;
                    font-weight: 700;
                    text-anchor: middle;
                    dominant-baseline: middle;
                    text-transform: lowercase;
                }
            </style>
            <text x="50%" y="50%" class="title">${escapedText}</text>
        </svg>
        `;

        // 5. Sobrepõe o texto e aplica o efeito de desfoque (blur)
        const finalImageBuffer = await image
            .composite([{ input: Buffer.from(svgText) }])
            .blur(blurAmount) // Aplica o desfoque
            .png()
            .toBuffer();

        // 6. Usa o wa-sticker-formatter para criar a figurinha
        const sticker = new Sticker(finalImageBuffer, {
            pack: `Brat (${theme})`,
            author: pushName,
            type: StickerTypes.DEFAULT,
            quality: 90,
        });
        
        const stickerMessage = await sticker.toMessage();
        
        await sock.sendMessage(sender, stickerMessage, { quoted: msg });

    } catch (err) {
        console.error('[Brat] Erro ao criar figurinha:', err);
        await sock.sendMessage(sender, { text: `Tive um probleminha pra fazer sua figurinha 😕.\n\n_${err.message}_` });
    }
    
    return true; 
}

module.exports = handleBratCommand;
