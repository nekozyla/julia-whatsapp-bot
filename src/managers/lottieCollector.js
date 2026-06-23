const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const FARM_DIR = path.join(__dirname, '..', '..', 'data', 'lotties_farm');

// Ensure directory exists
if (!fs.existsSync(FARM_DIR)) {
    fs.mkdirSync(FARM_DIR, { recursive: true });
}

async function collectLottie(sock, msg, stickerMsgObj, msgDetails) {
    if (!stickerMsgObj?.isLottie) {
        return;
    }

    try {
        const syntheticMsg = {
            key: msg.key,
            message: {
                stickerMessage: stickerMsgObj
            }
        };

        const buffer = await downloadMediaMessage(syntheticMsg, 'buffer', {}, { logger: undefined });
        if (!buffer) return;

        // .was files are standard ZIPs
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        const entryNames = entries.map(e => e.entryName);

        // Required files according to PROGRESSO_LOTTIE.md
        const reqFiles = [
            'animation/animation.json',
            'animation/animation_secondary.json',
            'animation/animation.json.trust_token',
            'animation/animation_secondary.json.trust_token'
        ];

        const hasAllFiles = reqFiles.every(f => entryNames.includes(f));
        
        if (hasAllFiles) {
            const stickerSha256 = stickerMsgObj.fileSha256;
            let fileId = 'lottie_farm';
            if (stickerSha256) {
                fileId = Buffer.from(stickerSha256).toString('hex');
            } else {
                fileId = `lottie_${Date.now()}`;
            }

            const wasPath = path.join(FARM_DIR, `${fileId}.was`);
            const metaPath = path.join(FARM_DIR, `${fileId}.json`);

            if (fs.existsSync(wasPath)) {
                // Already collected
                return;
            }

            fs.writeFileSync(wasPath, buffer);

            let lottieName = 'Desconhecido';
            try {
                const animEntry = zip.getEntry('animation/animation.json');
                if (animEntry) {
                    const animData = JSON.parse(animEntry.getData().toString('utf8'));
                    if (animData.nm) lottieName = animData.nm;
                }
            } catch (e) {
                console.error('[LottieCollector] Erro ao ler nome do lottie:', e);
            }

            const metadata = {
                fileSha256: fileId,
                lottieName: lottieName,
                collectedAt: new Date().toISOString(),
                authorJid: msgDetails.commandSenderJid,
                pushName: msgDetails.pushName,
                isAnimated: stickerMsgObj.isAnimated,
                mimetype: stickerMsgObj.mimetype,
                entriesCount: entryNames.length
            };

            fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
            console.log(`[LottieCollector] Lottie guardado na farm com sucesso: ${fileId}.was (${lottieName})`);
        }
    } catch (err) {
        console.error('[LottieCollector] Erro ao coletar Lottie:', err);
    }
}

module.exports = {
    collectLottie
};

