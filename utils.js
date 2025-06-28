// utils.js
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');

/**
 * Extrai o conteúdo de texto de um objeto de mensagem do Baileys.
 * @param {object} messageObject - O objeto 'message' de uma mensagem.
 * @returns {string|null} O texto extraído ou nulo.
 */
function getTextFromMsg(messageObject) {
    if (!messageObject) {
        return null;
    }
    // Tenta extrair texto de vários campos possíveis
    let text = messageObject.conversation || 
               messageObject.extendedTextMessage?.text || 
               messageObject.imageMessage?.caption || 
               messageObject.videoMessage?.caption ||
               messageObject.buttonsResponseMessage?.selectedDisplayText ||
               messageObject.templateButtonReplyMessage?.selectedDisplayText ||
               messageObject.listResponseMessage?.title;
    return text || null;
}

/**
 * Envia uma mensagem de erro padronizada e amigável para o usuário.
 * @param {object} sock - A instância do socket Baileys.
 * @param {string} sender - O JID do chat para onde enviar o erro.
 * @param {object} originalMsg - O objeto da mensagem original para responder a ela.
 * @param {Error} specificError - O objeto do erro capturado no bloco catch.
 */
async function sendJuliaError(sock, sender, originalMsg, specificError) {
    console.error(`[Erro Handler para ${sender}]:`, specificError.message ? `${specificError.message} (Status: ${specificError.status || 'N/A'})` : specificError);
    if (specificError.errorDetails) { 
        console.error(`[Erro Handler Detalhes Gemini]:`, JSON.stringify(specificError.errorDetails, null, 2));
    }

    let friendlyError = 'Ocorreu um erro aqui 😖 tenta de novo depois';
    if (specificError?.message) {
        if (specificError.status === 503 || specificError.message.includes('503')) {
            friendlyError = 'O modelo de IA parece estar sobrecarregado no momento. Por favor, tente novamente em alguns instantes. 🙏';
        } else if (specificError.message.includes('429')) { 
            friendlyError = 'Ops, falei demais e preciso de uma pausa! Atingi meu limite de interações. Tente de novo mais tarde. 😊';
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

/**
 * Converte um buffer de áudio (geralmente OGG/Opus do WhatsApp) para um formato WAV padrão.
 * @param {Buffer} inputBuffer - O buffer de áudio original.
 * @returns {Promise<Buffer>} Uma promessa que resolve com o buffer do áudio em formato WAV.
 */
async function convertAudioToWav(inputBuffer) {
    console.log('[Audio] Iniciando conversão de áudio para WAV com FFmpeg...');
    const tempDir = path.join(__dirname, 'temp_audio');
    await fs.mkdir(tempDir, { recursive: true });

    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.ogg`);
    const outputPath = path.join(tempDir, `${randomId}.wav`);

    await fs.writeFile(inputPath, inputBuffer);

    // Comando FFmpeg para converter para WAV, 16kHz de sample rate, 1 canal de áudio (mono).
    // Este é um formato de alta compatibilidade para APIs de transcrição.
    const ffmpegCommand = `ffmpeg -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}"`;

    return new Promise((resolve, reject) => {
        exec(ffmpegCommand, async (error, stdout, stderr) => {
            // Limpa o arquivo de entrada de qualquer maneira
            await fs.unlink(inputPath).catch(e => console.error("Erro ao limpar arquivo de áudio de entrada:", e));

            if (error) {
                console.error('[FFmpeg Audio Error]:', error);
                console.error('[FFmpeg Audio Stderr]:', stderr);
                await fs.unlink(outputPath).catch(() => {}); // Tenta limpar o arquivo de saída se a conversão falhou
                return reject(new Error('Falha ao converter o áudio com FFmpeg.'));
            }
            
            // Lê o buffer do arquivo convertido e o retorna
            const outputBuffer = await fs.readFile(outputPath);
            await fs.unlink(outputPath); // Limpa o arquivo de saída após a leitura
            console.log('[Audio] Conversão para WAV concluída com sucesso.');
            resolve(outputBuffer);
        });
    });
}


module.exports = { 
    getTextFromMsg, 
    sendJuliaError,
    convertAudioToWav // Exporta a nova função
};
