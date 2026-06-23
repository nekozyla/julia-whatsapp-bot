const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const settingsManager = require('../managers/groupSettingsManager.js');
const systemStateManager = require('../managers/systemStateManager.js');
const groqClient = require('../managers/groqClient.js');
const { validateCode } = require('../managers/commandSandbox.js');
const chatMemoryManager = require('../managers/chatMemoryManager.js');
const groupMetadataManager = require('../managers/groupMetadataManager.js');

const BOT_NAME = process.env.BOT_NAME || 'Bot';
const AI_COMMANDS_DIR = path.join(__dirname, '../commands/ai');
const MAX_RETRIES = 3;

async function isGroupAdmin(sock, groupJid, userJid, isSuperAdmin) {
    if (isSuperAdmin) return true;
    const meta = await groupMetadataManager.getGroupMetadata(sock, groupJid);
    return !!meta?.participants?.find(participant => participant.id === userJid)?.admin;
}


const CODE_GEN_PROMPT = `Você é um gerador de comandos para um bot de WhatsApp Node.js usando a lib @whiskeysockets/baileys.

## Estrutura obrigatória de um comando

Todo comando DEVE seguir EXATAMENTE este padrão:

\`\`\`javascript
async function handleNomeCommand(sock, msg, msgDetails) {
    const { sender, args, isGroup, pushName, commandSenderJid, isSuperAdmin } = msgDetails;
    
    // Lógica do comando aqui
    // Use sock.sendMessage(sender, { text: "resposta" }, { quoted: msg }) para responder
}

module.exports = handleNomeCommand;

module.exports.commandData = {
    name: "nomecomando",
    description: "Descrição curta do comando.",
    category: "diversao",
    usage: "/nomecomando [argumentos]",
    aliases: ["/alias1", "/alias2"]
};
\`\`\`

## Parâmetros disponíveis em msgDetails:
- sender: JID do chat (grupo ou PV)
- args: array de argumentos após o comando
- isGroup: boolean se é grupo
- pushName: nome do remetente
- commandSenderJid: JID do remetente
- isSuperAdmin: boolean se é super admin
- botJid: JID do bot
- mentionedJidList: array de JIDs mencionados
- commandText: texto completo do comando
- quotedMsgInfo: mensagem citada (se houver)

## Para mencionar alguém na resposta:
await sock.sendMessage(sender, { text: "@user", mentions: [userJid] }, { quoted: msg });

## Categorias disponíveis: diversao, util, midia, admin

## Regras CRÍTICAS:
1. Responda APENAS com o código JavaScript puro. SEM markdown, SEM \`\`\`, SEM explicação.
2. O código deve ser 100% funcional e completo.
3. NÃO use require() para NENHUM módulo. NENHUM. Nem fs, nem path, nem http. ZERO requires.
4. NÃO use process, eval, Function(), fetch, exec ou spawn.
5. Você só tem acesso a: sock, msg, msgDetails, Math, Date, JSON, String, Number, Array, Object, Map, Set, RegExp, Buffer, setTimeout, console.log, Promise.
6. O nome do arquivo/comando deve ser em português e lowercase.
7. Mantenha simples e funcional.`;


async function handleIaCommand(sock, msg, msgDetails) {
    const { sender, args, isSuperAdmin, isGroup } = msgDetails;

    const subCommand = (args[0] || '').toLowerCase();

    if (subCommand === 'provedor') {
        if (!isSuperAdmin) return;

        const allowedProviders = ['groq', 'gemini', 'openai', 'openrouter'];
        const newProvider = (args[1] || '').toLowerCase();

        if (!allowedProviders.includes(newProvider)) {
            await sock.sendMessage(sender, { text: `⚠️ Provedor inválido. Use: /ia provedor <${allowedProviders.join('|')}>` }, { quoted: msg });
            return;
        }

        const success = await systemStateManager.setAiProvider(newProvider);
        if (success) {
            await sock.sendMessage(sender, { text: `✅ Provedor global de IA alterado para: *${newProvider}*` }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: `❌ Erro ao alterar provedor.` }, { quoted: msg });
        }
        return;
    }

    if (subCommand === 'personalidade') {
        if (!isSuperAdmin) return;
        
        const textToSet = args.slice(1).join(' ').trim();
        if (!textToSet) {
            await sock.sendMessage(sender, { text: `⚠️ Uso: /ia personalidade <nova personalidade>\nOu: /ia personalidade resetar` }, { quoted: msg });
            return;
        }

        if (textToSet.toLowerCase() === 'resetar') {
            await systemStateManager.setCustomPersonality(null);
            await sock.sendMessage(sender, { text: `✅ Personalidade resetada para a marrenta padrão!` }, { quoted: msg });
            return;
        }

        await systemStateManager.setCustomPersonality(textToSet);
        await sock.sendMessage(sender, { text: `✅ Personalidade atualizada com sucesso!\n\nNota: As regras de comandos e de não usar emoji ou identificadores serão preservadas e coladas no fim dessa sua personalidade automaticamente.` }, { quoted: msg });
        return;
    }

    if (subCommand === 'modelo') {
        if (!isSuperAdmin) return;
        
        const modelName = args.slice(1).join(' ').trim();
        const activeProvider = systemStateManager.getAiProvider();

        if (!modelName) {
            await sock.sendMessage(sender, { text: `⚠️ Uso: /ia modelo <nome exato do modelo>\nOu: /ia modelo resetar\n(Isso altera o modelo apenas para o provedor atual: *${activeProvider}*)` }, { quoted: msg });
            return;
        }

        if (modelName.toLowerCase() === 'resetar') {
            await systemStateManager.setCustomModel(activeProvider, null);
            await sock.sendMessage(sender, { text: `✅ Modelo do provedor *${activeProvider}* redefinido para o padrão do ambiente.` }, { quoted: msg });
            return;
        }

        await systemStateManager.setCustomModel(activeProvider, modelName);
        await sock.sendMessage(sender, { text: `✅ Provedor *${activeProvider}* passará a usar o modelo:\n*${modelName}*` }, { quoted: msg });
        return;
    }

    if (subCommand === 'on') {
        if (!isGroup) return await sock.sendMessage(sender, { text: '⚠️ Só funciona em grupos.' }, { quoted: msg });
        await settingsManager.setSetting(sender, 'aiMode', 'on');
        await sock.sendMessage(sender, { text: `🧠 *${BOT_NAME} ativada!*\n\nAgora eu respondo quando me mencionarem ou chamarem pelo nome.` }, { quoted: msg });
        return;
    }

    if (subCommand === 'off') {
        if (!isGroup) return await sock.sendMessage(sender, { text: '⚠️ Só funciona em grupos.' }, { quoted: msg });
        await settingsManager.setSetting(sender, 'aiMode', 'off');

        await sock.sendMessage(sender, { text: `💤 *${BOT_NAME} desativada.*\n\nNão vou mais responder neste grupo.` }, { quoted: msg });
        return;
    }

    // --- /ia criar <descrição> ---
    if (subCommand === 'criar') {
        if (!isSuperAdmin) return;
        const descricao = args.slice(1).join(' ').trim();
        if (!descricao) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 𝗖𝗥𝗜𝗔𝗥 ❫━━\n┃\n┃ ➢ 𝗨𝘀𝗼 › /ia criar <descrição>\n┃ ➢ 𝗘𝘅 › /ia criar comando que conta piadas\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return;
        }
        return await criarComando(sock, msg, msgDetails, descricao);
    }

    // --- /ia listar ---
    if (subCommand === 'listar' || subCommand === 'list') {
        if (!isSuperAdmin) return;
        return await listarComandos(sock, msg, sender);
    }

    // --- /ia apagar <nome> ---
    if (subCommand === 'apagar' || subCommand === 'delete' || subCommand === 'del') {
        if (!isSuperAdmin) return;
        const nome = args.slice(1).join(' ').trim();
        if (!nome) {
            await sock.sendMessage(sender, { text: '⚠️ Use: /ia apagar <nome do comando>' }, { quoted: msg });
            return;
        }
        return await apagarComando(sock, msg, sender, nome);
    }

    // --- /ia limpar ---
    if (subCommand === 'limpar' || subCommand === 'reset') {
        chatMemoryManager.clearHistory(sender);
        await sock.sendMessage(sender, { text: '🧹 Memória da conversa limpa!' }, { quoted: msg });
        return;
    }

    // --- /ia anim on/off ---
    if (subCommand === 'anim' || subCommand === 'anima' || subCommand === 'animacao') {
        if (!isGroup) return await sock.sendMessage(sender, { text: '⚠️ Só funciona em grupos.' }, { quoted: msg });
        const animState = (args[1] || '').toLowerCase();
        if (animState === 'on') {
            settingsManager.setSetting(sender, 'aiAnimation', 'on');
            await sock.sendMessage(sender, { text: '✨ *Animação de digitação ativada!*' }, { quoted: msg });
        } else if (animState === 'off') {
            settingsManager.setSetting(sender, 'aiAnimation', 'off');
            await sock.sendMessage(sender, { text: '⚡ *Animação de digitação desativada!*' }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, { text: '⚠️ Use: /ia anim [on/off]' }, { quoted: msg });
        }
        return;
    }

    // --- /ia (sem argumentos) — mostra status e help ---
    const current = isGroup ? settingsManager.getSetting(sender, 'aiMode', 'off') : 'pv';
    const statusText = current === 'on' ? '✅ Ativada' : current === 'pv' ? '💬 PV' : '❌ Desativada';
    const animStatus = isGroup ? settingsManager.getSetting(sender, 'aiAnimation', 'on') : 'on';
    const animStatusText = animStatus === 'on' ? '✅ Ativada' : '❌ Desativada';

    let text = `┏━━❪ 🧠 ${BOT_NAME.toUpperCase()} 𝗜𝗔 ❫━━\n┃\n`;
    text += `┃ ➢ 𝗦𝘁𝗮𝘁𝘂𝘀 › ${statusText}\n`;
    text += `┃ ➢ 𝗔𝗻𝗶𝗺𝗮𝗰̧𝗮̃𝗼 › ${animStatusText}\n`;
    if (isSuperAdmin) {
        text += `┃ ➢ 𝗣𝗿𝗼𝘃𝗲𝗱𝗼𝗿 › ${systemStateManager.getAiProvider()}\n`;
        const customMod = systemStateManager.getCustomModel(systemStateManager.getAiProvider());
        if (customMod) {
            text += `┃ ➢ 𝗠𝗼𝗱𝗲𝗹𝗼 › ${customMod}\n`;
        }
    }
    text += `┃\n`;
    text += `┣━━❪ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ❫━━\n┃\n`;
    text += `┃ ➢ /ia on — Ativa no grupo\n`;
    text += `┃ ➢ /ia off — Desativa no grupo\n`;
    text += `┃ ➢ /ia anim [on/off] — Digitação\n`;
    text += `┃ ➢ /ia limpar — Limpa memória\n`;


    if (isSuperAdmin) {
        text += `┃\n┣━━❪ ⚡ 𝗦𝗨𝗣𝗘𝗥 ❫━━\n┃\n`;
        text += `┃ ➢ /ia criar <desc> — Cria comando\n`;
        text += `┃ ➢ /ia listar — Lista comandos IA\n`;
        text += `┃ ➢ /ia apagar <nome> — Apaga comando\n`;
        text += `┃ ➢ /ia provedor <groq|gemini...>\n`;
        text += `┃ ➢ /ia personalidade <texto>\n`;
        text += `┃ ➢ /ia personalidade resetar\n`;
        text += `┃ ➢ /ia modelo <nome do modelo/resetar>\n`;
    }

    text += `┃\n┗━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
}


// ============= CRIAR COMANDO VIA IA =============

async function criarComando(sock, msg, msgDetails, descricao) {
    const { sender } = msgDetails;

    await sock.sendPresenceUpdate('composing', sender);
    await sock.sendMessage(sender, { text: '🧠 Gerando comando...' }, { quoted: msg });

    let code = null;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            let prompt;
            if (attempt === 1) {
                prompt = `Crie um comando de WhatsApp bot com esta descrição: "${descricao}"`;
            } else {
                prompt = `O código anterior deu este erro:\n${lastError}\n\nCorrija o código. Descrição original: "${descricao}"\n\nCódigo com erro:\n${code}`;
            }

            const response = await groqClient.rawCompletion(
                [{ role: 'user', content: prompt }],
                CODE_GEN_PROMPT
            );

            // Limpar possíveis blocos de markdown
            code = response
                .replace(/^```(?:javascript|js)?\n?/gm, '')
                .replace(/```$/gm, '')
                .trim();

            // Extrair nome do comando do código
            const nameMatch = code.match(/name:\s*["'](\w+)["']/);
            if (!nameMatch) {
                lastError = 'O código não contém commandData.name válido.';
                continue;
            }

            const cmdName = nameMatch[1].toLowerCase();

            // Verificar se conflita com comandos existentes (não-IA)
            const existingCmdPath = path.join(__dirname, `${cmdName}.js`);
            if (fs.existsSync(existingCmdPath)) {
                lastError = `O nome "${cmdName}" já é usado por um comando existente. Escolha um nome DIFERENTE.`;
                continue;
            }

            // Verificar aliases contra comandos existentes
            const aliasMatch = code.match(/aliases:\s*\[(.*?)\]/s);
            if (aliasMatch) {
                const generatedAliases = aliasMatch[1].match(/["']\/?(\w+)["']/g)?.map(a => a.replace(/["'\/]/g, '')) || [];
                const conflicting = generatedAliases.find(a => fs.existsSync(path.join(__dirname, `${a}.js`)));
                if (conflicting) {
                    lastError = `O alias "${conflicting}" conflita com um comando existente. Use aliases diferentes.`;
                    continue;
                }
            }

            const filePath = path.join(AI_COMMANDS_DIR, `${cmdName}.js`);

            // Validar segurança (sandbox)
            const validation = validateCode(code);
            if (!validation.safe) {
                lastError = `CÓDIGO INSEGURO: ${validation.reason}. NÃO use require, fs, process, exec, eval, fetch.`;
                continue;
            }

            // Salvar e verificar sintaxe
            fs.writeFileSync(filePath, code, 'utf-8');

            try {
                execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
            } catch (syntaxError) {
                lastError = syntaxError.stderr?.toString() || syntaxError.message;
                try { fs.unlinkSync(filePath); } catch (e) { }
                if (attempt < MAX_RETRIES) {
                    await sock.sendMessage(sender, { text: `⚠️ Erro na tentativa ${attempt}. Corrigindo...` }, { quoted: msg });
                }
                continue;
            }

            // Verificar module.exports
            try {
                delete require.cache[require.resolve(filePath)];
                const testModule = require(filePath);
                if (typeof testModule !== 'function') {
                    lastError = 'O module.exports principal não é uma função.';
                    try { fs.unlinkSync(filePath); } catch (e) { }
                    continue;
                }
            } catch (loadError) {
                lastError = loadError.message;
                try { fs.unlinkSync(filePath); } catch (e) { }
                continue;
            }

            // Sucesso! Recarregar comandos
            const loader = require('../loader.js');
            const newMap = loader.loadCommands();
            if (msgDetails.commandMap) {
                msgDetails.commandMap.clear();
                for (const [k, v] of newMap) msgDetails.commandMap.set(k, v);
            }

            const aliasesMatch = code.match(/aliases:\s*\[(.*?)\]/s);
            const aliasesText = aliasesMatch ? aliasesMatch[1].replace(/["']/g, '').trim() : 'nenhum';

            await sock.sendMessage(sender, {
                text: `┏━━❪ ✅ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢 𝗖𝗥𝗜𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ 𝗡𝗼𝗺𝗲 › /${cmdName}\n┃ ➢ 𝗔𝗹𝗶𝗮𝘀𝗲𝘀 › ${aliasesText}\n┃ ➢ 𝗧𝗲𝗻𝘁𝗮𝘁𝗶𝘃𝗮𝘀 › ${attempt}/${MAX_RETRIES}\n┃\n┃ O comando já está ativo!\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return;

        } catch (aiError) {
            lastError = aiError.message;
            console.error(`[IA Criar] Erro tentativa ${attempt}:`, aiError.message);
        }
    }

    await sock.sendMessage(sender, {
        text: `┏━━❪ ❌ 𝗙𝗔𝗟𝗛𝗔 ❫━━\n┃\n┃ Não consegui gerar após ${MAX_RETRIES} tentativas.\n┃\n┃ ➢ 𝗘𝗿𝗿𝗼 › ${lastError || 'Desconhecido'}\n┗━━━━━━━━━━━━━━`
    }, { quoted: msg });
}


// ============= LISTAR COMANDOS IA =============

async function listarComandos(sock, msg, sender) {
    try {
        const files = fs.readdirSync(AI_COMMANDS_DIR).filter(f => f.endsWith('.js'));
        if (files.length === 0) {
            await sock.sendMessage(sender, { text: '📂 Nenhum comando IA criado ainda.' }, { quoted: msg });
            return;
        }

        let text = `┏━━❪ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 𝗜𝗔 ❫━━\n┃\n`;
        for (const file of files) {
            const name = path.basename(file, '.js');
            text += `┃ ➢ /${name}\n`;
        }
        text += `┃\n┃ Total: ${files.length}\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(sender, { text: '❌ Erro ao listar comandos.' }, { quoted: msg });
    }
}


// ============= APAGAR COMANDO IA =============

async function apagarComando(sock, msg, sender, nome) {
    const cleanName = nome.replace(/^\//, '').toLowerCase().trim();
    const filePath = path.join(AI_COMMANDS_DIR, `${cleanName}.js`);

    if (!fs.existsSync(filePath)) {
        await sock.sendMessage(sender, { text: `❌ Comando IA "/${cleanName}" não encontrado.` }, { quoted: msg });
        return;
    }

    try {
        fs.unlinkSync(filePath);
        try { delete require.cache[require.resolve(filePath)]; } catch (e) { }

        // Recarregar comandos
        const loader = require('../loader.js');
        const newMap = loader.loadCommands();

        await sock.sendMessage(sender, { text: `✅ Comando IA "/${cleanName}" apagado.` }, { quoted: msg });
    } catch (e) {
        await sock.sendMessage(sender, { text: `❌ Erro ao apagar: ${e.message}` }, { quoted: msg });
    }
}


module.exports = handleIaCommand;

module.exports.commandData = {
    name: "ia",
    description: "Controla a IA, o Grupoverse e gerencia comandos.",
    category: "admin",
    usage: "/ia [on/off/criar/listar/apagar/limpar/provedor/personalidade/modelo]",
    aliases: Array.from(new Set([
        "/ai",
        "/julia",
        ...(BOT_NAME.toLowerCase().includes(' ') ? [] : [`/${BOT_NAME.toLowerCase()}`])
    ]))
};
