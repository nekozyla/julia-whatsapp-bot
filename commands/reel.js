// commands/reel.js
const path = require('path');
const fsp = require('fs').promises;
const { exec } = require('child_process');
const crypto = require('crypto');
const { sendJuliaError } = require('../utils');
const { INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD } = require('../config');

// Função para extrair a primeira URL de um texto
function extractUrl(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const urlMatch = text.match(urlRegex);
    return urlMatch ? urlMatch[0] : null;
}

// Função para extrair o "shortcode" de um link do Instagram
function getInstagramShortcode(url) {
    const match = url.match(/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

async function handleReelCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const url = extractUrl(commandText);

    if (!url) {
        await sock.sendMessage(sender, { text: "Por favor, envie um link válido do TikTok ou Instagram Reels." }, { quoted: msg });
        return true;
    }

    const isInstagram = /instagram\.com/.test(url);
    const isTikTok = /tiktok\.com/.test(url);

    if (!isInstagram && !isTikTok) {
        await sock.sendMessage(sender, { text: "Hmm, este link não parece ser do Instagram Reels ou do TikTok." }, { quoted: msg });
        return true;
    }

    console.log(`[Reel] ${pushName} solicitou o download de: ${url}`);

    const tempDir = path.join(__dirname, '..', 'temp_downloads');
    await fsp.mkdir(tempDir, { recursive: true });
    
    let commandToExec;
    let finalFilePath; // Caminho completo do ficheiro final

    try {
        await sock.sendMessage(sender, { text: "🎥 A processar o seu link, por favor aguarde..." }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);

        if (isInstagram) {
            const shortcode = getInstagramShortcode(url);
            if (!shortcode) throw new Error("URL do Instagram inválida.");

            const randomId = crypto.randomBytes(8).toString('hex');
            const downloadFolder = path.join(tempDir, randomId);
            
            let loginArgs = '';
            if (INSTAGRAM_USERNAME && INSTAGRAM_PASSWORD) {
                loginArgs = `--login=${INSTAGRAM_USERNAME} --password=${INSTAGRAM_PASSWORD}`;
                console.log("[Reel] A usar credenciais do Instagram para o download.");
            } else {
                console.log("[Reel] A tentar descarregar do Instagram sem login.");
            }
            
            // --- CORREÇÃO: Usa a sintaxe correta para descarregar um único post ---
            const instaloaderPath = '/home/ubuntu/.local/bin/instaloader';
            commandToExec = `${instaloaderPath} ${loginArgs} --no-pictures --no-captions --no-metadata-json --no-compress-json --dirname-pattern=${downloadFolder} -- -${shortcode}`;
            
            await new Promise((resolve, reject) => {
                exec(commandToExec, async (error, stdout, stderr) => {
                    if (error) {
                        console.error('[Instaloader Error]:', stderr);
                        return reject(new Error('Não foi possível descarregar do Instagram. O post pode ser privado ou necessitar de login.'));
                    }
                    try {
                        const files = await fsp.readdir(downloadFolder);
                        const videoFile = files.find(f => f.endsWith('.mp4'));
                        if (!videoFile) return reject(new Error("Ficheiro de vídeo não encontrado após o download."));
                        
                        finalFilePath = path.join(downloadFolder, videoFile);
                        resolve(stdout);
                    } catch (readError) {
                        reject(readError);
                    }
                });
            });

        } else { // isTikTok
            const randomId = crypto.randomBytes(8).toString('hex');
            finalFilePath = path.join(tempDir, `${randomId}.mp4`);
            const cookiesFilePath = path.join(__dirname, '..', 'cookies.txt');
            let cookiesArgument = '';
            try {
                await fsp.access(cookiesFilePath);
                cookiesArgument = `--cookies "${cookiesFilePath}"`;
            } catch (e) { /* ignora */ }
            
            commandToExec = `yt-dlp ${cookiesArgument} -f 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best' -o "${finalFilePath}" "${url}"`;

            await new Promise((resolve, reject) => {
                exec(commandToExec, (error, stdout, stderr) => {
                    if (error) {
                        console.error('[YTDLP Error]:', stderr);
                        return reject(new Error('Não foi possível descarregar do TikTok.'));
                    }
                    resolve(stdout);
                });
            });
        }

        console.log(`[Reel] Mídia descarregada com sucesso em: ${finalFilePath}`);
        
        const stats = await fsp.stat(finalFilePath);
        if (stats.size > 64 * 1024 * 1024) {
            await sock.sendMessage(sender, { text: "O vídeo foi descarregado, mas é muito grande para ser enviado no WhatsApp (> 64MB). 😢" });
        } else {
            const fileBuffer = await fsp.readFile(finalFilePath);
            await sock.sendMessage(sender, { video: fileBuffer, caption: "✅ Vídeo descarregado!" });
        }

    } catch (error) {
        console.error("[Reel] Erro no processo de download:", error);
        await sendJuliaError(sock, sender, msg, error);
    } finally {
        if (finalFilePath) {
            const dirToDelete = isInstagram ? path.dirname(finalFilePath) : finalFilePath;
            await fsp.rm(dirToDelete, { recursive: true, force: true }).catch(() => {});
        }
    }

    return true;
}

module.exports = handleReelCommand;
