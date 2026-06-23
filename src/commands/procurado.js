const { generateImage } = require('../helpers/imageGenerator');
const { wantedTemplate } = require('../helpers/htmlTemplates');
const path = require('path');
const fs = require('fs');
const contactManager = require('../managers/contactManager');

async function procurado(sock, msg, msgDetails) {
    const { sender, commandSenderJid, prefix, commandName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    // Notify user that we are processing
    await sock.sendMessage(sender, { react: { text: '📜', key: msg.key } });

    // Determine target (mentioned user or sender)
    let targetJid = commandSenderJid;
    if (mentionedJids.length > 0) {
        targetJid = mentionedJids[0];
    } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
    }

    try {
        // Get user profile picture
        let ppUrl;
        try {
            ppUrl = await sock.profilePictureUrl(targetJid, 'image');
        } catch (e) {
            ppUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png'; // Default placeholder
        }

        // Get user name/nickname
        let name = contactManager.getNickname(targetJid) || targetJid.split('@')[0];

        // Truncate name if too long
        if (name.length > 20) {
            name = name.substring(0, 20) + '...';
        }

        // Generate Random Reward
        // Range: 1,000,000 to 5,000,000,000
        const minReward = 1000000;
        const maxReward = 5000000000;
        const rewardValue = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
        const formattedReward = rewardValue.toLocaleString('pt-BR');

        // Lists for randomization
        // Lists for randomization
        const crimes = [
            // Leves / Memes
            "Roubar Paçoca do mercado", "Ser Gostoso(a) Demais", "Falar mal de K-Pop",
            "Ignorar Áudio de 5min", "Usar tema claro no Zap", "Taxar a Shein",
            "Ser Low Profile", "Dar vácuo no Admin", "Roubar WiFi do vizinho",
            "Mandar trava-zap", "Não gostar de café", "Rir de meme ruim",
            "Gemidão do Zap em público", "Ser Falsiane", "Stalkear o ex",
            "Comer pizza com ketchup", "Sonegar imposto (bancário)", "Fazer figurinha proibida",
            "Ser Mono Yasuo", "Matar aula pra dormir",

            // "Mais Criminosos" (Solicitado)
            "Homicídio Doloso (matou a moda)", "Tráfico de Influência", "Lavagem de Dinheiro",
            "Agiotagem", "Sequestro Relâmpago", "Falsidade Ideológica",
            "Estelionato", "Porte Ilegal de Beleza", "Formação de Quadrilha",
            "Crimes de Guerra (no LoL)", "Pirataria Industrial", "Contrabando de Paçoca",
            "Derrubar o Servidor", "Vandalismo Virtual", "Corrupção Ativa",
            "Jogo do Bicho", "Rinha de Galo", "Assalto a Mão Armada",
            "Invasão de Propriedade", "Terrorismo Psicológico"
        ];

        const locations = [
            "Xique-Xique, BA", "Osasco, SP", "Belford Roxo, RJ", "Acre (???)",
            "Tangamandápio", "Wakanda", "Biquíni da Fenda", "Ratanabá",
            "Curralinho, PA", "Pau dos Ferros, RN", "Anta Gorda, RS",
            "Não-Me-Toque, RS", "Jardim de Piranhas, RN", "Passa Vinte, MG",
            "Varre-Sai, RJ", "Sombrio, SC", "Pintópolis, MG", "Grand Line",
            "Vila da Folha", "Gotham City", "Cyberpunk 2077"
        ];

        const randomCrime = crimes[Math.floor(Math.random() * crimes.length)];
        const randomLocation = locations[Math.floor(Math.random() * locations.length)];

        // Paths
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const outputPath = path.join(tempDir, `wanted_${Date.now()}.png`);

        // Generate Image
        await generateImage(wantedTemplate, outputPath, {
            avatarUrl: ppUrl,
            name: name,
            reward: formattedReward,
            crime: randomCrime,
            location: randomLocation
        }, { width: 600, height: 900 });

        // Send Image
        await sock.sendMessage(sender, {
            image: { url: outputPath },
            caption: `🤠 *PROCURADO: DEAD OR ALIVE* 🤠\n\n👤 *Alvo:* @${targetJid.split('@')[0]}\n📜 *Crime:* ${randomCrime}\n📍 *Visto em:* ${randomLocation}\n💰 *Recompensa:* ฿ ${formattedReward}`,
            mentions: [targetJid]
        }, { quoted: msg });

        // Cleanup
        setTimeout(() => {
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        }, 30000); // Delete after 30s

    } catch (error) {
        console.error('[PROCURADO] Erro ao gerar cartaz:', error);
        await sock.sendMessage(sender, { text: '❌ Erro ao gerar cartaz de procurado.' }, { quoted: msg });
    }
}

module.exports = procurado;

module.exports.commandData = {
    name: "procurado",
    description: "Gera um cartaz de 'Procurado' com a foto do usuário.",
    category: "midia",
    usage: "/procurado [@usuario]",
    aliases: ["wanted"]
};
