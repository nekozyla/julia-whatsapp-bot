// commands/audio.js
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

// Função para extrair a primeira URL de um texto
function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    return urlMatch ? urlMatch[0] : null;
}

async function handleAudioCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const url = extractUrl(commandText);

    if (!url) {
        await sock.sendMessage(sender, { text: "Por favor, envie um link válido junto com o comando `!audio`." }, { quoted: msg });
        return true;
    }

    console.log(`[Audio] ${pushName} solicitou o download do áudio de: ${url}`);

    const tempDir = path.join(__dirname, '..', 'temp_downloads');
    await fsp.mkdir(tempDir, { recursive: true });
    
    const randomId = crypto.randomBytes(8).toString('hex');
    const cookiesFilePath = path.join(__dirname, '..', 'cookies.txt');
    let cookiesArgument = '';
    try {
        await fsp.access(cookiesFilePath);
        cookiesArgument = `--cookies "${cookiesFilePath}"`;
    } catch (e) {
        console.warn('[Download] Arquivo cookies.txt não encontrado.');
    }

    const outputPath = path.join(tempDir, `${randomId}.mp3`);
    const ytdlpCommand = `yt-dlp ${cookiesArgument} -x --audio-format mp3 -o "${outputPath}" "${url}"`;

    try {
        await sock.sendMessage(sender, { text: "🎵 Baixando áudio, por favor aguarde..." }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);
        console.log(`[Audio] Executando comando: ${ytdlpCommand}`);

        await new Promise((resolve, reject) => {
            exec(ytdlpCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[YTDLP Error]:', stderr);
                    if (stderr.includes('DRM')) {
                        return reject(new Error('Este conteúdo é protegido por DRM e não pode ser baixado.'));
                    }
                    return reject(new Error('Não foi possível baixar o áudio. O link pode ser privado ou inválido.'));
                }
                resolve(stdout);
            });
        });

        console.log(`[Audio] Mídia baixada com sucesso em: ${outputPath}`);
        await fsp.access(outputPath);
        const fileBuffer = await fsp.readFile(outputPath);
        
        await sock.sendMessage(sender, { audio: fileBuffer, mimetype: 'audio/mpeg' });

    } catch (error) {
        console.error("[Audio] Erro no processo de download:", error);
        await sock.sendMessage(sender, { text: `😕 Falha no download.\n\n_Motivo: ${error.message}_` }, { quoted: msg });
    } finally {
        await fsp.unlink(outputPath).catch(() => {});
    }

    return true;
}

module.exports = handleAudioCommand;
