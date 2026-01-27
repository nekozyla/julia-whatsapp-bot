const profileManager = require('../managers/profileManager');
const contactManager = require('../managers/contactManager');
const authManager = require('../managers/authManager');

async function doacao(sock, msg, msgDetails) {
    const { sender, commandSenderJid, isGroup, args, prefix, commandName, pushName } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    const subCmd = args.length > 0 ? args[0].toLowerCase() : 'help';

    
    if (subCmd === 'add') {
        if (!authManager.isSuperAdmin(commandSenderJid)) {
            await sock.sendMessage(sender, { text: '❌ Apenas Super Admins podem adicionar doações.' }, { quoted: msg });
            return;
        }

        const targetUser = mentionedJids[0];
        const amountStr = args[2]; 

        if (!targetUser || !amountStr || isNaN(parseFloat(amountStr))) {
            await sock.sendMessage(sender, { text: `⚠️ Uso correto: ${prefix}${commandName} add @usuario [valor]` }, { quoted: msg });
            return;
        }

        const amount = parseFloat(amountStr);
        const newTotal = await profileManager.addDonation(targetUser, amount);

        await sock.sendMessage(sender, { text: `✅ Doação registrada!\n\n👤 Usuário: @${targetUser.split('@')[0]}\n💰 Valor: +R$ ${amount.toFixed(0)}\n💎 Total Acumulado: R$ ${newTotal.toFixed(0)}` }, { quoted: msg });
        return;
    }

    
    if (subCmd === 'rank' || subCmd === 'top') {
        const topDonors = profileManager.getTopDonors(10);

        if (topDonors.length === 0) {
            await sock.sendMessage(sender, { text: '📉 Ainda não há doadores registrados.' }, { quoted: msg });
            return;
        }

        let text = `🏆 *Top Doadores do Bot* 🏆\n\n`;

        for (let i = 0; i < topDonors.length; i++) {
            const donor = topDonors[i];
            const medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `${i + 1}º`));

            
            let name = contactManager.getNickname(donor.id);
            if (!name) name = donor.id.split('@')[0];

            text += `${medal} *${name}* - R$ ${donor.amount.toFixed(0)}\n`;
        }

        text += `\n💖 Obrigado a todos que apoiam o projeto!`;

        await sock.sendMessage(sender, { text: text }, { quoted: msg });
        return;
    }

    
    let helpText = `💰 *Sistema de Doações*\n\n`;
    helpText += `• ${prefix}${commandName} rank - *Ver ranking de doadores*\n`;
    if (authManager.isSuperAdmin(commandSenderJid)) {
        helpText += `• ${prefix}${commandName} add @user [valor] - *Adicionar doação*\n`;
    }

    await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
}

module.exports = doacao;


module.exports.commandData = {
    name: "doacao",
    description: "Sem descrição disponível.",
    category: "util",
    usage: "/doacao",
    aliases: []
};
