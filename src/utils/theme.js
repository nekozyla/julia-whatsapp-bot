
const emojis = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: '💠',
    waiting: '⏳',
    arrow: '➢',
    bot: '👻',
    music: '🎵',
    admin: '👑',
    super: '👾',
    fun: '🎉',
    util: '🛠️',
    download: '📥',
    link: '🔗'
};

const separators = {
    line: '━━━━━━━━━━━━━━━━━━━━━━',
    double: '══════════════════════',
    thin: '──────────────────────',
    star: '⋆ ˚ ｡ ⋆ ☁️ ⋆ ˚ ｡ ⋆ ☁️ ⋆ ˚ ｡ ⋆',
    fancy: '⚜️ • ⚜️ • ⚜️ • ⚜️ • ⚜️',
};

function formatTitle(text) {
    return `*⚡ ₲łⱤ₳₮ł₦₳ | ${text.toUpperCase()} ⚡*`;
}

function formatCommand(command, description) {
    return `│ ${emojis.arrow} *${command}* \n│ ╰ ${description}`;
}

function formatError(text) {
    return `${emojis.error} *Eʀʀᴏʀ*\n${separators.thin}\n${text}`;
}

function formatSuccess(text) {
    return `${emojis.success} *Sᴜᴄᴄᴇss*\n${separators.thin}\n${text}`;
}

function formatInfo(title, text) {
    return `${emojis.info} *${title}*\n${separators.thin}\n${text}`;
}

function getDesign() {
    return { emojis, separators };
}

module.exports = {
    emojis,
    separators,
    formatTitle,
    formatCommand,
    formatError,
    formatSuccess,
    formatInfo,
    getDesign
};
