// messageHandlers.js
const { getContentType } = require('@whiskeysockets/baileys');
const { model } = require('./geminiClient'); 
const { saveSessionHistory, clearSession, getOrCreateChatForSession } = require('./sessionManager');
const { sendJuliaError } = require('./utils');

function parseCommandFromResponse(responseText) {
    const commandRegex = /\[DO_COMMAND\](.*?)\[\/DO_COMMAND\]/;
    const match = responseText.match(commandRegex);
    if (match && match[1]) {
        return {
            commandName: match[1].trim().toLowerCase(),
            cleanedText: responseText.replace(commandRegex, '').trim()
        };
    }
    return null;
}

async function processAIResponse(sock, originalMsg, responseText, chatSession, commandMap) {
    const commandAction = parseCommandFromResponse(responseText);
    const senderJid = originalMsg.key.remoteJid;
    const pushName = originalMsg.pushName || 'alguém';

    if (commandAction?.commandName) {
        console.log(`[IA-Comando] Julia decidiu executar o comando: '${commandAction.commandName}'`);
        
        if (commandAction.cleanedText) {
            await sock.sendMessage(senderJid, { text: commandAction.cleanedText }, { quoted: originalMsg });
        }

        const commandHandler = commandMap[`!${commandAction.commandName}`];
        if (typeof commandHandler === 'function') {
            let targetMsg = null;
            const quotedMsgInfo = originalMsg.message?.extendedTextMessage?.contextInfo;

            if (quotedMsgInfo?.quotedMessage?.imageMessage || quotedMsgInfo?.quotedMessage?.videoMessage) {
                targetMsg = {
                    key: { remoteJid: senderJid, id: quotedMsgInfo.stanzaId, participant: quotedMsgInfo.participant },
                    message: quotedMsgInfo.quotedMessage
                };
            } else {
                const history = await chatSession.getHistory();
                targetMsg = history.slice().reverse().find(entry => entry.role === 'user' && (entry.message?.imageMessage || entry.message?.videoMessage));
            }

            if (targetMsg) {
                console.log(`[IA-Comando] Alvo encontrado: Mensagem ${targetMsg.key.id}`);
                const fakeMsgDetails = {
                    sender: senderJid, pushName, command: `!${commandAction.commandName}`,
                    commandText: `!${commandAction.commandName}`,
                    messageType: getContentType(targetMsg.message), isGroup: senderJid.endsWith('@g.us'),
                    quotedMsgInfo: targetMsg.message,
                    commandSenderJid: originalMsg.key.participant || originalMsg.key.remoteJid
                };
                await commandHandler(sock, targetMsg, fakeMsgDetails);
            } else {
                await sock.sendMessage(senderJid, { text: "Qual foi, mermão, tu pediu pra fazer a parada mas não achei nenhuma imagem ou vídeo pra usar." }, { quoted: originalMsg });
            }
        }
        return;
    }

    await sock.sendMessage(senderJid, { text: responseText }, { quoted: originalMsg });
}

// Handler Único e Principal
async function handleAnyMessage(sock, msg, chatSession, msgDetails, sessionManager, commandMap) {
    const text = msgDetails.currentMessageText || "";

    if (text.toLowerCase() === '/limpar') {
        await clearSession(msgDetails.sender);
        await sock.sendMessage(msgDetails.sender, { text: "Seu histórico de conversa comigo foi limpo! ✨" }, { quoted: msg }); 
        return true;
    }
    
    let contextForAI = "[CONTEXTO: TEXTO]";
    const quotedMsgInfo = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quotedMsgInfo?.imageMessage || quotedMsgInfo?.videoMessage) {
        contextForAI = "[CONTEXTO: MÍDIA]";
    } else {
        const history = await chatSession.getHistory();
        if (history.length > 0) {
            const lastMessage = history[history.length - 1];
            if (lastMessage.role === 'user' && (lastMessage.message?.imageMessage || lastMessage.message?.videoMessage)) {
                contextForAI = "[CONTEXTO: MÍDIA]";
            }
        }
    }
    
    const userMessageForGemini = `${contextForAI} (${msgDetails.pushName}): ${text}`;
    console.log(`[Prompt para IA] Enviando: "${userMessageForGemini}"`);

    try {
        const result = await chatSession.sendMessage(userMessageForGemini);
        const responseText = result.response.text();
        
        await processAIResponse(sock, msg, responseText, chatSession, commandMap);
        
        const currentHistory = await chatSession.getHistory();
        await saveSessionHistory(msgDetails.sender, currentHistory);

    } catch (error) {
        await sendJuliaError(sock, msgDetails.sender, msg, error);
    }
    return true; 
}

module.exports = {
    handleAnyMessage
};
