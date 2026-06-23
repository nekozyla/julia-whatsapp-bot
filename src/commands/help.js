
const { formatTitle, emojis, separators } = require('../utils/theme');
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

const categoryConfig = {
    'midia': { title: '𝗠𝗘𝗗𝗜𝗔', emoji: '🎬' },
    'downloads': { title: '𝗗𝗢𝗪𝗡𝗥𝗢𝗔𝗗𝗦', emoji: '⬇️' },
    'diversao': { title: '𝗙𝗨𝗡', emoji: '🎲' },
    'jogos': { title: '𝗚𝗔𝗠𝗘𝗦', emoji: '🎮' },
    'util': { title: '𝗨𝗧𝗜𝗟𝗦', emoji: '🛠️' },
    'admin': { title: '𝗔𝗗𝗠𝗜𝗡', emoji: '👮' },
    'super': { title: '𝗦𝗨𝗣𝗘𝗥', emoji: '⚡' },
    'outros': { title: '𝗢𝗧𝗛𝗘𝗥𝗦', emoji: '📦' },
    'nsfw': { title: '𝗡𝗦𝗙𝗪', emoji: '🔞' },
    'fumo': { title: '🚬 𝗙𝗨𝗠𝗢', emoji: '🚬', hiddenFromMenu: true }
};

const categoryAliases = {
    'games': 'jogos', 'fun': 'diversao',
    'adm': 'admin', 'admins': 'admin', 'grupo': 'admin',
    'media': 'midia', 'sticker': 'midia', 'fig': 'midia',
    'utils': 'util', 'tools': 'util', 'ferramentas': 'util',
    'dono': 'super', 'dev': 'super',
    'cigarro': 'fumo', 'tabaco': 'fumo', 'beck': 'fumo', 'tabeck': 'fumo', 'fuma': 'fumo',
    'maconha': 'fumo', 'baseado': 'fumo', 'paiero': 'fumo', 'kumbaya': 'fumo', 'tabaconha': 'fumo'
};

const descriptionTranslations = {
    'Sem descrição.': 'No description.',
    'Sem descrição disponível.': 'No description available.',
    'Define seu apelido.': 'Sets your nickname.',
    'Gerenciar ou resgatar tickets de uso do bot no PV.': 'Manage or redeem private-chat bot usage tickets.',
    'Cara ou coroa.': 'Flips a coin.',
    'Registra a música do dia no Mucha Música.': 'Registers the song of the day in Mucha Musica.',
    'Reação de tomate.': 'Tomato reaction mode.',
    'Auto-sticker.': 'Auto-sticker mode.',
    'Modo de rotação diária de músicas no grupo.': 'Daily group music rotation mode.',
    'Cria meme.': 'Creates a meme.',
    'Gera imagem com Gemini local.': 'Generates an image with local Gemini.',
    'Desafia para PvP.': 'Challenges someone to PvP.',
    'Controla acesso ao PV.': 'Controls private-chat access.',
    'Assinatura por PIX com análise e ativação automática de grupo.': 'PIX subscription with review and automatic group activation.',
    'Reduz qualidade da imagem.': 'Lowers image quality.',
    'Mostra o ranking global de reputação.': 'Shows the global reputation ranking.',
    'Mostra ID do chat/usuário.': 'Shows the chat/user ID.',
    'Gera uma imagem estilo Pokopia usando o site Pixelframe.': 'Generates a Pokopia-style image using Pixelframe.',
    "Cria uma manchete de 'Fake News' com a foto do usuário.": "Creates a 'Fake News' headline with the user's photo.",
    'Resume o que rolou no grupo enquanto você estava fora.': 'Summarizes what happened in the group while you were away.',
    "Gera um cartaz de 'Procurado' com a foto do usuário.": "Generates a 'Wanted' poster with the user's photo.",
    'Resume o que você perdeu no grupo.': 'Summarizes what you missed in the group.',
    'Sincronia de grupos.': 'Group sync.',
    'Envia um GIF NSFW (+18).': 'Sends an NSFW GIF.',
    'Calcula compatibilidade.': 'Calculates compatibility.',
    'Baixa video a partir de um link.': 'Downloads video from a link.',
    'RPG Interativo com IA como Mestre de Jogo. Crie personagens, explore masmorras, lute contra monstros e bosses com narração dinâmica por IA!': 'Interactive RPG with AI as game master. Create characters, explore dungeons, fight monsters and bosses with dynamic AI narration.',
    'Baixa audio de link ou busca no YouTube.': 'Downloads audio from a link or YouTube search.',
    'Restrições de comando.': 'Command restrictions.',
    'Jogo da velha.': 'Tic-tac-toe.',
    'Envia report ao dev.': 'Sends a report to the developer.',
    'Sistema de batalhas Pokémon estilo Showdown!': 'Showdown-style Pokemon battle system.',
    'Transcreve áudio.': 'Transcribes audio.',
    'Dá reputação a alguém.': 'Gives reputation to someone.',
    'Ranking aleatório.': 'Random ranking.',
    'Renomeia pacote/autor de figurinha.': 'Renames sticker pack/author metadata.',
    'Fiscal de inatividade.': 'Inactivity checker.',
    'Remove participante do grupo (ou inicia quarentena de ghosts).': 'Removes group members or starts ghost quarantine.',
    'Converte figurinha para imagem.': 'Converts a sticker to an image.',
    'Remove fundo da imagem (Local).': 'Removes an image background locally.',
    'Big Brother Brasil — o reality show do grupo! Provas, paredão, confessionário, eliminação.': 'Big Brother Brasil for the group: challenges, eviction wall, confessional, elimination.',
    'Marca todos.': 'Mentions everyone.',
    'Dá um tapa em alguém.': 'Slaps someone.',
    'Importar/exportar figurinhas entre WhatsApp e Telegram.': 'Imports/exports stickers between WhatsApp and Telegram.',
    'Configura presets de stickers.': 'Configures sticker presets.',
    'Envia uma mensagem de teste com a foto do bot.': 'Sends a test message with the bot photo.',
    'Cria uma conquista/achievement personalizada!': 'Creates a custom achievement.',
    'Ações de roleplay com GIFs (cafuné, atacar, dançar...)': 'Roleplay actions with GIFs (head pats, attack, dance...).',
    'Promove a admin.': 'Promotes someone to admin.',
    'Verifica latência.': 'Checks latency.',
    'Encontra o significado de uma palavra.': 'Finds a word meaning.',
    'Filtro global de palavrões.': 'Global profanity filter.',
    'Avalia waifu, husbando, poder, beleza, QI e mais!': 'Rates waifu, husbando, power, beauty, IQ, and more.',
    'Dá um soco em alguém.': 'Punches someone.',
    'Piadas do tio do pavê!': 'Dad jokes.',
    'Sorteia membros.': 'Draws random members.',
    'Cria lembretes com temporizador.': 'Creates timed reminders.',
    'Cria figurinhas animadas ou estáticas (imagem/vídeo/url).': 'Creates animated or static stickers from image/video/URL.',
    'Mostra dono do nickname ou nickname da pessoa.': 'Shows who owns a nickname or a person nickname.',
    'Ativa modo AFK (Longe do Teclado).': 'Enables AFK mode.',
    'Mostra hora atual.': 'Shows the current time.',
    'Cria um anagrama embaralhando letras.': 'Creates an anagram by shuffling letters.',
    'Codifica/decodifica código Morse.': 'Encodes/decodes Morse code.',
    'Escolhe aleatoriamente entre opções.': 'Randomly chooses between options.',
    'Transforma texto em vários estilos divertidos.': 'Transforms text into fun styles.',
    'Mata alguém (em anime, claro).': 'Kills someone, anime-style.',
    'Calculadora de expressões matemáticas.': 'Math expression calculator.',
    'Pedra, papel ou tesoura contra o bot!': 'Rock, paper, scissors against the bot.',
    'Pergunte ao oráculo Vieirinha!': 'Ask the Vieirinha oracle.',
    'Cancele alguém no estilo Twitter!': 'Cancel someone Twitter-style.',
    'Registra um cigarro fumado e exibe o contador do grupo.': 'Logs a smoked cigarette and shows the group counter.',
    'Configura boas-vindas.': 'Configures welcome messages.',
    'Beija alguém.': 'Kisses someone.',
    'Mostra o menu de ajuda e comandos.': 'Shows the help and commands menu.',
    'Inicia uma votação de banimento via enquete nativa do WhatsApp.': 'Starts a ban vote using a native WhatsApp poll.',
    'Abre/fecha grupo.': 'Opens/closes the group.',
    'RPG Battle — Desafie e lute com classes e poderes!': 'RPG Battle: challenge and fight with classes and powers.',
    'Mede a aura (+/-).': 'Measures aura (+/-).',
    'Mede o nível de gado.': 'Measures simp level.',
    'Super admin se promove a admin do grupo.': 'Lets a super admin promote themselves to group admin.',
    'Aplica efeito deep fry.': 'Applies a deep-fry effect.',
    'Reenvia msg apagadas.': 'Resends deleted messages.',
    'Sistema de avisos/ban com histórico de motivos.': 'Warning/ban system with reason history.',
    'Mostra perfil completo.': 'Shows the full profile.',
    'Marca admins.': 'Mentions admins.',
    'Adiciona admin temporário.': 'Adds a temporary admin.',
    'Controla a IA, o Grupoverse e gerencia comandos.': 'Controls AI, Grupoverse, and command management.',
    'Adiciona alguém (se possível).': 'Adds someone, if possible.',
    'Cria uma citação falsa.': 'Creates a fake quote.',
    'Sistema de anúncios globais com blacklist.': 'Global announcements with blacklist.',
    'Abraça alguém.': 'Hugs someone.',
    'Corrige o JID do bot em cache.': 'Fixes the cached bot JID.',
    'Nuke no grupo.': 'Nukes the group.',
    'Teste de paternidade.': 'Paternity test.',
    'Permitir uso do bot (whitelist).': 'Allows bot usage through the whitelist.',
    'Envia mensagem para todos (pv/grupos/todos).': 'Sends a message to private chats, groups, or everyone.',
    'Ativa ou desativa comandos +18 no grupo.': 'Enables or disables NSFW commands in the group.',
    'Cria figurinha estilo Brat (Local).': 'Creates a Brat-style sticker locally.',
    'Gera uma imagem de luto com a foto da pessoa.': 'Generates a mourning image with the person photo.',
    'Rola um dado (ex: 2d6).': 'Rolls dice, for example 2d6.',
    'Gera imagem estilo capa MC com frase e assinatura.': 'Generates an MC-cover-style image with a phrase and signature.',
    'Mostra o que está ouvindo.': 'Shows what you are listening to.',
    'Remove admin.': 'Removes admin.',
    'Gera uma carta de batalha colecionável premium baseada no usuário.': 'Generates a premium collectible battle card based on the user.'
};

function translateDescription(description) {
    return descriptionTranslations[description] || description;
}

function translateUsage(usage) {
    if (!usage) return usage;
    return usage
        .replaceAll('[categoria/comando]', '[category/command]')
        .replaceAll('[categoria]', '[category]')
        .replaceAll('<descrição>', '<description>')
        .replaceAll('<código>', '<code>')
        .replaceAll('<música - artista>', '<song - artist>')
        .replaceAll('<link ou busca>', '<link or search>')
        .replaceAll('[@usuario]', '[@user]')
        .replaceAll('@usuario', '@user')
        .replaceAll('@pessoa', '@person')
        .replaceAll('[apelido]', '[nickname]')
        .replaceAll('[mensagem]', '[message]')
        .replaceAll('<mensagem>', '<message>')
        .replaceAll('<texto>', '<text>')
        .replaceAll('<pergunta>', '<question>')
        .replaceAll('<palavra>', '<word>')
        .replaceAll('<opção1>', '<option1>')
        .replaceAll('<opção2>', '<option2>')
        .replaceAll('<expressão>', '<expression>')
        .replaceAll('[alvo]', '[target]')
        .replaceAll('[motivo]', '[reason]')
        .replaceAll('[música', '[song')
        .replaceAll('[modo]', '[mode]')
        .replaceAll('<modo>', '<mode>')
        .replaceAll('[horas]', '[hours]')
        .replaceAll(' ou ', ' or ')
        .replaceAll('responda msg', 'reply to a message')
        .replaceAll('responda a uma figurinha', 'reply to a sticker');
}

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix, commandMap } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const query = args[0]?.toLowerCase();

    // 1. Extrair comandos únicos do mapa (que contém aliases)
    const uniqueCommands = new Map();

    if (commandMap) {
        for (const [key, module] of commandMap.entries()) {
            // Ignora se não tiver commandData (ex: arquivo corrompido ou incompleto)
            if (!module.commandData) continue;

            // Ignora comandos ocultos
            if (module.commandData.hidden) continue;

            // Usa o nome real do comando como chave para evitar duplicatas de aliases
            // Se o módulo já foi processado (pela chave principal ou outro alias), sobrescreve (é o mesmo obj)
            uniqueCommands.set(module.commandData.name, module.commandData);
        }
    }

    // 2. Agrupar por categoria
    const groupedCommands = {};
    for (const cmdData of uniqueCommands.values()) {
        const cat = cmdData.category || 'outros';
        if (!groupedCommands[cat]) groupedCommands[cat] = [];
        groupedCommands[cat].push({
            name: cmdData.name,
            usage: translateUsage(cmdData.usage || `/${cmdData.name}`),
            description: translateDescription(cmdData.description || 'Sem descrição.'),
            aliases: cmdData.aliases || []
        });
    }

    // 3. Exibir Menu Principal
    if (!query) {
        let text = `┏━━❪ 𝗠𝗘𝗡𝗨 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗨𝘀𝗲 › ${prefix}help <category>\n┃\n`;

        const order = ['midia', 'diversao', 'jogos', 'util', 'downloads', 'admin', 'super'];
        const existingCategories = Object.keys(groupedCommands);

        // Ordena categorias conforme preferência, depois as restantes
        const sortedCategories = [...order, ...existingCategories.filter(c => !order.includes(c))];

        text += `┣━━❪ 𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗜𝗘𝗦 ❫━━\n┃\n`;
        sortedCategories.forEach(catKey => {
            if (groupedCommands[catKey] && groupedCommands[catKey].length > 0) {
                const catInfo = categoryConfig[catKey] || { title: catKey.toUpperCase() };
                if (catInfo.hiddenFromMenu) return; // categoria oculta do menu principal
                text += `┃ ➢ ${catInfo.title} › ${groupedCommands[catKey].length}\n`;
            }
        });

        text += `┃\n┣━━❪ 𝗟𝗜𝗡𝗞𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗚𝗮𝗹𝗹𝗲𝗿𝘆 › nekozyla.com.br/themes.html\n`;
        text += `┃ ➢ 𝗧𝗵𝗲𝗺𝗲 𝗰𝗿𝗲𝗮𝘁𝗼𝗿 › https://nekozyla.com.br/criador.html\n┃\n`;
        text += `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text: text.trim()
        }, { quoted: msg });
        return true;
    }

    // 4. Exibir Categoria Específica
    const targetCategory = categoryAliases[query] || query;
    if (groupedCommands[targetCategory]) {
        const catInfo = categoryConfig[targetCategory] || { title: targetCategory.toUpperCase() };
        const commands = groupedCommands[targetCategory];

        // Ordena comandos alfabeticamente
        commands.sort((a, b) => a.name.localeCompare(b.name));

        let text = `┏━━❪ ${catInfo.title} ❫━━\n┃\n`;
        commands.forEach(c => {
            // const aliasText = c.aliases.length > 0 ? ` (${c.aliases.join(', ')})` : '';
            text += `┃ ➢ *${c.usage}*\n┃   ${c.description}\n`;
        });

        text += `┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, {
            text: text.trim()
        }, { quoted: msg });
        return true;
    }

    // 5. Exibir Detalhes de um Comando Específico
    // Procura por nome ou alias em todos os comandos únicos
    let foundCmd = null;
    for (const cmdData of uniqueCommands.values()) {
        if (cmdData.name === query || cmdData.aliases.includes(`/${query}`) || cmdData.aliases.includes(query)) {
            foundCmd = cmdData;
            break;
        }
    }

    if (foundCmd) {
        const catTitle = (categoryConfig[foundCmd.category]?.title || foundCmd.category);

        let text = `┏━━❪ 𝗗𝗘𝗧𝗔𝗜𝗟𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗖𝗼𝗺𝗺𝗮𝗻𝗱 › /${foundCmd.name}\n`;
        text += `┃ ➢ 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆 › ${catTitle}\n`;
        text += `┃ ➢ 𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻 › ${translateDescription(foundCmd.description)}\n`;
        text += `┃ ➢ 𝗨𝘀𝗮𝗴𝗲 › ${translateUsage(foundCmd.usage || '/' + foundCmd.name)}\n┃\n`;

        if (foundCmd.aliases && foundCmd.aliases.length > 0) {
            text += `┣━━❪ 𝗔𝗟𝗜𝗔𝗦𝗘𝗦 ❫━━\n┃\n`;
            text += `┃ ➢ ${foundCmd.aliases.join(', ')}\n`;
        }

        text += `┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text: text.trim()
        }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(sender, {
        text: `┏━━❪ 𝗪𝗔𝗥𝗡 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢𝗥 › Category/command not found\n┃ ➢ 𝗧𝗶𝗽 › Try ${prefix}help\n┃\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });
    return true;
}

module.exports = handleHelpCommand;

module.exports.commandData = {
    name: "help",
    description: "Shows the help and commands menu.",
    category: "util",
    usage: "/help [category/command]",
    aliases: ["/ajuda", "/comandos", "/menu", "/h"]
};
