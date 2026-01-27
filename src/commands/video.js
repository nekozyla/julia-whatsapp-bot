const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');

function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    return urlMatch ? urlMatch[0] : null;
}

async function handleVideoCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const url = extractUrl(commandText);

    if (!url) {
        await sock.sendMessage(sender, { text: "Por favor, envie um link válido junto com o comando `!video`." }, { quoted: msg });
        return true;
    }

    console.log(`[Video] ${pushName} solicitou o download do vídeo de: ${url}`);

    const tempDir = path.join(__dirname, '..', 'temp');
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

    const outputPath = path.join(tempDir, `${randomId}.mp4`);
    const ytdlpCommand = `python3.11 -m yt_dlp ${cookiesArgument} -f 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o "${outputPath}" "${url}"`;

    try {
        await sock.sendMessage(sender, { text: "🎥 Baixando vídeo, isso pode levar um momento..." }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);
        console.log(`[Video] Executando comando: ${ytdlpCommand}`);

        await new Promise((resolve, reject) => {
            exec(ytdlpCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[YTDLP Error]:', stderr);
                    return reject(new Error('Não foi possível baixar o vídeo. O link pode ser privado ou inválido.'));
                }
                resolve(stdout);
            });
        });

        console.log(`[Video] Mídia baixada com sucesso em: ${outputPath}`);
        await fsp.access(outputPath);

        const stats = await fsp.stat(outputPath);
        if (stats.size > 64 * 1024 * 1024) {
            await sock.sendMessage(sender, { text: "O vídeo foi baixado, mas é muito grande para ser enviado no WhatsApp (> 64MB). 😢" });
        } else {
            const fileBuffer = await fsp.readFile(outputPath);
            await sock.sendMessage(sender, { video: fileBuffer, caption: "✅ Vídeo baixado!" });
        }

    } catch (error) {
        console.error("[Video] Erro no processo de download:", error);
        await sock.sendMessage(sender, { text: `😕 Falha no download.\n\n_Motivo: ${error.message}_` }, { quoted: msg });
    } finally {
        await fsp.unlink(outputPath).catch(() => { });
    }

    return true;
}

module.exports = handleVideoCommand;
