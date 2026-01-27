
const fs = require('fs');
const path = require('path');


const categoryConfig = {
    'midia': { title: '🎨 Mídia e Stickers', emoji: '🎨' },
    'downloads': { title: '📥 Downloads', emoji: '📥' },
    'diversao': { title: '🎉 Diversão e Interação', emoji: '🎉' },
    'util': { title: '⚙️ Utilitários', emoji: '⚙️' },
    'admin': { title: '👑 Administração', emoji: '👑' },
    'super': { title: '🔒 Super Admin', emoji: '🔒' },
    'outros': { title: '📦 Outros', emoji: '📦' }
};


const categoryAliases = {
    'jogos': 'diversao', 'fun': 'diversao',
    'adm': 'admin', 'admins': 'admin', 'grupo': 'admin',
    'media': 'midia', 'sticker': 'midia', 'fig': 'midia',
    'utils': 'util', 'ferramentas': 'util',
    'dono': 'super', 'dev': 'super'
};


const legacyHelpData = {
    'midia': [
        { cmd: '/sticker', desc: 'Cria figurinha (img/video/gif).' },
        { cmd: '/stickerpreset', desc: 'Configura presets de stickers.' },
        { cmd: '/renomear', desc: 'Renomeia pacote/autor de figurinha.' },
        { cmd: '/toimage', desc: 'Converte figurinha para imagem.' },
        { cmd: '/meme', desc: 'Cria meme.' },
        { cmd: '/brat', desc: 'Cria figurinha estilo Brat.' },
        { cmd: '/fritar', desc: 'Aplica efeito deep fry.' },
        { cmd: '/lowres', desc: 'Reduz qualidade da imagem.' },
        { cmd: '/removebg', desc: 'Remove fundo da imagem.' }
    ],
    'downloads': [
        { cmd: '/audio', desc: 'Baixa áudio (YouTube, Spotify, etc).' },
        { cmd: '/video', desc: 'Baixa vídeo (YouTube, etc).' }
    ],
    'diversao': [
        { cmd: '/casar', desc: 'Sistema de casamento.' },
        { cmd: '/adotar', desc: 'Adota um filho(a).' },
        { cmd: '/familia', desc: 'Mostra árvore genealógica.' },
        { cmd: '/combate', desc: 'Inicia combate RPG.' },
        { cmd: '/aura', desc: 'Mede a aura (+/-).' },
        { cmd: '/dado', desc: 'Rola um dado.' },
        { cmd: '/moeda', desc: 'Cara ou coroa.' },
        { cmd: '/sortear', desc: 'Sorteia membros.' },
        { cmd: '/np', desc: 'Mostra o que está ouvindo.' },
        { cmd: '/top', desc: 'Ranking aleatório.' },
        { cmd: '/shipp', desc: 'Calcula compatibilidade.' },
        { cmd: '/gado', desc: 'Mede nível de gado.' },
        { cmd: '/dna', desc: 'Teste de paternidade.' },
        { cmd: '/suicidio', desc: 'Sai do grupo.' },
        { cmd: '/lutar', desc: 'Desafia para PvP.' },
        { cmd: '/aceitarluta', desc: 'Aceita desafio PvP.' }
    ],
    'util': [
        { cmd: '/transcrever', desc: 'Transcreve áudio.' },
        { cmd: '/hora', desc: 'Mostra hora atual.' },
        { cmd: '/ping', desc: 'Verifica latência.' },
        { cmd: '/report', desc: 'Envia report ao dev.' },
    ]
};

const aliasesConfig = require('../../config/aliases.js');


const commandValues = Object.values(aliasesConfig);
const commandKeys = Object.keys(aliasesConfig);
const aliasMap = {};

commandValues.forEach((cmd, index) => {
    if (!aliasMap[cmd]) aliasMap[cmd] = [];
    aliasMap[cmd].push(commandKeys[index]);
});


if (legacyHelpData['util']) {
    legacyHelpData['util'] = legacyHelpData['util'].filter(c => c.cmd !== '/agrandejulia');
}


function loadCommandsMetadata() {
    const commandsDir = __dirname;
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js') && f !== 'help.js');
    const dynamicData = {};

    for (const file of files) {
        try {
            const filePath = path.join(commandsDir, file);

            delete require.cache[require.resolve(filePath)];
            const cmdModule = require(filePath);


            if (cmdModule.commandData) {
                const data = cmdModule.commandData;


                if (data.hidden) continue;

                const category = data.category || 'outros';

                if (!dynamicData[category]) dynamicData[category] = [];

                dynamicData[category].push({
                    cmd: data.usage || `/${data.name}`,
                    desc: data.description || 'Sem descrição.',
                    name: data.name,
                    aliases: data.aliases || []
                });
            }
        } catch (e) {
            console.error(`[Help] Erro ao ler metadados de ${file}:`, e.message);
        }
    }
    return dynamicData;
}


function findCommandMetadata(commandName, dynamicCommands) {
    const cleanName = commandName.replace(/^\//, '');

    for (const cat in dynamicCommands) {
        const cmd = dynamicCommands[cat].find(c => c.name === cleanName || c.aliases?.includes(`/${cleanName}`) || c.aliases?.includes(cleanName));
        if (cmd) return { ...cmd, category: cat };
    }


    for (const cat in legacyHelpData) {
        const cmd = legacyHelpData[cat].find(c => c.cmd.startsWith(`/${cleanName}`));
        if (cmd) return { name: cleanName, cmd: cmd.cmd, desc: cmd.desc, category: cat, isLegacy: true };
    }

    return null;
}

async function handleHelpCommand(sock, msg, msgDetails) {
    const { sender, commandText, prefix } = msgDetails;


    const args = commandText.split(' ').slice(1);
    const query = args[0]?.toLowerCase();


    const dynamicCommands = loadCommandsMetadata();


    const mergedData = { ...legacyHelpData };

    for (const [cat, cmds] of Object.entries(dynamicCommands)) {
        if (!mergedData[cat]) mergedData[cat] = [];
        cmds.forEach(newCmd => {

            const existsIndex = mergedData[cat].findIndex(c => c.cmd.split(' ')[0] === `/${newCmd.name}`);
            if (existsIndex !== -1) {
                mergedData[cat][existsIndex] = newCmd;
            } else {
                mergedData[cat].push(newCmd);
            }
        });
    }


    if (!query) {
        let text = `🤖 *Central de Ajuda da Julia* 🤖\n\n`;
        text += `Use \`${prefix}help <categoria>\` para ver listas ou \`${prefix}help <comando>\` para detalhes específicos.\n\n`;

        const order = ['midia', 'diversao', 'util', 'downloads', 'admin', 'super'];
        const existingCategories = Object.keys(mergedData);

        [...order, ...existingCategories.filter(c => !order.includes(c))].forEach(catKey => {
            if (mergedData[catKey] && mergedData[catKey].length > 0) {
                const catInfo = categoryConfig[catKey] || { title: catKey, emoji: '📂' };
                text += `> ${catInfo.emoji} *${prefix}help ${catKey}* (${mergedData[catKey].length})\n`;
            }
        });

        text += `\n💡 _Exemplo: ${prefix}help midia_`;
        await sock.sendMessage(sender, { text: text.trim() }, { quoted: msg });
        return true;
    }


    const targetCategory = categoryAliases[query] || query;
    if (mergedData[targetCategory]) {
        const catInfo = categoryConfig[targetCategory] || { title: targetCategory.toUpperCase(), emoji: '📂' };
        const commands = mergedData[targetCategory];

        let text = `*${catInfo.title}* ${catInfo.emoji}\n\n`;
        commands.forEach(c => {

            let aliases = c.aliases || [];
            if (aliases.length === 0) {
                const cmdName = c.cmd.split(' ')[0];
                if (aliasMap[cmdName]) {
                    aliases = aliasMap[cmdName];
                }
            }

            const aliasText = aliases.length > 0 ? ` (ou: ${aliases.join(', ')})` : '';



            text += `🔹 *${c.cmd}*${aliasText}\n   _${c.desc}_\n`;
        });

        text += `\n_Digite ${prefix}help <comando> para mais detalhes._`;
        await sock.sendMessage(sender, { text: text.trim() }, { quoted: msg });
        return true;
    }


    const cmdDetails = findCommandMetadata(query, dynamicCommands);
    if (cmdDetails) {
        const catEmoji = categoryConfig[cmdDetails.category]?.emoji || '🔧';

        let text = `*Detalhes do Comando* ${catEmoji}\n\n`;
        text += `📝 *Comando:* \`/${cmdDetails.name}\`\n`;
        text += `📂 *Categoria:* ${cmdDetails.category}\n`;
        text += `📄 *Descrição:* ${cmdDetails.desc}\n`;
        text += `⌨️ *Uso:* \`${cmdDetails.cmd}\`\n`;


        let aliases = cmdDetails.aliases || [];
        const cmdName = `/${cmdDetails.name}`;
        if (aliasMap[cmdName]) {

            aliasMap[cmdName].forEach(a => {
                if (!aliases.includes(a)) aliases.push(a);
            });
        }

        if (aliases && aliases.length > 0) {
            text += `🖇️ *Apelidos:* ${aliases.join(', ')}\n`;
        }

        if (cmdDetails.isLegacy) {
            text += `\n_ℹ️ Este comando ainda não foi migrado para o novo sistema de ajuda, então as informações podem ser básicas._`;
        }

        await sock.sendMessage(sender, { text: text.trim() }, { quoted: msg });
        return true;
    }


    await sock.sendMessage(sender, { text: `❌ Não encontrei a categoria ou comando "${query}". Tente \`${prefix}help\` para ver o menu.` }, { quoted: msg });
    return true;
}

module.exports = handleHelpCommand;
