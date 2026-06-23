
const userPresetManager = require('../managers/userPresetManager.js');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

function getOptionValue(args, key) {
    const rx = new RegExp(`${key}:(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, 'i');
    const match = args.match(rx);
    return match ? (match[1] ?? match[2] ?? match[3] ?? '').trim() : null;
}

function parseColorToken(value) {
    if (!value) return null;
    const named = {
        branca: '#ffffff',
        branco: '#ffffff',
        preta: '#000000',
        preto: '#000000',
        vermelha: '#ff3b30',
        vermelho: '#ff3b30',
        azul: '#007aff',
        verde: '#34c759',
        amarela: '#ffcc00',
        amarelo: '#ffcc00'
    };

    const low = value.toLowerCase();
    if (named[low]) return named[low];
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    return null;
}

function parseBoolSwitch(args, key) {
    const raw = getOptionValue(args, key);
    if (raw !== null) {
        const low = raw.toLowerCase();
        if (['on', 'true', '1', 'sim'].includes(low)) return true;
        if (['off', 'false', '0', 'nao', 'não'].includes(low)) return false;
    }

    const tokenRegex = new RegExp(`(^|\\s)${key}(\\s|$)`, 'i');
    if (tokenRegex.test(args)) return true;
    return undefined;
}

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
- \`efeito:boom|reverso|none\`
- \`borda:#ffffff\` (ou \`borda:none\`)
- \`emoji:🔥😂\`
- \`crop:rosto\` (ou \`crop:none\`)
- \`duracao:1-10\` (ou \`duracao:off\`)
- \`inicio:0+\` (ou \`inicio:off\`)
- \`pv\` / \`pv:on\` / \`pv:off\`
- \`reply\` / \`reply:on\` / \`reply:off\`
- \`anon\` / \`anon:on\` / \`anon:off\`

*Exemplo de uso:*
\`/stickerpreset formato:quadrado pack:"Memes" autor:"Eu" borda:#ffffff crop:rosto\`
\`/stickerpreset pack:"" autor:""\` (remove pack/autor)
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

        const pack = currentPreset.pack || `(Padrão da ${BOT_NAME})`;
        const author = currentPreset.author || `(Padrão da ${BOT_NAME})`;
        const effect = currentPreset.effect || 'none';
        const border = currentPreset.borderColor || '(sem borda)';
        const crop = currentPreset.cropMode || '(sem crop)';
        const emoji = Array.isArray(currentPreset.categories) && currentPreset.categories.length > 0
            ? currentPreset.categories.join(' ')
            : '(sem emoji)';
        const duration = currentPreset.videoDuration ?? '(padrão)';
        const start = currentPreset.videoStart ?? '(padrão)';
        const pv = currentPreset.sendToPrivate ? 'on' : 'off';
        const reply = currentPreset.replyConfirmation ? 'on' : 'off';
        const anon = currentPreset.anonymous ? 'on' : 'off';

        const viewText = `*Seu Preset de Figurinhas Atual*
- Formato: \`${format}\`
- Pack: \`${pack}\`
- Autor: \`${author}\`
- Efeito: \`${effect}\`
- Borda: \`${border}\`
- Crop: \`${crop}\`
- Emoji: \`${emoji}\`
- Duração vídeo: \`${duration}\`
- Início vídeo: \`${start}\`
- PV: \`${pv}\`
- Reply: \`${reply}\`
- Anon: \`${anon}\``;
        
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

    
    const packRegex = /pack:(?:"([^"]*)"|'([^']*)')/i;
    const authorRegex = /autor:(?:"([^"]*)"|'([^']*)')/i;
    const formatRegex = /formato:(\w+)/i;

    const packMatch = argsString.match(packRegex);
    const authorMatch = argsString.match(authorRegex);
    const formatMatch = argsString.match(formatRegex);

    const newSettings = {};
    let settingsChanged = false;
    let formatError = false;

    if (packMatch) {
        const parsedPack = (packMatch[1] ?? packMatch[2] ?? '').trim();
        newSettings.pack = parsedPack === '' ? null : parsedPack;
        settingsChanged = true;
    }
    if (authorMatch) {
        const parsedAuthor = (authorMatch[1] ?? authorMatch[2] ?? '').trim();
        newSettings.author = parsedAuthor === '' ? null : parsedAuthor;
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

    const effectValue = getOptionValue(argsString, 'efeito');
    if (effectValue !== null) {
        const low = effectValue.toLowerCase();
        if (['boom'].includes(low)) {
            newSettings.effect = 'boom';
            settingsChanged = true;
        } else if (['reverso', 'reverse'].includes(low)) {
            newSettings.effect = 'reverse';
            settingsChanged = true;
        } else if (['none', 'nenhum', 'off'].includes(low)) {
            newSettings.effect = 'none';
            settingsChanged = true;
        } else {
            formatError = true;
        }
    }

    const borderValue = getOptionValue(argsString, 'borda');
    if (borderValue !== null) {
        if (borderValue === '' || /^none|off|sem$/i.test(borderValue)) {
            newSettings.borderColor = null;
            settingsChanged = true;
        } else {
            const parsedColor = parseColorToken(borderValue);
            if (parsedColor) {
                newSettings.borderColor = parsedColor;
                settingsChanged = true;
            } else {
                formatError = true;
            }
        }
    }

    const emojiValue = getOptionValue(argsString, 'emoji');
    if (emojiValue !== null) {
        newSettings.categories = emojiValue
            ? emojiValue.split(/\s+/).filter(Boolean).slice(0, 5)
            : [];
        settingsChanged = true;
    }

    const cropValue = getOptionValue(argsString, 'crop');
    if (cropValue !== null) {
        const low = cropValue.toLowerCase();
        if (low === 'rosto') {
            newSettings.cropMode = 'rosto';
            settingsChanged = true;
        } else if (['none', 'off', 'sem'].includes(low) || cropValue === '') {
            newSettings.cropMode = null;
            settingsChanged = true;
        } else {
            formatError = true;
        }
    }

    const durationValue = getOptionValue(argsString, 'duracao') ?? getOptionValue(argsString, 'duração');
    if (durationValue !== null) {
        const low = durationValue.toLowerCase();
        if (durationValue === '' || ['off', 'none'].includes(low)) {
            newSettings.videoDuration = null;
            settingsChanged = true;
        } else {
            const n = parseFloat(low.replace(',', '.'));
            if (!Number.isNaN(n)) {
                newSettings.videoDuration = Math.max(1, Math.min(10, n));
                settingsChanged = true;
            } else {
                formatError = true;
            }
        }
    }

    const startValue = getOptionValue(argsString, 'inicio') ?? getOptionValue(argsString, 'início');
    if (startValue !== null) {
        const low = startValue.toLowerCase();
        if (startValue === '' || ['off', 'none'].includes(low)) {
            newSettings.videoStart = null;
            settingsChanged = true;
        } else {
            const n = parseFloat(low.replace(',', '.'));
            if (!Number.isNaN(n)) {
                newSettings.videoStart = Math.max(0, Math.min(120, n));
                settingsChanged = true;
            } else {
                formatError = true;
            }
        }
    }

    const pvSwitch = parseBoolSwitch(argsString, 'pv');
    if (pvSwitch !== undefined) {
        newSettings.sendToPrivate = pvSwitch;
        settingsChanged = true;
    }

    const replySwitch = parseBoolSwitch(argsString, 'reply');
    if (replySwitch !== undefined) {
        newSettings.replyConfirmation = replySwitch;
        settingsChanged = true;
    }

    const anonSwitch = parseBoolSwitch(argsString, 'anon');
    if (anonSwitch !== undefined) {
        newSettings.anonymous = anonSwitch;
        settingsChanged = true;
    }
    

    if (formatError) {
        await sock.sendMessage(sender, { text: `Alguma opção está inválida. Use \`/stickerpreset\` para ver exemplos válidos.` }, { quoted: msg });
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
