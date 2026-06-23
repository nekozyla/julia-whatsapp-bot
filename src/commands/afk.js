const afkManager = require('../managers/afkManager');
const contactManager = require('../managers/contactManager');

async function handleAfkCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();

    // /afk desligar
    if (subCommand === 'desligar' || subCommand === 'off' || subCommand === 'voltar' || subCommand === 'voltei') {
        const was = afkManager.removeAfk(commandSenderJid);
        if (was) {
            const duration = afkManager.getTimeSince(was.timestamp);
            await sock.sendMessage(sender, {
                text: `┏━━❪ 💤 𝗔𝗙𝗞 ❫━━\n┃\n┃ ➢ Bem-vindo(a) de volta!\n┃ ➢ 𝗧𝗲𝗺𝗽𝗼 𝗳𝗼𝗿𝗮 › *${duration}*\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚠️ 𝗔𝗙𝗞 ❫━━\n┃\n┃ ➢ Você não está em modo AFK!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
        }
        return true;
    }

    // /afk [motivo] — ativa o modo AFK
    const reason = args.join(' ').trim();

    if (afkManager.isAfk(commandSenderJid)) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ 💤 𝗔𝗙𝗞 ❫━━\n┃\n┃ ➢ Você já está em modo AFK!\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use ${prefix}afk voltei para sair\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    afkManager.setAfk(commandSenderJid, reason);

    const reasonText = reason ? `\n┃ ➢ 𝗠𝗼𝘁𝗶𝘃𝗼 › _"${reason}"_` : '';

    await sock.sendMessage(sender, {
        text: `┏━━❪ 💤 𝗔𝗙𝗞 ❫━━\n┃\n┃ ➢ Modo AFK ativado!${reasonText}\n┃ ➢ Avisarei quem te marcar.\n┃\n┃ ➢ 𝗗𝗶𝗰𝗮 › ${prefix}afk voltei para desativar\n┃\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });

    return true;
}

module.exports = handleAfkCommand;

module.exports.commandData = {
    name: "afk",
    description: "Ativa modo AFK (Longe do Teclado).",
    category: "util",
    usage: "/afk [motivo]",
    aliases: ["/ausente", "/brb"]
};
