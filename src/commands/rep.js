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
        await sock.sendMessage(sender, { text: `❌ Mencione alguém ou responda uma mensagem para dar reputação.\nEx: ${prefix}${commandName} @usuario` }, { quoted: msg });
        return;
    }

    try {
        const result = await profileManager.giveRep(commandSenderJid, targetJid);

        if (result.success) {
            await sock.sendMessage(sender, { text: `✅ Você deu +1 de reputação para @${targetJid.split('@')[0]}!\nAgora ele(a) tem *${result.newRep}* de Rep.` }, { quoted: msg });
        } else {
            if (result.reason === 'self_rep') {
                await sock.sendMessage(sender, { text: `❌ Você não pode dar reputação para si mesmo.` }, { quoted: msg });
            } else if (result.reason === 'cooldown') {
                await sock.sendMessage(sender, { text: `⏳ Você já deu reputação hoje! Tente novamente em *${result.time}*.` }, { quoted: msg });
            }
        }
    } catch (e) {
        console.error('[REP] Error giving rep:', e);
        await sock.sendMessage(sender, { text: `❌ Erro ao dar reputação.` }, { quoted: msg });
    }
}

module.exports = rep;


module.exports.commandData = {
    name: "rep",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/rep",
    aliases: ["/rep", "/reputacao", "/moral"]
};
