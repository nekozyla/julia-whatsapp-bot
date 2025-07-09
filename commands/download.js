// commands/download.js
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils');

// Função para extrair a primeira URL e os argumentos do texto
function parseCommand(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    const url = urlMatch ? urlMatch[0] : null;
    
    // Remove a URL do texto para encontrar o argumento de formato
    const remainingText = url ? text.replace(url, '') : text;
    const args = remainingText.toLowerCase().split(' ').filter(Boolean);
    const format = args.find(arg => arg === 'audio' || arg === 'video') || null;

    return { url, format };
}

async function handleDownloadCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;

    const { url, format } = parseCommand(commandText);

    if (!url) {
        await sock.sendMessage(sender, { text: "Por favor, envie um link válido junto com o comando `!download`." }, { quoted: msg });
        return true;
    }

    console.log(`[Download] ${pushName} solicitou: URL=${url}, Formato=${format || 'auto'}`);

    const isMusicService = /spotify\.com|deezer\.com|music\.youtube\.com/.test(url);
    const isYouTube = /youtube\.com|youtu\.be/.test(url) && !isMusicService;
    
    // Se for um link de serviço de música, o formato é sempre 'audio'
    const finalFormat = isMusicService ? 'audio' : format;

    if (!finalFormat) {
        await sock.sendMessage(sender, { text: "Para links do YouTube ou de outros sites, você precisa me dizer o formato.\n\n*Exemplos:*\n`!download <link_do_yt> audio`\n`!download <link_do_yt> video`" }, { quoted: msg });
        return true;
    }

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

    let ytdlpCommand;
    let outputPath;

    try {
        if (finalFormat === 'audio') {
            outputPath = path.join(tempDir, `${randomId}.mp3`);
            await sock.sendMessage(sender, { text: "🎵 Baixando áudio, por favor aguarde..." }, { quoted: msg });
            ytdlpCommand = `yt-dlp ${cookiesArgument} -x --audio-format mp3 -o "${outputPath}" "${url}"`;
        } else { // finalFormat === 'video'
            outputPath = path.join(tempDir, `${randomId}.mp4`);
            await sock.sendMessage(sender, { text: "🎥 Baixando vídeo, isso pode levar um momento..." }, { quoted: msg });
            ytdlpCommand = `yt-dlp ${cookiesArgument} -f 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o "${outputPath}" "${url}"`;
        }
        
        await sock.sendPresenceUpdate('composing', sender);

        console.log(`[Download] Executando comando: ${ytdlpCommand}`);
        
        await new Promise((resolve, reject) => {
            exec(ytdlpCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('[YTDLP Error]:', stderr);
                    if (stderr.includes('DRM')) {
                        return reject(new Error('Este conteúdo é protegido por DRM e não pode ser baixado.'));
                    }
                    return reject(new Error('Não foi possível baixar a mídia. O link pode ser privado, inválido ou o YouTube pode estar bloqueando.'));
                }
                resolve(stdout);
            });
        });

        console.log(`[Download] Mídia baixada com sucesso em: ${outputPath}`);
        
        await fsp.access(outputPath);
        const fileBuffer = await fsp.readFile(outputPath);
        
        if (finalFormat === 'audio') {
            await sock.sendMessage(sender, { audio: fileBuffer, mimetype: 'audio/mpeg' });
        } else {
            const stats = await fsp.stat(outputPath);
            if (stats.size > 64 * 1024 * 1024) {
                 await sock.sendMessage(sender, { text: "O vídeo foi baixado, mas é muito grande para ser enviado no WhatsApp (> 64MB). 😢" });
            } else {
                await sock.sendMessage(sender, { video: fileBuffer, caption: "✅ Vídeo baixado!" });
            }
        }

    } catch (error) {
        console.error("[Download] Erro no processo de download:", error);
        await sock.sendMessage(sender, { text: `😕 Falha no download.\n\n_Motivo: ${error.message}_` }, { quoted: msg });
    } finally {
        await fsp.unlink(outputPath).catch(() => {});
    }

    return true;
}

module.exports = handleDownloadCommand;
