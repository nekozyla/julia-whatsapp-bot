// commands/brat.js (Versão com texto esticado)


const nodeHtmlToImage = require('node-html-to-image');

const { Sticker, StickerTypes } = require('wa-sticker-formatter');


// Lista de predefinições de cores

const colorPresets = [

    { label: 'brat deluxe', value: 'deluxe', textColor: '#000000', backgroundColor: '#ffffff' },

    { label: 'brat', value: 'brat', textColor: '#000000', backgroundColor: '#8ace00' },

    { label: 'crash', value: 'crash', textColor: '#f70000', backgroundColor: '#019bd9' },

    { label: 'charli', value: 'charli', textColor: '#000000', backgroundColor: '#918a84' },

    { label: 'pop 2', value: 'pop2', textColor: '#000000', backgroundColor: '#c9a1dd' },

    { label: 'vroom vroom', value: 'vroom', textColor: '#404040', backgroundColor: '#000000' },

    { label: 'sucker', value: 'sucker', textColor: '#ffffff', backgroundColor: '#f5abcc' },

    { label: 'true romance', value: 'romance', textColor: '#ffffff', backgroundColor: '#700150' },

];


/**

 * Gera a imagem no estilo "brat" usando HTML.

 * @param {string} text - O texto a ser renderizado.

 * @param {object} preset - O objeto da predefinição de cor.

 * @returns {Promise<Buffer>} Um buffer com a imagem gerada.

 */

async function generateBratImage(text, preset) {

    const textAlignStyle = preset.value === 'deluxe' ? 'justify' : 'center';


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

            padding: 20px;

            box-sizing: border-box;

          }

          .text {

            color: ${preset.textColor};

            font-size: 65px;

            /* --- MUDANÇA: Aumentado para dar mais espaço entre as linhas --- */

            line-height: 0.9;

            /* --- MUDANÇA: Estica o texto 20% na vertical --- */

            transform: scaleY(1.7);

            filter: blur(1.5px);

            word-wrap: break-word;

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
            // Substitua o caminho abaixo pelo resultado do comando 'which chromium-browser'
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
