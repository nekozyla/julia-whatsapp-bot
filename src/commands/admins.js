const groupMetadataManager = require('../managers/groupMetadataManager.js');
const { sendGiratinaError } = require('../utils/utils.js');

async function handleAdminsCommand(sock, msg, msgDetails) {
    const { sender, commandText, command } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        return sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
    }

    try {
        const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, sender);
        const participants = groupMetadata.participants;

        
        const admins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');

        if (admins.length === 0) {
            return sock.sendMessage(sender, { text: "Não encontrei administradores neste grupo." }, { quoted: msg });
        }

        const mentions = admins.map(p => p.id);

        
        let messageText = commandText.substring(command.length).trim();
        if (!messageText) {
            messageText = "📢 *Chamando a Administração!*";
        }

        const tagsText = mentions.map(jid => `@${jid.split('@')[0]}`).join(' ');
        const finalText = `${messageText}\n\n${tagsText}`;

        await sock.sendMessage(sender, {
            text: finalText,
            mentions: mentions
        }, { quoted: msg });

    } catch (error) {
        await sendGiratinaError(sock, sender, msg, error);
    }
}

module.exports = handleAdminsCommand;


module.exports.commandData = {
    name: "admins",
    description: "Marca admins.",
    category: "admin",
    usage: "/admins",
    aliases: ["/admin","/admins","/adm","/adms"]
};
