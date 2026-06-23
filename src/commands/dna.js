async function dna(sock, msg, msgDetails) {
    const { sender: chatJid, commandSenderJid, prefix, commandName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let parent, child;

    if (mentionedJids.length === 0) {
        return sock.sendMessage(chatJid, {
            text: `┏━━❪ 🧬 𝗗𝗡𝗔 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › Mencione alguém\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} @user\n┃ ➢ 𝗘𝘅𝟮 › ${prefix}${commandName} @pai @filho\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
    } else if (mentionedJids.length === 1) {
        parent = commandSenderJid;
        child = mentionedJids[0];
    } else {
        parent = mentionedJids[0];
        child = mentionedJids[1];
    }

    const botJid = msgDetails.botJid || sock.user?.id?.replace(/:.*@/, '@') || '';

    const parentClean = parent.replace(/:.*@/, '@');
    const childClean = child.replace(/:.*@/, '@');
    const botClean = botJid.replace(/:.*@/, '@');

    let percentage = Math.floor(Math.random() * 101);
    let extraMessage = "";

    if (parentClean === botClean || childClean === botClean) {
        if (msgDetails.isSuperAdmin) {
            percentage = 100;
            extraMessage = `\n┃ ➢ 𝗡𝗼𝘁𝗮 › Claro que é 100%! Minha criadora ❤️`;
        } else {
            percentage = 0;
            extraMessage = `\n┃ ➢ 𝗡𝗼𝘁𝗮 › Meu DNA é feito de 0s e 1s`;
        }
    }

    const text = `┏━━❪ 🧬 𝗗𝗡𝗔 ❫━━\n┃\n┃ ➢ 𝗣𝗮𝗶/𝗠𝗮𝗲 › @${parent.split('@')[0]}\n┃ ➢ 𝗙𝗶𝗹𝗵𝗼(𝗮) › @${child.split('@')[0]}\n┃\n┣━━❪ 𝗥𝗘𝗦𝗨𝗟𝗧 ❫━━\n┃\n┃ ➢ 𝗖𝗵𝗮𝗻𝗰𝗲 › *${percentage}%*${extraMessage}\n┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(chatJid, { text, mentions: [parent, child] }, { quoted: msg });
}

module.exports = dna;


module.exports.commandData = {
    name: "dna",
    description: "Teste de paternidade.",
    category: "diversao",
    usage: "/dna @usuario",
    aliases: []
};
