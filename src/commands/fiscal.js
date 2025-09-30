// commands/fiscalizar.js
const settingsManager = require('../managers/groupSettingsManager.js'); // <-- CAMINHO CORRIGIDO
const fs = require('fs');
const path = require('path');
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { sendJuliaError } = require('../utils/utils.js'); // <-- CAMINHO CORRIGIDO

const fiscalStickerPath = path.join(__dirname, '..', 'assets', 'fiscal.webp');

/**
 * Envia o sticker de fiscalização para o chat.
 * @param {object} sock - A instância do socket Baileys.
 * @param {string} jid - O JID do chat de destino.
 */
async function sendFiscalSticker(sock, jid) {
    if (!fs.existsSync(fiscalStickerPath)) {
        console.error("[Fiscalizar] O ficheiro do sticker 'assets/fiscal.webp' não foi encontrado.");
        // Envia um aviso para o admin se o ficheiro não existir
        if (config.ADMIN_JID) {
            await sock.sendMessage(config.ADMIN_JID, { text: `Aviso: A função de fiscalização tentou ser usada no grupo ${jid}, mas o ficheiro 'assets/fiscal.webp' não existe.` });
        }
        return false;
    }
    const stickerBuffer = await fs.promises.readFile(fiscalStickerPath);
    const sticker = new Sticker(stickerBuffer, {
        pack: 'Fiscalização',
        author: 'Julia Bot',
        type: StickerTypes.DEFAULT,
	quality: 75,
    });
    await sock.sendMessage(jid, await sticker.toMessage());
    return true;
}


async function handleFiscalizarCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup, isSuperAdmin, pushName } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return true;
    }

    try {
        const groupMetadata = await sock.groupMetadata(sender);
        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        if (!senderParticipant?.admin && !isSuperAdmin) {
            await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return true;
        }

        const argument = (commandText || '').split(' ')[1]?.toLowerCase();

        if (argument === 'on') {
            await settingsManager.setSetting(sender, 'fiscalMode', 'on');
            await sock.sendMessage(sender, { text: "✅ *Modo Fiscalização ATIVADO!* 👀\nVou ficar de olho neste grupo e mandar uma figurinha de vez em quando." });
        } else if (argument === 'off') {
            await settingsManager.setSetting(sender, 'fiscalMode', 'off');
            await sock.sendMessage(sender, { text: "✅ *Modo Fiscalização DESATIVADO*. Deixei de fiscalizar." });
        } else if (argument === 'teste') {
            console.log(`[Fiscalizar] ${pushName} está a testar o sticker no grupo ${sender}.`);
            await sock.sendMessage(sender, { react: { text: '👍', key: msg.key } });
            await sendFiscalSticker(sock, sender);
        } else {
            const currentMode = settingsManager.getSetting(sender, 'fiscalMode', 'off');
            await sock.sendMessage(sender, { text: `Uso incorreto. Use \`!fiscalizar on\`, \`!fiscalizar off\` ou \`!fiscalizar teste\`.\n\n*Status atual:* ${currentMode.toUpperCase()}` }, { quoted: msg });
        }

    } catch (error) {
        console.error("[Fiscalizar] Erro no comando:", error);
        await sendJuliaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleFiscalizarCommand;

