const { handleInteraction } = require('../helpers/interactionHandler');

// ═══════════════════════════════════════════════════════════
//  🎭 /roleplay — Multi-action roleplay command
// ═══════════════════════════════════════════════════════════

const ROLEPLAY_ACTIONS = {
    cafune: {
        search: 'anime headpat gif',
        self: (s) => `💆 ${s} fez cafuné em si mesmo(a). Todo mundo merece carinho!`,
        other: (s, t) => `💆 ${s} fez cafuné em ${t}! Que fofura!`,
    },
    atacar: {
        search: 'anime attack gif',
        self: (s) => `⚔️ ${s} se atacou! Auto-sabotagem nível máximo!`,
        other: (s, t) => `⚔️ ${s} atacou ${t} com tudo! Cuidado!`,
    },
    dancar: {
        search: 'anime dance gif',
        self: (s) => `💃 ${s} está dançando sozinho(a)! Festa de um só!`,
        other: (s, t) => `💃 ${s} chamou ${t} pra dançar! Que show!`,
    },
    tocaaqui: {
        search: 'anime high five gif',
        self: (s) => `🖐️ ${s} deu um toca aqui no ar! ... Que triste.`,
        other: (s, t) => `🖐️ ${s} mandou um toca aqui pra ${t}! ✋`,
    },
    carinho: {
        search: 'anime cuddle gif',
        self: (s) => `🥰 ${s} se abraçou com carinho. Self-love!`,
        other: (s, t) => `🥰 ${s} fez carinho em ${t}! Awww!`,
    },
    morder: {
        search: 'anime bite gif',
        self: (s) => `😬 ${s} se mordeu! Isso não parece saudável...`,
        other: (s, t) => `😈 ${s} mordeu ${t}! Ai!`,
    },
    acariciar: {
        search: 'anime pat gif',
        self: (s) => `😊 ${s} se acariciou. Importantíssimo o auto-cuidado!`,
        other: (s, t) => `😊 ${s} acariciou ${t} delicadamente!`,
    },
    poke: {
        search: 'anime poke gif',
        self: (s) => `👉 ${s} se cutucou. Para que?`,
        other: (s, t) => `👉 ${s} cutucou ${t}! Ei, atenção aqui!`,
    },
    chorar: {
        search: 'anime cry gif',
        self: (s) => `😭 ${s} está chorando! Alguém console!`,
        other: (s, t) => `😭 ${s} está chorando no colo de ${t}!`,
    },
    rir: {
        search: 'anime laugh gif',
        self: (s) => `😂 ${s} está rindo sozinho(a)! Lembrou de algo engraçado.`,
        other: (s, t) => `😂 ${s} está rindo de ${t}! KKKKKKKK`,
    },
};

async function handleRoleplayCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandName } = msgDetails;

    const args = commandText.split(' ').slice(1);
    const action = args[0]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '');

    if (!action || !ROLEPLAY_ACTIONS[action]) {
        const actions = Object.keys(ROLEPLAY_ACTIONS);
        let text = `┏━━❪ 🎭 𝗥𝗢𝗟𝗘𝗣𝗟𝗔𝗬 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › ${prefix}${commandName} <ação> [@user]\n┃\n┣━━❪ 𝗔𝗖𝗢𝗘𝗦 ❫━━\n┃\n`;
        actions.forEach(a => {
            text += `┃ ➢ *${a}*\n`;
        });
        text += `┃\n┃ ➢ 𝗘𝘅 › ${prefix}${commandName} cafune @user\n┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    const rp = ROLEPLAY_ACTIONS[action];

    const captionGenerator = (senderName, targetName, isSelf) => {
        if (isSelf) return rp.self(senderName);
        return rp.other(senderName, targetName);
    };

    await handleInteraction(sock, msg, msgDetails, `roleplay_${action}`, rp.search, captionGenerator);
    return true;
}

module.exports = handleRoleplayCommand;

module.exports.commandData = {
    name: "roleplay",
    description: "Ações de roleplay com GIFs (cafuné, atacar, dançar...)",
    category: "diversao",
    usage: "/roleplay <ação> [@user]",
    aliases: ["/rp", "/acao"]
};
