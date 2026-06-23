/**
 * /importar - Importador de Figurinhas WhatsApp ↔ Telegram
 * 
 * Uso:
 *   /importar vincular      → Gera link para vincular com o Telegram
 *   /importar desvincular   → Remove o vínculo
 *   /importar status        → Verifica se está vinculado
 *   /importar               → (respondendo a um sticker) Envia a figurinha pro Telegram
 */

const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const { pipeline } = require('stream/promises');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const telegramBridge = require('../managers/telegramBridge.js');

async function importar(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup, args, pushName } = msgDetails;

    const sub = args[0]?.toLowerCase();

    // ─── /importar vincular ────────────────────────────────
    if (sub === 'vincular') {
        const code = telegramBridge.createLinkCode(commandSenderJid);

        let botInfo;
        try {
            botInfo = await telegramBridge.getBotInfo();
        } catch (e) {
            await sock.sendMessage(sender, {
                text: '❌ O bot do Telegram está offline. Tente novamente mais tarde.'
            }, { quoted: msg });
            return;
        }

        if (!botInfo) {
            await sock.sendMessage(sender, {
                text: '❌ Não foi possível conectar ao bot do Telegram.'
            }, { quoted: msg });
            return;
        }

        const botUsername = botInfo.username;
        const deepLink = `https://t.me/${botUsername}?start=link_${code}`;

        await sock.sendMessage(sender, {
            text:
                `┏━━❪ 📨 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗥 ❫━━\n` +
                `┃\n` +
                `┃ ➢ Vincular com Telegram\n` +
                `┃\n` +
                `┃ Clique no link abaixo para\n` +
                `┃ vincular seu Telegram:\n` +
                `┃\n` +
                `┃ 🔗 ${deepLink}\n` +
                `┃\n` +
                `┃ ⏰ Expira em 10 minutos\n` +
                `┃\n` +
                `┃ Depois de vincular, responda\n` +
                `┃ a qualquer figurinha com\n` +
                `┃ /importar para enviá-la\n` +
                `┃ ao Telegram!\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    // ─── /importar desvincular ─────────────────────────────
    if (sub === 'desvincular') {
        const removed = await telegramBridge.unlinkByWhatsApp(commandSenderJid);
        if (removed) {
            await sock.sendMessage(sender, {
                text: '✅ Vínculo com o Telegram removido com sucesso.'
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: '❌ Você não tem nenhum Telegram vinculado.'
            }, { quoted: msg });
        }
        return;
    }

    // ─── /importar status ──────────────────────────────────
    if (sub === 'status') {
        const linked = telegramBridge.isLinked(commandSenderJid);
        if (linked) {
            await sock.sendMessage(sender, {
                text: '✅ Seu WhatsApp está vinculado ao Telegram! Responda a qualquer figurinha com /importar para enviá-la.'
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: '❌ Nenhum Telegram vinculado. Use /importar vincular para conectar.'
            }, { quoted: msg });
        }
        return;
    }

    // ─── /importar (sem sub) ou /importar (respondendo a sticker) ──

    // Verificar se está vinculado
    if (!telegramBridge.isLinked(commandSenderJid)) {
        await sock.sendMessage(sender, {
            text:
                `┏━━❪ 📨 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗥 ❫━━\n` +
                `┃\n` +
                `┃ Você precisa vincular seu\n` +
                `┃ Telegram primeiro!\n` +
                `┃\n` +
                `┃ Use: /importar vincular\n` +
                `┃\n` +
                `┃ ─── Subcomandos ───\n` +
                `┃ vincular - Vincular Telegram\n` +
                `┃ desvincular - Remover vínculo\n` +
                `┃ status - Ver status do vínculo\n` +
                `┃\n` +
                `┃ Responda a uma figurinha com\n` +
                `┃ /importar para enviá-la ao\n` +
                `┃ Telegram vinculado!\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    // Verificar se respondeu a uma mensagem
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMessage = contextInfo?.quotedMessage;

    if (!quotedMessage) {
        // Se não está respondendo a nada, mostrar ajuda 
        if (!sub) {
            await sock.sendMessage(sender, {
                text:
                    `┏━━❪ 📨 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗥 ❫━━\n` +
                    `┃\n` +
                    `┃ ✅ Telegram vinculado!\n` +
                    `┃\n` +
                    `┃ ➢ Responda a uma figurinha\n` +
                    `┃   com /importar para enviá-la\n` +
                    `┃   ao seu Telegram\n` +
                    `┃\n` +
                    `┃ ➢ Envie figurinhas no PV do\n` +
                    `┃   bot no Telegram para recebê-las\n` +
                    `┃   aqui no WhatsApp!\n` +
                    `┃\n` +
                    `┃ ─── Subcomandos ───\n` +
                    `┃ vincular - Vincular Telegram\n` +
                    `┃ desvincular - Remover vínculo\n` +
                    `┃ status - Ver status do vínculo\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return;
        }
    }

    // ─── Exportar figurinha para o Telegram ────────────────

    if (!quotedMessage) {
        await sock.sendMessage(sender, {
            text: '❌ Responda a uma figurinha com /importar para enviá-la ao Telegram.'
        }, { quoted: msg });
        return;
    }

    const quotedType = getContentType(quotedMessage);

    if (quotedType !== 'stickerMessage') {
        // Se respondeu a uma imagem, enviar como sticker
        if (quotedType === 'imageMessage') {
            try {
                await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

                const stream = await downloadContentFromMessage(quotedMessage.imageMessage, 'image');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const imageBuffer = Buffer.concat(chunks);

                const result = await telegramBridge.sendImageAsStickerToTelegram(commandSenderJid, imageBuffer);

                if (result.success) {
                    await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
                    await sock.sendMessage(sender, {
                        text: '✅ Imagem enviada como figurinha para o Telegram!'
                    }, { quoted: msg });
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
                await sock.sendMessage(sender, {
                    text: `❌ Erro ao enviar imagem: ${err.message}`
                }, { quoted: msg });
            }
            return;
        }

        await sock.sendMessage(sender, {
            text: '❌ Responda a uma *figurinha* ou *imagem* para enviar ao Telegram.'
        }, { quoted: msg });
        return;
    }

    // É um sticker! Baixar e enviar
    try {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const stream = await downloadContentFromMessage(quotedMessage.stickerMessage, 'sticker');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const stickerBuffer = Buffer.concat(chunks);

        const result = await telegramBridge.sendStickerToTelegram(commandSenderJid, stickerBuffer);

        if (result.success) {
            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });
            await sock.sendMessage(sender, {
                text: '✅ Figurinha enviada para o Telegram!'
            }, { quoted: msg });
        } else if (result.error === 'not_linked') {
            await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(sender, {
                text: '❌ Seu Telegram não está mais vinculado. Use /importar vincular.'
            }, { quoted: msg });
        } else {
            throw new Error(result.error);
        }

    } catch (err) {
        console.error('[Importar] Erro ao exportar sticker para TG:', err);
        await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
        await sock.sendMessage(sender, {
            text: `❌ Erro ao enviar figurinha: ${err.message}`
        }, { quoted: msg });
    }
}

module.exports = importar;

module.exports.commandData = {
    name: "importar",
    description: "Importar/exportar figurinhas entre WhatsApp e Telegram.",
    category: "midia",
    usage: "/importar [vincular|desvincular|status] — ou responda a uma figurinha com /importar",
    aliases: ["/exportar", "/telegram", "/tg"]
};
