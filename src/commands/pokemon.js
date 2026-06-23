const pokemonManager = require('../managers/pokemonBattleManager');
const pokeApiService = require('../services/pokeApiPokemonService');
const { TYPE_EMOJI, TYPE_NAME_PT } = require('../services/pokeApiPokemonService');
const llmManager = require('../managers/llmManager');

// ═══════════════════════════════════════════════════════════
//  ⚡ /pokemon — Sistema de Batalhas Pokémon
// ═══════════════════════════════════════════════════════════

const POKEDEX_PER_PAGE = 15;

async function handlePokemonCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup, commandSenderJid, prefix, commandName, pushName } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const sub = args[0]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '') || '';

    try {
        await pokemonManager.ensureInitialized();

        // ══════════════════════════════════════════════
        //  📖 AJUDA / MENU PRINCIPAL
        // ══════════════════════════════════════════════
        if (!sub || sub === 'ajuda' || sub === 'help' || sub === 'menu') {
            const text = `┏━━❪ ⚡ 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗕𝗔𝗧𝗧𝗟𝗘 ❫━━
┃
┃  🎮 *Sistema de Batalhas Pokémon*
┃  _Monte seu time e lute!_
┃
┣━━❪ 📋 𝗣𝗢𝗞𝗘́𝗗𝗘𝗫 ❫━━
┃ ➢ ${prefix}${commandName} pokedex [pag]
┃ ➢ ${prefix}${commandName} info <nome>
┃ ➢ ${prefix}${commandName} tipo <tipo>
┃
┣━━❪ 🏗️ 𝗠𝗢𝗡𝗧𝗔𝗥 𝗧𝗜𝗠𝗘 ❫━━
┃ ➢ ${prefix}${commandName} novo
┃ ➢ ${prefix}${commandName} add <nome>
┃ ➢ ${prefix}${commandName} remover <slot>
┃ ➢ ${prefix}${commandName} moves <slot> <m1>, <m2>, <m3>, <m4>
┃ ➢ ${prefix}${commandName} meutime
┃ ➢ ${prefix}${commandName} pronto
┃ ➢ ${prefix}${commandName} aleatorio
┃ ➢ ${prefix}${commandName} ia <tema/pedido>
┃ ➢ ${prefix}${commandName} importar <json>
┃
┣━━❪ 🌐 𝗧𝗘𝗔𝗠 𝗕𝗨𝗜𝗟𝗗𝗘𝗥 ❫━━
┃ ➢ Monte seu time com IVs,
┃   EVs, Nature e Moveset:
┃ ➢ nekozyla.com.br/pokemon.html
┃ ➢ Copie o JSON e use importar!
┃
┣━━❪ ⚔️ 𝗕𝗔𝗧𝗔𝗟𝗛𝗔 ❫━━
┃ ➢ ${prefix}${commandName} desafiar @user
┃ ➢ ${prefix}${commandName} aceitar
┃ ➢ ${prefix}${commandName} recusar
┃ ➢ ${prefix}${commandName} atk <1-4>
┃ ➢ ${prefix}${commandName} trocar <slot>
┃ ➢ ${prefix}${commandName} golpes
┃ ➢ ${prefix}${commandName} status
┃ ➢ ${prefix}${commandName} time
┃ ➢ ${prefix}${commandName} desistir
┃
┣━━❪ ℹ️ 𝗥𝗘𝗚𝗥𝗔𝗦 ❫━━
┃ ➢ Time de até 6 Pokémon
┃ ➢ Máx 1 Lendário por time
┃ ➢ 4 golpes por Pokémon
┃ ➢ Level 50 • Turnos simultâneos
┃ ➢ Tipo, STAB, crítico e status!
┃
┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  📋 POKÉDEX — Lista paginada
        // ══════════════════════════════════════════════
        if (sub === 'pokedex' || sub === 'dex' || sub === 'lista') {
            const page = parseInt(args[1]) || 1;
            const dex = await pokeApiService.getPokedexPage(page, POKEDEX_PER_PAGE);

            let text = `┏━━❪ 📋 𝗣𝗢𝗞𝗘́𝗗𝗘𝗫 — Pág ${dex.page}/${dex.totalPages} ❫━━\n┃\n`;

            for (const p of dex.items) {
                const types = p.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
                const total = p.stats.reduce((a, b) => a + b, 0);
                const legend = p.legendary ? ' ⭐' : '';
                text += `┃ *#${String(p.id).padStart(3, '0')}* ${p.name}${legend}\n`;
                text += `┃ ${types} | Total: ${total}\n`;
            }

            text += `┃\n┃ Use: ${prefix}${commandName} pokedex <pag>\n`;
            text += `┃ Info: ${prefix}${commandName} info <nome>\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🔍 INFO — Detalhes de um Pokémon
        // ══════════════════════════════════════════════
        if (sub === 'info' || sub === 'ver' || sub === 'detalhes') {
            const query = args.slice(1).join(' ');
            if (!query) {
                await sock.sendMessage(sender, { text: `❌ Use: ${prefix}${commandName} info <nome ou número>` }, { quoted: msg });
                return true;
            }

            const pkm = await pokeApiService.findPokemon(query);
            if (!pkm) {
                await sock.sendMessage(sender, { text: `❌ Pokémon "${query}" não encontrado!` }, { quoted: msg });
                return true;
            }

            const types = pkm.types.map(t => `${TYPE_EMOJI[t]} ${TYPE_NAME_PT[t]}`).join(' / ');
            const total = pkm.stats.reduce((a, b) => a + b, 0);
            const legend = pkm.legendary ? '\n┃ ⭐ *LENDÁRIO*' : '';

            // Stat bars
            const statBar = (val, max = 255) => {
                const bars = Math.round((val / max) * 15);
                return '█'.repeat(bars) + '░'.repeat(15 - bars);
            };

            let text = `┏━━❪ ⚡ #${String(pkm.id).padStart(3, '0')} ${pkm.name.toUpperCase()} ❫━━\n`;
            text += `┃\n`;
            text += `┃ Tipo: ${types}${legend}\n`;
            text += `┃\n`;
            text += `┣━━❪ 📊 𝗦𝗧𝗔𝗧𝗦 ❫━━ (Total: ${total})\n`;
            text += `┃ ❤️ HP:    ${String(pkm.stats[0]).padStart(3)} ${statBar(pkm.stats[0])}\n`;
            text += `┃ ⚔️ ATK:   ${String(pkm.stats[1]).padStart(3)} ${statBar(pkm.stats[1])}\n`;
            text += `┃ 🛡️ DEF:   ${String(pkm.stats[2]).padStart(3)} ${statBar(pkm.stats[2])}\n`;
            text += `┃ 🌀 SpAtk: ${String(pkm.stats[3]).padStart(3)} ${statBar(pkm.stats[3])}\n`;
            text += `┃ 🔮 SpDef: ${String(pkm.stats[4]).padStart(3)} ${statBar(pkm.stats[4])}\n`;
            text += `┃ 💨 Speed: ${String(pkm.stats[5]).padStart(3)} ${statBar(pkm.stats[5])}\n`;
            text += `┃\n`;
            text += `┣━━❪ ⚡ 𝗚𝗢𝗟𝗣𝗘𝗦 𝗗𝗜𝗦𝗣𝗢𝗡𝗜́𝗩𝗘𝗜𝗦 ❫━━\n`;

            const preview = pkm.moves.slice(0, 16);
            for (const moveName of preview) {
                text += `┃ • ${moveName}\n`;
            }
            if (pkm.moves.length > preview.length) text += `┃ • ... +${pkm.moves.length - preview.length} golpes\n`;

            text += `┃\n┃ Add ao time: ${prefix}${commandName} add ${pkm.name}\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🔍 TIPO — Filtrar por tipo
        // ══════════════════════════════════════════════
        if (sub === 'tipo' || sub === 'type') {
            const typeQuery = args[1]?.toLowerCase();
            if (!typeQuery) {
                const typeList = Object.entries(TYPE_EMOJI).map(([t, e]) => `${e} ${TYPE_NAME_PT[t]}`).join('\n┃ ');
                await sock.sendMessage(sender, {
                    text: `┏━━❪ 📋 𝗧𝗜𝗣𝗢𝗦 ❫━━\n┃\n┃ ${typeList}\n┃\n┃ Use: ${prefix}${commandName} tipo <nome>\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
                return true;
            }

            const typeResult = await pokeApiService.getPokemonByType(typeQuery);
            const matchedType = typeResult.type;

            if (!matchedType) {
                await sock.sendMessage(sender, { text: `❌ Tipo "${typeQuery}" não encontrado!` }, { quoted: msg });
                return true;
            }

            const filtered = typeResult.list;
            const page = parseInt(args[2]) || 1;
            const perPage = 20;
            const totalPages = Math.ceil(filtered.length / perPage);
            const clampedPage = Math.max(1, Math.min(page, totalPages));
            const start = (clampedPage - 1) * perPage;
            const end = Math.min(start + perPage, filtered.length);

            let text = `┏━━❪ ${TYPE_EMOJI[matchedType]} 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 ${TYPE_NAME_PT[matchedType].toUpperCase()} ❫━━\n`;
            text += `┃ ${filtered.length} Pokémon | Pág ${clampedPage}/${totalPages}\n┃\n`;

            for (let i = start; i < end; i++) {
                const p = filtered[i];
                const total = p.stats.reduce((a, b) => a + b, 0);
                const legend = p.legendary ? ' ⭐' : '';
                text += `┃ #${String(p.id).padStart(3, '0')} *${p.name}*${legend} (${total})\n`;
            }

            text += `┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🏗️ NOVO TIME
        // ══════════════════════════════════════════════
        if (sub === 'novo' || sub === 'new' || sub === 'reset') {
            const result = pokemonManager.createTeam(commandSenderJid);
            let text = `┏━━❪ 🏗️ 𝗧𝗜𝗠𝗘 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 ❫━━\n┃\n`;
            text += `┃ ✅ Time criado!\n┃\n`;
            text += `┃ 1️⃣ ${prefix}${commandName} add <nome>\n`;
            text += `┃ 2️⃣ ${prefix}${commandName} moves <slot> <m1>, <m2>, <m3>, <m4>\n`;
            text += `┃ 3️⃣ ${prefix}${commandName} pronto\n`;
            text += `┃\n┃ Ou: ${prefix}${commandName} aleatorio\n`;
            text += `┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ➕ ADD POKÉMON AO TIME
        // ══════════════════════════════════════════════
        if (sub === 'add' || sub === 'adicionar') {
            const pkmName = args.slice(1).join(' ');
            if (!pkmName) {
                await sock.sendMessage(sender, {
                    text: `❌ Use: ${prefix}${commandName} add <nome do Pokémon>\nEx: ${prefix}${commandName} add Charizard`
                }, { quoted: msg });
                return true;
            }

            const result = await pokemonManager.addToTeam(commandSenderJid, pkmName);
            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            const pkm = result.pokemon;
            const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
            let text = `┏━━❪ ✅ 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 𝗔𝗗𝗗 ❫━━\n┃\n`;
            text += `┃ *${pkm.name}* (${types})\n`;
            text += `┃ HP:${pkm.stats[0]} ATK:${pkm.stats[1]} DEF:${pkm.stats[2]}\n`;
            text += `┃ SpA:${pkm.stats[3]} SpD:${pkm.stats[4]} Spe:${pkm.stats[5]}\n`;
            text += `┃\n`;
            text += `┃ Golpes disponíveis:\n`;
            text += `┃ ${pkm.moves.join(', ')}\n`;
            text += `┃\n`;

            const team = pokemonManager.getTeam(commandSenderJid);
            const slot = team.pokemon.length;
            text += `┃ 💡 Para escolher golpes:\n`;
            text += `┃ ${prefix}${commandName} moves ${slot} <m1>, <m2>, <m3>, <m4>\n`;
            text += `┃ (ou deixe em branco, será auto)\n`;
            text += `┃\n`;
            text += `┃ ${result.message}\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ❌ REMOVER DO TIME
        // ══════════════════════════════════════════════
        if (sub === 'remover' || sub === 'remove' || sub === 'rem') {
            const slot = parseInt(args[1]);
            if (!slot) {
                await sock.sendMessage(sender, { text: `❌ Use: ${prefix}${commandName} remover <slot>` }, { quoted: msg });
                return true;
            }
            const result = pokemonManager.removeFromTeam(commandSenderJid, slot);
            await sock.sendMessage(sender, { text: result.success ? `✅ ${result.message}` : `❌ ${result.message}` }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🎯 MOVES — Escolher golpes
        // ══════════════════════════════════════════════
        if (sub === 'moves' || sub === 'golpesset' || sub === 'setmoves') {
            const slot = parseInt(args[1]);
            if (!slot) {
                await sock.sendMessage(sender, {
                    text: `❌ Use: ${prefix}${commandName} moves <slot> <golpe1>, <golpe2>, <golpe3>, <golpe4>\nEx: ${prefix}${commandName} moves 1 Flamethrower, Earthquake, Dragon Claw, Swords Dance`
                }, { quoted: msg });
                return true;
            }

            const movesStr = args.slice(2).join(' ');
            const moveNames = movesStr.split(',').map(m => m.trim()).filter(m => m);

            if (moveNames.length === 0) {
                // Show available moves for this slot
                const team = pokemonManager.getTeam(commandSenderJid);
                if (!team || slot < 1 || slot > team.pokemon.length) {
                    await sock.sendMessage(sender, { text: '❌ Slot inválido.' }, { quoted: msg });
                    return true;
                }
                const pkm = team.pokemon[slot - 1];
                let text = `┏━━❪ 📋 𝗚𝗢𝗟𝗣𝗘𝗦 — ${pkm.name} ❫━━\n┃\n`;
                for (const moveName of pkm.moves) {
                    text += `┃ • ${moveName}\n`;
                }
                text += `┃\n┃ Escolha 4:\n`;
                text += `┃ ${prefix}${commandName} moves ${slot} <m1>, <m2>, <m3>, <m4>\n`;
                text += `┗━━━━━━━━━━━━━━`;
                await sock.sendMessage(sender, { text }, { quoted: msg });
                return true;
            }

            const result = await pokemonManager.setMoves(commandSenderJid, slot, moveNames);
            let reply = result.success ? `✅ ${result.message}` : `❌ ${result.message}`;
            if (result.errors) reply += `\n⚠️ Avisos: ${result.errors.join(', ')}`;
            await sock.sendMessage(sender, { text: reply }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  📋 MEU TIME
        // ══════════════════════════════════════════════
        if (sub === 'meutime' || sub === 'myteam' || sub === 'mt') {
            const team = pokemonManager.getTeam(commandSenderJid);
            if (!team || team.pokemon.length === 0) {
                await sock.sendMessage(sender, { text: `❌ Você não tem um time. Use ${prefix}${commandName} novo` }, { quoted: msg });
                return true;
            }

            const text = pokemonManager.renderTeamList(commandSenderJid);
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ✅ PRONTO — Confirmar time
        // ══════════════════════════════════════════════
        if (sub === 'pronto' || sub === 'ready' || sub === 'confirmar') {
            const result = await pokemonManager.setReady(commandSenderJid);
            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            const team = pokemonManager.getTeam(commandSenderJid);
            let text = `┏━━❪ ✅ 𝗧𝗜𝗠𝗘 𝗣𝗥𝗢𝗡𝗧𝗢 ❫━━\n┃\n`;
            team.pokemon.forEach((pkm, i) => {
                const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
                text += `┃ *${i + 1}.* ${pkm.name} (${types})\n`;
                text += `┃    ${pkm.selectedMoves.join(', ')}\n`;
            });
            text += `┃\n┃ 🎮 Desafie alguém:\n`;
            text += `┃ ${prefix}${commandName} desafiar @usuario\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🎲 ALEATÓRIO — Time random
        // ══════════════════════════════════════════════
        if (sub === 'aleatorio' || sub === 'random' || sub === 'rand') {
            const team = await pokemonManager.generateRandomTeam(commandSenderJid);
            
            let text = `┏━━❪ 🎲 𝗧𝗜𝗠𝗘 𝗔𝗟𝗘𝗔𝗧𝗢́𝗥𝗜𝗢 ❫━━\n┃\n`;
            team.pokemon.forEach((pkm, i) => {
                const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
                text += `┃ *${i + 1}.* ${pkm.name} (${types})\n`;
                text += `┃    ${pkm.selectedMoves.join(', ')}\n`;
            });
            text += `┃\n┃ ✅ Time pronto para batalha!\n`;
            text += `┃ Use: ${prefix}${commandName} desafiar @usuario\n`;
            text += `┃ Ou: ${prefix}${commandName} novo (para refazer)\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🔮 IA — Criar time com Inteligência Artificial
        // ══════════════════════════════════════════════
        if (sub === 'ia' || sub === 'criar-ia' || sub === 'time-ia') {
            const prompt = args.slice(1).join(' ').trim();
            if (!prompt) {
                await sock.sendMessage(sender, {
                    text: `❌ Use: ${prefix}${commandName} ia <tema ou pedido>\nExemplo: ${prefix}${commandName} ia um time temático de dragões super rápidos`
                }, { quoted: msg });
                return true;
            }

            // Envia reação ou mensagem de carregando
            await sock.sendMessage(sender, { text: '🔮 Julia está pensando no melhor time...' }, { quoted: msg });

            try {
                const responseText = await llmManager.chatCompletion([
                    {
                        role: 'user',
                        content: `Você é um assistente especialista em Pokémon. 
Gere um time temático de Pokémon com base neste pedido: "${prompt}".

O time DEVE ter exatamente 6 Pokémon (ou menos se o pedido for explícito, mas tente gerar 6).
Regra crítica: Máximo de 1 Pokémon lendário ou mítico no time inteiro!

Retorne a sua resposta estritamente formatada como um JSON válido que contém:
- "pokemons": uma lista de strings contendo apenas os nomes dos Pokémons sugeridos em inglês (ex: ["Charizard", "Blastoise", "Pikachu", "Snorlax", "Dragonite", "Mewtwo"]). Garanta que os nomes estejam corretos conforme a franquia oficial de Pokémon.
- "motivo": uma explicação detalhada e muito bonita em português (com emojis e boa formatação do WhatsApp) explicando o tema, a sinergia e a estratégia do time criado.

Exemplo de formato esperado:
\`\`\`json
{
  "pokemons": ["Charizard", "Venusaur", "Blastoise", "Raichu", "Alakazam", "Gengar"],
  "motivo": "*🔥 Time do Trio Inicial Kanto Clássico 💧*\\n\\nEste time foi criado com base em... (sua explicação super bacana)"
}
\`\`\`

Apenas responda com o JSON, nada mais.`
                    }
                ]);

                let cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                let parsed;
                try {
                    parsed = JSON.parse(cleaned);
                } catch (e) {
                    console.error('[Pokemon IA] Resposta não-JSON recebida:', responseText);
                    // Tentar extrair JSON usando regex se a resposta tiver texto fora do JSON
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('Não foi possível extrair um JSON válido da resposta da IA.');
                    }
                }

                if (!parsed.pokemons || !Array.isArray(parsed.pokemons) || parsed.pokemons.length === 0) {
                    await sock.sendMessage(sender, { text: '❌ A IA não conseguiu sugerir pokémons válidos.' }, { quoted: msg });
                    return true;
                }

                // Cria um time limpo para o usuário
                pokemonManager.createTeam(commandSenderJid);

                const addedList = [];
                const errors = [];

                for (const pkmName of parsed.pokemons) {
                    const addResult = await pokemonManager.addToTeam(commandSenderJid, pkmName);
                    if (addResult.success) {
                        addedList.push(addResult.pokemon);
                    } else {
                        errors.push(`${pkmName}: ${addResult.message}`);
                    }
                }

                if (addedList.length === 0) {
                    await sock.sendMessage(sender, { 
                        text: `❌ Nenhum dos Pokémon sugeridos pôde ser adicionado!\n\n⚠️ Erros:\n${errors.join('\n')}` 
                    }, { quoted: msg });
                    return true;
                }

                // Salva como pronto (o que gera os golpes automaticamente para os que não têm)
                await pokemonManager.setReady(commandSenderJid);

                // Prepara a resposta final
                let text = `🔮 𝗠𝗢𝗡𝗧𝗔𝗗𝗢 𝗖𝗢𝗠 𝗜𝗔\n\n`;
                
                // Explicação da IA
                if (parsed.motivo) {
                    text += `${parsed.motivo}\n\n`;
                }

                text += `┏━━❪ ⚡ 𝗧𝗜𝗠𝗘 𝗖𝗥𝗜𝗔𝗗𝗢 ❫━━\n┃\n`;
                
                const team = pokemonManager.getTeam(commandSenderJid);
                team.pokemon.forEach((pkm, i) => {
                    const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
                    text += `┃ *${i + 1}.* ${pkm.name} (${types})\n`;
                    text += `┃    ${pkm.selectedMoves.join(', ')}\n`;
                });

                if (errors.length > 0) {
                    text += `┃\n┃ ⚠️ Avisos/Erros:\n`;
                    errors.forEach(e => { text += `┃ • ${e}\n`; });
                }

                text += `┃\n┃ ✅ Time pronto para batalha!\n`;
                text += `┃ Use: ${prefix}${commandName} desafiar @usuario\n`;
                text += `┗━━━━━━━━━━━━━━`;

                await sock.sendMessage(sender, { text }, { quoted: msg });
                return true;

            } catch (error) {
                console.error('[Pokemon IA] Erro:', error);
                await sock.sendMessage(sender, { 
                    text: `❌ Ocorreu um erro ao processar o seu pedido com IA: ${error.message}` 
                }, { quoted: msg });
                return true;
            }
        }

        // ══════════════════════════════════════════════
        //  📥 IMPORTAR — Importar time via JSON (do site)
        // ══════════════════════════════════════════════
        if (sub === 'importar' || sub === 'import') {
            const jsonStr = args.slice(1).join(' ');
            if (!jsonStr) {
                await sock.sendMessage(sender, {
                    text: `┏━━❪ 📥 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗥 𝗧𝗜𝗠𝗘 ❫━━\n┃\n┃ Cole o JSON gerado pelo site:\n┃ ${prefix}${commandName} importar <json>\n┃\n┃ 🌐 Monte seu time em:\n┃ nekozyla.com.br/pokemon.html\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
                return true;
            }

            let teamData;
            try {
                teamData = JSON.parse(jsonStr);
            } catch (e) {
                await sock.sendMessage(sender, { text: '❌ JSON inválido! Copie o JSON completo do site.' }, { quoted: msg });
                return true;
            }

            if (!Array.isArray(teamData) || teamData.length === 0) {
                await sock.sendMessage(sender, { text: '❌ O JSON deve ser um array de Pokémon.' }, { quoted: msg });
                return true;
            }

            if (teamData.length > 6) {
                await sock.sendMessage(sender, { text: '❌ Máximo 6 Pokémon por time!' }, { quoted: msg });
                return true;
            }

            // Create a fresh team
            pokemonManager.createTeam(commandSenderJid);
            const errors = [];
            let addedCount = 0;

            for (const entry of teamData) {
                if (!entry.name) {
                    errors.push('Pokémon sem nome encontrado, pulando...');
                    continue;
                }

                // Add pokémon
                const addResult = await pokemonManager.addToTeam(commandSenderJid, entry.name);
                if (!addResult.success) {
                    errors.push(`${entry.name}: ${addResult.message}`);
                    continue;
                }
                addedCount++;

                const team = pokemonManager.getTeam(commandSenderJid);
                const slot = team.pokemon.length;
                const pkm = team.pokemon[slot - 1];

                // Set IVs if provided
                if (entry.ivs && typeof entry.ivs === 'object') {
                    pkm._ivs = {
                        hp: Math.max(0, Math.min(31, entry.ivs.hp ?? 31)),
                        atk: Math.max(0, Math.min(31, entry.ivs.atk ?? 31)),
                        def: Math.max(0, Math.min(31, entry.ivs.def ?? 31)),
                        spa: Math.max(0, Math.min(31, entry.ivs.spa ?? 31)),
                        spd: Math.max(0, Math.min(31, entry.ivs.spd ?? 31)),
                        spe: Math.max(0, Math.min(31, entry.ivs.spe ?? 31))
                    };
                }

                // Set EVs if provided
                if (entry.evs && typeof entry.evs === 'object') {
                    const evs = {};
                    let total = 0;
                    for (const stat of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
                        const v = Math.max(0, Math.min(252, entry.evs[stat] ?? 0));
                        if (total + v > 510) {
                            evs[stat] = Math.max(0, 510 - total);
                        } else {
                            evs[stat] = v;
                        }
                        total += evs[stat];
                    }
                    pkm._evs = evs;
                }

                // Set nature if provided
                if (entry.nature) {
                    pkm._nature = entry.nature;
                }

                // Set level if provided
                if (entry.level) {
                    pkm._level = Math.max(1, Math.min(100, entry.level));
                }

                // Set moves if provided
                if (entry.moves && Array.isArray(entry.moves) && entry.moves.length > 0) {
                    const moveResult = await pokemonManager.setMoves(commandSenderJid, slot, entry.moves);
                    if (!moveResult.success) {
                        errors.push(`${entry.name} golpes: ${moveResult.message}`);
                    }
                }
            }

            if (addedCount === 0) {
                await sock.sendMessage(sender, {
                    text: `❌ Nenhum Pokémon válido no JSON!\n${errors.join('\n')}`
                }, { quoted: msg });
                return true;
            }

            // Set team as ready
            const readyResult = await pokemonManager.setReady(commandSenderJid);

            const team = pokemonManager.getTeam(commandSenderJid);
            let text = `┏━━❪ 📥 𝗧𝗜𝗠𝗘 𝗜𝗠𝗣𝗢𝗥𝗧𝗔𝗗𝗢 ❫━━\n┃\n`;
            team.pokemon.forEach((pkm, i) => {
                const types = pkm.types.map(t => `${TYPE_EMOJI[t]}${TYPE_NAME_PT[t]}`).join('/');
                const nature = pkm._nature ? ` [${pkm._nature}]` : '';
                text += `┃ *${i + 1}.* ${pkm.name} (${types})${nature}\n`;
                text += `┃    ${pkm.selectedMoves.join(', ')}\n`;
            });

            if (errors.length > 0) {
                text += `┃\n┃ ⚠️ Avisos:\n`;
                errors.forEach(e => { text += `┃ • ${e}\n`; });
            }

            text += `┃\n┃ ✅ Time importado e pronto!\n`;
            text += `┃ Use: ${prefix}${commandName} desafiar @usuario\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ⚔️ DESAFIAR
        // ══════════════════════════════════════════════
        if (sub === 'desafiar' || sub === 'challenge' || sub === 'battle') {
            if (!isGroup) {
                await sock.sendMessage(sender, { text: '❌ Batalhas só em grupos!' }, { quoted: msg });
                return true;
            }

            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length === 0) {
                await sock.sendMessage(sender, { text: `❌ Mencione alguém! Ex: ${prefix}${commandName} desafiar @fulano` }, { quoted: msg });
                return true;
            }

            const targetJid = mentionedJids[0];
            const result = pokemonManager.challenge(sender, commandSenderJid, targetJid);

            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            const text = `┏━━❪ ⚔️ 𝗗𝗘𝗦𝗔𝗙𝗜𝗢 𝗣𝗢𝗞𝗘́𝗠𝗢𝗡 ❫━━\n┃\n┃ 🔴 @${commandSenderJid.split('@')[0]} desafiou\n┃ 🔵 @${targetJid.split('@')[0]} para uma batalha!\n┃\n┃ Use ${prefix}${commandName} aceitar para aceitar!\n┃ Use ${prefix}${commandName} recusar para recusar.\n┃\n┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, {
                text,
                mentions: [commandSenderJid, targetJid]
            }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ✅ ACEITAR DESAFIO
        // ══════════════════════════════════════════════
        if (sub === 'aceitar' || sub === 'accept') {
            if (!isGroup) return true;

            const result = pokemonManager.acceptChallenge(sender, commandSenderJid);
            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            const battle = result.battle;
            const [p1, p2] = battle.players;
            const pkm1 = pokemonManager.getActivePokemon(battle, p1);
            const pkm2 = pokemonManager.getActivePokemon(battle, p2);

            let text = `┏━━❪ ⚡ 𝗕𝗔𝗧𝗔𝗟𝗛𝗔 𝗜𝗡𝗜𝗖𝗜𝗔𝗗𝗔! ❫━━\n`;
            text += `┃\n`;
            text += `┃ 🔴 @${p1.split('@')[0]} ➜ *${pkm1.name}*\n`;
            text += `┃ 🔵 @${p2.split('@')[0]} ➜ *${pkm2.name}*\n`;
            text += `┃\n`;

            // Show battle status
            const statusInfo = pokemonManager.renderBattleStatus(battle);
            text += statusInfo.text + '\n\n';
            text += `┏━━❪ 📋 𝗖𝗢𝗠𝗢 𝗝𝗢𝗚𝗔𝗥 ❫━━\n`;
            text += `┃ ➢ ${prefix}${commandName} atk <1-4> — Usar golpe\n`;
            text += `┃ ➢ ${prefix}${commandName} golpes — Ver golpes\n`;
            text += `┃ ➢ ${prefix}${commandName} trocar <slot> — Trocar Pokémon\n`;
            text += `┃ ➢ ${prefix}${commandName} time — Ver seu time\n`;
            text += `┃ ➢ ${prefix}${commandName} desistir — Desistir\n`;
            text += `┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, {
                text,
                mentions: [p1, p2]
            }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ❌ RECUSAR DESAFIO
        // ══════════════════════════════════════════════
        if (sub === 'recusar' || sub === 'decline') {
            if (!isGroup) return true;
            const result = pokemonManager.declineChallenge(sender, commandSenderJid);
            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }
            await sock.sendMessage(sender, { text: '❌ Desafio recusado.' }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ⚔️ ATK — Usar golpe
        // ══════════════════════════════════════════════
        if (sub === 'atk' || sub === 'attack' || sub === 'atacar' || sub === 'usar' || sub === 'use') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                await sock.sendMessage(sender, { text: '❌ Não há batalha ativa neste grupo.' }, { quoted: msg });
                return true;
            }
            if (!battle.players.includes(commandSenderJid)) {
                await sock.sendMessage(sender, { text: '❌ Você não está nesta batalha!' }, { quoted: msg });
                return true;
            }

            const moveNum = parseInt(args[1]);
            if (!moveNum || moveNum < 1 || moveNum > 4) {
                // Show moves
                const movesText = pokemonManager.renderMoves(battle, commandSenderJid);
                await sock.sendMessage(sender, { text: movesText }, { quoted: msg });
                return true;
            }

            const result = pokemonManager.submitAction(sender, commandSenderJid, {
                type: 'move',
                moveIndex: moveNum - 1
            });

            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            if (!result.resolved) {
                await sock.sendMessage(sender, { text: result.message }, { quoted: msg });
                return true;
            }

            // Turn resolved — show results
            await sendBattleResult(sock, sender, msg, result, battle, prefix, commandName);
            return true;
        }

        // ══════════════════════════════════════════════
        //  🔄 TROCAR — Switch Pokémon
        // ══════════════════════════════════════════════
        if (sub === 'trocar' || sub === 'switch' || sub === 'sw') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                await sock.sendMessage(sender, { text: '❌ Não há batalha ativa.' }, { quoted: msg });
                return true;
            }
            if (!battle.players.includes(commandSenderJid)) {
                await sock.sendMessage(sender, { text: '❌ Você não está nesta batalha!' }, { quoted: msg });
                return true;
            }

            const slot = parseInt(args[1]);
            if (!slot) {
                // Show team with status
                const text = pokemonManager.renderTeamList(commandSenderJid, battle);
                await sock.sendMessage(sender, { text: text + `\n\nUse: ${prefix}${commandName} trocar <slot>` }, { quoted: msg });
                return true;
            }

            const result = pokemonManager.submitAction(sender, commandSenderJid, {
                type: 'switch',
                slot: slot - 1
            });

            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            if (result.switchOnly) {
                // Forced switch resolved
                let text = result.log.join('\n');
                const statusInfo = pokemonManager.renderBattleStatus(result.battle);
                text += '\n\n' + statusInfo.text;
                await sock.sendMessage(sender, { text, mentions: statusInfo.mentions }, { quoted: msg });
                return true;
            }

            if (!result.resolved) {
                await sock.sendMessage(sender, { text: result.message }, { quoted: msg });
                return true;
            }

            await sendBattleResult(sock, sender, msg, result, battle, prefix, commandName);
            return true;
        }

        // ══════════════════════════════════════════════
        //  📋 GOLPES — Ver golpes atuais
        // ══════════════════════════════════════════════
        if (sub === 'golpes' || sub === 'moves' || sub === 'moveset') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                await sock.sendMessage(sender, { text: '❌ Não há batalha ativa.' }, { quoted: msg });
                return true;
            }
            if (!battle.players.includes(commandSenderJid)) {
                await sock.sendMessage(sender, { text: '❌ Você não está nesta batalha!' }, { quoted: msg });
                return true;
            }

            const text = pokemonManager.renderMoves(battle, commandSenderJid);
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  📊 STATUS — Ver estado da batalha
        // ══════════════════════════════════════════════
        if (sub === 'status' || sub === 'estado' || sub === 'campo') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                await sock.sendMessage(sender, { text: '❌ Não há batalha ativa.' }, { quoted: msg });
                return true;
            }

            const statusInfo = pokemonManager.renderBattleStatus(battle);
            await sock.sendMessage(sender, { text: statusInfo.text, mentions: statusInfo.mentions }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  📋 TIME — Ver time na batalha
        // ══════════════════════════════════════════════
        if (sub === 'time' || sub === 'team') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                // Show builder team
                const team = pokemonManager.getTeam(commandSenderJid);
                if (!team) {
                    await sock.sendMessage(sender, { text: `Sem time. Use ${prefix}${commandName} novo` }, { quoted: msg });
                    return true;
                }
                const text = pokemonManager.renderTeamList(commandSenderJid);
                await sock.sendMessage(sender, { text }, { quoted: msg });
                return true;
            }
            if (!battle.players.includes(commandSenderJid)) {
                await sock.sendMessage(sender, { text: '❌ Você não está nesta batalha!' }, { quoted: msg });
                return true;
            }

            const text = pokemonManager.renderTeamList(commandSenderJid, battle);
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  🏳️ DESISTIR
        // ══════════════════════════════════════════════
        if (sub === 'desistir' || sub === 'forfeit' || sub === 'ff' || sub === 'surrender') {
            if (!isGroup) return true;
            const battle = pokemonManager.getBattle(sender);
            if (!battle) {
                // Also check for challenges
                const challenge = pokemonManager.challenges.get(sender);
                if (challenge && (challenge.challenger === commandSenderJid || challenge.target === commandSenderJid)) {
                    pokemonManager.declineChallenge(sender, commandSenderJid);
                    await sock.sendMessage(sender, { text: '❌ Desafio cancelado.' }, { quoted: msg });
                    return true;
                }
                await sock.sendMessage(sender, { text: '❌ Não há batalha ativa.' }, { quoted: msg });
                return true;
            }

            const result = pokemonManager.forfeit(sender, commandSenderJid);
            if (!result.success) {
                await sock.sendMessage(sender, { text: `❌ ${result.message}` }, { quoted: msg });
                return true;
            }

            const text = `┏━━❪ 🏳️ 𝗗𝗘𝗦𝗜𝗦𝗧𝗘̂𝗡𝗖𝗜𝗔 ❫━━\n┃\n┃ @${commandSenderJid.split('@')[0]} desistiu!\n┃\n┃ 🏆 Vitória de @${result.winner.split('@')[0]}!\n┃\n┗━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, {
                text,
                mentions: [commandSenderJid, result.winner]
            }, { quoted: msg });
            return true;
        }

        // ══════════════════════════════════════════════
        //  ❓ SUBCOMANDO NÃO ENCONTRADO
        // ══════════════════════════════════════════════
        await sock.sendMessage(sender, {
            text: `❌ Subcomando "${sub}" não encontrado.\nUse ${prefix}${commandName} ajuda para ver os comandos.`
        }, { quoted: msg });
        return true;

    } catch (error) {
        console.error('[Pokemon] Erro:', error);
        await sock.sendMessage(sender, {
            text: '❌ Ocorreu um erro no sistema Pokémon. Tente novamente.'
        }, { quoted: msg });
        return true;
    }
}

// ── HELPER: Send battle result after turn resolution ──
async function sendBattleResult(sock, sender, msg, result, battle, prefix, commandName) {
    let text = result.log.join('\n');

    // Winner?
    if (result.winner) {
        const loser = battle.players.find(p => p !== result.winner);
        text += `\n\n┏━━❪ 🏆 𝗩𝗜𝗧𝗢́𝗥𝗜𝗔! ❫━━\n`;
        text += `┃\n`;
        text += `┃ 🏆 @${result.winner.split('@')[0]} venceu a batalha!\n`;
        text += `┃ 💀 @${loser.split('@')[0]} foi derrotado!\n`;
        text += `┃\n┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text,
            mentions: [result.winner, loser]
        }, { quoted: msg });
        return;
    }

    // Forced switch?
    if (result.forcedSwitch && result.forcedSwitch.length > 0) {
        const switchPlayers = result.forcedSwitch;
        for (const playerJid of switchPlayers) {
            text += `\n\n⚠️ @${playerJid.split('@')[0]} precisa trocar de Pokémon!`;
            text += `\nUse: ${prefix}${commandName} trocar <slot>`;

            // Show their remaining team
            const teamList = pokemonManager.renderTeamList(playerJid, result.battle);
            text += '\n' + teamList;
        }
    }

    // Show battle status
    const statusInfo = pokemonManager.renderBattleStatus(result.battle);
    text += '\n\n' + statusInfo.text;

    await sock.sendMessage(sender, {
        text,
        mentions: [...battle.players, ...(result.forcedSwitch || [])]
    }, { quoted: msg });
}

module.exports = handlePokemonCommand;

module.exports.commandData = {
    name: "pokemon",
    description: "Sistema de batalhas Pokémon estilo Showdown!",
    category: "jogos",
    usage: "/pokemon [ajuda|pokedex|info|novo|add|moves|pronto|aleatorio|desafiar|aceitar|atk|trocar|status|desistir]",
    aliases: ["/pkm", "/pkmn", "/pokebattle", "/pokemonbattle"]
};
