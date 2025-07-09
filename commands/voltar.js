// commands/euquerovoltarparaaalegria.js
const settingsManager = require('../groupSettingsManager');

async function handleOptInCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, pushName } = msgDetails;

    if (!sender.endsWith('@g.us')) return true; // Só funciona em grupos

    const optedOutUsers = settingsManager.getSetting(sender, 'optedOutUsers', []);

    if (!optedOutUsers.includes(commandSenderJid)) {
        await sock.sendMessage(sender, { text: `${pushName}, você já é uma pessoa divertida e está participando de tudo! ✨` }, { quoted: msg });
        return true;
    }

    // Remove o usuário da lista e salva
    const updatedList = optedOutUsers.filter(jid => jid !== commandSenderJid);
    await settingsManager.setSetting(sender, 'optedOutUsers', updatedList);

    console.log(`[OptIn] Usuário ${pushName} (${commandSenderJid}) voltou a participar das interações no grupo ${sender}`);
    
    const replyText = `🥳 Bem-vindo(a) de volta, ${pushName}! A partir de agora você participará das brincadeiras e poderá usar todos os meus comandos novamente!`;
    await sock.sendMessage(sender, { text: replyText }, { quoted: msg });

    return true;
}

module.exports = handleOptInCommand;
