const fightManager = require('../managers/fightManager');
const contactManager = require('../managers/contactManager');

async function lutar(sock, msg, msgDetails) {
    const { commandSenderJid, sender, commandText, isGroup, chatId } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: '❌ O Clube da Luta só funciona em grupos!' }, { quoted: msg });
        return;
    }



    const nick = contactManager.getNickname(commandSenderJid);
    if (!nick) {
        await sock.sendMessage(sender, { text: '⚠️ Defina seu nick primeiro com /nick' }, { quoted: msg });
        return;
    }

    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = mentionedJids[0];

    if (!targetJid) {
        await sock.sendMessage(sender, { text: '⚠️ Mencione o oponente!\nEx: */lutar @usuario*' }, { quoted: msg });
        return;
    }

    if (targetJid === commandSenderJid) {
        await sock.sendMessage(sender, { text: '⚠️ Você não pode lutar contra si mesmo (procure terapia).' }, { quoted: msg });
        return;
    }

    const result = fightManager.createMatch(chatId, commandSenderJid, targetJid);

    if (result.success) {
        const p1Name = contactManager.getNickname(commandSenderJid);
        const p2Name = contactManager.getNickname(targetJid) || `@${targetJid.split('@')[0]}`; 

        await sock.sendMessage(sender, {
            text: `🥊 *DESAFIO NO RINGUE!* 🥊\n\n🤜 ${p1Name} desafiou 🤛 ${p2Name}!\n\n${p2Name}, digite */aceitarluta* para aceitar!\n_O desafio expira em 60 segundos._`,
            mentions: [commandSenderJid, targetJid]
        });
    } else {
        await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
    }
}

module.exports = lutar;


module.exports.commandData = {
    name: "lutar",
    description: "Desafia para PvP.",
    category: "diversao",
    usage: "/lutar",
    aliases: []
};
