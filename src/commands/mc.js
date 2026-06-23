const { generateImage } = require('../helpers/imageGenerator');
const path = require('path');
const fs = require('fs');

const mcTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            width: 600px;
            height: 450px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            font-family: Helvetica, Arial, sans-serif;
        }

        .card {
            width: 600px;
            height: 450px;
            background: #0a3a70;
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 70px;
        }

        .title {
            font-size: 44px;
            line-height: 1.08;
            font-weight: 500;
            white-space: pre-wrap;
            word-break: break-word;
            text-align: center;
        }

        .author {
            margin-top: 36px;
            font-size: 34px;
            color: rgba(255,255,255,0.82);
            font-weight: 400;
            white-space: pre-wrap;
            word-break: break-word;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="title">{{title}}</div>
        <div class="author">{{author}}</div>
    </div>
</body>
</html>
`;

function sanitizeText(input, maxLen) {
    return String(input || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function extractQuotedText(msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return '';

    return (
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        ''
    );
}

async function mc(sock, msg, msgDetails) {
    const { sender, args = [], prefix, commandName } = msgDetails;

    const usage = `Uso:\n${prefix}${commandName} frase | assinatura\n${prefix}${commandName} frase\n(assinatura padrão: Mc procrastinador...)`;

    let rawInput = args.join(' ').trim();
    if (!rawInput) {
        rawInput = extractQuotedText(msg).trim();
    }

    if (!rawInput) {
        await sock.sendMessage(sender, { text: usage }, { quoted: msg });
        return true;
    }

    const parts = rawInput.split('|');
    const title = sanitizeText(parts[0], 120);
    const author = sanitizeText(parts.slice(1).join('|'), 60) || 'Mc procrastinador...';

    if (!title) {
        await sock.sendMessage(sender, { text: usage }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(sender, { react: { text: '🎵', key: msg.key } });

    try {
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const outputPath = path.join(tempDir, `mc_${Date.now()}.png`);

        await generateImage(mcTemplate, outputPath, {
            title,
            author
        }, { width: 600, height: 450 });

        await sock.sendMessage(sender, {
            image: { url: outputPath }
        }, { quoted: msg });

        setTimeout(() => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }, 30000);
    } catch (error) {
        console.error('[MC] Erro ao gerar imagem:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao gerar imagem MC.' }, { quoted: msg });
    }

    return true;
}

module.exports = mc;

module.exports.commandData = {
    name: 'mc',
    description: 'Gera imagem estilo capa MC com frase e assinatura.',
    category: 'midia',
    usage: '/mc frase | assinatura',
    aliases: []
};
