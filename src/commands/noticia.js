const { generateImage } = require('../helpers/imageGenerator');
const { newsTemplate } = require('../helpers/htmlTemplates');
const path = require('path');
const fs = require('fs');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

async function noticia(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Notify user that we are processing
    await sock.sendMessage(sender, { react: { text: '📺', key: msg.key } });

    // Determine target (mentioned user or sender if no mention but has quoted)
    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }

    // Determine headline text
    // 1. If args exist, use them as headline.
    // 2. If no args, generate random headline.
    let headline = args.join(' ');
    let isRandom = false;

    if (!headline) {
        isRandom = true;
        const randomHeadlines = [
            "Cientistas confirmam: Terra é plana e quadrada",
            "Homem é preso após tentar vender ar engarrafado",
            "Gato assume presidência do bairro e decreta sachê grátis",
            "Água molhada é descoberta por cientistas da NASA",
            "Bolacha ou Biscoito? O debate que parou o congresso",
            "Admin do grupo é visto trabalhando (Imagens Reais)",
            "Usuário esquece de beber água e vira uma passas",
            "Previsão do tempo: Chuva de boletos para amanhã",
            `Vazou: ${BOT_NAME} Bot vai dominar o mundo em 2026`,
            "Estudo revela: Dormir 14h por dia faz bem à saúde",
            "Sexta-feira é cancelada por falta de orçamento",
            "Novo imposto sobre memes entra em vigor hoje"
        ];
        headline = randomHeadlines[Math.floor(Math.random() * randomHeadlines.length)];
    }

    // Categories
    const categories = ["MUNDO", "POLÍTICA", "ESPORTE", "CIÊNCIA", "URGENTE", "ECONOMIA", "ENTRETENIMENTO"];
    const category = categories[Math.floor(Math.random() * categories.length)];

    try {
        // Get user profile picture
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            ppUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; // Default placeholder
        }

        // Paths
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const outputPath = path.join(tempDir, `news_${Date.now()}.png`);

        // Generate Image
        await generateImage(newsTemplate, outputPath, {
            imageUrl: ppUrl,
            category: category,
            headline: headline
        }, { width: 800, height: 450 });

        // Send Image
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `📺 *PLANTÃO URGENTE* 📺`,
            mentions: [targetJid]
        }, { quoted: msg });

        // Cleanup
        setTimeout(() => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }, 30000); // Delete after 30s

    } catch (error) {
        console.error('[NOTICIA] Erro ao gerar imagem:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao gerar notícia.' }, { quoted: msg });
    }
}

module.exports = noticia;

module.exports.commandData = {
    name: "noticia",
    description: "Cria uma manchete de 'Fake News' com a foto do usuário.",
    category: "midia",
    usage: "/noticia [texto] ou /noticia (sem texto para aleatório)",
    aliases: ["fake", "fakenews", "plantao"]
};
