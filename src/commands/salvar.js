const path = require('path');
const fsp = require('fs').promises;
const crypto = require('crypto');

// Extrai a primeira URL do texto
function extractUrl(text) {
    if (!text || typeof text !== 'string') return null;
    const match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[0] : null;
}

// Extrai URL de uma mensagem citada (reply)
function extractUrlFromQuotedMessage(msg) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return null;

    const sources = [
        quoted.conversation,
        quoted.extendedTextMessage?.text,
        quoted.imageMessage?.caption,
        quoted.videoMessage?.caption,
        quoted.documentMessage?.caption,
    ];

    for (const text of sources) {
        const found = extractUrl(text);
        if (found) return found;
    }
    return null;
}

// Identifica a plataforma pelo URL
function detectPlatform(url) {
    if (/tiktok\.com|vm\.tiktok/i.test(url)) return 'tiktok';
    if (/instagram\.com|instagr\.am/i.test(url)) return 'instagram';
    if (/twitter\.com|x\.com|t\.co/i.test(url)) return 'twitter';
    if (/pinterest\.com|pin\.it|br\.pinterest/i.test(url)) return 'pinterest';
    return null;
}

// Resolve redirecionamentos de links curtos (vm.tiktok.com, t.co, pin.it)
async function resolveShortUrl(url) {
    try {
        const res = await fetch(url, { redirect: 'follow' });
        return res.url || url;
    } catch {
        return url;
    }
}

// ── TikTok via Tikwm ──────────────────────────────────────────────
async function downloadTikTok(url) {
    // Tikwm funciona melhor com links curtos vm.tiktok.com
    // Para links longos, tenta extrair o ID do vídeo
    const res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `url=${encodeURIComponent(url)}`
    });

    if (!res.ok) throw new Error('Tikwm retornou erro HTTP ' + res.status);

    const json = await res.json();
    if (json.code !== 0) {
        // Tenta resolver link e tentar de novo (pode ser link longo que precisa virar curto)
        const resolved = await resolveShortUrl(url);
        if (resolved !== url) {
            const res2 = await fetch('https://www.tikwm.com/api/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `url=${encodeURIComponent(resolved)}`
            });
            const json2 = await res2.json();
            if (json2.code === 0 && json2.data) {
                return formatTikwmResult(json2.data);
            }
        }
        throw new Error('Não consegui processar esse link do TikTok. Verifique se o link é válido e público.');
    }

    return formatTikwmResult(json.data);
}

function formatTikwmResult(data) {
    const result = { platform: 'tiktok', images: [], videos: [] };

    // Slideshow de fotos (carrossel)
    if (data.images && data.images.length > 0) {
        result.images = data.images.map(url => ({ url, type: 'image' }));
        result.caption = data.title || '';
    }
    // Vídeo normal
    else if (data.play) {
        result.videos.push({ url: data.play, type: 'video' });
        result.caption = data.title || '';
    }
    // Cover como fallback
    else if (data.cover) {
        result.images.push({ url: data.cover, type: 'image' });
    }

    return result;
}

// ── Pinterest via oEmbed ──────────────────────────────────────────
async function downloadPinterest(url) {
    // Resolve links curtos pin.it primeiro
    const resolved = /pin\.it/i.test(url) ? await resolveShortUrl(url) : url;

    const res = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(resolved)}`);
    if (!res.ok) throw new Error('Pinterest não reconheceu esse pin. Verifique se o link é válido.');

    const data = await res.json();
    if (!data.thumbnail_url) throw new Error('Nenhuma imagem encontrada nesse pin.');

    // Troca /236x/ por /originals/ para resolução máxima
    const originalUrl = data.thumbnail_url.replace(/\/\d+x\d*\//, '/originals/');

    // Verifica se a URL original existe
    let imageUrl = originalUrl;
    try {
        const check = await fetch(originalUrl, { method: 'HEAD' });
        if (!check.ok) imageUrl = data.thumbnail_url; // fallback para thumbnail
    } catch {
        imageUrl = data.thumbnail_url;
    }

    return {
        platform: 'pinterest',
        images: [{ url: imageUrl, type: 'image' }],
        videos: [],
        caption: data.title || ''
    };
}

// ── Twitter/X via FXTwitter ───────────────────────────────────────
async function downloadTwitter(url) {
    // Extrair o ID do tweet da URL
    const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!match) {
        // Tenta resolver link curto (t.co) primeiro
        const resolved = await resolveShortUrl(url);
        const match2 = resolved.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        if (!match2) throw new Error('Não consegui identificar o tweet. Use o link direto do post.');
        return await fetchFxTwitter(resolved);
    }
    return await fetchFxTwitter(url);
}

async function fetchFxTwitter(url) {
    // Extrai username e ID do status da URL
    const match = url.match(/(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/);
    if (!match) throw new Error('Link do Twitter/X inválido.');

    const [, username, statusId] = match;

    const res = await fetch(`https://api.fxtwitter.com/${username}/status/${statusId}`);
    if (!res.ok) throw new Error('FXTwitter não conseguiu acessar esse tweet. Pode ser privado ou excluído.');

    const data = await res.json();
    const tweet = data.tweet;
    if (!tweet) throw new Error('Tweet não encontrado.');

    const result = { platform: 'twitter', images: [], videos: [], caption: tweet.text || '' };

    // Coleta fotos e vídeos
    if (tweet.media?.photos) {
        result.images = tweet.media.photos.map(p => ({ url: p.url, type: 'image' }));
    }
    if (tweet.media?.videos) {
        result.videos = tweet.media.videos.map(v => ({ url: v.url, type: 'video' }));
    }
    // Fallback: coleta "all" se existir
    if (result.images.length === 0 && result.videos.length === 0 && tweet.media?.all) {
        for (const m of tweet.media.all) {
            if (m.type === 'photo') result.images.push({ url: m.url, type: 'image' });
            else if (m.type === 'video') result.videos.push({ url: m.url, type: 'video' });
        }
    }

    if (result.images.length === 0 && result.videos.length === 0) {
        throw new Error('Esse tweet não contém imagens ou vídeos.');
    }

    return result;
}

// ── Instagram via oEmbed + Puppeteer fallback ─────────────────────
async function downloadInstagram(url) {
    // Tenta a API oEmbed oficial do Instagram
    const oembedRes = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`);
    if (oembedRes.ok) {
        const text = await oembedRes.text();
        if (text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            if (data.thumbnail_url) {
                return {
                    platform: 'instagram',
                    images: [{ url: data.thumbnail_url, type: 'image' }],
                    videos: [],
                    caption: data.title || ''
                };
            }
        }
    }

    // Se oEmbed falhou, não há como baixar sem login
    throw new Error(
        'Não consegui acessar esse post do Instagram.\n\n' +
        '_O Instagram bloqueia downloads sem login. ' +
        'Se o post for público, tente novamente mais tarde._'
    );
}

// ── Downloader de buffer de mídia ─────────────────────────────────
async function downloadBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar mídia (HTTP ${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer;
}

// ── Função principal do comando ───────────────────────────────────
async function handleSalvarCommand(sock, msg, msgDetails) {
    const { sender, commandText, pushName } = msgDetails;
    const url = extractUrl(commandText) || extractUrlFromQuotedMessage(msg);

    if (!url) {
        await sock.sendMessage(sender, {
            text: '📥 *Como usar o /salvar*\n\n' +
                'Envie um link de rede social junto com o comando:\n' +
                '➜ `/salvar <link>`\n\n' +
                'Ou responda uma mensagem que contenha o link:\n' +
                '➜ (reply) `/salvar`\n\n' +
                '*Plataformas suportadas:*\n' +
                '• TikTok (fotos e vídeos)\n' +
                '• Pinterest\n' +
                '• Twitter / X\n' +
                '• Instagram (limitado)'
        }, { quoted: msg });
        return true;
    }

    const platform = detectPlatform(url);
    if (!platform) {
        await sock.sendMessage(sender, {
            text: '❌ Link não reconhecido.\n\n' +
                '_Plataformas suportadas: TikTok, Pinterest, Twitter/X e Instagram._'
        }, { quoted: msg });
        return true;
    }

    const platformNames = {
        tiktok: '🎵 TikTok',
        pinterest: '📌 Pinterest',
        twitter: '🐦 Twitter/X',
        instagram: '📸 Instagram'
    };

    console.log(`[Salvar] ${pushName} solicitou download de ${platform}: ${url}`);

    try {
        await sock.sendMessage(sender, {
            text: `${platformNames[platform]} Buscando mídia, aguarde...`
        }, { quoted: msg });
        await sock.sendPresenceUpdate('composing', sender);

        // Chama o downloader da plataforma correspondente
        let result;
        switch (platform) {
            case 'tiktok': result = await downloadTikTok(url); break;
            case 'pinterest': result = await downloadPinterest(url); break;
            case 'twitter': result = await downloadTwitter(url); break;
            case 'instagram': result = await downloadInstagram(url); break;
        }

        const totalMedia = result.images.length + result.videos.length;
        if (totalMedia === 0) {
            await sock.sendMessage(sender, {
                text: '😕 Nenhuma mídia encontrada nesse link.'
            }, { quoted: msg });
            return true;
        }

        console.log(`[Salvar] Encontrado: ${result.images.length} imagem(ns), ${result.videos.length} vídeo(s)`);

        // Envia imagens
        let sentCount = 0;
        for (let i = 0; i < result.images.length; i++) {
            try {
                const buffer = await downloadBuffer(result.images[i].url);

                // Limita envio a 32MB
                if (buffer.length > 32 * 1024 * 1024) {
                    console.log(`[Salvar] Imagem ${i + 1} excede 32MB, pulando.`);
                    continue;
                }

                const caption = (i === 0 && result.caption)
                    ? `📥 ${result.caption.substring(0, 500)}`
                    : '';

                await sock.sendMessage(sender, {
                    image: buffer,
                    caption: caption || (i === 0 ? `📥 Imagem ${i + 1}/${totalMedia}` : '')
                });

                sentCount++;

                // Delay entre envios para evitar flood (200ms)
                if (i < result.images.length - 1) {
                    await new Promise(r => setTimeout(r, 200));
                }
            } catch (imgError) {
                console.error(`[Salvar] Erro ao enviar imagem ${i + 1}:`, imgError.message);
            }
        }

        // Envia vídeos
        for (let i = 0; i < result.videos.length; i++) {
            try {
                const buffer = await downloadBuffer(result.videos[i].url);

                if (buffer.length > 32 * 1024 * 1024) {
                    await sock.sendMessage(sender, {
                        text: `⚠️ Vídeo ${i + 1} muito grande (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 32MB).`
                    });
                    continue;
                }

                const caption = (sentCount === 0 && i === 0 && result.caption)
                    ? `📥 ${result.caption.substring(0, 500)}`
                    : '';

                await sock.sendMessage(sender, {
                    video: buffer,
                    caption: caption || ''
                });

                sentCount++;
            } catch (vidError) {
                console.error(`[Salvar] Erro ao enviar vídeo ${i + 1}:`, vidError.message);
            }
        }

        if (sentCount === 0) {
            await sock.sendMessage(sender, {
                text: '😕 Não foi possível enviar nenhuma mídia. Os arquivos podem ser grandes demais.'
            }, { quoted: msg });
        }

    } catch (error) {
        console.error(`[Salvar] Erro:`, error);
        await sock.sendMessage(sender, {
            text: `😕 Falha no download.\n\n_${error.message}_`
        }, { quoted: msg });
    }

    return true;
}

module.exports = handleSalvarCommand;

module.exports.commandData = {
    name: "salvar",
    description: "Salva fotos e vídeos de redes sociais (TikTok, Pinterest, Twitter/X, Instagram).",
    category: "downloads",
    usage: "/salvar <link>",
    aliases: ["/save", "/download", "/dl", "/baixar"]
};
