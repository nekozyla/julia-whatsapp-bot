

const { getContentType } = require('@whiskeysockets/baileys');
const config = require('../config/config.js');
const settingsManager = require('./managers/groupSettingsManager.js');
const authManager = require('./managers/authManager.js');
const systemStateManager = require('./managers/systemStateManager.js');
const profanityManager = require('./managers/profanityManager.js');
const rejectionManager = require('./managers/rejectionManager.js');
const { getTextFromMsg, normalizeText } = require('./utils/utils.js');

const rankManager = require('./managers/rankManager.js'); 
const syncManager = require('./managers/syncManager.js');

const groupMetadataManager = require('./managers/groupMetadataManager.js');
const joinDateManager = require('./managers/joinDateManager.js'); 

const MIN_GROUP_MEMBERS = 10;


let stickerCommandHandler = null;
try {
    stickerCommandHandler = require('./commands/sticker.js');
} catch (e) {
    console.warn("[MessageHandler] O comando de sticker não foi encontrado, o modo sticker automático está desativado.");
}


async function processMessage(sock, msg, commandMap, botJidCache, messageStore, store) { 
    if (!msg.message || msg.key.fromMe) return;

    
    
    if (msg.key.id) {
        
        msg.pushName = msg.pushName || 'Alguém';
        messageStore.set(msg.key.id, msg);

        
        
        if (messageStore.size > 200) {
            const firstKey = messageStore.keys().next().value;
            messageStore.delete(firstKey);
        }
    }
    

    try {
        const senderJid = msg.key.remoteJid;
        const authorJid = msg.key.participant || senderJid;
        const isGroup = senderJid.endsWith('@g.us');
        const isAuthorSuperAdmin = authManager.isSuperAdmin(authorJid);

        const pushName = msg.pushName || 'alguém'; 
        const messageType = getContentType(msg.message);
        const originalText = getTextFromMsg(msg.message);

        
        if (isGroup) {
            
            
            const existingDate = joinDateManager.getJoinDate(senderJid, authorJid);
            if (!existingDate) {
                joinDateManager.setJoinDate(senderJid, authorJid, Math.floor(Date.now() / 1000));
            }
        }
        

        
        let textContent = originalText;
        let isSyncTag = false;
        if (originalText && originalText.trim().toLowerCase().endsWith('--sync')) {
            isSyncTag = true;
            textContent = originalText.replace(/\s*--sync\s*$/i, '').trim();
        }

        
        let isJuliaFile = false;

        let docMessage = null;
        if (messageType === 'documentMessage') docMessage = msg.message.documentMessage;
        else if (messageType === 'documentWithCaptionMessage') docMessage = msg.message.documentWithCaptionMessage.message.documentMessage;

        if (docMessage) {
            const fileName = (docMessage.fileName || '').toLowerCase();
            
            if (/\.julia(\s*(\(\d+\)|\d+))?(\.json|\.zip)?$/.test(fileName)) {
                isJuliaFile = true;
                
                
                
                textContent = '/perfil tema import-file';
            }
        }

        
        
        const commandKey = textContent?.startsWith('/') ? normalizeText(textContent.split(' ')[0]) : null;
        const commandToRun = commandKey ? commandMap.get(commandKey) : null;

        
        const botJidInThisGroup = botJidCache[senderJid] || botJidCache['global'];
        const mentions = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;

        const isMentioned = isGroup && botJidInThisGroup && (mentions.includes(botJidInThisGroup) || quotedParticipant === botJidInThisGroup);
        const isPrivateChat = !isGroup;
        

        
        
        let isAllowed = isAuthorSuperAdmin || authManager.isGroupAllowed(senderJid) || authManager.isContactAllowed(authorJid) || commandKey === '/agrandejulia';

        
        
        if (isGroup) {
            
            if (isAuthorSuperAdmin || authManager.isGroupAllowed(senderJid)) {
                isAllowed = true;
            } else {
                
                try {
                    const groupMetadata = await groupMetadataManager.getGroupMetadata(sock, senderJid);
                    if (groupMetadata && groupMetadata.participants.length < MIN_GROUP_MEMBERS) {
                        
                        isAllowed = false;
                        if (commandKey) {
                            console.log(`[GroupLimit] Comando ignorado em ${senderJid} (membros < ${MIN_GROUP_MEMBERS})`);
                        }
                    } else {
                        isAllowed = true;
                    }
                } catch (err) {
                    console.error(`[GroupLimit] Erro ao verificar tamanho do grupo ${senderJid}:`, err);
                    isAllowed = true;
                }
            }
        }

        if (!isAllowed) {
            
            if (isPrivateChat) return;

            
            
            if (commandKey || isMentioned) {
                if (rejectionManager.shouldSendRejection(authorJid)) {
                    const rejectionMessage = `Olá! Sou a Julia. 😊\n\nNotei que você tentou interagir comigo, mas só tenho permissão para funcionar em grupos autorizados ou no meu canal de novidades.\n\n🔗 *Entre no nosso grupo principal para conversar e usar todos os meus comandos:*\nhttps://chat.whatsapp.com/HtkDdUNzSt5EeA5S150ThR\n\nTe vejo lá! 😉`;
                    await sock.sendMessage(authorJid, { text: rejectionMessage });
                    rejectionManager.recordRejectionSent(authorJid);
                }
            }
            return;
        }

        
        if (systemStateManager.isMaintenanceMode() && !isAuthorSuperAdmin) return;
        if (isGroup && settingsManager.getSetting(senderJid, 'rankingMode', 'on') === 'on') {
            rankManager.incrementCount(senderJid, authorJid);
        }

        if (isGroup && textContent && settingsManager.getSetting(senderJid, 'tomatoMode', 'off') === 'on') {
            if (profanityManager.analyzeMessage(textContent)) {
                sock.sendMessage(senderJid, { react: { text: '🍅', key: msg.key } }).catch(e => { });
            }
        }

        
        if (commandToRun) {
            const restrictedCommands = settingsManager.getSetting(senderJid, 'restrictedCommands', []);

            if (restrictedCommands.includes(commandKey)) {

                let isAuthorGroupAdmin = false;
                if (isGroup) {
                    try {
                        const groupMeta = await groupMetadataManager.getGroupMetadata(sock, senderJid);
                        const participant = groupMeta.participants.find(p => p.id === authorJid);
                        isAuthorGroupAdmin = !!participant?.admin;
                    } catch (e) {
                        console.error("[MessageHandler] Erro ao verificar status de admin para restrição:", e);
                    }
                }

                if (!isAuthorSuperAdmin && !isAuthorGroupAdmin) {
                    console.log(`[Restrict] Comando ${commandKey} bloqueado para ${authorJid} no grupo ${senderJid}.`);
                    return;
                }
            }
        }
        

        
        let args = [];
        let prefix = '/';
        let commandName = '';

        if (commandKey) {
            args = textContent.split(' ').slice(1);
            prefix = commandKey.charAt(0);
            commandName = commandKey.slice(1);
        }

        const msgDetails = {
            sender: senderJid, pushName, command: commandKey, commandText: textContent,
            messageType, isGroup, quotedMsgInfo: msg.message.extendedTextMessage?.contextInfo?.quotedMessage,
            commandSenderJid: authorJid, isSuperAdmin: isAuthorSuperAdmin,
            store, 
            botJid: botJidInThisGroup, 
            args, prefix, commandName, 
            commandMap 
        };

        if (commandToRun) {
            
            await commandToRun(sock, msg, msgDetails);

            
            if (isSyncTag && isGroup) {
                try {
                    const linked = await syncManager.getLinks(senderJid);
                    if (linked && linked.length > 0) {
                        
                        const botJidForOriginal = botJidCache[senderJid] || Object.values(botJidCache)[0];

                        for (const targetGroup of linked) {
                            if (targetGroup === senderJid) continue;

                            try {
                                
                                const meta = await groupMetadataManager.getGroupMetadata(sock, targetGroup);
                                const botJidForTarget = botJidCache[targetGroup] || botJidForOriginal;
                                const botParticipant = meta?.participants.find(p => p.id === botJidForTarget);
                                if (!botParticipant?.admin) {
                                    console.log(`[Sync] Julia não é admin em ${targetGroup}, pulando execução sincronizada.`);
                                    continue;
                                }

                                
                                const fakeMsg = { ...msg, key: { ...msg.key, remoteJid: targetGroup, participant: botJidForTarget } };
                                const fakeDetails = {
                                    ...msgDetails,
                                    sender: targetGroup,
                                    pushName: 'Julia (sync)',
                                    command: commandKey,
                                    commandText: textContent,
                                    commandSenderJid: botJidForTarget,
                                    isGroup: true,
                                    isSuperAdmin: false
                                };

                                
                                await commandToRun(sock, fakeMsg, fakeDetails);
                                console.log(`[Sync] Executado ${commandKey} em ${targetGroup} (sync from ${senderJid}).`);
                            } catch (e) {
                                console.error('[Sync] Erro ao executar comando sincronizado em', targetGroup, e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Sync] Erro ao recuperar grupos sincronizados:', e);
                }
            }

            return;
        }

        
        if (stickerCommandHandler && settingsManager.getSetting(senderJid, 'stickerMode', 'off') === 'on' && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
            const stickerMsgDetails = { ...msgDetails, command: '/sticker', commandText: '/sticker' };
            await stickerCommandHandler(sock, msg, stickerMsgDetails);
            return;
        }

    } catch (error) {
        console.error("[MessageHandler] Ocorreu um erro ao processar a mensagem:", error);
    }
}

module.exports = { processMessage };
