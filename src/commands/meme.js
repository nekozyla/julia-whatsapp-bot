

const axios = require('axios');
const { IMGFLIP_USERNAME, IMGFLIP_PASSWORD } = require('../../config/config.js');


let memeTemplates = [];


async function loadMemeTemplates() {
    try {
        const response = await axios.get('https://api.imgflip.com/get_memes');
        if (response.data?.success) {
            memeTemplates = response.data.data.memes;
            console.log(`[Imgflip] ${memeTemplates.length} templates de memes carregados.`);
        }
    } catch (error) {
        console.error("[Imgflip] Erro ao carregar templates de memes:", error.message);
    }
}


async function createMeme(templateId, text0, text1) {
    const params = new URLSearchParams();
    params.append('template_id', templateId);
    params.append('username', IMGFLIP_USERNAME);
    params.append('password', IMGFLIP_PASSWORD);
    params.append('text0', text0);
    params.append('text1', text1);

    try {
        const response = await axios.post('https://api.imgflip.com/caption_image', params);
        if (response.data?.success) {
            return response.data.data.url;
        } else {
            console.error("[Imgflip] Erro da API ao criar meme:", response.data.error_message);
            return null;
        }
    } catch (error) {
        console.error("[Imgflip] Erro na requisição para criar meme:", error.message);
        return null;
    }
}


module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText } = msgDetails;

    if (memeTemplates.length === 0) {
        await sock.sendMessage(sender, { text: "⏳ Um momento, estou a carregar os templates de memes..." });
        await loadMemeTemplates();
    }
    
    const argsRegex = /(?:[^\s"]+|"[^"]*")+/g;
    const args = commandText.match(argsRegex) || [];
    
    args.shift(); 

    const templateIdentifier = (args[0] || '').toLowerCase();
    const text0 = (args[1] || '').replace(/"/g, '');
    const text1 = (args[2] || '').replace(/"/g, '');

    if (!templateIdentifier) {
        
        const fullMemeList = memeTemplates.map((m, index) => `*${index + 1}.* \`${m.name}\``).join('\n');
        const tutorialText = `*Gerador de Memes da Julia* 🖼️\n\nCrie um meme usando os templates mais populares!\n\n*Como usar:*\n\`/meme <número> "texto de cima" "texto de baixo"\`\n\n*Exemplo:*\n\`/meme 1 "Ninguém simplesmente" "cria um comando de meme tão rápido"\`\n\n*Lista Completa de Memes Populares:*\n${fullMemeList}`;
        await sock.sendMessage(sender, { text: tutorialText }, { quoted: msg });
        return;
    }
    
    let selectedTemplate = null;

    const templateNumber = parseInt(templateIdentifier, 10);
    if (!isNaN(templateNumber) && templateNumber > 0 && templateNumber <= memeTemplates.length) {
        selectedTemplate = memeTemplates[templateNumber - 1];
    } else {
        selectedTemplate = memeTemplates.find(m => m.name.toLowerCase().replace(/\s/g, '-') === templateIdentifier);
    }
    
    if (!selectedTemplate) {
        await sock.sendMessage(sender, { text: `😕 Template "\`${templateIdentifier}\`" não encontrado. Use \`/meme\` para ver a lista de números.` }, { quoted: msg });
        return;
    }
    
    if (!text0 && !text1) {
        await sock.sendMessage(sender, { text: "Por favor, forneça o texto para o meme entre aspas." }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

        const memeUrl = await createMeme(selectedTemplate.id, text0, text1);

        if (!memeUrl) {
            throw new Error("Não foi possível obter a URL do meme gerado.");
        }

        const response = await axios.get(memeUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(response.data);
        
        await sock.sendMessage(sender, { 
            image: imageBuffer,
            caption: `Criado com o template: ${selectedTemplate.name}`
        }, { quoted: msg });

    } catch (error) {
        console.error("[Meme Command] Erro ao gerar o meme:", error);
        await sock.sendMessage(sender, { text: "😕 Ocorreu um erro ao criar o seu meme." }, { quoted: msg });
    }
};


module.exports.commandData = {
    name: "meme",
    description: "Cria meme.",
    category: "midia",
    usage: "/meme",
    aliases: []
};
