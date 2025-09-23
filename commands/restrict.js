// commands/restrict.js
const settingsManager = require('../groupSettingsManager');

// Função para verificar se o autor do comando é admin do grupo
async function isAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (e) {
        console.error("[Restrict Command] Erro ao verificar status de admin:", e);
        return false;
    }
}

async function handleRestrictCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    const isAuthorAdmin = await isAdmin(sock, sender, commandSenderJid);
    if (!isAuthorAdmin) {
        await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
        return;
    }

    const args = commandText.split(' ').slice(1);
    const [action, type, target] = args;

    const helpText = `*Comando de Restrição*\n\nComo usar:\n- \`/restrict chat on\` | \`off\`\n_(Restringe o bate-papo a apenas comandos)_ \n\n- \`/restrict command add\` | \`remove\` \`</comando>\`\n_(Bloqueia ou libera um comando específico)_ \n\n- \`/restrict view\`\n_(Mostra as restrições atuais)_`;

    switch (action) {
        case 'chat': {
            if (type === 'on') {
                await settingsManager.setSetting(sender, 'chatRestricted', 'on');
                await sock.sendMessage(sender, { text: "✅ O bate-papo agora está restrito apenas a comandos." }, { quoted: msg });
            } else if (type === 'off') {
                await settingsManager.setSetting(sender, 'chatRestricted', 'off');
                await sock.sendMessage(sender, { text: "✅ O bate-papo foi liberado para todos." }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
            }
            break;
        }
        case 'command': {
            const restrictedCommands = settingsManager.getSetting(sender, 'restrictedCommands', []);
            const commandToRestrict = target?.toLowerCase();

            if (!commandToRestrict || !commandToRestrict.startsWith('/')) {
                 await sock.sendMessage(sender, { text: "Por favor, especifique um comando válido para restringir (ex: /sticker)." }, { quoted: msg });
                 return;
            }

            if (type === 'add') {
                if (restrictedCommands.includes(commandToRestrict)) {
                    await sock.sendMessage(sender, { text: `O comando \`${commandToRestrict}\` já está restrito.` }, { quoted: msg });
                } else {
                    restrictedCommands.push(commandToRestrict);
                    await settingsManager.setSetting(sender, 'restrictedCommands', restrictedCommands);
                    await sock.sendMessage(sender, { text: `✅ O comando \`${commandToRestrict}\` foi restrito neste grupo.` }, { quoted: msg });
                }
            } else if (type === 'remove') {
                if (!restrictedCommands.includes(commandToRestrict)) {
                    await sock.sendMessage(sender, { text: `O comando \`${commandToRestrict}\` não estava restrito.` }, { quoted: msg });
                } else {
                    const updatedCommands = restrictedCommands.filter(cmd => cmd !== commandToRestrict);
                    await settingsManager.setSetting(sender, 'restrictedCommands', updatedCommands);
                    await sock.sendMessage(sender, { text: `✅ O comando \`${commandToRestrict}\` foi liberado neste grupo.` }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
            }
            break;
        }
        case 'view': {
            const isChatRestricted = settingsManager.getSetting(sender, 'chatRestricted', 'off');
            const restrictedCmds = settingsManager.getSetting(sender, 'restrictedCommands', []);
            let response = `*Status das Restrições para este Grupo*\n\n`;
            response += `Restrição de Bate-papo: *${isChatRestricted === 'on' ? 'ATIVADA' : 'DESATIVADA'}*\n`;
            response += `Comandos Restritos: ${restrictedCmds.length > 0 ? `\`${restrictedCmds.join('`, `')}\`` : 'Nenhum'}`;
            await sock.sendMessage(sender, { text: response }, { quoted: msg });
            break;
        }
        default:
            await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
            break;
    }
}

module.exports = handleRestrictCommand;
