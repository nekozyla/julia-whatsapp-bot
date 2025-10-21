// utils.js (Versão com mensagem de erro genérica aprimorada)
const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const { tmpdir } = require('os');
const path = require('path');
const ffmpeg = require('ffmpeg-static');
const ffprobe = require('ffprobe-static');

/**
 * Envia uma mensagem de erro padronizada para o chat e loga o erro completo no console.
 * @param {any} sock O socket da conexão Baileys.
 * @param {string} chatJid O JID do chat para onde enviar o erro.
 * @param {any} originalMsg O objeto da mensagem original para responder.
 * @param {Error} error O objeto do erro que ocorreu.
 */
async function sendJuliaError(sock, chatJid, originalMsg, error) {
    console.error(`[Erro Handler para ${chatJid}]: ${error.message} (Status: ${error.status || 'N/A'})`);
    console.error(error.stack); // Loga o stack completo para depuração

    let friendlyMessage = `😕 Tive um probleminha aqui e não consegui processar o seu pedido.`; // <-- Mensagem padrão melhorada

    // Personaliza a mensagem para erros comuns da API do Gemini
    if (error.message && error.message.includes('GoogleGenerativeAI Error')) {
        if (error.message.includes('500 Internal Server Error')) {
            // Ignora o envio para o usuário, pois é um problema temporário do servidor do Google
            console.warn(`[Erro Handler] Erro 500 do Google, ignorando a mensagem para o utilizador.`);
            return;
        }
        if (error.message.includes('API key not valid')) {
            friendlyMessage = "🔑 Minha chave de API para o Gemini não é válida. A minha criadora precisa de verificar o ficheiro `.env`.";
        } else if (error.message.includes('quota')) {
            friendlyMessage = " overworked. Atingi o meu limite de pedidos à IA por enquanto. Por favor, tente novamente mais tarde.";
        }
    } else if (error.message.includes('FFMPEG')) {
        friendlyMessage = "😕 Tive um problema ao processar o ficheiro de mídia. Ele pode estar num formato que eu não consigo ler.";
    } else {
         // --- MELHORIA 5: Adiciona o texto do erro à mensagem genérica ---
         // Ajuda a depurar problemas inesperados.
         friendlyMessage = `😕 Tive um probleminha aqui: ${error.message}`;
    }

    try {
        await sock.sendMessage(chatJid, { text: friendlyMessage }, { quoted: originalMsg });
    } catch (sendError) {
        console.error(`[Erro Handler] Falha ao enviar a mensagem de erro para ${chatJid}:`, sendError);
    }
}

// O resto do ficheiro permanece igual...
/**
 * Extrai o texto de um objeto de mensagem, independentemente do tipo.
 * @param {object} message O objeto da mensagem do Baileys.
 * @returns {string | null} O texto da mensagem ou nulo se não houver.
 */
function getTextFromMsg(message) {
    if (!message) return null;
    return message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        null;
}

/**
 * Extrai o texto de um comando, removendo o prefixo.
 * @param {string} fullText O texto completo da mensagem.
 * @param {string} commandPrefix O prefixo do comando (ex: "!mudar").
 * @returns {string | null} O texto após o comando ou nulo.
 */
function extractCommandText(fullText, commandPrefix) {
    if (!fullText || !fullText.startsWith(commandPrefix)) return null;
    return fullText.substring(commandPrefix.length).trim();
}


/**
 * Converte um buffer de áudio para o formato WAV usando ffmpeg.
 * @param {Buffer} audioBuffer O buffer de áudio original.
 * @returns {Promise<Buffer>} Um buffer com o áudio no formato WAV.
 */
async function convertAudioToWav(audioBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            '-i', 'pipe:0',
            '-f', 'wav',
            '-ac', '1',
            '-ar', '16000',
            'pipe:1'
        ]);

        let outputBuffers = [];
        ffmpegProcess.stdout.on('data', (chunk) => outputBuffers.push(chunk));
        ffmpegProcess.stderr.on('data', (data) => console.error(`[FFMPEG STDERR] ${data}`));

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                resolve(Buffer.concat(outputBuffers));
            } else {
                reject(new Error(`FFMPEG falhou ao converter para WAV com o código ${code}`));
            }
        });

        ffmpegProcess.stdin.write(audioBuffer);
        ffmpegProcess.stdin.end();
    });
}


/**
 * Obtém a duração de um vídeo em segundos.
 * @param {string} videoPath O caminho para o ficheiro de vídeo.
 * @returns {Promise<number>} A duração do vídeo em segundos.
 */
async function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        exec(`${ffprobe.path} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (error, stdout, stderr) => {
            if (error) {
                reject(`Erro ao obter a duração do vídeo: ${stderr}`);
            } else {
                resolve(parseFloat(stdout));
            }
        });
    });
}

/**
 * Converte um buffer de áudio PCM bruto para o formato OGG Opus usando ffmpeg.
 * @param {Buffer} pcmBuffer O buffer de áudio PCM.
 * @returns {Promise<Buffer>} Um buffer com o áudio no formato OGG.
 */
async function pcmToOgg(pcmBuffer) {
    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpeg, [
            '-f', 's16le',
            '-ar', '24000',
            '-ac', '1',
            '-i', 'pipe:0',
            '-c:a', 'libopus',
            '-b:a', '16k',
            '-vbr', 'on',
            '-f', 'ogg',
            'pipe:1'
        ]);

        let outputBuffers = [];
        ffmpegProcess.stdout.on('data', (chunk) => {
            outputBuffers.push(chunk);
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) {
                console.log("[FFMPEG] Conversão de PCM para OGG concluída.");
                resolve(Buffer.concat(outputBuffers));
            } else {
                reject(new Error(`FFMPEG falhou com o código ${code}`));
            }
        });

        ffmpegProcess.on('error', (err) => {
            reject(err);
        });

        ffmpegProcess.stdin.write(pcmBuffer);
        ffmpegProcess.stdin.end();
    });
}

module.exports = {
    sendJuliaError,
    getTextFromMsg,
    extractCommandText, // Adicionada para exportação
    convertAudioToWav,
    getVideoDuration,
    pcmToOgg // Adicionada para exportação
};
