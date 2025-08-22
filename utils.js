// utils.js
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const geminiClient = require('./geminiClient');

function getTextFromMsg(messageObject) {
    if (!messageObject) return null;
    return messageObject.conversation || 
           messageObject.extendedTextMessage?.text || 
           messageObject.imageMessage?.caption || 
           messageObject.videoMessage?.caption || null;
}

async function sendJuliaError(sock, sender, originalMsg, specificError) {
    console.error(`[Erro Handler para ${sender}]:`, specificError.message ? `${specificError.message} (Status: ${specificError.status || 'N/A'})` : specificError);
    let friendlyError = 'Ocorreu um erro aqui 😖 tenta de novo depois';
    
    if (specificError?.message) {
        if (specificError.message.includes('429')) {
            friendlyError = 'Ops, falei demais e preciso de uma pausa! Atingi meu limite de interações. Já estou resolvendo, tente de novo em um instante. 😊';
            geminiClient.switchToNextModel();
        } else if (specificError.message.includes('503')) {
            friendlyError = 'O modelo de IA parece estar sobrecarregado no momento. Por favor, tente novamente em alguns instantes. 🙏';
        } else {
            // Usa a mensagem de erro da própria exceção se for mais descritiva
            friendlyError = `😕 Tive um probleminha: ${specificError.message}`;
        }
    }
    try {
        await sock.sendMessage(sender, { text: friendlyError }, { quoted: originalMsg });
    } catch (sendErr) {
        console.error(`[Erro Handler] Falha ao enviar mensagem de erro para ${sender}:`, sendErr);
    }
}

/**
 * Converte um buffer de áudio para um formato WAV padrão, de forma mais robusta.
 * @param {Buffer} inputBuffer - O buffer de áudio original.
 * @returns {Promise<Buffer>}
 */
async function convertAudioToWav(inputBuffer) {
    console.log('[Audio] A iniciar conversão de áudio para WAV com FFmpeg...');
    const tempDir = path.join(__dirname, 'temp_audio');
    await fs.mkdir(tempDir, { recursive: true });

    const randomId = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tempDir, `${randomId}.ogg`);
    const outputPath = path.join(tempDir, `${randomId}.wav`);

    await fs.writeFile(inputPath, inputBuffer);

    // Comando FFmpeg mais robusto, com -y para sobrescrever e -v error para logs mais limpos
    const ffmpegCommand = `ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -c:a pcm_s16le -v error "${outputPath}"`;

    return new Promise((resolve, reject) => {
        exec(ffmpegCommand, async (error, stdout, stderr) => {
            if (error) {
                console.error('[FFmpeg Audio Error]:', stderr);
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
                return reject(new Error('Falha ao converter o áudio com FFmpeg. O formato pode não ser suportado.'));
            }
            
            try {
                // Verifica se o ficheiro de saída foi criado e não está vazio
                const stats = await fs.stat(outputPath);
                if (stats.size === 0) {
                    throw new Error("O ficheiro de áudio convertido está vazio.");
                }

                const outputBuffer = await fs.readFile(outputPath);
                console.log('[Audio] Conversão para WAV concluída com sucesso.');
                resolve(outputBuffer);
            } catch (readError) {
                reject(readError);
            } finally {
                // Limpeza dos ficheiros temporários
                await fs.unlink(inputPath).catch(() => {});
                await fs.unlink(outputPath).catch(() => {});
            }
        });
    });
}

module.exports = { 
    getTextFromMsg, 
    sendJuliaError,
    convertAudioToWav
};
