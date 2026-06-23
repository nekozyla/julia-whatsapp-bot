const axios = require('axios');
const config = require('../../config.js');

async function handleTesteCommand(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        // Busca a foto de perfil do bot
        let botJid = sock.user.id;
        let thumbnailBuffer = null;

        try {
            const imageUrl = await sock.profilePictureUrl(botJid, 'image');
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
            thumbnailBuffer = Buffer.from(response.data);
        } catch {
            try {
                const cleanJid = botJid.split(':')[0] + '@s.whatsapp.net';
                const imageUrl = await sock.profilePictureUrl(cleanJid, 'image');
                const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 10000 });
                thumbnailBuffer = Buffer.from(response.data);
            } catch {
                thumbnailBuffer = null;
            }
        }

        const botName = sock.user.name || config.BOT_NAME;
        const hora = new Date().toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const text = `┏━━❪ 🤖 𝗧𝗘𝗦𝗧𝗘 ❫━━\n┃\n┃ ➢ Bot online e funcionando!\n┃ ➢ Tudo certo por aqui ✅\n┃\n┃ ➢ 𝗡𝗼𝗺𝗲 › ${botName}\n┃ ➢ 𝗛𝗼𝗿𝗮 › ${hora}\n┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text,
            contextInfo: {
                externalAdReply: {
                    title: `꩜ ${botName}`,
                    body: '✅ Bot online e funcionando!',
                    mediaType: 1,
                    renderLargerThumbnail: true,
                    showAdAttribution: false,
                    ...(thumbnailBuffer ? { thumbnail: thumbnailBuffer } : {}),
                }
            }
        }, { quoted: msg });

    } catch (err) {
        console.error('[TESTE] Erro:', err.message);
        await sock.sendMessage(sender, {
            text: '❌ Ocorreu um erro ao executar o teste.'
        }, { quoted: msg });
    }

    return true;
}

module.exports = handleTesteCommand;

module.exports.commandData = {
    name: "teste",
    description: "Envia uma mensagem de teste com a foto do bot.",
    category: "util",
    usage: "/teste",
    aliases: ["/test", "/botinfo"]
};
