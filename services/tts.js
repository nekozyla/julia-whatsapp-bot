// services/tts.js
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;

// Cria um cliente para a API
const client = new textToSpeech.TextToSpeechClient();

async function generateAudio(text) {
    console.log(`[TTS] Recebido texto para converter em áudio: "${text.substring(0, 50)}..."`);

    const request = {
        input: { text: text },
        // Selecione a voz e as configurações de idioma
        voice: {
            languageCode: 'pt-BR',
            name: 'pt-BR-Wavenet-B', // Uma voz feminina natural. Outras opções: A, C, D
            ssmlGender: 'FEMALE'
        },
        // Selecione o tipo de áudio a ser retornado
        audioConfig: {
            audioEncoding: 'OGG_OPUS', // Formato ideal para notas de voz do WhatsApp
            sampleRateHertz: 16000,
        },
    };

    try {
        const [response] = await client.synthesizeSpeech(request);
        console.log('[TTS] Áudio gerado com sucesso pela API do Google.');
        return response.audioContent; // Retorna o buffer do áudio
    } catch (error) {
        console.error('[TTS] Erro ao gerar áudio:', error);
        throw new Error('Falha ao sintetizar a fala.');
    }
}

module.exports = { generateAudio };
