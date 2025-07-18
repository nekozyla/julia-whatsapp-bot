// commands/concordo.js
const agreementManager = require('../agreementManager');
const { ADMIN_JID } = require('../config'); // Para o help

async function handleAgreeCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, pushName } = msgDetails;

    if (agreementManager.hasUserAgreed(commandSenderJid)) {
        await sock.sendMessage(sender, { text: `Tudo certo, ${pushName}! Você já tinha aceitado os termos. Use o comando \`!help\` para ver o que eu posso fazer.` }, { quoted: msg });
        return true;
    }

    await agreementManager.setUserAsAgreed(commandSenderJid);

    await sock.sendMessage(sender, { text: `✅ Obrigado por concordar, ${pushName}! Você agora tem acesso a todas as minhas funções. Comece usando o comando \`!help\` para ver a lista de comandos.` }, { quoted: msg });

    // Avisa o admin que um novo usuário aceitou (opcional)
    const adminMessage = `📝 Novo usuário aceitou os termos: ${pushName} (${commandSenderJid.split('@')[0]})`;
    await sock.sendMessage(ADMIN_JID, { text: adminMessage });

    return true;
}

module.exports = handleAgreeCommand;
