// ═══════════════════════════════════════════════════════════════════════════
//  🏰 /rpg — RPG Interativo com IA como Mestre de Jogo (AI Dungeon Master)
//  Feature: Aventuras dinâmicas geradas por IA com mecânicas reais de RPG
// ═══════════════════════════════════════════════════════════════════════════

const rpg = require('../managers/rpgManager');
const groqClient = require('../managers/groqClient');

// ═══════════════════════════════════════════════════════════════════════════
//  🤖 AI DUNGEON MASTER — Prompts para a IA narrar
// ═══════════════════════════════════════════════════════════════════════════

const DM_SYSTEM_PROMPT = `Você é o Mestre de um RPG de texto imersivo ambientado em um mundo de fantasia medieval sombria chamado "Eryndor". Você narra cenários, descreve ambientes, inimigos e eventos de forma épica e envolvente.

REGRAS DE NARRAÇÃO:
1. Respostas SEMPRE em português brasileiro
2. Use no MÁXIMO 6 linhas de narrativa — seja impactante e conciso
3. NUNCA decida resultados mecânicos (dano, cura, etc.) — apenas narre o que acontece com base nos resultados que receber
4. Crie atmosfera com descrições sensoriais (sons, cheiros, visual)
5. Dê personalidade aos inimigos — eles falam, provocam, imploram
6. Adapte o tom: masmorras são tenebrosas, bosses são épicos, vitórias são gloriosas
7. NUNCA use emojis na narrativa
8. Refira-se aos jogadores pelos nomes dos seus personagens
9. Use formatação WhatsApp: *negrito* para coisas importantes, _itálico_ para pensamentos/sons
10. Quando narrar combate, descreva os golpes de forma cinematográfica`;

async function aiNarrate(context, maxTokens = 300) {
    if (!groqClient.GROQ_API_KEY) return null;
    try {
        const result = await groqClient.rawCompletion(
            [{ role: 'user', content: context }],
            DM_SYSTEM_PROMPT
        );
        return result;
    } catch (e) {
        console.error('[RPG-AI] Erro na narração:', e.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  📝 FORMATAÇÃO DE MENSAGENS
// ═══════════════════════════════════════════════════════════════════════════

function hpBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    const percent = Math.round((current / max) * 100);
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty)) + ` ${current}/${max} (${percent}%)`;
}

function formatCharCard(char) {
    const stats = rpg.calculateCharStats(char);
    const cls = rpg.CLASSES[char.class];
    const race = rpg.RACES[char.race];
    const xpForNext = rpg.getXpForLevel(char.level + 1);
    const xpProgress = char.xp - rpg.getXpForLevel(char.level);
    const xpNeeded = xpForNext - rpg.getXpForLevel(char.level);

    let card = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `┃  ${cls.emoji} *${char.name}* — ${race.emoji} ${race.name} ${cls.name}\n`;
    card += `┃  Nível *${char.level}* ⬥ ${char.xp} XP (${xpProgress}/${xpNeeded})\n`;
    card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `┃  ❤️ HP: ${hpBar(char.hp, stats.maxHp)}\n`;
    card += `┃  💎 MP: ${hpBar(char.mp, stats.maxMp)}\n`;
    card += `┃  💰 Gold: *${char.gold}*G\n`;
    card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `┃  ⚔️ ATK: ${stats.atk}  🔮 MAG: ${stats.magAtk}\n`;
    card += `┃  🛡️ DEF: ${stats.def}  ✨ MDEF: ${stats.magDef}\n`;
    card += `┃  🎯 CRIT: ${(stats.critChance * 100).toFixed(1)}%\n`;
    card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `┃  FOR: ${stats.forca}  DEX: ${stats.destreza}  INT: ${stats.inteligencia}\n`;
    card += `┃  CON: ${stats.constituicao}  SAB: ${stats.sabedoria}  CAR: ${stats.carisma}\n`;
    card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Equipment
    const eq = char.equipment;
    card += `┃  🗡️ Arma: ${eq.arma ? `*${eq.arma.name}* ${rpg.RARITY_EMOJI[eq.arma.rarity]}` : '_Nenhuma_'}\n`;
    card += `┃  🛡️ Armadura: ${eq.armadura ? `*${eq.armadura.name}* ${rpg.RARITY_EMOJI[eq.armadura.rarity]}` : '_Nenhuma_'}\n`;
    card += `┃  💍 Acessório: ${eq.acessorio ? `*${eq.acessorio.name}* ${rpg.RARITY_EMOJI[eq.acessorio.rarity]}` : '_Nenhum_'}\n`;
    card += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    card += `┃  🏆 Monstros: ${char.monstersKilled} ⬥ Bosses: ${char.bossesKilled}\n`;
    card += `┃  💀 Mortes: ${char.deaths} ⬥ Andares: ${char.floorsCleared}\n`;
    card += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return card;
}

function formatCombatStatus(adventure) {
    let text = `┏━━❪ ⚔️ 𝗖𝗢𝗠𝗕𝗔𝗧𝗘 — Andar ${adventure.floor} ❫━━\n┃\n`;

    // Enemies
    text += `┃ 👹 *INIMIGOS:*\n`;
    for (const enemy of adventure.enemies) {
        if (enemy.alive) {
            text += `┃   ${enemy.emoji} ${enemy.name} — ${hpBar(enemy.hp, enemy.maxHp, 8)}\n`;
        } else {
            text += `┃   ☠️ ~~${enemy.name}~~ — DERROTADO\n`;
        }
    }

    text += `┃\n┃ 🛡️ *GRUPO:*\n`;
    for (const jid of adventure.party) {
        const char = rpg.getCharacter(jid);
        if (!char) continue;
        const stats = rpg.calculateCharStats(char);
        const cls = rpg.CLASSES[char.class];
        const status = char.hp <= 0 ? '💀 MORTO' : '';
        text += `┃   ${cls.emoji} *${char.name}* Lv.${char.level} — ❤️ ${hpBar(char.hp, stats.maxHp, 6)} ${status}\n`;
        text += `┃       💎 MP: ${char.mp}/${stats.maxMp}\n`;
    }

    // Summons
    if (adventure.summons?.length > 0) {
        text += `┃\n┃ 🦴 *INVOCAÇÕES:*\n`;
        for (const s of adventure.summons.filter(s => s.alive)) {
            text += `┃   ${s.emoji} ${s.name} — HP: ${s.hp}\n`;
        }
    }

    // Current turn
    const turn = rpg.getCurrentTurnPlayer(adventure.party[0]); // hack — we need groupJid
    text += `┃\n`;
    text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return text;
}

function formatEnemyAppear(enemies) {
    let text = '';
    for (const e of enemies) {
        const isBoss = e.type === 'boss';
        if (isBoss) {
            text += `\n⚠️ *═══ BOSS ENCONTRADO ═══* ⚠️\n\n`;
            text += `${e.emoji} *${e.name}*\n`;
            text += `❤️ HP: ${e.maxHp} ⬥ ⚔️ ATK: ${e.atk} ⬥ 🛡️ DEF: ${e.def}\n`;
        } else {
            text += `${e.emoji} *${e.name}* — HP: ${e.maxHp} ⬥ ATK: ${e.atk}\n`;
        }
    }
    return text;
}

function formatActionResults(results, skillName = null) {
    let text = '';
    for (const r of results) {
        if (r.damage !== undefined) {
            const crit = r.isCrit ? ' *CRÍTICO!*' : '';
            const kill = r.targetAlive === false ? ' ☠️ *ELIMINADO!*' : '';
            text += `  ➤ ${r.target}: *-${r.damage}* HP${crit}${kill}\n`;
            if (r.targetHp !== undefined && r.targetAlive !== false) {
                text += `     HP: ${hpBar(r.targetHp, r.targetMaxHp, 8)}\n`;
            }
        }
        if (r.healed !== undefined) {
            text += `  ➤ ${r.target || 'Aliado'}: *+${r.healed}* HP curado\n`;
        }
        if (r.buffed) {
            text += `  ➤ ${r.buffed}: Buff *${r.buff || 'Escudo'}* ativo!\n`;
        }
        if (r.shield) {
            text += `  ➤ Escudo de *${r.shield}* pontos ativado!\n`;
        }
        if (r.stunned) {
            text += `  ➤ ${r.target}: *Congelado* por ${r.stunned} turnos!\n`;
        }
        if (r.summoned) {
            text += `  ➤ *${r.summoned}* invocado com ${r.hp} HP!\n`;
        }
        if (r.partyHealed) {
            text += `  ➤ Grupo curado pela luz sagrada!\n`;
        }
        if (r.hit) {
            text += `  ➤ Hit #${r.hit} em ${r.target}: *-${r.damage}* HP${r.targetAlive === false ? ' ☠️' : ''}\n`;
        }
    }
    return text;
}

function formatEnemyResults(results) {
    let text = '';
    for (const r of results) {
        if (r.type === 'enemy_attack') {
            text += `${r.enemyEmoji} *${r.enemy}* ataca *${r.target}*: *-${r.damage}* HP\n`;
            if (r.targetHp !== undefined) {
                text += `   ❤️ ${r.target}: ${hpBar(r.targetHp, r.targetMaxHp, 8)}${!r.targetAlive ? ' 💀 *CAIU!*' : ''}\n`;
            }
        }
        if (r.type === 'drain') {
            text += `   🩸 ${r.enemy} drena *${r.healed}* HP!\n`;
        }
        if (r.type === 'poison') {
            text += `   ☠️ ${r.target} sofre *${r.damage}* de veneno!\n`;
        }
        if (r.type === 'stunned') {
            text += `❄️ ${r.enemy} está atordoado!\n`;
        }
        if (r.type === 'summon_attack') {
            text += `🦴 ${r.summon} ataca ${r.target}: *-${r.damage}* HP\n`;
        }
    }
    return text;
}

function formatVictory(rewards, adventureFloor) {
    let text = `┏━━❪ 🏆 𝗩𝗜𝗧𝗢́𝗥𝗜𝗔! ❫━━\n┃\n`;

    if (rewards.wasBoss) {
        text += `┃ ⚠️ *BOSS DERROTADO!* ⚠️\n┃\n`;
    }

    text += `┃ ✨ XP por jogador: *+${rewards.xpPerPlayer}*\n`;
    text += `┃ 💰 Gold por jogador: *+${rewards.goldPerPlayer}G*\n`;

    if (rewards.loot.length > 0) {
        text += `┃\n┃ 🎁 *Loot:*\n`;
        for (const l of rewards.loot) {
            text += `┃   ${rpg.RARITY_EMOJI[l.item.rarity]} *${l.item.name}* → ${l.recipient}\n`;
        }
    }

    if (rewards.levelUps.length > 0) {
        text += `┃\n┃ 🎉 *LEVEL UP!*\n`;
        for (const lu of rewards.levelUps) {
            text += `┃   ⬆️ *${lu.name}*: Lv.${lu.oldLevel} → Lv.*${lu.newLevel}*\n`;
        }
    }

    text += `┃\n┃ Use */rpg avancar* para ir ao andar ${adventureFloor + 1}\n`;
    text += `┃ Ou */rpg sair* para encerrar a aventura\n`;
    text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return text;
}

// ═══════════════════════════════════════════════════════════════════════════
//  🎮 HANDLER PRINCIPAL DO COMANDO /rpg
// ═══════════════════════════════════════════════════════════════════════════

async function rpgCommand(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args, isGroup, pushName } = msgDetails;
    const sub = (args[0] || '').toLowerCase();

    // Helper para enviar mensagem
    const reply = async (text) => {
        await sock.sendMessage(sender, { text }, { quoted: msg });
    };

    const replyWithMentions = async (text, mentions) => {
        await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
    };

    try {
        switch (sub) {

            // ───────────────────────────────────────────
            //  /rpg — Menu principal
            // ───────────────────────────────────────────
            case '':
            case 'help':
            case 'ajuda':
            case 'menu': {
                const char = rpg.getCharacter(commandSenderJid);
                let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `┃  🏰 *RPG INTERATIVO — AI DUNGEON*\n`;
                text += `┃  _Aventuras com IA como Mestre_\n`;
                text += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

                if (!char) {
                    text += `┃\n┃  Você ainda não tem um personagem!\n`;
                    text += `┃  Use */rpg criar* para começar\n┃\n`;
                }

                text += `┃  📖 *PERSONAGEM*\n`;
                text += `┃  /rpg criar — Criar personagem\n`;
                text += `┃  /rpg status — Ver ficha completa\n`;
                text += `┃  /rpg skills — Ver habilidades\n`;
                text += `┃  /rpg inventario — Ver inventário\n`;
                text += `┃  /rpg equipar <item> — Equipar item\n`;
                text += `┃  /rpg usar <item> — Usar consumível\n`;
                text += `┃  /rpg descansar — Restaurar HP/MP\n`;
                text += `┃\n┃  ⚔️ *AVENTURA*\n`;
                text += `┃  /rpg aventura — Criar aventura\n`;
                text += `┃  /rpg entrar — Entrar na aventura\n`;
                text += `┃  /rpg iniciar — Iniciar aventura\n`;
                text += `┃  /rpg explorar — Explorar o andar\n`;
                text += `┃  /rpg avancar — Próximo andar\n`;
                text += `┃  /rpg sair — Encerrar aventura\n`;
                text += `┃\n┃  ⚔️ *COMBATE*\n`;
                text += `┃  /rpg atacar — Ataque básico\n`;
                text += `┃  /rpg habilidade <nome> — Usar skill\n`;
                text += `┃  /rpg defender — Postura defensiva\n`;
                text += `┃  /rpg fugir — Tentar fugir\n`;
                text += `┃  /rpg item <nome> — Usar item em combate\n`;
                text += `┃\n┃  🛒 *LOJA*\n`;
                text += `┃  /rpg loja — Ver itens à venda\n`;
                text += `┃  /rpg comprar <item> — Comprar item\n`;
                text += `┃  /rpg vender <item> — Vender item\n`;
                text += `┃\n┃  📊 *RANKING*\n`;
                text += `┃  /rpg ranking — Top jogadores\n`;
                text += `┃  /rpg classes — Ver classes disponíveis\n`;
                text += `┃  /rpg racas — Ver raças disponíveis\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg classes
            // ───────────────────────────────────────────
            case 'classes':
            case 'classe': {
                let text = `┏━━❪ 📖 𝗖𝗟𝗔𝗦𝗦𝗘𝗦 ❫━━\n┃\n`;
                for (const [id, cls] of Object.entries(rpg.CLASSES)) {
                    text += `┃ ${cls.emoji} *${cls.name}* _(${id})_\n`;
                    text += `┃   ${cls.description}\n`;
                    text += `┃   FOR:${cls.baseStats.forca} DEX:${cls.baseStats.destreza} INT:${cls.baseStats.inteligencia} CON:${cls.baseStats.constituicao}\n`;
                    text += `┃   Habilidades: ${cls.skills.length}\n┃\n`;
                }
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `\nUse */rpg criar <nome> <classe> <raça>*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg racas
            // ───────────────────────────────────────────
            case 'racas':
            case 'raças':
            case 'raca':
            case 'raça': {
                let text = `┏━━❪ 📖 𝗥𝗔𝗖̧𝗔𝗦 ❫━━\n┃\n`;
                for (const [id, race] of Object.entries(rpg.RACES)) {
                    text += `┃ ${race.emoji} *${race.name}* _(${id})_\n`;
                    text += `┃   ${race.description}\n┃\n`;
                }
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `\nUse */rpg criar <nome> <classe> <raça>*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg criar <nome> <classe> <raça>
            // ───────────────────────────────────────────
            case 'criar':
            case 'create':
            case 'novo': {
                if (args.length < 4) {
                    let text = `🏰 *Criação de Personagem*\n\n`;
                    text += `Uso: */rpg criar <nome> <classe> <raça>*\n\n`;
                    text += `*Classes:* ${Object.values(rpg.CLASSES).map(c => `${c.emoji} ${c.name}`).join(', ')}\n`;
                    text += `*Raças:* ${Object.values(rpg.RACES).map(r => `${r.emoji} ${r.name}`).join(', ')}\n\n`;
                    text += `Exemplo: */rpg criar Aldric guerreiro humano*\n`;
                    text += `\nUse */rpg classes* ou */rpg racas* para detalhes`;
                    await reply(text);
                    return;
                }

                const name = args[1];
                const className = args[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const raceName = args[3].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                // Map common variations
                const classMap = {
                    'guerreiro': 'guerreiro', 'warrior': 'guerreiro', 'tank': 'guerreiro',
                    'mago': 'mago', 'mage': 'mago', 'wizard': 'mago',
                    'arqueiro': 'arqueiro', 'archer': 'arqueiro', 'ranger': 'arqueiro',
                    'ladino': 'ladino', 'rogue': 'ladino', 'assassino': 'ladino',
                    'clerigo': 'clerigo', 'cleric': 'clerigo', 'healer': 'clerigo', 'padre': 'clerigo',
                    'necromante': 'necromante', 'necro': 'necromante', 'necromancer': 'necromante',
                };
                const raceMap = {
                    'humano': 'humano', 'human': 'humano',
                    'elfo': 'elfo', 'elf': 'elfo',
                    'anao': 'anao', 'dwarf': 'anao',
                    'orc': 'orc',
                    'draconato': 'draconato', 'dragonborn': 'draconato', 'dragao': 'draconato',
                    'elfonegro': 'elfoNegro', 'drow': 'elfoNegro', 'elfo negro': 'elfoNegro', 'elfo_negro': 'elfoNegro',
                };

                const resolvedClass = classMap[className];
                const resolvedRace = raceMap[raceName];

                if (!resolvedClass) {
                    await reply(`❌ Classe "${args[2]}" não encontrada.\nClasses: ${Object.keys(classMap).filter((v,i,a) => a.indexOf(v) === i).join(', ')}`);
                    return;
                }
                if (!resolvedRace) {
                    await reply(`❌ Raça "${args[3]}" não encontrada.\nRaças: ${Object.keys(raceMap).filter((v,i,a) => a.indexOf(v) === i).join(', ')}`);
                    return;
                }

                const result = rpg.createCharacter(commandSenderJid, name, resolvedClass, resolvedRace);
                if (!result.success) {
                    await reply(`❌ ${result.message}`);
                    return;
                }

                const char = result.character;
                const cls = rpg.CLASSES[resolvedClass];
                const race = rpg.RACES[resolvedRace];

                // AI narration for character creation
                const narration = await aiNarrate(
                    `Narre a entrada de um novo aventureiro no mundo de Eryndor. Nome: "${char.name}", classe: "${cls.name}", raça: "${race.name}". Seja épico e misterioso. Máximo 4 linhas.`
                );

                let text = `┏━━❪ 🏰 𝗛𝗘𝗥𝗢́𝗜 𝗖𝗥𝗜𝗔𝗗𝗢 ❫━━\n┃\n`;
                text += `┃ ${cls.emoji} *${char.name}*\n`;
                text += `┃ ${race.emoji} ${race.name} ${cls.name} — Nível 1\n`;
                text += `┃\n`;
                text += `┃ ❤️ HP: ${char.hp}  💎 MP: ${char.mp}  💰 ${char.gold}G\n`;
                text += `┃\n`;

                // Starting skills
                const startSkills = rpg.getAvailableSkills(char);
                if (startSkills.length > 0) {
                    text += `┃ 🔥 Habilidade inicial: *${startSkills[0].name}*\n`;
                    text += `┃   _${startSkills[0].desc}_\n┃\n`;
                }

                text += `┃ 🎒 Mochila: 3x Poção de Vida, 2x Poção de Mana\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                if (narration) {
                    text += `\n\n📜 _${narration}_`;
                }

                text += `\n\nUse */rpg aventura* para iniciar uma aventura!`;

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg status
            // ───────────────────────────────────────────
            case 'status':
            case 'ficha':
            case 'stats':
            case 'perfil': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) {
                    await reply(`❌ Você não tem um personagem! Use */rpg criar* para começar.`);
                    return;
                }
                await reply(formatCharCard(char));
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg skills
            // ───────────────────────────────────────────
            case 'skills':
            case 'habilidades': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) { await reply(`❌ Crie um personagem com */rpg criar*`); return; }

                const cls = rpg.CLASSES[char.class];
                const available = rpg.getAvailableSkills(char);
                let text = `┏━━❪ 🔥 𝗛𝗔𝗕𝗜𝗟𝗜𝗗𝗔𝗗𝗘𝗦 — ${cls.emoji} ${cls.name} ❫━━\n┃\n`;

                for (const skill of cls.skills) {
                    const unlocked = char.level >= skill.unlockLv;
                    const icon = unlocked ? '✅' : '🔒';
                    text += `┃ ${icon} *${skill.name}* _(${skill.id})_\n`;
                    text += `┃   ${skill.desc}\n`;
                    text += `┃   💎 Custo: ${skill.cost} MP${!unlocked ? ` — Desbloq. Lv.${skill.unlockLv}` : ''}\n┃\n`;
                }

                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `\nEm combate: */rpg habilidade <id>*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg inventario
            // ───────────────────────────────────────────
            case 'inventario':
            case 'inv':
            case 'mochila':
            case 'bag': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) { await reply(`❌ Crie um personagem com */rpg criar*`); return; }

                let text = `┏━━❪ 🎒 𝗜𝗡𝗩𝗘𝗡𝗧𝗔́𝗥𝗜𝗢 ❫━━\n┃\n`;
                text += `┃ 💰 Gold: *${char.gold}G*\n┃\n`;

                if (char.inventory.length === 0) {
                    text += `┃ _Inventário vazio_\n`;
                } else {
                    const grouped = {};
                    for (const item of char.inventory) {
                        const type = item.type;
                        if (!grouped[type]) grouped[type] = [];
                        grouped[type].push(item);
                    }

                    const typeNames = { arma: '⚔️ Armas', armadura: '🛡️ Armaduras', acessorio: '💍 Acessórios', consumivel: '🧪 Consumíveis' };
                    for (const [type, items] of Object.entries(grouped)) {
                        text += `┃ *${typeNames[type] || type}:*\n`;
                        for (const item of items) {
                            const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
                            text += `┃   ${rpg.RARITY_EMOJI[item.rarity]} ${item.name}${qty} _(${item.id})_\n`;
                        }
                    }
                }

                text += `┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                text += `\n\n💡 */rpg equipar <id>* | */rpg usar <id>* | */rpg vender <id>*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg equipar <item_id>
            // ───────────────────────────────────────────
            case 'equipar':
            case 'equip': {
                if (!args[1]) { await reply('Uso: */rpg equipar <id_do_item>*'); return; }
                const result = rpg.equipItem(commandSenderJid, args[1].toLowerCase());
                await reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg usar <item_id>
            // ───────────────────────────────────────────
            case 'usar':
            case 'use':
            case 'item': {
                if (!args[1]) { await reply('Uso: */rpg usar <id_do_item>*'); return; }
                const result = rpg.useConsumable(commandSenderJid, args[1].toLowerCase());
                await reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg descansar
            // ───────────────────────────────────────────
            case 'descansar':
            case 'rest':
            case 'heal': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) { await reply('❌ Crie um personagem primeiro.'); return; }

                // Check if in adventure
                if (isGroup) {
                    const adv = rpg.getAdventure(sender);
                    if (adv?.active && adv.phase === 'combat') {
                        await reply('❌ Não é possível descansar durante combate!');
                        return;
                    }
                }

                // Cooldown: 30 min
                const now = Date.now();
                if (char.lastRest && now - char.lastRest < 30 * 60 * 1000) {
                    const remaining = Math.ceil((30 * 60 * 1000 - (now - char.lastRest)) / 60000);
                    await reply(`⏳ Você precisa esperar *${remaining} minutos* para descansar novamente.`);
                    return;
                }

                rpg.fullRest(commandSenderJid);
                char.lastRest = now;
                rpg.saveCharacters();

                const narration = await aiNarrate(
                    `Narre brevemente um aventureiro chamado "${char.name}" (${rpg.CLASSES[char.class].name}) descansando numa taverna ou acampamento em Eryndor. Máximo 3 linhas, crie atmosfera aconchegante.`
                );

                const stats = rpg.calculateCharStats(char);
                let text = `┏━━❪ 💤 𝗗𝗘𝗦𝗖𝗔𝗡𝗦𝗢 ❫━━\n┃\n`;
                text += `┃ ❤️ HP: ${stats.maxHp}/${stats.maxHp} (COMPLETO)\n`;
                text += `┃ 💎 MP: ${stats.maxMp}/${stats.maxMp} (COMPLETO)\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                if (narration) text += `\n\n📜 _${narration}_`;

                await reply(text);
                break;
            }

            // ═══════════════════════════════════════════
            //  AVENTURA
            // ═══════════════════════════════════════════

            // ───────────────────────────────────────────
            //  /rpg aventura — Criar lobby de aventura
            // ───────────────────────────────────────────
            case 'aventura':
            case 'dungeon':
            case 'quest': {
                if (!isGroup) { await reply('❌ Aventuras só podem ser criadas em grupos!'); return; }

                const result = rpg.createAdventure(sender, commandSenderJid);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const char = rpg.getCharacter(commandSenderJid);
                const cls = rpg.CLASSES[char.class];

                let text = `┏━━❪ 🏰 𝗔𝗩𝗘𝗡𝗧𝗨𝗥𝗔 𝗖𝗥𝗜𝗔𝗗𝗔 ❫━━\n┃\n`;
                text += `┃ ${cls.emoji} *${char.name}* abriu uma aventura!\n┃\n`;
                text += `┃ 🎮 *Lobby aberto* (1/4 jogadores)\n`;
                text += `┃ 📍 Destino: Masmorras de Eryndor\n┃\n`;
                text += `┃ ➤ */rpg entrar* — Para se juntar\n`;
                text += `┃ ➤ */rpg iniciar* — Líder inicia\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg entrar — Entrar na aventura do grupo
            // ───────────────────────────────────────────
            case 'entrar':
            case 'join': {
                if (!isGroup) { await reply('❌ Use em um grupo com aventura ativa.'); return; }

                const result = rpg.joinAdventure(sender, commandSenderJid);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const char = result.char;
                const adv = rpg.getAdventure(sender);
                const cls = rpg.CLASSES[char.class];

                let text = `┏━━❪ ✅ 𝗘𝗡𝗧𝗥𝗢𝗨 ❫━━\n┃\n`;
                text += `┃ ${cls.emoji} *${char.name}* se juntou à aventura!\n┃\n`;
                text += `┃ 🎮 *Grupo* (${adv.party.length}/4):\n`;

                for (const jid of adv.party) {
                    const pc = rpg.getCharacter(jid);
                    if (pc) {
                        const pcCls = rpg.CLASSES[pc.class];
                        text += `┃   ${pcCls.emoji} ${pc.name} — Lv.${pc.level}\n`;
                    }
                }

                text += `┃\n┃ ➤ Líder: */rpg iniciar* para começar!\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg iniciar — Líder inicia a aventura
            // ───────────────────────────────────────────
            case 'iniciar':
            case 'start':
            case 'comecar': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const result = rpg.startAdventure(sender, commandSenderJid);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const adv = rpg.getAdventure(sender);
                const partyNames = adv.party.map(jid => {
                    const c = rpg.getCharacter(jid);
                    return c ? `${rpg.CLASSES[c.class].emoji} ${c.name}` : '???';
                }).join(', ');

                // AI narrates the dungeon entrance
                const narration = await aiNarrate(
                    `Narre a entrada de um grupo de aventureiros (${partyNames}) nas Masmorras de Eryndor. Descreva o portão, o ambiente escuro, sons distantes. Máximo 5 linhas. Crie tensão e mistério.`
                );

                let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `┃  🏰 *A AVENTURA COMEÇA!*\n`;
                text += `┃  📍 *Masmorras de Eryndor — Andar 1*\n`;
                text += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                text += `┃  Grupo: ${partyNames}\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

                if (narration) {
                    text += `\n📜 ${narration}\n`;
                }

                text += `\n➤ Use */rpg explorar* para avançar pela masmorra`;

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg explorar — Explorar o andar atual
            // ───────────────────────────────────────────
            case 'explorar':
            case 'explore': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active) { await reply('❌ Não há aventura ativa. Use */rpg aventura*'); return; }
                if (adv.phase === 'combat') { await reply('⚔️ Você está em combate! Use */rpg atacar*, */rpg habilidade*, */rpg defender* ou */rpg fugir*'); return; }
                if (adv.phase === 'lobby') { await reply('⏳ A aventura ainda não começou. Líder deve usar */rpg iniciar*'); return; }
                if (!adv.party.includes(commandSenderJid)) { await reply('❌ Você não está nesta aventura!'); return; }

                // Generate encounter with AI
                const combatResult = rpg.startCombat(sender);
                if (!combatResult) { await reply('❌ Erro ao iniciar combate.'); return; }

                const { enemies } = combatResult;
                const isBoss = enemies.some(e => e.type === 'boss');
                const partyNames = adv.party.map(jid => rpg.getCharacter(jid)?.name).filter(Boolean).join(', ');
                const enemyNames = enemies.map(e => `${e.emoji} ${e.name}`).join(', ');

                // AI narrates the encounter
                const narration = await aiNarrate(
                    `Narre o encontro de aventureiros (${partyNames}) com ${isBoss ? 'o poderoso boss' : 'inimigos'} no andar ${adv.floor} de uma masmorra: ${enemyNames}. ${isBoss ? 'Torne épico e intimidador.' : 'Descreva o ambiente e como os inimigos aparecem.'} Máximo 5 linhas.`
                );

                let text = '';
                if (narration) {
                    text += `📜 ${narration}\n\n`;
                }

                text += formatEnemyAppear(enemies);
                text += `\n`;

                // Show combat status
                const updatedAdv = rpg.getAdventure(sender);
                text += formatCombatStatus(updatedAdv);

                // Show whose turn it is
                const turn = rpg.getCurrentTurnPlayer(sender);
                if (turn?.type === 'player') {
                    const turnChar = rpg.getCharacter(turn.jid);
                    text += `\n\n🎯 Turno de *${turnChar?.name}*!\n`;
                    text += `➤ */rpg atacar* | */rpg habilidade <id>* | */rpg defender* | */rpg fugir*`;
                }

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg atacar — Ataque básico
            // ───────────────────────────────────────────
            case 'atacar':
            case 'attack':
            case 'atk': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active || adv.phase !== 'combat') { await reply('❌ Não há combate ativo.'); return; }

                const targetIdx = args[1] ? parseInt(args[1]) - 1 : 0;
                const result = rpg.processPlayerAttack(sender, commandSenderJid, targetIdx);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const char = rpg.getCharacter(commandSenderJid);

                // Narrate the attack
                const narration = await aiNarrate(
                    `Narre brevemente o ataque de ${char.name} (${rpg.CLASSES[char.class].name}) contra ${result.target}. Dano: ${result.damage}${result.isCrit ? ', FOI CRÍTICO' : ''}${!result.targetAlive ? ', MATOU O INIMIGO' : ''}. Máximo 2 linhas, seja cinematográfico.`
                );

                let text = `⚔️ *${char.name}* ataca *${result.target}*!\n`;
                if (narration) text += `\n📜 _${narration}_\n\n`;
                text += formatActionResults([result]);

                // Process enemy turns
                const enemyResults = rpg.processEnemyTurns(sender);
                if (enemyResults.length > 0) {
                    text += `\n👹 *Turno dos Inimigos:*\n` + formatEnemyResults(enemyResults);
                }

                // Check combat end
                const combatEnd = rpg.checkCombatEnd(sender);
                if (combatEnd) {
                    if (combatEnd.result === 'victory') {
                        const victoryNarration = await aiNarrate(
                            `Narre brevemente a vitória dos aventureiros após derrotar os inimigos no andar ${adv.floor}. ${combatEnd.wasBoss ? 'Foi uma luta contra um boss! Torne épico!' : 'Vitória normal.'} Máximo 3 linhas.`
                        );
                        if (victoryNarration) text += `\n📜 ${victoryNarration}\n\n`;
                        text += `\n` + formatVictory(combatEnd, adv.floor);
                    } else if (combatEnd.result === 'defeat') {
                        const defeatNarration = await aiNarrate(
                            `Narre brevemente a derrota trágica do grupo de aventureiros na masmorra. Todos caíram. Crie atmosfera sombria. Máximo 3 linhas.`
                        );
                        text += `\n\n💀 *═══ DERROTA ═══*\n`;
                        if (defeatNarration) text += `\n📜 _${defeatNarration}_\n`;
                        text += `\nO grupo foi derrotado... A aventura acabou.\nUse */rpg descansar* e tente novamente com */rpg aventura*`;
                    }
                } else {
                    // Show next turn
                    text += `\n`;
                    const updatedAdv = rpg.getAdventure(sender);
                    text += formatCombatStatus(updatedAdv);
                    const nextTurn = rpg.getCurrentTurnPlayer(sender);
                    if (nextTurn?.type === 'player') {
                        const turnChar = rpg.getCharacter(nextTurn.jid);
                        text += `\n\n🎯 Turno de *${turnChar?.name}*!`;
                    }
                }

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg habilidade <skill_id>
            // ───────────────────────────────────────────
            case 'habilidade':
            case 'skill':
            case 'hab':
            case 'magia':
            case 'spell': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }
                if (!args[1]) { await reply('Uso: */rpg habilidade <id>*\nVeja suas skills com */rpg skills*'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active || adv.phase !== 'combat') { await reply('❌ Não há combate ativo.'); return; }

                const skillId = args[1].toLowerCase();
                const targetIdx = args[2] ? parseInt(args[2]) - 1 : 0;
                const result = rpg.processPlayerSkill(sender, commandSenderJid, skillId, targetIdx);

                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const char = rpg.getCharacter(commandSenderJid);
                const cls = rpg.CLASSES[char.class];
                const skillData = cls.skills.find(s => s.id === skillId);

                // Narrate the skill
                const narrationPrompt = result.results.some(r => r.damage)
                    ? `Narre brevemente ${char.name} usando a habilidade "${result.skill}" em combate. ${result.results.map(r => r.target ? `Contra ${r.target}, dano ${r.damage}` : '').join('. ')}. Máximo 2 linhas, seja épico.`
                    : `Narre brevemente ${char.name} usando a habilidade "${result.skill}" — ${skillData?.desc || 'habilidade especial'}. Máximo 2 linhas.`;

                const narration = await aiNarrate(narrationPrompt);

                let text = `🔥 *${char.name}* usa *${result.skill}*!\n`;
                if (narration) text += `\n📜 _${narration}_\n\n`;
                text += formatActionResults(result.results, result.skill);

                // Enemy turns
                const enemyResults = rpg.processEnemyTurns(sender);
                if (enemyResults.length > 0) {
                    text += `\n👹 *Turno dos Inimigos:*\n` + formatEnemyResults(enemyResults);
                }

                // Check end
                const combatEnd = rpg.checkCombatEnd(sender);
                if (combatEnd) {
                    if (combatEnd.result === 'victory') {
                        const vn = await aiNarrate(`Narre brevemente a vitória após ${char.name} usar "${result.skill}". Andar ${adv.floor}. Máximo 3 linhas.`);
                        if (vn) text += `\n📜 ${vn}\n\n`;
                        text += `\n` + formatVictory(combatEnd, adv.floor);
                    } else if (combatEnd.result === 'defeat') {
                        text += `\n\n💀 *═══ DERROTA ═══*\nO grupo foi derrotado...\nUse */rpg descansar* e tente novamente.`;
                    }
                } else {
                    text += `\n`;
                    const updatedAdv = rpg.getAdventure(sender);
                    text += formatCombatStatus(updatedAdv);
                    const nextTurn = rpg.getCurrentTurnPlayer(sender);
                    if (nextTurn?.type === 'player') {
                        const turnChar = rpg.getCharacter(nextTurn.jid);
                        text += `\n\n🎯 Turno de *${turnChar?.name}*!`;
                    }
                }

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg defender
            // ───────────────────────────────────────────
            case 'defender':
            case 'defend':
            case 'def': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active || adv.phase !== 'combat') { await reply('❌ Não há combate ativo.'); return; }

                const result = rpg.processPlayerDefend(sender, commandSenderJid);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                const char = rpg.getCharacter(commandSenderJid);

                let text = `🛡️ *${char.name}* assume posição defensiva!\n`;
                text += `_Defesa reforçada e recuperou um pouco de HP._\n`;

                // Enemy turns
                const enemyResults = rpg.processEnemyTurns(sender);
                if (enemyResults.length > 0) {
                    text += `\n👹 *Turno dos Inimigos:*\n` + formatEnemyResults(enemyResults);
                }

                const combatEnd = rpg.checkCombatEnd(sender);
                if (combatEnd) {
                    if (combatEnd.result === 'victory') {
                        text += `\n` + formatVictory(combatEnd, adv.floor);
                    } else if (combatEnd.result === 'defeat') {
                        text += `\n\n💀 *DERROTA*\nO grupo foi derrotado...\nUse */rpg descansar* e tente novamente.`;
                    }
                } else {
                    text += `\n`;
                    text += formatCombatStatus(rpg.getAdventure(sender));
                    const nextTurn = rpg.getCurrentTurnPlayer(sender);
                    if (nextTurn?.type === 'player') {
                        const turnChar = rpg.getCharacter(nextTurn.jid);
                        text += `\n\n🎯 Turno de *${turnChar?.name}*!`;
                    }
                }

                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg fugir
            // ───────────────────────────────────────────
            case 'fugir':
            case 'flee':
            case 'run': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const result = rpg.processPlayerFlee(sender, commandSenderJid);
                if (!result.success) { await reply(`❌ ${result.message}`); return; }

                if (result.fled) {
                    const narration = await aiNarrate(`Narre brevemente um grupo de aventureiros fugindo desesperadamente de um combate em uma masmorra. Máximo 2 linhas, faça ser engraçado/dramático.`);
                    let text = `🏃 *FUGA BEM-SUCEDIDA!*\n`;
                    if (narration) text += `\n📜 _${narration}_\n`;
                    text += `\nUse */rpg explorar* para continuar ou */rpg sair* para encerrar.`;
                    await reply(text);
                } else {
                    let text = `❌ *Falha ao fugir!* Os inimigos bloquearam a saída!\n`;

                    const enemyResults = rpg.processEnemyTurns(sender);
                    if (enemyResults.length > 0) {
                        text += `\n👹 *Os inimigos aproveitam!*\n` + formatEnemyResults(enemyResults);
                    }

                    const combatEnd = rpg.checkCombatEnd(sender);
                    if (combatEnd?.result === 'defeat') {
                        text += `\n💀 *DERROTA*\nNão foi possível escapar...`;
                    } else {
                        text += `\n`;
                        text += formatCombatStatus(rpg.getAdventure(sender));
                        const nextTurn = rpg.getCurrentTurnPlayer(sender);
                        if (nextTurn?.type === 'player') {
                            const turnChar = rpg.getCharacter(nextTurn.jid);
                            text += `\n\n🎯 Turno de *${turnChar?.name}*!`;
                        }
                    }
                    await reply(text);
                }
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg avancar — Avançar para o próximo andar
            // ───────────────────────────────────────────
            case 'avancar':
            case 'advance':
            case 'next':
            case 'avancar':
            case 'próximo':
            case 'proximo': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active) { await reply('❌ Não há aventura ativa.'); return; }
                if (adv.phase === 'combat') { await reply('⚔️ Termine o combate primeiro!'); return; }
                if (!adv.party.includes(commandSenderJid)) { await reply('❌ Você não está nesta aventura!'); return; }

                const updated = rpg.advanceFloor(sender);
                if (!updated) { await reply('❌ Erro ao avançar.'); return; }

                const partyNames = updated.party.map(jid => rpg.getCharacter(jid)?.name).filter(Boolean).join(', ');
                const isBossFloor = updated.floor % 5 === 0;

                const narration = await aiNarrate(
                    `Narre a descida do grupo (${partyNames}) para o andar ${updated.floor} de uma masmorra. ${isBossFloor ? 'Este andar tem uma aura sinistra e opressora — um boss aguarda. Crie tensão máxima.' : 'Descreva o novo ambiente, sons e cheiros.'} Máximo 4 linhas.`
                );

                let text = `┏━━❪ 📍 𝗔𝗡𝗗𝗔𝗥 ${updated.floor} ❫━━\n`;
                if (isBossFloor) {
                    text += `┃ ⚠️ *ANDAR DE BOSS!* ⚠️\n`;
                }
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

                if (narration) text += `\n📜 ${narration}\n`;

                // Show party HP
                text += `\n🛡️ *Status do grupo (recuperação parcial):*\n`;
                for (const jid of updated.party) {
                    const pc = rpg.getCharacter(jid);
                    if (pc) {
                        const stats = rpg.calculateCharStats(pc);
                        text += `${rpg.CLASSES[pc.class].emoji} ${pc.name}: ❤️ ${pc.hp}/${stats.maxHp} 💎 ${pc.mp}/${stats.maxMp}\n`;
                    }
                }

                text += `\n➤ Use */rpg explorar* para avançar`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg sair — Encerrar aventura
            // ───────────────────────────────────────────
            case 'sair':
            case 'leave':
            case 'quit':
            case 'encerrar': {
                if (!isGroup) { await reply('❌ Use em um grupo.'); return; }

                const adv = rpg.getAdventure(sender);
                if (!adv?.active) { await reply('❌ Não há aventura ativa.'); return; }

                rpg.endAdventure(sender);

                let text = `┏━━❪ 🏠 𝗔𝗩𝗘𝗡𝗧𝗨𝗥𝗔 𝗘𝗡𝗖𝗘𝗥𝗥𝗔𝗗𝗔 ❫━━\n┃\n`;
                text += `┃ 📍 Andares explorados: *${adv.floorsCleared}*\n`;
                text += `┃ ✨ XP total: *${adv.totalXpEarned}*\n`;
                text += `┃ 💰 Gold total: *${adv.totalGoldEarned}G*\n`;
                text += `┃\n┃ O grupo retorna à superfície...\n`;
                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                text += `\n\nUse */rpg aventura* para uma nova aventura!`;

                await reply(text);
                break;
            }

            // ═══════════════════════════════════════════
            //  LOJA
            // ═══════════════════════════════════════════

            // ───────────────────────────────────────────
            //  /rpg loja
            // ───────────────────────────────────────────
            case 'loja':
            case 'shop':
            case 'store': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) { await reply('❌ Crie um personagem primeiro.'); return; }

                const floor = isGroup ? (rpg.getAdventure(sender)?.floor || 1) : 1;
                const items = rpg.getShopItems(Math.max(floor, char.level));

                let text = `┏━━❪ 🛒 𝗟𝗢𝗝𝗔 ❫━━\n┃\n`;
                text += `┃ 💰 Seu gold: *${char.gold}G*\n┃\n`;

                const grouped = {};
                for (const item of items) {
                    if (!grouped[item.type]) grouped[item.type] = [];
                    grouped[item.type].push(item);
                }

                const typeNames = { arma: '⚔️ Armas', armadura: '🛡️ Armaduras', acessorio: '💍 Acessórios', consumivel: '🧪 Consumíveis' };
                for (const [type, typeItems] of Object.entries(grouped)) {
                    text += `┃ *${typeNames[type] || type}*\n`;
                    for (const item of typeItems.slice(0, 6)) {
                        text += `┃   ${rpg.RARITY_EMOJI[item.rarity]} ${item.name} — *${item.price}G* _(${item.id})_\n`;
                    }
                    text += `┃\n`;
                }

                text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                text += `\n\n💡 */rpg comprar <id>* | */rpg vender <id>*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg comprar <item_id>
            // ───────────────────────────────────────────
            case 'comprar':
            case 'buy': {
                if (!args[1]) { await reply('Uso: */rpg comprar <id_do_item>*'); return; }
                const result = rpg.buyItem(commandSenderJid, args[1].toLowerCase());
                await reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg vender <item_id>
            // ───────────────────────────────────────────
            case 'vender':
            case 'sell': {
                if (!args[1]) { await reply('Uso: */rpg vender <id_do_item>*'); return; }
                const result = rpg.sellItem(commandSenderJid, args[1].toLowerCase());
                await reply(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
                break;
            }

            // ═══════════════════════════════════════════
            //  RANKING
            // ═══════════════════════════════════════════

            case 'ranking':
            case 'rank':
            case 'top':
            case 'leaderboard': {
                const type = args[1] || 'level';
                const typeNames = { level: 'Nível', gold: 'Gold', kills: 'Monstros', damage: 'Dano Total', bosses: 'Bosses' };
                const ranking = rpg.getRanking(type);

                let text = `┏━━❪ 🏆 𝗥𝗔𝗡𝗞𝗜𝗡𝗚 — ${typeNames[type] || 'Nível'} ❫━━\n┃\n`;

                if (ranking.length === 0) {
                    text += `┃ _Nenhum herói registrado ainda._\n`;
                } else {
                    const medals = ['🥇', '🥈', '🥉'];
                    for (let i = 0; i < ranking.length; i++) {
                        const c = ranking[i];
                        const cls = rpg.CLASSES[c.class];
                        const medal = medals[i] || `${i + 1}.`;
                        let value = '';
                        switch (type) {
                            case 'level': value = `Lv.${c.level} (${c.xp} XP)`; break;
                            case 'gold': value = `${c.gold}G`; break;
                            case 'kills': value = `${c.monstersKilled} mortes`; break;
                            case 'damage': value = `${c.totalDamageDealt} dano`; break;
                            case 'bosses': value = `${c.bossesKilled} bosses`; break;
                        }
                        text += `┃ ${medal} ${cls.emoji} *${c.name}* — ${value}\n`;
                    }
                }

                text += `┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                text += `\n\n📊 Categorias: */rpg ranking [level|gold|kills|damage|bosses]*`;
                await reply(text);
                break;
            }

            // ───────────────────────────────────────────
            //  /rpg reset — Deletar personagem
            // ───────────────────────────────────────────
            case 'reset':
            case 'deletar':
            case 'delete': {
                const char = rpg.getCharacter(commandSenderJid);
                if (!char) { await reply('❌ Você não tem personagem.'); return; }

                if (args[1] !== 'confirmar') {
                    await reply(`⚠️ *Tem certeza?* Isso apagará permanentemente o personagem *${char.name}* (Lv.${char.level})!\n\nDigite */rpg reset confirmar* para confirmar.`);
                    return;
                }

                rpg.deleteCharacter(commandSenderJid);
                await reply(`✅ Personagem *${char.name}* deletado. Use */rpg criar* para começar de novo.`);
                break;
            }

            default: {
                await reply(`❌ Subcomando "${sub}" não reconhecido.\nUse */rpg* para ver o menu.`);
            }
        }
    } catch (error) {
        console.error('[RPG] Erro no comando:', error);
        await reply('❌ Ocorreu um erro. Tente novamente.');
    }
}

module.exports = rpgCommand;

module.exports.commandData = {
    name: 'rpg',
    description: 'RPG Interativo com IA como Mestre de Jogo. Crie personagens, explore masmorras, lute contra monstros e bosses com narração dinâmica por IA!',
    aliases: ['dungeon', 'masmorra', 'aventura'],
    category: 'jogos',
    usage: '/rpg [criar|status|aventura|explorar|atacar|habilidade|loja|ranking]',
    cooldown: 2,
    groupOnly: false,
};
