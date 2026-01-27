const fightManager = require('../managers/fightManager');
const contactManager = require('../managers/contactManager');

async function aceitarluta(sock, msg, msgDetails) {
    const { commandSenderJid, sender, isGroup, chatId } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: '❌ O Clube da Luta só funciona em grupos!' }, { quoted: msg });
        return;
    }

    
    const result = fightManager.acceptMatch(chatId, commandSenderJid);

    if (result.success) {
        
        const p1Name = contactManager.getNickname(result.p1) || result.p1.split('@')[0];
        const p2Name = contactManager.getNickname(result.p2) || result.p2.split('@')[0];

        await sock.sendMessage(sender, {
            text: `🔔 *LUTA ACEITA!* 🔔\n\n${p1Name} vs ${p2Name}\n\nA briga vai começar em instantes... 🩸`
        });

        
        setTimeout(async () => {
            const fightResult = fightManager.simulateFight(chatId);
            if (fightResult) {
                const logText = fightResult.logs.join('\n');
                await sock.sendMessage(sender, {
                    text: `🥊 *RESULTADO DA LUTA* 🥊\n\n${logText}`
                });
            }
        }, 3000);

    } else {
        await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
    }
}

module.exports = aceitarluta;


module.exports.commandData = {
    name: "aceitarluta",
    description: "Aceita desafio PvP.",
    category: "diversao",
    usage: "/aceitarluta",
    aliases: []
};
