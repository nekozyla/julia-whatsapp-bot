// commands/transcrever.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { textModel } = require('../managers/geminiClient'); // <- A importação já está correta
const { sendJuliaError, convertAudioToWav } = require('../utils/utils');

/**
 * Lógica principal que baixa, converte e transcreve um áudio.
 */
async function transcribeAudio(sock, msgToTranscribe, originalMsgToQuote) {
    const chatJid = originalMsgToQuote.key.remoteJid;

    try {
        await sock.sendPresenceUpdate('composing', chatJid);

        const audioBuffer = await downloadMediaMessage(msgToTranscribe, 'buffer', {}, { logger: undefined });

        if (!audioBuffer) {
            throw new Error("Não foi possível baixar o áudio. Pode ter sido apagado.");
        }

        const wavBuffer = await convertAudioToWav(audioBuffer);
        const audioBase64 = wavBuffer.toString('base64');

        // Prepara as partes para o modelo: um objeto de áudio e um objeto de texto (prompt)
        const promptParts = [
            { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
            { text: "Transcreva este áudio na íntegra, sem adicionar nenhum texto ou comentário adicional." }
        ];

        console.log(`[Transcrever] A enviar áudio de ${chatJid} para o Gemini...`);
        
        // --- CORREÇÃO AQUI ---
        // Usar textModel.generateContent e passar o array de 'parts' diretamente
        const result = await textModel.generateContent(promptParts);
        const transcription = result.response.text();
        
        console.log(`[Transcrever] Transcrição recebida.`);

        const replyText = `*Transcrição da Julia:*\n\n> ${transcription || "(Não foi possível extrair texto do áudio.)"}`;
        await sock.sendMessage(chatJid, { text: replyText }, { quoted: originalMsgToQuote });

    } catch (error) {
        console.error("[Transcrever] Erro ao transcrever áudio:", error);
        await sendJuliaError(sock, chatJid, originalMsgToQuote, error);
    }
}


/**
 * Handler para o comando !transcrever.
 */
async function handleTranscriptionCommand(sock, msg, msgDetails) {
    const { sender, commandText } = msgDetails;
    const contextInfo = msg.message.extendedTextMessage?.contextInfo;
    const quotedMsgInfo = contextInfo?.quotedMessage;

    if (!quotedMsgInfo || !quotedMsgInfo.audioMessage) {
        if ((commandText || '').toLowerCase().trim() === '!transcrever') {
            await sock.sendMessage(sender, { text: "Para transcrever um áudio, por favor, responda à mensagem de áudio com o comando `!transcrever`." }, { quoted: msg });
        }
        return true;
    }

    if (!contextInfo.stanzaId || !contextInfo.participant) {
        await sock.sendMessage(sender, { text: "Não consegui identificar a mensagem de áudio corretamente. Tente responder novamente." }, { quoted: msg });
        return true;
    }

    console.log(`[Transcrever] Utilizador em ${sender} solicitou a transcrição de um áudio via comando.`);

    const messageToTranscribe = {
        key: {
            remoteJid: sender,
            id: contextInfo.stanzaId,
            fromMe: contextInfo.participant === (sock.user.id.split(':')[0] + '@s.whatsapp.net'),
            participant: contextInfo.participant
        },
        message: quotedMsgInfo
    };

    await transcribeAudio(sock, messageToTranscribe, msg);

    return true;
}

module.exports = handleTranscriptionCommand;
module.exports.transcribeAudio = transcribeAudio;
