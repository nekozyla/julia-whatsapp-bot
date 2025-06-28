// commands/imagine.js
// O require da ferramenta de geração de imagem é tratado pelo ambiente.

async function handleImageGenerationCommand(sock, msg, msgDetails) {
    const { command, commandText, sender, pushName } = msgDetails;

    // Garante que estamos lidando apenas com o comando !imagine
    if (command !== '!imagine') {
        return false;
    }
    console.log(`[Imagine] Comando detectado de ${pushName}.`);

    const prompt = commandText.substring(command.length).trim();

    if (!prompt) {
        console.log('[Imagine] Prompt vazio. Enviando instruções de uso.');
        await sock.sendMessage(sender, {
            text: "Para gerar uma imagem, use o comando `!imagine` seguido de uma descrição.\n\n*Exemplo:* `!imagine um cachorro surfista de óculos escuros`"
        }, { quoted: msg });
        return true;
    }

    try {
        console.log(`[Imagine] Prompt recebido: "${prompt}"`);
        await sock.sendPresenceUpdate('composing', sender);
        await sock.sendMessage(sender, { text: `Ok, ${pushName}! Gerando sua imagem para: "*${prompt}*".\n\nIsso pode levar um momento... 🎨` }, { quoted: msg });

        console.log('[Imagine] Chamando a ferramenta de geração de imagem...');
        
        // Chamada à ferramenta de geração de imagem
        // A ferramenta interna já lida com a tradução do prompt para inglês
        const imageResult = await image_generation.generate_images({
            prompts: [prompt],
            image_generation_usecase: image_generation_usecase.ALTERNATIVES, 
        });

        // Log da resposta completa da API para depuração
        console.log('[Imagine] Resposta recebida da API de imagem:', JSON.stringify(imageResult, null, 2));

        // Verificação cuidadosa do resultado
        const firstResult = imageResult?.results?.[0];
        const imageId = firstResult?.content_id;
        const generatedPromptUsed = firstResult?.generated_images?.[0]?.prompt;

        if (imageId) {
            console.log(`[Imagine] Sucesso! content_id recebido: ${imageId}`);
            
            // Envia a imagem gerada para o usuário
            await sock.sendMessage(sender, {
                image: { url: imageId }, // O content_id funciona como uma URL aqui
                caption: `Prontinho! ✨\n\n*Prompt usado pela IA:* ${generatedPromptUsed || 'N/A'}`
            }, { quoted: msg });
            console.log('[Imagine] Imagem enviada ao usuário.');

        } else {
            console.error('[Imagine] Falha ao gerar imagem. A resposta da API não continha um content_id válido.');
            await sock.sendMessage(sender, { text: "Desculpe, não consegui gerar a imagem desta vez. Tente descrever de outra forma ou com mais detalhes." }, { quoted: msg });
        }

    } catch (error) {
        console.error('[Erro fatal no comando !imagine]:', error);
        await sock.sendMessage(sender, { text: "Ocorreu um erro inesperado ao tentar gerar sua imagem. Tente novamente mais tarde." }, { quoted: msg });
    }

    return true;
}

module.exports = handleImageGenerationCommand;
