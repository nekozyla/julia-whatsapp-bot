

const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const crypto = require('crypto');
const { Image } = require('node-webpmux');
const fs = require('fs');
const path = require('path');

const colorPresets = [
    { label: 'brat deluxe', value: 'deluxe', textColor: '#000000', backgroundColor: '#ffffff', textAlign: 'justify' },
    { label: 'brat', value: 'brat', textColor: '#000000', backgroundColor: '#8ace00', textAlign: 'center' },
    { label: 'crash', value: 'crash', textColor: '#f70000', backgroundColor: '#019bd9', textAlign: 'center' },
    { label: 'charli', value: 'charli', textColor: '#000000', backgroundColor: '#918a84', textAlign: 'center' },
    { label: 'pop 2', value: 'pop2', textColor: '#000000', backgroundColor: '#c9a1dd', textAlign: 'center' },
    { label: 'vroom vroom', value: 'vroom', textColor: '#404040', backgroundColor: '#000000', textAlign: 'center' },
    { label: 'sucker', value: 'sucker', textColor: '#ffffff', backgroundColor: '#f5abcc', textAlign: 'center' },
    { label: 'true romance', value: 'romance', textColor: '#ffffff', backgroundColor: '#700150', textAlign: 'center' },
    { label: 'hexatombe', value: 'hexa', textColor: '#000000', backgroundColor: '#ff0000' },
    { label: 'brasil', value: 'bra', textColor: '#ffcd00', backgroundColor: '#009c3b', textAlign: 'center' },
    { label: 'felps', value: 'felps', textColor: '#12000A', backgroundColor: '#FF008C', textAlign: 'center' },
    { label: 'cyberpunk', value: 'cyber', textColor: '#000000', backgroundColor: '#f3e600', textAlign: 'center' },
    { label: 'matrix', value: 'matrix', textColor: '#00ff41', backgroundColor: '#000000', textAlign: 'center' },
    { label: 'Franberry', value: 'berry', textColor: '#420004', backgroundColor: '#FF0061', textAlign: 'center' },
];

function calculateFontSize(text, preset) {
    const length = text.length;
    
    if (preset.value === 'deluxe') {
        if (length <= 20) return 90;
        if (length <= 40) return 80;
        if (length <= 70) return 65;
        if (length <= 120) return 55;
        return 45;
    } else {
        if (length <= 10) return 100;
        if (length <= 20) return 85;
        if (length <= 40) return 70;
        if (length <= 70) return 55;
        if (length <= 120) return 45;
        return 35;
    }
}

async function generateBratImage(text, preset) {
    const textAlignStyle = preset.textAlign || 'center';
    const fontSize = calculateFontSize(text, preset);

    let extraStyles = '';
    if (preset.value === 'deluxe') {
        extraStyles = 'text-align-last: justify; line-height: 0.8; letter-spacing: -1px;';
    } else {
        extraStyles = 'line-height: 0.85; letter-spacing: -0.5px;';
    }

    
    const html = `
    <html>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700&display=swap" rel="stylesheet">
        
        <style>
          body {
            width: 512px; height: 512px;
            display: flex; align-items: center; justify-content: center;
            background-color: ${preset.backgroundColor};
            font-family: 'Roboto Condensed', sans-serif; /* Fonte Automática */
            font-weight: 700; 
            text-align: ${textAlignStyle};
            margin: 0; padding: 15px; box-sizing: border-box;
          }
          .text {
            color: ${preset.textColor}; font-size: ${fontSize}px;
            transform: scaleY(1.35); /* Estica a fonte para ficar igual ao album */
            filter: blur(1.5px);
            word-wrap: break-word; word-break: break-word;
            ${extraStyles}
          }
        </style>
      </head>
      <body>
        <div class="text">${text}</div>
      </body>
    </html>
    `;

    let browser = null;
    try {
        
        const executablePath = path.resolve('./chromium_arm_final/chrome-linux/chrome');

        if (!fs.existsSync(executablePath)) {
            throw new Error('Navegador não encontrado! Rode "node instalador_final.js"');
        }

        browser = await puppeteer.launch({
            executablePath: executablePath,
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--font-render-hinting=none'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 512, height: 512 });

        
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const imageBuffer = await page.screenshot({ type: 'png', omitBackground: true });
        return imageBuffer;

    } catch (err) {
        console.error('Erro no Navegador Local:', err);
        throw new Error(`Falha: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

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
    const { sender, commandText } = msgDetails;
    const args = commandText.split(' ').slice(1);

    if (args.length === 0) {
        const presetList = colorPresets.map(p => `- \`${p.value}\` (${p.label})`).join('\n');
        const tutorialText = `*Gerador de Imagens Brat (Local)* 🦊\n\n*Exemplo:*\n\`/brat deluxe club classics\`\n\n*Opções:*\n${presetList}`;
        await sock.sendMessage(sender, { text: tutorialText }, { quoted: msg });
        return;
    }

    const presetValue = args[0].toLowerCase();
    const textToBrat = args.slice(1).join(' ');
    const selectedPreset = colorPresets.find((p) => p.value === presetValue);

    if (!selectedPreset) {
        await sock.sendMessage(sender, { text: `😕 Predefinição "\`${presetValue}\`" não encontrada.` }, { quoted: msg });
        return;
    }

    if (!textToBrat) {
        await sock.sendMessage(sender, { text: "Escreva o texto após a predefinição." }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🦊', key: msg.key } });
        const imageBuffer = await generateBratImage(textToBrat, selectedPreset);

        let stickerBuffer = await sharp(imageBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();

        stickerBuffer = await addExif(stickerBuffer, {
            pack: selectedPreset.label,
            author: 'Julia Bot'
        });

        await sock.sendMessage(sender, { sticker: stickerBuffer });

    } catch (error) {
        console.error("[Brat Command] Erro:", error);
        await sock.sendMessage(sender, { text: `😕 Erro: ${error.message}` }, { quoted: msg });
    }
};

module.exports.commandData = {
    name: "brat",
    description: "Cria figurinha estilo Brat (Local).",
    category: "midia",
    usage: "/brat",
    aliases: ["/bratgreen", "/charli"]
};
