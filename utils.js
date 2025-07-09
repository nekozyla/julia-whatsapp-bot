// utils.js
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const geminiClient = require('./geminiClient'); // Importa nosso cliente atualizado

function getTextFromMsg(messageObject) {
    if (!messageObject) return null;
    return messageObject.conversation || 
           messageObject.extendedTextMessage?.text || 
           messageObject.imageMessage?.caption || 
           messageObject.videoMessage?.caption ||
           messageObject.buttonsResponseMessage?.selectedDisplayText ||
           messageObject.templateButtonReplyMessage?.selectedDisplayText ||
           messageObject.listResponseMessage?.title || null;
}

async function sendJuliaError(sock, sender, originalMsg, specificError) {
    console.error(`[Erro Handler para ${sender}]:`, specificError.message ? `${specificError.message} (Status: ${specificError.status || 'N/A'})` : specificError);
    if (specificError.errorDetails) { 
        console.error(`[Erro Handler Detalhes Gemini]:`, JSON.stringify(specificError.errorDetails, null, 2));
    }

    let friendlyError = 'Ocorreu um erro aqui 😖 tenta de novo depois';
    
    if (specificError?.message) {
        // --- LÓGICA DE TROCA DE MODELO ---
        if (specificError.message.includes('429')) { 
            // Tenta trocar para o próximo modelo de fallback
            if (geminiClient.switchToNextModel()) {
                 friendlyError = 'Percebi que estou falando muito e meu cérebro principal cansou! Mudei para um modo um pouco diferente para continuarmos. Por favor, tente de novo. 😊';
            } else {
                 friendlyError = 'Ops, parece que falei demais em todos os meus modos! Preciso de uma pausa para recarregar. Tente novamente mais tarde. 😢';
            }
        } else if (specificError.status === 503 || specificError.message.includes('503')) {
            friendlyError = 'O modelo de IA parece estar sobrecarregado no momento. Por favor, tente novamente em alguns instantes. 🙏';
        } else if (specificError.message.toLowerCase().includes('blocked by safety') || specificError.message.toLowerCase().includes('prompt was blocked')) {
            friendlyError = 'Minhas configurações de segurança me impediram de processar essa solicitação. Vamos tentar algo diferente?';
        }
    }

    try {
        await sock.sendMessage(sender, { text: friendlyError }, { quoted: originalMsg });
    } catch (sendErr) {
        console.error(`[Erro Handler] Falha ao enviar mensagem de erro para ${sender}:`, sendErr);
    }
}

async function convertAudioToWav(inputBuffer) {
    // ... (função convertAudioToWav continua igual)
}

module.exports = { 
    getTextFromMsg, 
    sendJuliaError,
    convertAudioToWav
};
