const profileManager = require('../managers/profileManager');

async function rep(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args, prefix, commandName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let targetJid = mentionedJids[0];

    if (!targetJid) {
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;
        if (quotedMsg && quotedMsg.participant) {
            targetJid = quotedMsg.participant;
        }
    }

    if (!targetJid) {
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗥𝗘𝗣 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › Mencione ou responda alguém\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} @usuario\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
        return;
    }

    try {
        const result = await profileManager.giveRep(commandSenderJid, targetJid);

        if (result.success) {
            await sock.sendMessage(sender, { text: `┏━━❪ 𝗥𝗘𝗣 ❫━━\n┃\n┃ ➢ 𝗦𝗧𝗔𝗧𝗨𝗦 › +1 Reputação\n┃ ➢ 𝗨𝘀𝗲𝗿 › @${targetJid.split('@')[0]}\n┃ ➢ 𝗧𝗼𝘁𝗮𝗹 › ${result.newRep} Rep\n┃\n┗━━━━━━━━━━━━━━`, mentions: [targetJid] }, { quoted: msg });
        } else {
            if (result.reason === 'self_rep') {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Não pode dar rep a si mesmo\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            } else if (result.reason === 'cooldown') {
                await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Cooldown ativo\n┃ ➢ 𝗧𝗲𝗺𝗽𝗼 › ${result.time}\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
            }
        }
    } catch (e) {
        console.error('[REP] Error giving rep:', e);
        await sock.sendMessage(sender, { text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Falha ao dar reputação\n┃\n┗━━━━━━━━━━━━━━` }, { quoted: msg });
    }
}

module.exports = rep;


module.exports.commandData = {
    name: "rep",
    description: "Dá reputação a alguém.",
    category: "diversao",
    usage: "/rep @usuario",
    aliases: ["/rep", "/reputacao", "/moral"]
};
