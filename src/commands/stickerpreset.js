
const userPresetManager = require('../managers/userPresetManager.js');

const helpText = `*⚙️ Preset de Figurinhas*

Defina um padrão para todas as figurinhas que você fizer neste chat.

*Comandos:*
- \`/stickerpreset [opções]\`
  Define o seu preset.
- \`/stickerpreset view\`
  Mostra o seu preset atual.
- \`/stickerpreset clear\`
  Limpa o seu preset.

*Opções Disponíveis:*
- \`formato:quadrado\` (corta a imagem)
- \`formato:esticado\` (estica a imagem)
- \`formato:original\` (preserva o aspecto)
- \`pack:"Nome do Pack"\`
- \`autor:"Nome do Autor"\`

*Exemplo de uso:*
\`/stickerpreset formato:quadrado pack:"Memes" autor:"Eu"\`
_(Você pode definir só uma opção de cada vez, se quiser)_
`;

module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandSenderJid, commandText } = msgDetails;

    const argsString = commandText.substring('/stickerpreset'.length).trim();
    const currentPreset = userPresetManager.getPreset(sender, commandSenderJid);

    
    if (argsString.toLowerCase() === 'view') {
        
        
        const formatMap = {
            square: 'quadrado',
            stretch: 'esticado',
            original: 'original'
        };
        const format = formatMap[currentPreset.format] || 'original';
        

        const pack = currentPreset.pack || '(Padrão da Julia)';
        const author = currentPreset.author || '(Padrão da Julia)';
        
        const viewText = `*Seu Preset de Figurinhas Atual*
- Formato: \`${format}\`
- Pack: \`${pack}\`
- Autor: \`${author}\``;
        
        await sock.sendMessage(sender, { text: viewText }, { quoted: msg });
        return;
    }

    
    if (argsString.toLowerCase() === 'clear') {
        if (await userPresetManager.clearPreset(sender, commandSenderJid)) {
            await sock.sendMessage(sender, { text: "✅ Seu preset de figurinhas foi limpo." }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: "Você não tinha nenhum preset definido." }, { quoted: msg });
        }
        return;
    }

    
    const packRegex = /pack:(?:"([^"]+)"|'([^']+)')/i;
    const authorRegex = /autor:(?:"([^"]+)"|'([^']+)')/i;
    const formatRegex = /formato:(\w+)/i;

    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    const formatMatch = argsString.match(formatRegex);

    const newSettings = {};
    let settingsChanged = false;
    let formatError = false;

    if (packMatch) {
        newSettings.pack = packMatch[1] || packMatch[2] || '';
        settingsChanged = true;
    }
    if (authorMatch) {
        newSettings.author = authorMatch[1] || authorMatch[2] || '';
        settingsChanged = true;
    }
    
    // --- CORREÇÃO AQUI: Traduz o input do usuário para o nome interno ---
    if (formatMatch) {
        const formatInput = formatMatch[1].toLowerCase();
        if (formatInput === 'quadrado') {
            newSettings.format = 'square';
            settingsChanged = true;
        } else if (formatInput === 'esticado') {
            newSettings.format = 'stretch';
            settingsChanged = true;
        } else if (formatInput === 'original') {
            newSettings.format = 'original';
            settingsChanged = true;
        } else {
            formatError = true;
        }
    }
    

    if (formatError) {
        await sock.sendMessage(sender, { text: `Formato inválido. Use \`formato:quadrado\`, \`formato:esticado\` ou \`formato:original\`.` }, { quoted: msg });
        return;
    }

    if (!settingsChanged) {
        await sock.sendMessage(sender, { text: helpText }, { quoted: msg });
        return;
    }

    await userPresetManager.setPreset(sender, commandSenderJid, newSettings);
    await sock.sendMessage(sender, { text: `✅ Preset de figurinha atualizado com sucesso!` }, { quoted: msg });
};


module.exports.commandData = {
    name: "stickerpreset",
    description: "Configura presets de stickers.",
    category: "midia",
    usage: "/stickerpreset",
    aliases: ["/preset","/configsticker"]
};
