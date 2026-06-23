const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const { downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');

const FARM_DIR = path.join(__dirname, '..', '..', 'data', 'lotties_farm');

const findFarmFile = (id) => {
    const files = fs.readdirSync(FARM_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f.startsWith(id));
    if (jsonFiles.length === 0) return { error: `Nenhum Lottie na farm com o ID: ${id}` };
    if (jsonFiles.length > 1) return { error: `Múltiplos Lotties com o prefixo ${id}. Seja mais específico.` };
    const fullId = jsonFiles[0].replace('.json', '');
    const wasPath = path.join(FARM_DIR, `${fullId}.was`);
    if (!fs.existsSync(wasPath)) return { error: `Arquivo .was não encontrado para o ID: ${id}` };
    return { path: wasPath, fullId };
};

async function handleLottieList(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    if (!fs.existsSync(FARM_DIR)) {
        await sock.sendMessage(sender, { text: 'A farm de Lotties está vazia (diretório não existe).' }, { quoted: msg });
        return;
    }

    const files = fs.readdirSync(FARM_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
        await sock.sendMessage(sender, { text: 'A farm de Lotties está vazia.' }, { quoted: msg });
        return;
    }

    let listText = '🎬 *Lotties na Farm* 🎬\n\n';

    for (const jsonFile of jsonFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(FARM_DIR, jsonFile), 'utf8'));
            const id = data.fileSha256;
            const shortId = id.substring(0, 8);
            const date = new Date(data.collectedAt).toLocaleDateString('pt-BR');
            const pushName = data.pushName || 'Desconhecido';
            const lottieName = data.lottieName || 'Desconhecido';
            
            listText += `*ID:* \`${shortId}\`\n`;
            listText += `*Nome:* ${lottieName}\n`;
            listText += `Enviado por: ${pushName} (${date})\n`;
            listText += `──────────────────\n`;
        } catch (e) {
            console.error('[LottieList] Erro ao ler metadado:', jsonFile, e);
        }
    }

    listText += `\nPara fundir, use:\n\`/lottie <ID_PRINCIPAL> <ID_SECUNDARIO>\``;

    await sock.sendMessage(sender, { text: listText }, { quoted: msg });
}

async function getBufferFromQuoted(sock, msg, msgDetails) {
    const { sender, quotedMsgInfo } = msgDetails;
    let targetMessage = null;
    let stickerObj = null;

    if (quotedMsgInfo) {
        const quotedType = getContentType(quotedMsgInfo);
        if (quotedType === 'stickerMessage' || quotedType === 'lottieStickerMessage') {
            targetMessage = {
                key: {
                    remoteJid: msg.key.remoteJid,
                    id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
                    participant: msg.message?.extendedTextMessage?.contextInfo?.participant
                },
                message: quotedMsgInfo
            };

            stickerObj = quotedMsgInfo.stickerMessage;
            if (!stickerObj && quotedMsgInfo.lottieStickerMessage?.message?.stickerMessage) {
                stickerObj = quotedMsgInfo.lottieStickerMessage.message.stickerMessage;
            }
        }
    }

    if (!targetMessage || !stickerObj?.isLottie) {
        await sock.sendMessage(sender, { text: 'Você precisa responder a um Lottie válido para esta operação.' }, { quoted: msg });
        return null;
    }

    await sock.sendMessage(sender, { react: { text: '🧪', key: msg.key } });

    try {
        const syntheticMsg = {
            key: targetMessage.key,
            message: { stickerMessage: stickerObj }
        };
        const buffer = await downloadMediaMessage(syntheticMsg, 'buffer', {}, { logger: undefined });
        if (!buffer) throw new Error('Buffer vazio.');
        return buffer;
    } catch (err) {
        console.error('Erro ao baixar Lottie citado:', err);
        await sock.sendMessage(sender, { text: `❌ Falha ao baixar o Lottie respondido: ${err.message}` }, { quoted: msg });
        return null;
    }
}

async function handleLottieMerge(sock, msg, msgDetails, principalId, secondaryId) {
    const { sender } = msgDetails;

    if (!fs.existsSync(FARM_DIR)) {
        await sock.sendMessage(sender, { text: 'Farm vazia.' }, { quoted: msg });
        return;
    }

    if (principalId) {
        const pIdToUse = principalId;
        const principalRes = findFarmFile(pIdToUse);
        if (principalRes.error) {
            await sock.sendMessage(sender, { text: principalRes.error }, { quoted: msg });
            return;
        }
        mainBuffer = fs.readFileSync(principalRes.path);
    } else {
        mainBuffer = await getBufferFromQuoted(sock, msg, msgDetails);
        if (!mainBuffer) return;
    }

    // 2. Resolver o Lottie Secundário
    const secondaryRes = findFarmFile(secondaryId);
    if (secondaryRes.error) {
        await sock.sendMessage(sender, { text: secondaryRes.error }, { quoted: msg });
        return;
    }
    secondaryBuffer = fs.readFileSync(secondaryRes.path);

    try {
        const mainZip = new AdmZip(mainBuffer);
        const mainEntry_anim = mainZip.getEntry('animation/animation.json');
        const mainEntry_token = mainZip.getEntry('animation/animation.json.trust_token');

        if (!mainEntry_anim || !mainEntry_token) {
            throw new Error('Lottie Principal não possui animation.json ou seu respectivo trust_token.');
        }

        const secZip = new AdmZip(secondaryBuffer);
        const secEntry_animSec = secZip.getEntry('animation/animation_secondary.json');
        const secEntry_tokenSec = secZip.getEntry('animation/animation_secondary.json.trust_token');

        if (!secEntry_animSec || !secEntry_tokenSec) {
            throw new Error('Lottie Secundário da farm não possui animation_secondary.json ou seu respectivo trust_token.');
        }

        const mergedZip = new AdmZip();
        
        const metaObj = {
            "sticker-pack-id": crypto.randomBytes(16).toString('hex'),
            "sticker-pack-name": "Made With Jul.ia",
            "sticker-pack-publisher": "@JuliaZap_Bot",
            "emojis": ["⭐️", "💖"],
            "is-from-user-created-pack": 1
        };
        mergedZip.addFile('animation/animation.json.overridden_metadata', Buffer.from(JSON.stringify(metaObj), 'utf-8'));

        mergedZip.addFile('animation/animation.json', mainEntry_anim.getData());
        mergedZip.addFile('animation/animation.json.trust_token', mainEntry_token.getData());
        mergedZip.addFile('animation/animation_secondary.json', secEntry_animSec.getData());
        mergedZip.addFile('animation/animation_secondary.json.trust_token', secEntry_tokenSec.getData());

        const mergedBuffer = mergedZip.toBuffer();

        await sock.sendMessage(sender, {
            sticker: mergedBuffer,
            mimetype: 'application/was',
            isLottie: true,
            isAnimated: true,
        }, { quoted: msg });

    } catch (err) {
        console.error('[LottieMerge] Erro:', err);
        await sock.sendMessage(sender, { text: `❌ Falha ao fundir: ${err.message}` }, { quoted: msg });
    }
}

async function handleLottieRandom(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    if (!fs.existsSync(FARM_DIR)) {
        await sock.sendMessage(sender, { text: 'Farm vazia.' }, { quoted: msg });
        return;
    }

    const files = fs.readdirSync(FARM_DIR);
    const wasFiles = files.filter(f => f.endsWith('.was'));

    if (wasFiles.length < 2) {
        await sock.sendMessage(sender, { text: 'A farm precisa de pelo menos 2 Lotties salvos para fazer uma mistura aleatória.' }, { quoted: msg });
        return;
    }

    const idx1 = Math.floor(Math.random() * wasFiles.length);
    let idx2 = Math.floor(Math.random() * wasFiles.length);
    while (idx2 === idx1) {
        idx2 = Math.floor(Math.random() * wasFiles.length);
    }

    const principalFile = wasFiles[idx1];
    const secondaryFile = wasFiles[idx2];

    const principalPath = path.join(FARM_DIR, principalFile);
    const secondaryPath = path.join(FARM_DIR, secondaryFile);

    await sock.sendMessage(sender, { react: { text: '🎲', key: msg.key } });

    try {
        const principalBuffer = fs.readFileSync(principalPath);
        const secondaryBuffer = fs.readFileSync(secondaryPath);

        const mainZip = new AdmZip(principalBuffer);
        const pIsReversed = Math.random() > 0.5;
        const mainEntry_anim = pIsReversed ? mainZip.getEntry('animation/animation_secondary.json') : mainZip.getEntry('animation/animation.json');
        const mainEntry_token = pIsReversed ? mainZip.getEntry('animation/animation_secondary.json.trust_token') : mainZip.getEntry('animation/animation.json.trust_token');

        if (!mainEntry_anim || !mainEntry_token) {
            throw new Error('Lottie Principal sorteado não possui arquivos essenciais.');
        }

        const secZip = new AdmZip(secondaryBuffer);
        const sIsReversed = Math.random() > 0.5;
        const secEntry_animSec = sIsReversed ? secZip.getEntry('animation/animation.json') : secZip.getEntry('animation/animation_secondary.json');
        const secEntry_tokenSec = sIsReversed ? secZip.getEntry('animation/animation.json.trust_token') : secZip.getEntry('animation/animation_secondary.json.trust_token');

        if (!secEntry_animSec || !secEntry_tokenSec) {
            throw new Error('Lottie Secundário sorteado não possui arquivos essenciais.');
        }

        const mergedZip = new AdmZip();

        const metaObj = {
            "sticker-pack-id": crypto.randomBytes(16).toString('hex'),
            "sticker-pack-name": "Made With Jul.ia",
            "sticker-pack-publisher": "@JuliaZap_Bot",
            "emojis": ["🎲", "✨"],
            "is-from-user-created-pack": 1
        };
        mergedZip.addFile('animation/animation.json.overridden_metadata', Buffer.from(JSON.stringify(metaObj), 'utf-8'));

        mergedZip.addFile('animation/animation.json', mainEntry_anim.getData());
        mergedZip.addFile('animation/animation.json.trust_token', mainEntry_token.getData());
        mergedZip.addFile('animation/animation_secondary.json', secEntry_animSec.getData());
        mergedZip.addFile('animation/animation_secondary.json.trust_token', secEntry_tokenSec.getData());

        const mergedBuffer = mergedZip.toBuffer();

        let principalName = principalFile.substring(0, 8);
        let secondaryName = secondaryFile.substring(0, 8);
        try {
            const pMeta = JSON.parse(fs.readFileSync(principalPath.replace('.was', '.json'), 'utf8'));
            if (pMeta.lottieName) principalName = pMeta.lottieName;
            
            const sMeta = JSON.parse(fs.readFileSync(secondaryPath.replace('.was', '.json'), 'utf8'));
            if (sMeta.lottieName) secondaryName = sMeta.lottieName;
        } catch (e) {
            console.error('[LottieRandom] Erro ao tentar ler nomes para log:', e);
        }

        let pLabel = principalName + (pIsReversed ? ' (Inv)' : '');
        let sLabel = secondaryName + (sIsReversed ? ' (Inv)' : '');

        await sock.sendMessage(sender, {
            sticker: mergedBuffer,
            mimetype: 'application/was',
            isLottie: true,
            isAnimated: true,
        }, { quoted: msg });

        await sock.sendMessage(sender, { 
            text: `🎲 *Lottie Quimera Sorteada!*\n\n🧠 *Esqueleto:* ${pLabel}\n🎨 *Textura:* ${sLabel}` 
        }, { quoted: msg });

    } catch (err) {
        console.error('[LottieRandom] Erro:', err);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(sender, { text: `❌ Falha ao fundir aleatórios: ${err.message}` }, { quoted: msg });
    }
}

async function handleLottieInvert(sock, msg, msgDetails) {
    const { sender } = msgDetails;
    
    const buffer = await getBufferFromQuoted(sock, msg, msgDetails);
    if (!buffer) return; // Erro já tratado internamente
    
    try {
        const origZip = new AdmZip(buffer);
        const main_anim = origZip.getEntry('animation/animation.json');
        const main_token = origZip.getEntry('animation/animation.json.trust_token');
        const sec_anim = origZip.getEntry('animation/animation_secondary.json');
        const sec_token = origZip.getEntry('animation/animation_secondary.json.trust_token');

        if (!main_anim || !main_token || !sec_anim || !sec_token) {
            throw new Error('A figurinha não possui a estrutura secundária necessária para a inversão.');
        }

        const mergedZip = new AdmZip();

        // Custom metadata
        const metaObj = {
            "sticker-pack-id": crypto.randomBytes(16).toString('hex'),
            "sticker-pack-name": "Made With Jul.ia",
            "sticker-pack-publisher": "@JuliaZap_Bot",
            "emojis": ["🔄", "✨"],
            "is-from-user-created-pack": 1
        };
        mergedZip.addFile('animation/animation.json.overridden_metadata', Buffer.from(JSON.stringify(metaObj), 'utf-8'));

        // A mágica: trocamos os papéis dos arquivos
        mergedZip.addFile('animation/animation.json', sec_anim.getData());
        mergedZip.addFile('animation/animation.json.trust_token', sec_token.getData());
        mergedZip.addFile('animation/animation_secondary.json', main_anim.getData());
        mergedZip.addFile('animation/animation_secondary.json.trust_token', main_token.getData());

        const newBuffer = mergedZip.toBuffer();

        await sock.sendMessage(sender, {
            sticker: newBuffer,
            mimetype: 'application/was',
            isLottie: true,
            isAnimated: true,
        }, { quoted: msg });

    } catch (err) {
        console.error('[LottieInverter] Erro:', err);
        await sock.sendMessage(sender, { text: `❌ Falha ao inverter a figurinha: ${err.message}` }, { quoted: msg });
    }
}

async function handleLottieCommand(sock, msg, msgDetails) {
    const { sender, args, commandName, prefix } = msgDetails;

    if (!args[0]) {
        const helpText = `┏━━❪ 𝗟𝗢𝗧𝗧𝗜𝗘 ❫━━\n┃\n┃ ➢ ${prefix}${commandName} list\n┃ ➢ ${prefix}${commandName} random\n┃ ➢ ${prefix}${commandName} inverter\n┃ ➢ ${prefix}${commandName} <ID>\n┃ ➢ ${prefix}${commandName} <ID_1> <ID_2>\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return;
    }

    const subCommand = args[0].toLowerCase();

    // Roteamento
    if (subCommand === 'list' || subCommand === 'farm') {
        return await handleLottieList(sock, msg, msgDetails);
    } 
    
    if (subCommand === 'random' || subCommand === 'sortear') {
        return await handleLottieRandom(sock, msg, msgDetails);
    }
    
    if (subCommand === 'inverter') {
        return await handleLottieInvert(sock, msg, msgDetails);
    }
    
    if (subCommand === 'merge' || subCommand === 'fundir') {
        if (!args[1]) {
            await sock.sendMessage(sender, { text: `Uso correto: ${prefix}${commandName} ${subCommand} <ID>` }, { quoted: msg });
            return;
        }
        
        let principalId = null;
        let secondaryId = null;
        if (args.length >= 3) {
            principalId = args[1].toLowerCase();
            secondaryId = args[2].toLowerCase();
        } else {
            secondaryId = args[1].toLowerCase();
        }
        
        return await handleLottieMerge(sock, msg, msgDetails, principalId, secondaryId);
    }

    // Default: Assume que é um ID e faz merge diretamente (Smart Merge)
    let principalId = null;
    let secondaryId = null;
    
    if (args.length >= 2) {
        principalId = args[0].toLowerCase();
        secondaryId = args[1].toLowerCase();
    } else {
        secondaryId = args[0].toLowerCase();
    }

    return await handleLottieMerge(sock, msg, msgDetails, principalId, secondaryId);
}

module.exports = handleLottieCommand;

module.exports.commandData = {
    name: 'lottie',
    description: 'Central de comandos de animações Lottie (list, random, merge, inverter).',
    category: 'diversao',
    usage: '/lottie [ação]',
    aliases: ['/lottielist', '/lottiefarm', '/lottiemerge', '/merge', '/lottierandom', '/randlottie', '/lottiesortear']
};
