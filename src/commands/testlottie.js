const fs = require('fs');
const path = require('path');

const LOTTIE_SOURCE = path.join(__dirname, '..', '..', 'test_no_secondary.was');

async function handleTestLottieCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    if (!fs.existsSync(LOTTIE_SOURCE)) {
        await sock.sendMessage(sender, { text: '❌ Arquivo Lottie nao encontrado.' }, { quoted: msg });
        return;
    }

    const stickerBuffer = fs.readFileSync(LOTTIE_SOURCE);

    await sock.sendMessage(sender, { react: { text: '🎬', key: msg.key } });

    // Template com trust_token valido (Pedrozz13755 approach).
    // animation.json fica intacto (trust_token valida o SHA256).
    // animation_secondary.json pode ser modificado livremente.
    await sock.sendMessage(sender, {
        sticker: stickerBuffer,
        mimetype: 'application/was',
        isLottie: true,
        isAnimated: true,
    }, { quoted: msg });
}

module.exports = handleTestLottieCommand;

module.exports.commandData = {
    name: "testlottie",
    description: "Envia o sticker Lottie de teste (WA Spring original).",
    category: "diversao",
    usage: "/testlottie",
    aliases: ["/testanim", "/lottie"]
};
