

const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const crypto = require('crypto');
const { Image } = require('node-webpmux');
const fs = require('fs');
const path = require('path');
const React = require('react');
const satoriModule = require('satori');
const { Resvg } = require('@resvg/resvg-js');
const config = require('../../config.js');

const satori = satoriModule.default || satoriModule;

const BOT_NAME = config.BOT_NAME || 'Bot';

const BRAT_CANVAS_SIZE = 512;
const BRAT_PADDING = 15;

const ROBOTO_CONDENSED_FILES = {
    regular: path.join(__dirname, '..', '..', 'node_modules', '@fontsource', 'roboto-condensed', 'files', 'roboto-condensed-latin-400-normal.woff'),
    bold: path.join(__dirname, '..', '..', 'node_modules', '@fontsource', 'roboto-condensed', 'files', 'roboto-condensed-latin-700-normal.woff')
};

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

function getBratSpec(text, preset) {
    return {
        fontSize: calculateFontSize(text, preset),
        textAlign: preset.textAlign || 'center',
        lineHeight: preset.value === 'deluxe' ? 0.8 : 0.85,
        letterSpacing: preset.value === 'deluxe' ? '-1px' : '-0.5px',
        scaleY: 1.35,
        blurPx: 1.5,
        textAlignLast: preset.value === 'deluxe' ? 'justify' : null
    };
}

async function resolveBratFonts() {
    const fontPairs = [
        {
            regular: ROBOTO_CONDENSED_FILES.regular,
            bold: ROBOTO_CONDENSED_FILES.bold
        },
        {
            regular: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Regular.woff'),
            bold: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.woff')
        },
        {
            regular: '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
            bold: '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'
        },
        {
            regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        }
    ];

    for (const pair of fontPairs) {
        if (fs.existsSync(pair.regular) && fs.existsSync(pair.bold)) {
            return {
                regular: fs.readFileSync(pair.regular),
                bold: fs.readFileSync(pair.bold)
            };
        }
    }

    throw new Error('Nenhuma fonte válida encontrada para o renderer Satori no brat.');
}

function buildEmbeddedRobotoCss() {
        if (!fs.existsSync(ROBOTO_CONDENSED_FILES.regular) || !fs.existsSync(ROBOTO_CONDENSED_FILES.bold)) {
                return '';
        }

        const regularBase64 = fs.readFileSync(ROBOTO_CONDENSED_FILES.regular).toString('base64');
        const boldBase64 = fs.readFileSync(ROBOTO_CONDENSED_FILES.bold).toString('base64');

        return `
            @font-face {
                font-family: 'Roboto Condensed Local';
                src: url(data:font/woff;base64,${regularBase64}) format('woff');
                font-style: normal;
                font-weight: 400;
            }
            @font-face {
                font-family: 'Roboto Condensed Local';
                src: url(data:font/woff;base64,${boldBase64}) format('woff');
                font-style: normal;
                font-weight: 700;
            }
        `;
}

function escapeBratHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function generateBratImageSatori(text, preset) {
    const spec = getBratSpec(text, preset);
    const fonts = await resolveBratFonts();
    const e = React.createElement;

    const tree = e(
        'div',
        {
            style: {
                width: '512px',
                height: '512px',
                display: 'flex',
                backgroundColor: preset.backgroundColor,
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${BRAT_PADDING}px`,
                boxSizing: 'border-box',
                fontFamily: 'Brat Sans'
            }
        },
        e(
            'div',
            {
                style: {
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }
            },
            e(
                'div',
                {
                    style: {
                        width: '100%',
                    color: preset.textColor,
                        fontSize: `${spec.fontSize}px`,
                    fontWeight: 700,
                    letterSpacing: spec.letterSpacing,
                    lineHeight: spec.lineHeight,
                    textAlign: spec.textAlign,
                        display: 'flex',
                        justifyContent: spec.textAlign === 'center' ? 'center' : 'flex-start',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    // scaleY no Satori desloca baseline em alguns casos; compensamos no tamanho da fonte.
                    textShadow: `0 0 1px ${preset.textColor}`
                }
            },
                text
            )
        )
    );

    const svg = await satori(tree, {
        width: BRAT_CANVAS_SIZE,
        height: BRAT_CANVAS_SIZE,
        fonts: [
            {
                name: 'Brat Sans',
                data: fonts.regular,
                weight: 400,
                style: 'normal'
            },
            {
                name: 'Brat Sans',
                data: fonts.bold,
                weight: 700,
                style: 'normal'
            }
        ]
    });

    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: BRAT_CANVAS_SIZE
        }
    });

    const rendered = resvg.render().asPng();
    return sharp(rendered).modulate({ brightness: 1 }).blur(spec.blurPx).toBuffer();
}

async function generateBratImage(text, preset) {
    const spec = getBratSpec(text, preset);
    const embeddedRobotoCss = buildEmbeddedRobotoCss();

    
    const html = `
    <html>
      <head>
        <style>
                    ${embeddedRobotoCss}

          body {
                        width: ${BRAT_CANVAS_SIZE}px; height: ${BRAT_CANVAS_SIZE}px;
            display: flex; align-items: center; justify-content: center;
            background-color: ${preset.backgroundColor};
                        font-family: 'Roboto Condensed Local', 'Roboto Condensed', sans-serif;
            font-weight: 700; 
                        text-align: ${spec.textAlign};
                        margin: 0; padding: ${BRAT_PADDING}px; box-sizing: border-box;
          }
          .text {
                        width: 100%;
                        color: ${preset.textColor}; font-size: ${spec.fontSize}px;
                        transform: scaleY(${spec.scaleY});
                        filter: blur(${spec.blurPx}px);
            word-wrap: break-word; word-break: break-word;
                        white-space: pre-wrap;
                        line-height: ${spec.lineHeight};
                        letter-spacing: ${spec.letterSpacing};
                        ${spec.textAlignLast ? `text-align-last: ${spec.textAlignLast};` : ''}
          }
        </style>
      </head>
      <body>
                <div class="text">${escapeBratHtml(text)}</div>
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
        await page.setViewport({ width: BRAT_CANVAS_SIZE, height: BRAT_CANVAS_SIZE });

        
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
    const renderer = args.includes('--satori') ? 'satori' : 'browser';
    const cleanArgs = args.filter(arg => arg !== '--browser' && arg !== '--satori');

    if (cleanArgs.length === 0) {
        const presetList = colorPresets.map(p => `- \`${p.value}\` (${p.label})`).join('\n');
        const tutorialText = `*Gerador de Imagens Brat (Local)* 🦊\n\n*Exemplo:*\n\`/brat deluxe club classics\`\n\n*Renderer padrão:*\n\`browser\`\n\n*Forçar satori:*\n\`/brat --satori deluxe club classics\`\n\n*Opções:*\n${presetList}`;
        await sock.sendMessage(sender, { text: tutorialText }, { quoted: msg });
        return;
    }

    const fallbackPreset = colorPresets.find((p) => p.value === 'brat') || colorPresets[0];
    const requestedPresetValue = cleanArgs[0].toLowerCase();
    const requestedPreset = colorPresets.find((p) => p.value === requestedPresetValue);
    const selectedPreset = requestedPreset || fallbackPreset;
    const textArgs = requestedPreset ? cleanArgs.slice(1) : cleanArgs;
    const textToBrat = textArgs.join(' ');

    if (!textToBrat) {
        await sock.sendMessage(sender, { text: "Escreva o texto após a predefinição." }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🦊', key: msg.key } });
        let imageBuffer;
        if (renderer === 'browser') {
            imageBuffer = await generateBratImage(textToBrat, selectedPreset);
        } else {
            try {
                imageBuffer = await generateBratImageSatori(textToBrat, selectedPreset);
            } catch (err) {
                console.error('[Brat Satori] Falha no render, usando navegador:', err.message);
                imageBuffer = await generateBratImage(textToBrat, selectedPreset);
            }
        }

        let stickerBuffer = await sharp(imageBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();

        stickerBuffer = await addExif(stickerBuffer, {
            pack: selectedPreset.label,
            author: `${BOT_NAME} Bot`
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
