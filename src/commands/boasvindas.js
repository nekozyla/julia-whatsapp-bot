const settingsManager = require('../managers/groupSettingsManager.js');
const { getGroupMetadata } = require('../managers/groupMetadataManager.js');

module.exports = async (sock, msg, msgDetails) => {
    const { sender, isGroup, args, commandSenderJid, isSuperAdmin } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: '❌ Este comando só pode ser usado em grupos.' });
        return;
    }

    
    let isAdmin = isSuperAdmin;
    if (!isAdmin) {
        try {
            const groupMetadata = await getGroupMetadata(sock, sender);
            const participant = groupMetadata.participants.find(p => p.id === commandSenderJid);
            if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                isAdmin = true;
            }
        } catch (e) {
            console.error('[BoasVindas] Erro ao verificar admin:', e);
        }
    }

    if (!isAdmin) {
        await sock.sendMessage(sender, { text: '❌ Apenas administradores podem configurar as boas-vindas.' });
        return;
    }

    const subCommand = args[0]?.toLowerCase();

    if (!subCommand) {
        await sock.sendMessage(sender, {
            text: `📢 *Configuração de Boas-Vindas*\n\nUse:\n` +
                `• */boasvindas on* - Ativa as boas-vindas\n` +
                `• */boasvindas off* - Desativa as boas-vindas\n` +
                `• */boasvindas mensagem <texto>* - Define a mensagem\n\n` +
                `*Variáveis disponíveis:*\n` +
                `@user - Menciona o novo membro\n` +
                `@group - Nome do grupo\n` +
                `@desc - Descrição do grupo`
        });
        return;
    }

    if (subCommand === 'on') {
        settingsManager.setSetting(sender, 'welcomeMode', 'on');
        await sock.sendMessage(sender, { text: '✅ Boas-vindas ativadas para este grupo!' });
    } else if (subCommand === 'off') {
        settingsManager.setSetting(sender, 'welcomeMode', 'off');
        await sock.sendMessage(sender, { text: '🛑 Boas-vindas desativadas.' });
    } else if (subCommand === 'mensagem' || subCommand === 'msg') {
        const newMessage = args.slice(1).join(' ');
        if (!newMessage) {
            await sock.sendMessage(sender, { text: '❌ Você precisa digitar a mensagem após o comando.' });
            return;
        }

        settingsManager.setSetting(sender, 'welcomeMessage', newMessage);
        await sock.sendMessage(sender, {
            text: `✅ Mensagem de boas-vindas atualizada!\n\n*Nova mensagem:*\n${newMessage}`
        });
    } else {
        await sock.sendMessage(sender, { text: '❌ Opção inválida. Use */boasvindas* para ver as opções.' });
    }
};


module.exports.commandData = {
    name: "boasvindas",
    description: "Configura boas-vindas.",
    category: "admin",
    usage: "/boasvindas",
    aliases: ["/welcome","/bv","/recepcao"]
};
