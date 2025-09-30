// commands/adicionar.js
const authManager = require('../managers/authManager.js');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, isSuperAdmin, isGroup } = msgDetails;

    if (!isSuperAdmin) {
        return true;
    }

    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    const jidArgument = commandText.split(' ')[1];

    // Cenário 1: Adicionar por resposta
    if (contextInfo && contextInfo.participant) {
        const userToAllow = contextInfo.participant;
        if (await authManager.addAllowedContact(userToAllow)) {
            await sock.sendMessage(sender, { text: `✅ Utilizador respondido foi adicionado à lista de permissões.` });
        } else {
            await sock.sendMessage(sender, { text: `⚠️ Utilizador respondido já estava permitido.` });
        }
        return true;
    }

    // Cenário 2: Adicionar por JID
    if (jidArgument) {
        const jidToAdd = jidArgument.trim();
        if (jidToAdd.endsWith('@g.us')) {
            if (await authManager.addGroup(jidToAdd)) await sock.sendMessage(sender, { text: `✅ Grupo ${jidToAdd} adicionado.` });
            else await sock.sendMessage(sender, { text: `⚠️ Grupo ${jidToAdd} já estava permitido.` });
        } else if (jidToAdd.includes('@s.whatsapp.net')) {
            if (await authManager.addAllowedContact(jidToAdd)) await sock.sendMessage(sender, { text: `✅ Contacto ${jidToAdd} adicionado.` });
            else await sock.sendMessage(sender, { text: `⚠️ Contacto ${jidToAdd} já estava permitido.` });
        } else {
            await sock.sendMessage(sender, { text: `O JID fornecido não parece válido.` });
        }
        return true;
    }

    // Cenário 3: Adicionar o grupo atual
    if (isGroup) {
        if (await authManager.addGroup(sender)) {
            await sock.sendMessage(sender, { text: `✅ Este grupo foi adicionado à lista de permissões.` });
        } else {
            await sock.sendMessage(sender, { text: `Este grupo já estava na lista.` });
        }
        return true;
    }

    await sock.sendMessage(sender, { text: "Uso: /adicionar <JID> ou responda a uma mensagem." });
    return true;
};
