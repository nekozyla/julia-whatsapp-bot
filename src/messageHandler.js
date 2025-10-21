// src/messageHandler.js

const { getContentType } = require('@whiskeysockets/baileys');
const config = require('../config/config.js');
const conversationalHandlers = require('./managers/messageHandlers.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const sessionManager = require('./managers/sessionManager.js');
const { getTextFromMsg } = require('./utils/utils.js');
const rankHandler = require('./commands/rank.js');

// Carrega o comando de sticker de forma segura
let stickerCommandHandler = null;
try {
    stickerCommandHandler = require('./commands/sticker.js');
} catch (e) {
    console.warn("[MessageHandler] O comando de sticker não foi encontrado, o modo sticker automático está desativado.");
}

/**
 * Processa uma nova mensagem recebida.
 * @param {object} sock A instância do socket Baileys.
 * @param {object} msg A mensagem recebida.
 * @param {Map<string, function>} commandMap O mapa de comandos disponíveis.
 * @param {object} botJidCache O cache de JIDs do bot.
 */
async function processMessage(sock, msg, commandMap, botJidCache) {
    if (!msg.message || msg.key.fromMe) return;

    try {
        const senderJid = msg.key.remoteJid;
        const authorJid = msg.key.participant || senderJid;
        const isGroup = senderJid.endsWith('@g.us');
        const isAuthorSuperAdmin = config.ADMIN_JIDS.includes(authorJid);
        
        // 1. Verificação de permissão
        if (!isAuthorSuperAdmin && !authManager.isGroupAllowed(senderJid) && !authManager.isContactAllowed(authorJid)) {
            if (rejectionManager.shouldSendRejection(authorJid)) {
                const rejectionMessage = `Olá! Sou a Julia. 😊\n\nNotei que você tentou interagir comigo, mas só tenho permissão para funcionar em grupos autorizados ou no meu canal de novidades.\n\n🔗 *Entre no nosso grupo principal para conversar e usar todos os meus comandos:*\nhttps://chat.whatsapp.com/G6yvFKyWglbCcCLZxRPPHw\n\n📢 *Siga meu canal para ficar por dentro das atualizações:*\nhttps://whatsapp.com/channel/0029Vb6C238CxoAwXrkEXe1E\n\nTe vejo lá! 😉`;
                await sock.sendMessage(authorJid, { text: rejectionMessage });
                rejectionManager.recordRejectionSent(authorJid);
            }
            return;
        }

        // 2. Lógicas de modo (manutenção, ranking, etc.)
        if (systemStateManager.isMaintenanceMode() && !isAuthorSuperAdmin) return;
        if (isGroup && settingsManager.getSetting(senderJid, 'rankingMode', 'on') === 'on') {
            rankHandler.incrementCount(senderJid, authorJid);
        }

        const pushName = msg.pushName || 'alguém';
        const messageType = getContentType(msg.message);
        const textContent = getTextFromMsg(msg.message);

        if (isGroup && textContent && settingsManager.getSetting(senderJid, 'tomatoMode', 'on') === 'on') {
            if (profanityManager.analyzeMessage(textContent)) {
                sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => {});
            }
        }

        // 3. Roteamento de Comandos
        const commandKey = textContent?.startsWith('/') ? textContent.split(' ')[0].toLowerCase() : null;
        const commandToRun = commandKey ? commandMap.get(commandKey) : null;
        
        const msgDetails = {
            sender: senderJid, pushName, command: commandKey, commandText: textContent,
            messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage,
            commandSenderJid: authorJid, isSuperAdmin: isAuthorSuperAdmin
        };

        if (commandToRun) {
            await commandToRun(sock, msg, msgDetails);
            return;
        }

        // 4. Modos Automáticos (Sticker)
        if (stickerCommandHandler && settingsManager.getSetting(senderJid, 'stickerMode', 'on') === 'on' && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
            const stickerMsgDetails = { ...msgDetails, command: '/sticker', commandText: '/sticker' };
            await stickerCommandHandler(sock, msg, stickerMsgDetails);
            return;
        }
        
        // 5. Lógica de Resposta da IA
        const botJidInThisGroup = botJidCache[senderJid];
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
        
        const isMentioned = isGroup && botJidInThisGroup && (mentions.includes(botJidInThisGroup) || quotedParticipant === botJidInThisGroup);
        const isPrivateChat = !isGroup;

        if ((isMentioned || isPrivateChat) && settingsManager.getSetting(senderJid, 'aiMode', 'on') === 'on') {
            const chatSession = await sessionManager.getOrCreateChatForSession(senderJid);
            await sock.sendPresenceUpdate('composing', senderJid);
            const msgDetailsForHandler = { sender: senderJid, pushName, currentMessageText: textContent, messageType };
            await conversationalHandlers.handleAnyMessage(sock, msg, chatSession, msgDetailsForHandler, sessionManager, commandMap);
        }

    } catch (error) {
        console.error("[MessageHandler] Ocorreu um erro ao processar a mensagem:", error);
    }
}

module.exports = { processMessage };
