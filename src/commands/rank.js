
const settingsManager = require('../managers/groupSettingsManager');
const rankManager = require('../managers/rankManager');
const contactManager = require('../managers/contactManager');

async function handleRankCommand(sock, msg, msgDetails) {
    const { sender: chatJid, commandText, commandSenderJid, isSuperAdmin } = msgDetails;

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só pode ser usado em grupos." });
        return;
    }

    const groupMeta = await sock.groupMetadata(chatJid);
    const participants = groupMeta.participants.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
    }, {});

    const args = commandText.split(' ');
    const subCommand = args[1]?.toLowerCase();
    const isFullMode = args.includes('--full');

    const isAdmin = !!participants[commandSenderJid]?.admin;

    if (subCommand === 'on' || subCommand === 'off') {
        if (!isAdmin) {
            await sock.sendMessage(chatJid, { text: "Apenas administradores do grupo podem ativar ou desativar o ranking." });
            return;
        }
        const newStatus = subCommand === 'on' ? 'on' : 'off';
        await settingsManager.setSetting(chatJid, 'rankingMode', newStatus);

        if (newStatus === 'on') {
            await rankManager.initGroup(chatJid);
        }

        await sock.sendMessage(chatJid, { text: `✅ O ranking de mensagens foi *${subCommand.toUpperCase()}* neste grupo.` });
        return;
    }

    if (isFullMode && !isSuperAdmin) {
        await sock.sendMessage(chatJid, { text: "🚫 Apenas Super Admins podem ver o ranking completo." });
        return;
    }


    const topUsers = rankManager.getTopUsers(chatJid, isFullMode ? 1000 : 10);


    if (topUsers.length === 0) {

        const isEnabled = settingsManager.getSetting(chatJid, 'rankingMode', 'off') === 'on';
        if (!isEnabled) {
            await sock.sendMessage(chatJid, { text: "O ranking está desativado neste grupo. Um admin precisa ativar com `/rank on`." });
            return;
        }
        await sock.sendMessage(chatJid, { text: "Ainda não há dados de ranking para este grupo. Comecem a conversar!" });
        return;
    }

    let rankText = isFullMode ? `*🏆 Ranking Completo do Grupo 🏆*\n\n` : `*🏆 Ranking dos Mais Faladores do Grupo 🏆*\n\n`;
    const mentions = [];

    // Filtra quem saiu do grupo
    const activeUsers = topUsers.filter(user => participants[user.jid]);

    activeUsers.forEach((user, index) => {
        const jid = user.jid;
        const count = user.count;

        // Tenta pegar o nick personalizado primeiro
        const nickname = contactManager.getNickname(jid);

        let displayName;
        if (nickname) {
            // Se tem nick, usa o nick
            displayName = nickname;
        } else {
            // Se não tem nick, marca o usuário
            displayName = `@${jid.split('@')[0]}`;
            mentions.push(jid);
        }

        const medal = ['🥇', '🥈', '🥉'][index] || `*${index + 1}.*`;
        rankText += `${medal} ${displayName} - *${count}* mensagens\n`;
    });

    await sock.sendMessage(chatJid, { text: rankText.trim(), mentions });
}


module.exports = handleRankCommand;



module.exports.commandData = {
    name: "rank",
    description: "Sem descrição disponível.",
    category: "util",
    usage: "/rank",
    aliases: ["/atividade", "/stats", "/xp"]
};
