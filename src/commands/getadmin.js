
const groupMetadataManager = require('../managers/groupMetadataManager.js');

async function handleAdminCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, botJid, isSuperAdmin, isGroup } = msgDetails;

    if (!isSuperAdmin) return;

    if (!isGroup) {
        await sock.sendMessage(chatJid, { text: '⚠️ Esse comando só funciona em grupos.' }, { quoted: msg });
        return;
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, chatJid);
        const botParticipant = groupMetadata.participants.find(p => p.id === botJid);

        if (!botParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: '❌ Eu não sou admin neste grupo, então não posso te promover.' }, { quoted: msg });
            return;
        }

        const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);

        if (senderParticipant?.admin) {
            await sock.sendMessage(chatJid, { text: '⚠️ Você já é admin deste grupo.' }, { quoted: msg });
            return;
        }

        await sock.groupParticipantsUpdate(chatJid, [commandSenderJid], 'promote');
        await sock.sendMessage(chatJid, {
            text: `✅ @${commandSenderJid.split('@')[0]} foi promovido a admin!`,
            mentions: [commandSenderJid]
        }, { quoted: msg });

    } catch (error) {
        console.error('[Admin] Erro:', error);
        await sock.sendMessage(chatJid, { text: '❌ Erro ao tentar promover.' }, { quoted: msg });
    }
}

module.exports = handleAdminCommand;

module.exports.commandData = {
    name: "getadmin",
    description: "Super admin se promove a admin do grupo.",
    category: "super",
    usage: "/getadmin",
    aliases: ["/meadmin"]
};
