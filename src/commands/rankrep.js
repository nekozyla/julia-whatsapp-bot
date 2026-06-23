const profileManager = require('../managers/profileManager');
const contactManager = require('../managers/contactManager');

async function rankRep(sock, msg, msgDetails) {
    const { sender } = msgDetails;

    try {
        const topRep = profileManager.getTopReputation(10);

        if (topRep.length === 0) {
            await sock.sendMessage(sender, { text: '📉 Ainda não há ninguém com reputação registrada.' }, { quoted: msg });
            return;
        }

        let text = `🏆 *Ranking Global de Reputação* 🏆\n\n`;

        for (let i = 0; i < topRep.length; i++) {
            const user = topRep[i];
            const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}º`));

            let name = contactManager.getNickname(user.id);
            if (!name) name = user.id.split('@')[0];

            text += `${medal} *${name}* - ${user.reputation} Rep\n`;
        }

        text += `\n✨ Use \`/rep @usuario\` para dar moral a alguém!`;

        await sock.sendMessage(sender, { text: text }, { quoted: msg });
    } catch (e) {
        console.error('[RANKREP] Error:', e);
        await sock.sendMessage(sender, { text: `❌ Erro ao buscar ranking de reputação.` }, { quoted: msg });
    }
}

module.exports = rankRep;

module.exports.commandData = {
    name: "rankrep",
    description: "Mostra o ranking global de reputação.",
    category: "diversao",
    usage: "/rankrep",
    aliases: ["/reps", "/toprep", "/moralranking"]
};
