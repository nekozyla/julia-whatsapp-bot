// speechGenerator.js
const https = require('https');
const { GEMINI_API_KEY } = require('./config');
const { pcmToOgg } = require('./utils'); // Usaremos uma nova função para converter o áudio

/**
 * Gera um áudio a partir de um texto usando a API TTS do Google.
 * @param {string} text O texto a ser convertido em fala.
 * @param {string} [voice='Kore'] O nome da voz a ser usada.
 * @returns {Promise<Buffer|null>} Um buffer com o áudio em formato OGG ou nulo em caso de falha.
 */
async function generateSpeech(text, voice = 'Autonoe') {
    if (!GEMINI_API_KEY) {
        console.error("[Speech Gen] Chave de API do Gemini não configurada.");
        return null;
    }

    if (!text || text.trim().length === 0) {
        console.error("[Speech Gen] O texto para gerar fala está vazio.");
        return null;
    }

    // O prompt é simples, apenas o texto que queremos que seja falado.
    const payload = JSON.stringify({
        contents: [{
            parts: [{ text }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    });

    // CORREÇÃO: Usar Buffer.byteLength para calcular o tamanho correto em bytes.
    const payloadByteLength = Buffer.byteLength(payload, 'utf8');

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payloadByteLength // Usa o tamanho em bytes
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const result = JSON.parse(data);
                        const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                        if (audioData) {
                            console.log("[Speech Gen] Áudio PCM recebido da API.");
                            const pcmBuffer = Buffer.from(audioData, 'base64');
                            const oggBuffer = await pcmToOgg(pcmBuffer);
                            resolve(oggBuffer);
                        } else {
                            console.error("[Speech Gen] Resposta da API não continha dados de áudio.", result);
                            resolve(null);
                        }
                    } catch (e) {
                        console.error("[Speech Gen] Erro ao processar resposta da API:", e);
                        resolve(null);
                    }
                } else {
                    console.error(`[Speech Gen] Erro na API: Status ${res.statusCode}`, data);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error("[Speech Gen] Erro na requisição para a API:", e);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

module.exports = { generateSpeech };


