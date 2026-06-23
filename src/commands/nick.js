const contactManager = require('../managers/contactManager');

async function nick(sock, msg, msgDetails) {
    const { commandSenderJid, sender, commandText, prefix, commandName } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const nickname = args.join(' ').trim();

    if (!nickname) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗡𝗜𝗖𝗞 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} [apelido]\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} Neko\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    if (nickname.length > 20) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Máximo de 20 caracteres\n┃ ➢ 𝗔𝘁𝘂𝗮𝗹 › ${nickname.length} caracteres\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    const isValid = /^[a-zA-Z0-9]+$/.test(nickname);
    if (!isValid) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas letras e números\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    if (contactManager.checkNicknameExists(nickname)) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apelido já em uso\n┃ ➢ 𝗗𝗶𝗰𝗮 › Escolha outro nome\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return;
    }

    contactManager.updateContact(commandSenderJid, { notify: nickname });

    await sock.sendMessage(sender, {
        text: `┏━━❪ 𝗢𝗞 ❫━━\n┃\n┃ ➢ 𝗡𝗶𝗰𝗸 › *${nickname}*\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › Definido com sucesso\n┃\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });
}

module.exports = nick;


module.exports.commandData = {
    name: "nick",
    description: "Define seu apelido.",
    category: "util",
    usage: "/nick [apelido]",
    aliases: []
};
