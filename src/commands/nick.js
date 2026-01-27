const contactManager = require('../managers/contactManager');

async function nick(sock, msg, msgDetails) {
    const { commandSenderJid, sender, commandText } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const nickname = args.join(' ').trim();

    if (!nickname) {
        await sock.sendMessage(sender, {
            text: '⚠️ Uso correto: /nick [seu apelido]'
        }, { quoted: msg });
        return;
    }

    if (nickname.length > 20) {
        await sock.sendMessage(sender, {
            text: '⚠️ O apelido deve ter no máximo 20 caracteres.'
        }, { quoted: msg });
        return;
    }

    
    const isValid = /^[a-zA-Z0-9]+$/.test(nickname);
    if (!isValid) {
        await sock.sendMessage(sender, {
            text: '⚠️ O apelido não pode conter espaços ou caracteres especiais (apenas letras e números).'
        }, { quoted: msg });
        return;
    }

    contactManager.updateContact(commandSenderJid, { notify: nickname });

    await sock.sendMessage(sender, {
        text: `✅ Apelido definido como: *${nickname}*\nAgora você pode usar os comandos de economia!`
    }, { quoted: msg });
}

module.exports = nick;


module.exports.commandData = {
    name: "nick",
    description: "Define seu apelido.",
    category: "util",
    usage: "/nick",
    aliases: []
};
