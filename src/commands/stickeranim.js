const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

const TEMPLATE_FOLDER = path.join(__dirname, '..', '..', 'sticker_template');
const SUPPORTED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

function getMime(ext, mime) {
    if (mime) return mime;
    const map = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    return map[ext?.toLowerCase()] || null;
}

function toDataUri(buffer, mime) {
    return `data:${mime};base64,${buffer.toString('base64')}`;
}

function replaceBase64Image(jsonPath, dataUri) {
    const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    if (!Array.isArray(json.assets)) {
        throw new Error('JSON do template nao tem assets.');
    }

    const asset = json.assets.find(a => typeof a?.p === 'string' && a.p.startsWith('data:image/'));
    if (!asset) {
        throw new Error('Nenhuma imagem base64 encontrada no template animation_secondary.json.');
    }

    asset.p = dataUri;
    // Atualiza dimensoes da imagem se disponivel no asset
    if (asset.w) asset.w = undefined;
    if (asset.h) asset.h = undefined;

    fs.writeFileSync(jsonPath, JSON.stringify(json));
}

function zipToWas(folder, output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });

    const zipPath = output.replace(/\.was$/i, '.zip');
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(output)) fs.unlinkSync(output);

    execSync(`zip -r "${zipPath}" .`, { cwd: folder, stdio: 'ignore' });
    fs.renameSync(zipPath, output);
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, item.name);
        const to = path.join(dest, item.name);
        if (item.isDirectory()) copyDir(from, to);
        else fs.copyFileSync(from, to);
    }
}

async function buildAnimatedSticker(imageBuffer, imageExt) {
    const mime = getMime(imageExt);
    if (!mime) throw new Error('Formato de imagem nao suportado. Use PNG, JPG ou WEBP.');

    const temp = path.join(os.tmpdir(), `lottie-sticker-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    const output = path.join(os.tmpdir(), `sticker-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.was`);

    try {
        copyDir(TEMPLATE_FOLDER, temp);

        const secondaryJsonPath = path.join(temp, 'animation', 'animation_secondary.json');
        if (!fs.existsSync(secondaryJsonPath)) {
            throw new Error('Template animation_secondary.json nao encontrado.');
        }

        const dataUri = toDataUri(imageBuffer, mime);
        replaceBase64Image(secondaryJsonPath, dataUri);

        zipToWas(temp, output);
        return output;
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

async function handleStickerAnimCommand(sock, msg, msgDetails) {
    const { sender, quotedMsgInfo } = msgDetails;

    let targetMessage = null;

    // Verifica se a mensagem tem imagem direta
    if (msg.message?.imageMessage) {
        targetMessage = msg;
    }
    // Verifica mensagem citada (reply)
    else if (quotedMsgInfo) {
        const quotedType = getContentType(quotedMsgInfo);
        if (quotedType === 'imageMessage') {
            targetMessage = {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
                    participant: msg.message?.extendedTextMessage?.contextInfo?.participant
                },
                message: quotedMsgInfo
            };
        }
    }

    if (!targetMessage) {
        await sock.sendMessage(sender, {
            text: '❌ Envie ou responda a uma imagem com /stickeranim para criar um sticker animado.'
        }, { quoted: msg });
        return;
    }

    await sock.sendMessage(sender, { react: { text: '🎬', key: msg.key } });

    try {
        const buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined });

        let imageExt = '.png';
        if (targetMessage.message?.imageMessage?.mimetype) {
            const m = targetMessage.message.imageMessage.mimetype;
            if (m === 'image/jpeg') imageExt = '.jpg';
            else if (m === 'image/webp') imageExt = '.webp';
        }

        const wasPath = await buildAnimatedSticker(buffer, imageExt);
        const wasBuffer = fs.readFileSync(wasPath);

        await sock.sendMessage(sender, {
            sticker: wasBuffer,
            mimetype: 'application/was',
            isLottie: true,
            isAnimated: true,
        }, { quoted: msg });

        fs.unlinkSync(wasPath);
    } catch (err) {
        console.error('[stickeranim] Erro:', err);
        await sock.sendMessage(sender, {
            text: `❌ Erro ao criar sticker animado: ${err.message}`
        }, { quoted: msg });
    }
}

module.exports = handleStickerAnimCommand;

module.exports.commandData = {
    name: 'stickeranim',
    description: 'Cria um sticker animado (Lottie) a partir de uma imagem.',
    category: 'diversao',
    usage: '/stickeranim (respondendo a uma imagem)',
    aliases: ['/sanime', '/animfig', '/figanim']
};
