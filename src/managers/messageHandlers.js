// messageHandlers.js (Versão com feedback de processamento e melhor tratamento de erros)

const { getContentType } = require('@whiskeysockets/baileys');
const { model, startChat } = require('./geminiClient'); 
const { saveSessionHistory, clearSession } = require('./sessionManager');
const { sendJuliaError } = require('../utils/utils.js');
const settingsManager = require('./groupSettingsManager');

// --- FUNÇÃO REMOVIDA ---
// A função parseCommandFromResponse foi removida pois não estava a ser utilizada.

async function processAIResponse(sock, originalMsg, responseText, chatSession) {
    const chatJid = originalMsg.key.remoteJid;

    // Se a resposta da IA for válida, envia o texto.
    if (responseText) {
        await sock.sendMessage(chatJid, { text: responseText }, { quoted: originalMsg });
    } else {
        // Se a IA não retornou texto (erro ou filtro de segurança), avisa o utilizador.
        console.warn(`[AI] A resposta do Gemini para ${chatJid} veio vazia.`);
        await sock.sendMessage(chatJid, { text: "😕 Tentei pensar numa resposta, mas não consegui formular nada. Tente perguntar de outra forma." }, { quoted: originalMsg });
    }
}

async function handleAnyMessage(sock, msg, chatSession, msgDetails, sessionManager) {
    const text = msgDetails.currentMessageText || "";
    const senderJid = msgDetails.sender;

    // O comando de limpar continua igual.
    if (text.toLowerCase() === '/limpar' || text.toLowerCase() === '!limpar') {
        await clearSession(senderJid);
        await sock.sendMessage(senderJid, { text: "✨ Histórico de conversa limpo! Podemos começar de novo." }, { quoted: msg }); 
        return;
    }
    
    // Constrói o contexto para a IA
    let contextForAI = "[CONTEXTO: TEXTO]";
    if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        contextForAI = "[CONTEXTO: RESPOSTA A OUTRA MENSAGEM]";
    } else if (msgDetails.messageType === 'imageMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UMA IMAGEM]";
    } else if (msgDetails.messageType === 'videoMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UM VÍDEO]";
    } else if (msgDetails.messageType === 'stickerMessage') {
        contextForAI = "[CONTEXTO: REAÇÃO A UMA FIGURINHA]";
    }

    try {
        // --- MELHORIA 1: Feedback Imediato ---
        // Reage à mensagem do utilizador para indicar que a IA está a "pensar".
        // Isto confirma que a mensagem não foi ignorada.
        await sock.sendMessage(senderJid, { react: { text: '🤔', key: msg.key } });

        const userMessageForGemini = `${contextForAI} (${msgDetails.pushName}): ${text}`;
        const result = await chatSession.sendMessage(userMessageForGemini);
        const responseText = result.response.text();
        
        // --- MELHORIA 2: Resposta Garantida ---
        // Passa a responsabilidade de enviar a mensagem para uma função que verifica se a resposta não está vazia.
        await processAIResponse(sock, msg, responseText, chatSession);
        
        // --- MELHORIA 3: Feedback de Conclusão ---
        // Troca a reação para "sucesso" após enviar a resposta.
        await sock.sendMessage(senderJid, { react: { text: '✅', key: msg.key } });
        
        const currentHistory = await chatSession.getHistory();
        await saveSessionHistory(senderJid, currentHistory);

    } catch (error) {
        // --- MELHORIA 4: Feedback de Erro ---
        // Se ocorrer um erro, troca a reação para "falha" e chama o gestor de erros.
        console.error(`[AI Handler] Erro ao processar IA para ${senderJid}:`, error);
        await sock.sendMessage(senderJid, { react: { text: '❌', key: msg.key } });
        await sendJuliaError(sock, senderJid, msg, error);
    }
}

module.exports = {
    handleAnyMessage
};
