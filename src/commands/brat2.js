// commands/brat.js (Versão com preenchimento de 100% do quadrado)

const nodeHtmlToImage = require('node-html-to-image');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');

const colorPresets = [
    { label: 'brat deluxe', value: 'deluxe', textColor: '#000000', backgroundColor: '#ffffff', textAlign: 'justify' },
    { label: 'brat', value: 'brat', textColor: '#000000', backgroundColor: '#8ace00', textAlign: 'center' },
    { label: 'crash', value: 'crash', textColor: '#f70000', backgroundColor: '#019bd9', textAlign: 'center' },
    { label: 'charli', value: 'charli', textColor: '#000000', backgroundColor: '#918a84', textAlign: 'center' },
    { label: 'pop 2', value: 'pop2', textColor: '#000000', backgroundColor: '#c9a1dd', textAlign: 'center' },
    { label: 'vroom vroom', value: 'vroom', textColor: '#404040', backgroundColor: '#000000', textAlign: 'center' },
    { label: 'sucker', value: 'sucker', textColor: '#ffffff', backgroundColor: '#f5abcc', textAlign: 'center' },
    { label: 'true romance', value: 'romance', textColor: '#ffffff', backgroundColor: '#700150', textAlign: 'center' },
];

/**
 * Calcula o tamanho da fonte com base no comprimento do texto e no preset para preencher o quadrado.
 * @param {string} text - O texto.
 * @param {object} preset - O preset selecionado.
 * @returns {number} O tamanho da fonte em pixels.
 */
function calculateFontSize(text, preset) {
    const length = text.length;

    if (preset.value === 'deluxe') {
        // Lógica para 'deluxe' com preenchimento agressivo e fonte maior
        if (length <= 20) return 95;
        if (length <= 40) return 85;
        if (length <= 70) return 70;
        if (length <= 120) return 60;
        return 50; // Para textos muito longos
    } else {
        // Lógica aprimorada para outros presets preencherem mais
        if (length <= 10) return 100; // Textos muito curtos, gigante
        if (length <= 20) return 85;
        if (length <= 40) return 70;
        if (length <= 70) return 55;
        if (length <= 120) return 45;
        return 35; // Para textos muito longos
    }
}


/**
 * Gera a imagem no estilo "brat" usando HTML.
 * @param {string} text - O texto a ser renderizado.
 * @param {object} preset - O objeto da predefinição de cor.
 * @returns {Promise<Buffer>} Um buffer com a imagem gerada.
 */
async function generateBratImage(text, preset) {
    const textAlignStyle = preset.textAlign || 'center';
    const fontSize = calculateFontSize(text, preset);

    // Ajustes finos no line-height e letter-spacing para o preenchimento
    let extraStyles = '';
    if (preset.value === 'deluxe') {
        extraStyles = 'text-align-last: justify; line-height: 0.8; letter-spacing: -1px;';
    } else {
        // Ajusta line-height e letter-spacing para outros presets também preencherem mais
        extraStyles = 'line-height: 0.85; letter-spacing: -0.5px;';
    }
    
    const html = `
    <html>
      <head>
        <style>
          body {
            width: 512px;
            height: 512px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: ${preset.backgroundColor};
            font-family: 'Arial Narrow', Arial, sans-serif;
            font-weight: bold;
            text-align: ${textAlignStyle};
            margin: 0;
            /* --- MUDANÇA: Reduzindo o padding para dar mais espaço ao texto --- */
            padding: 15px; 
            box-sizing: border-box;
          }
          .text {
            color: ${preset.textColor};
            font-size: ${fontSize}px;
            transform: scaleY(1.7);
            filter: blur(1.5px);
            word-wrap: break-word;
            word-break: break-word; /* Garante que palavras muito longas quebrem */
            /* --- MUDANÇA: Aplica os estilos extras para preenchimento --- */
            ${extraStyles}
          }
        </style>
      </head>
      <body>
        <div class="text">${text}</div>
      </body>
    </html>
    `;
    
    return nodeHtmlToImage({ 
        html,
        puppeteerArgs: {
            executablePath: '/usr/bin/chromium-browser', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
    });
}


// --- Handler Principal do Comando (sem alterações) ---
module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText } = msgDetails;
    const args = commandText.split(' ').slice(1);

    if (args.length === 0) {
        const presetList = colorPresets.map(p => `- \`${p.value}\` (${p.label})`).join('\n');
        const tutorialText = `*Gerador de Imagens Brat* 🎨\n\nCrie uma imagem personalizada com texto e um estilo pré-definido.\n\n*Como usar:*\n\`/brat <predefinição> <seu texto aqui>\`\n\n*Exemplo:*\n\`/brat deluxe club classics\`\n\n*Predefinições disponíveis:*\n${presetList}`;
        await sock.sendMessage(sender, { text: tutorialText }, { quoted: msg });
        return;
    }

    const presetValue = args[0].toLowerCase();
    const textToBrat = args.slice(1).join(' ');

    const selectedPreset = colorPresets.find((p) => p.value === presetValue);

    if (!selectedPreset) {
        await sock.sendMessage(sender, { text: `😕 Predefinição "\`${presetValue}\`" não encontrada. Use \`/brat\` para ver a lista de opções.` }, { quoted: msg });
        return;
    }

    if (!textToBrat) {
        await sock.sendMessage(sender, { text: "Por favor, escreva o texto que você quer na imagem após a predefinição." }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        const imageBuffer = await generateBratImage(textToBrat, selectedPreset);

        const sticker = new Sticker(imageBuffer, {
            pack: 'Brat Pack',
            author: 'Julia Bot',
            type: StickerTypes.FULL,
            quality: 90,
        });

        await sock.sendMessage(sender, await sticker.toMessage());

    } catch (error) {
        console.error("[Brat Command] Erro ao gerar a imagem:", error);
        await sock.sendMessage(sender, { text: "😕 Ocorreu um erro ao criar o seu brat." }, { quoted: msg });
    }
};
