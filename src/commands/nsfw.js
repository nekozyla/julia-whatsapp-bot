const settingsManager = require('../managers/groupSettingsManager.js');
const { getGroupMetadata } = require('../managers/groupMetadataManager.js');

async function nsfw(sock, msg, msgDetails) {
    const { sender, isGroup, args, isSuperAdmin, commandSenderJid } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: '❌ Este comando só pode ser usado em grupos.' }, { quoted: msg });
        return;
    }

    // Check Admin Permissions
    let isGroupAdmin = false;
    try {
        const groupMetadata = await getGroupMetadata(sock, sender);
        const participant = groupMetadata.participants.find(p => p.id === commandSenderJid);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
            isGroupAdmin = true;
        }
    } catch (e) {
        console.error('Erro ao verificar admin:', e);
    }

    if (!isSuperAdmin && !isGroupAdmin) {
        await sock.sendMessage(sender, { text: '❌ Apenas administradores podem alterar essa configuração.' }, { quoted: msg });
        return;
    }

    if (args.length === 0) {
        const currentMode = settingsManager.getSetting(sender, 'nsfwMode', 'off');
        await sock.sendMessage(sender, { text: `🔞 *Modo +18 (NSFW)*\n\nStatus atual: *${currentMode === 'on' ? 'ATIVADO ✅' : 'DESATIVADO ❌'}*\n\nUse: */nsfw on* ou */nsfw off*` }, { quoted: msg });
        return;
    }

    const mode = args[0].toLowerCase();

    if (mode === 'on' || mode === 'ligar' || mode === 'ativar') {
        await settingsManager.setSetting(sender, 'nsfwMode', 'on');
        await sock.sendMessage(sender, { text: '🔞 *Modo +18 ATIVADO* ✅\n\nComandos adultos agora estão permitidos neste grupo. Use com responsabilidade!' }, { quoted: msg });
    } else if (mode === 'off' || mode === 'desligar' || mode === 'desativar') {
        await settingsManager.setSetting(sender, 'nsfwMode', 'off');
        await sock.sendMessage(sender, { text: '🔞 *Modo +18 DESATIVADO* ❌\n\nComandos adultos foram bloqueados.' }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { text: '❌ Opção inválida. Use *on* ou *off*.' }, { quoted: msg });
    }
}

module.exports = nsfw;

module.exports.commandData = {
    name: "nsfw",
    description: "Ativa ou desativa comandos +18 no grupo.",
    category: "admin",
    usage: "/nsfw on|off",
    aliases: ["/mais18", "/adulto"],
    isNSFW: false // This command itself is safe
};
