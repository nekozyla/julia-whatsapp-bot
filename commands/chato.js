// commands/eusouchatoenaoqueroparticipardadiversao.js
const settingsManager = require('../groupSettingsManager');

async function handleOptOutCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, pushName } = msgDetails;

    if (!sender.endsWith('@g.us')) {
        await sock.sendMessage(sender, { text: "Este comando só tem efeito dentro de grupos." }, { quoted: msg });
        return true;
    }

    // Pega a lista atual de usuários que saíram ou cria uma nova
    const optedOutUsers = settingsManager.getSetting(sender, 'optedOutUsers', []);

    if (optedOutUsers.includes(commandSenderJid)) {
        await sock.sendMessage(sender, { text: `Calma, ${pushName}. Você já está no modo antissocial. Ninguém vai te perturbar.` }, { quoted: msg });
        return true;
    }

    // Adiciona o usuário à lista e salva
    optedOutUsers.push(commandSenderJid);
    await settingsManager.setSetting(sender, 'optedOutUsers', optedOutUsers);

    console.log(`[OptOut] Usuário ${pushName} (${commandSenderJid}) optou por sair das interações no grupo ${sender}`);
    
    const replyText = `Ok, ${pushName}, entendido. A partir de agora, você não será incluído nas brincadeiras e não poderá usar meus comandos neste grupo.\n\nSe um dia a alegria te chamar de volta, use o comando \`\`.`;
    await sock.sendMessage(sender, { text: replyText }, { quoted: msg });

    return true;
}

module.exports = handleOptOutCommand;
