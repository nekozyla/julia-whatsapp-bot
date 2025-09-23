// commands/modosticker.js
const settingsManager = require('../groupSettingsManager');

// Função para verificar se o autor do comando é admin do grupo
async function isAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return !!participant?.admin; // Retorna true se for 'admin' ou 'superadmin'
    } catch (e) {
        console.error("[StickerMode Command] Erro ao verificar status de admin:", e);
        return false;
    }
}

async function handleStickerModeCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup } = msgDetails;

    // Se estiver em um grupo, apenas admins podem usar o comando
    if (isGroup) {
        const isAuthorAdmin = await isAdmin(sock, sender, commandSenderJid);
        if (!isAuthorAdmin) {
            await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
            return;
        }
    }

    const argument = (msgDetails.commandText || '').split(' ')[1]?.toLowerCase();
    const chatType = isGroup ? "grupo" : "chat";

    if (argument === 'on') {
        await settingsManager.setSetting(sender, 'stickerMode', 'on');
        const responseText = isGroup 
            ? "✅ *Modo Sticker ATIVADO*.\n\n*Aviso:* Qualquer imagem ou GIF enviada neste grupo por *qualquer membro* será convertida em figurinha automaticamente."
            : "✅ *Modo Sticker ATIVADO*.\n\nQualquer imagem ou GIF que você me enviar neste chat será convertida em figurinha automaticamente.";
        await sock.sendMessage(sender, { text: responseText }, { quoted: msg });

    } else if (argument === 'off') {
        await settingsManager.setSetting(sender, 'stickerMode', 'off');
        await sock.sendMessage(sender, { text: `✅ *Modo Sticker DESATIVADO* neste ${chatType}.` }, { quoted: msg });

    } else {
        const currentMode = settingsManager.getSetting(sender, 'stickerMode', 'off');
        await sock.sendMessage(sender, { text: `Uso incorreto. Use \`/modosticker on\` ou \`/modosticker off\`.\n\n*Status atual neste ${chatType}:* ${currentMode.toUpperCase()}` }, { quoted: msg });
    }
}

module.exports = handleStickerModeCommand;
