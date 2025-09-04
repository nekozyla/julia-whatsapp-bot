// commands/modofala.js
const settingsManager = require('../groupSettingsManager');

async function handleSpeechModeCommand(sock, msg, msgDetails) {
    const { sender, isGroup, commandText, commandSenderJid, isSuperAdmin } = msgDetails;

    // A chave para a configuração é sempre o JID do chat (seja grupo ou privado)
    const chatJid = sender;

    // Se for um grupo, verifica as permissões de administrador
    if (isGroup) {
        try {
            const groupMetadata = await sock.groupMetadata(sender);
            const senderParticipant = groupMetadata.participants.find(p => p.id === commandSenderJid);
            const isAdmin = senderParticipant?.admin === 'admin' || senderParticipant?.admin === 'superadmin';

            if (!isAdmin && !isSuperAdmin) {
                await sock.sendMessage(sender, { text: "Em grupos, apenas administradores podem alterar o modo de fala." }, { quoted: msg });
                return true;
            }
        } catch (error) {
            console.error("[Modo Fala] Erro ao verificar permissões de admin:", error);
            await sock.sendMessage(sender, { text: "Ocorreu um erro ao verificar as suas permissões." }, { quoted: msg });
            return true;
        }
    }

    // A lógica para ligar/desligar funciona da mesma forma para ambos os tipos de chat
    const argument = (commandText.split(' ')[1] || '').toLowerCase();

    if (argument === 'on') {
        settingsManager.setSetting(chatJid, 'speechMode', 'on');
        await sock.sendMessage(sender, { text: "🎤 Modo Fala ativado! A partir de agora, as minhas respostas de IA neste chat serão em áudio." }, { quoted: msg });
    } else if (argument === 'off') {
        settingsManager.setSetting(chatJid, 'speechMode', 'off');
        await sock.sendMessage(sender, { text: "📝 Modo Fala desativado! Voltarei a responder por texto neste chat." }, { quoted: msg });
    } else {
        await sock.sendMessage(sender, { text: "Uso incorreto. Use `!modofala on` ou `!modofala off`." }, { quoted: msg });
    }

    return true;
}

module.exports = handleSpeechModeCommand;


