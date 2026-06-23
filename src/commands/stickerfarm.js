/**
 * /farm — Comando integrado de gerenciamento de Sticker Farm.
 * Permite ligar/desligar (Apenas Admin) e gerar pack a partir 
 * dos últimos 10 stickers criados em tempo real na farm.
 */

const authManager = require('../managers/authManager.js');
const stickerFarmManager = require('../managers/stickerFarmManager.js');
const userPresetManager = require('../managers/userPresetManager.js');
const { buildStickerPackZip, encryptAndUploadPack, sendStickerPack } = require('../helpers/stickerPackHelper.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

async function handleStickerFarmCommand(sock, msg, msgDetails) {
    const { sender, commandText, authorJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: 'Este comando só funciona em grupos.' }, { quoted: msg });
        return;
    }

    const args = msgDetails.args || [];
    const action = args[0] ? args[0].toLowerCase() : 'status';

    const commandSenderJid = msg.key?.participant || msg.key?.remoteJid || msgDetails.authorJid;
    const isSuperAdmin = authManager.isSuperAdmin(commandSenderJid);

    // /farm on | /farm off
    if (action === 'on' || action === 'off') {
        if (!isSuperAdmin) {
            await sock.sendMessage(sender, { text: 'Apenas Super Administradores podem ligar ou desligar a Sticker Farm.' }, { quoted: msg });
            return;
        }

        const turnOn = action === 'on';
        const isCurrentlyEnabled = stickerFarmManager.isFarmEnabled(sender);

        if (turnOn && isCurrentlyEnabled) {
            await sock.sendMessage(sender, { text: '🚜 A Sticker Farm já está *LIGADA* neste grupo.' }, { quoted: msg });
            return;
        }
        if (!turnOn && !isCurrentlyEnabled) {
            await sock.sendMessage(sender, { text: '🚜 A Sticker Farm já está *DESLIGADA* neste grupo.' }, { quoted: msg });
            return;
        }

        const newState = stickerFarmManager.toggleFarm(sender);
        if (newState) {
            await sock.sendMessage(sender, { text: '🚜 *Sticker Farm ATIVADA!* As próximas figurinhas criadas aqui (até 10) serão rastreadas. Use `/farm pack` para juntá-las num pacote.' }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: '🚜 *Sticker Farm DESATIVADA!* A memória de figurinhas deste grupo foi apagada.' }, { quoted: msg });
        }
        return;
    }

    // /farm status
    if (action === 'status') {
        const status = stickerFarmManager.getStatus(sender);
        let txt = `🚜 *Sticker Farm* 🚜\n\n`;
        txt += `*Status:* ${status.enabled ? '🟢 LIGADO' : '🔴 DESLIGADO'}\n`;
        txt += `*Colheita:* ${status.count} figurinhas de ${status.users} membros (${status.limit} por pessoa)\n\n`;
        if (status.enabled) {
            txt += `Para empacotar a colheita, digite: \`/farm pack\``;
        } else {
            txt += `Para ligar (Apenas S.A.), digite: \`/farm on\``;
        }

        await sock.sendMessage(sender, { text: txt }, { quoted: msg });
        return;
    }

    // /farm pack
    if (action === 'pack' || action === 'gerar') {
        if (!stickerFarmManager.isFarmEnabled(sender)) {
            await sock.sendMessage(sender, { text: 'A Sticker Farm está desligada neste grupo.' }, { quoted: msg });
            return;
        }

        const buffers = stickerFarmManager.getStickers(sender);
        
        if (buffers.length < 2) {
            await sock.sendMessage(sender, { text: `Não há figurinhas suficientes na colheita ainda (${buffers.length}/2 mínimas).\nCrie mais figurinhas (sem --pv) para formar um pacote.` }, { quoted: msg });
            return;
        }

        try {
            await sock.sendMessage(sender, { react: { text: '📦', key: msg.key } });
            await sock.sendMessage(sender, { text: `🚜 *Empacotando Colheita!*\nEstou gerando um sticker pack com as ${buffers.length} figurinhas recentes do grupo...` }, { quoted: msg });

            const sharp = require('sharp');
            const crypto = require('crypto');

            // Redimensionar tray icon para 96x96 PNG (igual ao handleStickerPackCommand)
            const trayIconBuf = await sharp(buffers[0])
                .resize(96, 96, { fit: 'cover' })
                .png()
                .toBuffer();

            // Pack Info - usa preset do autor se disponível
            const commandSenderJid = msg.key?.participant || msg.key?.remoteJid || authorJid;
            const stickerPreset = userPresetManager.getPreset(sender, commandSenderJid);
            const packId = crypto.randomBytes(16).toString('hex');
            const packName = stickerPreset?.pack || `Farm de ${BOT_NAME}`;
            const publisher = stickerPreset?.author || BOT_NAME;

            // 1) Criar o ZIP (auto-detecta animated)
            const zipResult = await buildStickerPackZip(packId, packName, publisher, buffers, trayIconBuf);

            // 2) Upload e criptografia HKDF
            const payload = await encryptAndUploadPack(sock, zipResult.zipBuffer);

            // 3) Enviar
            await sendStickerPack(sock, sender, payload, {
                packId,
                packName,
                publisher,
                stickersMeta: zipResult.stickersMeta,
                trayHash: crypto.createHash('sha256').update(trayIconBuf).digest('base64')
            });

            await sock.sendMessage(sender, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[StickerFarm] Erro ao empacotar:', error);
            await sock.sendMessage(sender, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(sender, { text: `❌ Erro ao empacotar a farm: ${error.message}` }, { quoted: msg });
        }
        return;
    }

    // Default: mostrar ajuda
    const limit = stickerFarmManager.MAX_STICKERS || 10;
    await sock.sendMessage(sender, { 
        text: `🚜 *Comandos da Sticker Farm:*\n\n` + 
              `• \`/farm status\` - Mostra se está ativa e a qtde.\n` +
              `• \`/farm pack\` - Cria um Sticker Pack das últimas <=${limit} figurinhas geradas no grupo.\n` +
              `• \`/farm on/off\` - Liga ou desliga (Somente SA).`
    }, { quoted: msg });
}

handleStickerFarmCommand.commandData = {
    name: "farm",
    description: "Gerencia a fazenda de figurinhas do grupo (rastreia até 10 figurinhas criadas).",
    category: "midia",
    usage: "/farm [status|on|off|pack]",
    aliases: ["/farm", "/packfarm", "/stickerfarm", "/colheita"]
};

module.exports = handleStickerFarmCommand;
