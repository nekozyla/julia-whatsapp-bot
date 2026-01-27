
const settingsManager = require('../managers/groupSettingsManager');
const { getContentType } = require('@whiskeysockets/baileys');
const groupMetadataManager = require('../managers/groupMetadataManager.js');
const authManager = require('../managers/authManager.js');
const config = require('../../config/config.js');




async function reinforcedModeMonitor(sock, { messages }) {
    const msg = messages[0];
    if (!msg.message || !msg.key.remoteJid.endsWith('@g.us')) return;

    const chatJid = msg.key.remoteJid;
    const authorJid = msg.key.participant;

    
    const isReinforcedOn = settingsManager.getSetting(chatJid, 'chatRestrictedReinforced', 'off');
    if (isReinforcedOn !== 'on' || !authorJid) return;

    
    const isSuperAdmin = authManager.isSuperAdmin(authorJid);
    if (isSuperAdmin) return;

    const groupMeta = await groupMetadataManager.getGroupMetadata(sock, chatJid);

    
    if (!groupMeta || !groupMeta.participants) {
        console.warn(`[Restrict Reinforced] Não foi possível obter metadata do grupo ${chatJid}. Ignorando verificação de admin.`);
        return;
    }

    const participant = groupMeta.participants.find(p => p.id === authorJid);
    if (participant?.admin) return;

    const messageType = getContentType(msg.message);
    const textContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    
    const allowedTypes = ['imageMessage', 'stickerMessage'];
    if (allowedTypes.includes(messageType)) {
        return;
    }

    
    if (textContent.startsWith('/')) {
        return;
    }

    
    try {
        await sock.sendMessage(chatJid, { delete: msg.key });
        console.log(`[Restrict Reinforced] Mensagem de ${authorJid} apagada no grupo ${chatJid}.`);
    } catch (e) {
        console.error(`[Restrict Reinforced] Falha ao apagar mensagem. O bot é admin? Erro:`, e);
    }
}




async function handleRestrictCommand(sock, msg, msgDetails) {
    const { sender, commandText, commandSenderJid, isGroup } = msgDetails;

    if (!isGroup) {
        await sock.sendMessage(sender, { text: "Este comando só pode ser usado em grupos." }, { quoted: msg });
        return;
    }

    const groupMeta = await groupMetadataManager.getGroupMetadata(sock, sender);
    const participant = groupMeta.participants.find(p => p.id === commandSenderJid);
    const isAuthorAdmin = !!participant?.admin;

    if (!isAuthorAdmin) {
        await sock.sendMessage(sender, { text: "Apenas administradores do grupo podem usar este comando." }, { quoted: msg });
        return;
    }

    const args = commandText.split(' ').slice(1);
    const [action, type, target] = args;
    const reinforced = args.includes('--reinforced');

    const helpText = `*Comando de Restrição*\n\nComo usar:\n- \`/restrict chat on\` | \`off\`\n_(Restringe o bate-papo a apenas comandos)_\n\n- \`/restrict chat on --reinforced\`\n_(Apaga todas as mensagens que não forem comandos, imagens ou stickers de não-admins)_\n\n- \`/restrict command add\` | \`remove\` \`</comando>\`\n_(Bloqueia ou libera um comando específico)_\n\n- \`/restrict view\`\n_(Mostra as restrições atuais)_`;

    switch (action) {
        case 'chat': {
            if (type === 'on') {
                if (reinforced) {
                    await settingsManager.setSetting(sender, 'chatRestrictedReinforced', 'on');
                    await settingsManager.setSetting(sender, 'chatRestricted', 'off'); 

                    
                    if (!sock.reinforcedListenerAttached) {
                        sock.ev.on('messages.upsert', (data) => reinforcedModeMonitor(sock, data));
                        sock.reinforcedListenerAttached = true;
                        console.log('[Restrict] Monitor de restrição reforçada ativado e anexado ao bot.');
                    }
                    await sock.sendMessage(sender, { text: "✅ O bate-papo agora está em modo de *restrição reforçada*.\nApenas comandos, imagens e stickers serão permitidos." }, { quoted: msg });
                } else {
                    await settingsManager.setSetting(sender, 'chatRestricted', 'on');
                    await settingsManager.setSetting(sender, 'chatRestrictedReinforced', 'off'); 
                    await sock.sendMessage(sender, { text: "✅ O bate-papo agora está restrito apenas a comandos (modo normal)." }, { quoted: msg });
                }
            } else if (type === 'off') {
                
                await settingsManager.setSetting(sender, 'chatRestricted', 'off');
                await settingsManager.setSetting(sender, 'chatRestrictedReinforced', 'off');
                await sock.sendMessage(sender, { text: "✅ Todas as restrições de bate-papo foram removidas." }, { quoted: msg });
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
            const isReinforced = settingsManager.getSetting(sender, 'chatRestrictedReinforced', 'off');
            const restrictedCmds = settingsManager.getSetting(sender, 'restrictedCommands', []);

            let chatStatus = 'DESATIVADA';
            if (isChatRestricted === 'on') chatStatus = 'ATIVADA (Normal)';
            if (isReinforced === 'on') chatStatus = 'ATIVADA (Reforçada)';

            let response = `*Status das Restrições para este Grupo*\n\n`;
            response += `Restrição de Bate-papo: *${chatStatus}*\n`;
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


module.exports.commandData = {
    name: "restrict",
    description: "Restrições de comando.",
    category: "admin",
    usage: "/restrict",
    aliases: ["/regras","/restricoes","/bloquear"]
};
