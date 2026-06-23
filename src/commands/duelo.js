const dueloManager = require('../managers/dueloManager');
const contactManager = require('../managers/contactManager');
const { generateArenaCard, generateActionCard, generateVictoryCard } = require('../helpers/dueloCardGenerator');
const { rawCompletion } = require('../managers/groqClient');
const fs = require('fs').promises;
const config = require('../../config.js');

const BOT_NAME = config.BOT_NAME || 'Bot';

// ═══════════════════════════════════════════════════════════
//  ⚔️  /duelo — RPG Battle System Command
// ═══════════════════════════════════════════════════════════

async function handleDueloCommand(sock, msg, msgDetails) {
    const { sender, commandText, isGroup, commandSenderJid, prefix, commandName } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase()?.normalize('NFD')?.replace(/[\u0300-\u036f]/g, '') || '';
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!isGroup) {
        await sock.sendMessage(sender, {
            text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas em grupos!\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // ── GUIA RPG ────────────────────────────────────────
    if (subCommand === 'guia' || subCommand === 'guide' || subCommand === 'tutorial') {
        const page = parseInt(args[1]) || 1;

        if (page === 1) {
            // PÁGINA 1: Classes detalhadas
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗖𝗟𝗔𝗦𝗦𝗘𝗦\n`;
            text += `┃  _Página 1/5_\n┃\n`;
            text += `┣━━❪ 🗡️ 𝗚𝗨𝗘𝗥𝗥𝗘𝗜𝗥𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:120 ⚔️ ATK:17 🛡️ DEF:13\n`;
            text += `┃ ✦ *Fúria Berserker* (+50% ATK, 2 turnos)\n`;
            text += `┃ 📊 Tipo: Bruiser / Offtank\n`;
            text += `┃ ⭐ Dificuldade: ★★☆☆☆\n`;
            text += `┃ 💡 _Classe equilibrada. Alta vida + dano_\n`;
            text += `┃ _sólido. Ideal para iniciantes. O especial_\n`;
            text += `┃ _transforma em máquina de destruição._\n┃\n`;
            text += `┣━━❪ 🧙 𝗠𝗔𝗚𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:95 ⚔️ ATK:23 🛡️ DEF:9\n`;
            text += `┃ ✦ *Meteoro Arcano* (30-45 dmg puro)\n`;
            text += `┃ 📊 Tipo: Glass Cannon\n`;
            text += `┃ ⭐ Dificuldade: ★★★☆☆\n`;
            text += `┃ 💡 _Maior ATK do jogo mas frágil. O_\n`;
            text += `┃ _Meteoro ignora DEF e pode virar o jogo_\n`;
            text += `┃ _em um turno. Jogue agressivamente._\n┃\n`;
            text += `┣━━❪ 🏹 𝗔𝗥𝗤𝗨𝗘𝗜𝗥𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:105 ⚔️ ATK:18 🛡️ DEF:12\n`;
            text += `┃ ✦ *Chuva de Flechas* (3 hits de 8-14)\n`;
            text += `┃ 📊 Tipo: DPS Consistente\n`;
            text += `┃ ⭐ Dificuldade: ★★☆☆☆\n`;
            text += `┃ 💡 _Dano confiável a cada turno. A_\n`;
            text += `┃ _Chuva de Flechas pode causar até 42_\n`;
            text += `┃ _de dano! Bom contra tanques lentos._\n┃\n`;
            text += `┣━━❪ 🛡️ 𝗣𝗔𝗟𝗔𝗗𝗜𝗡𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:140 ⚔️ ATK:12 🛡️ DEF:18\n`;
            text += `┃ ✦ *Escudo Divino* (block total + cura 20)\n`;
            text += `┃ 📊 Tipo: Tank / Suporte\n`;
            text += `┃ ⭐ Dificuldade: ★★★★☆\n`;
            text += `┃ 💡 _O mais resistente. Escudo bloqueia_\n`;
            text += `┃ _QUALQUER ataque incluindo especiais._\n`;
            text += `┃ _Use no timing certo para frustrar o_\n`;
            text += `┃ _oponente. Vença pelo cansaço._\n┃\n`;
            text += `┣━━❪ 🥷 𝗔𝗦𝗦𝗔𝗦𝗦𝗜𝗡𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:90 ⚔️ ATK:24 🛡️ DEF:7\n`;
            text += `┃ ✦ *Execução Sombria* (2x dmg se HP<30%)\n`;
            text += `┃ 📊 Tipo: Finisher / Assassin\n`;
            text += `┃ ⭐ Dificuldade: ★★★★★\n`;
            text += `┃ 💡 _Para jogadores experientes. A menor_\n`;
            text += `┃ _vida do jogo mas a Execução é LETAL._\n`;
            text += `┃ _Guarde o especial para quando o_\n`;
            text += `┃ _inimigo estiver fraco e EXECUTE._\n┃\n`;
            text += `┣━━❪ 🐉 𝗗𝗥𝗔𝗚𝗔̃𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:110 ⚔️ ATK:19 🛡️ DEF:12\n`;
            text += `┃ ✦ *Sopro de Fogo* (dmg + burn 5/turno x3)\n`;
            text += `┃ 📊 Tipo: DPS Over Time\n`;
            text += `┃ ⭐ Dificuldade: ★★★☆☆\n`;
            text += `┃ 💡 _Classe versátil. A queimadura causa_\n`;
            text += `┃ _15 de dano extra ao longo do tempo,_\n`;
            text += `┃ _além do hit inicial. Perfeito para_\n`;
            text += `┃ _pressionar tanques e curandeiros._\n┃\n`;
            text += `┣━━❪ 📌 ❫━━\n┃\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 2 › Classes 2\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 3 › Mecânicas\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 4 › Matchups\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 5 › Espécies\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 2) {
            // PÁGINA 2: Classes pt 2
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗖𝗟𝗔𝗦𝗦𝗘𝗦 𝗜𝗜 🆕\n`;
            text += `┃  _Página 2/5_\n┃\n`;
            text += `┣━━❪ 🪓 𝗕𝗔́𝗥𝗕𝗔𝗥𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:150 ⚔️ ATK:15 🛡️ DEF:8\n`;
            text += `┃ ✦ *Sede de Sangue* (+30% dmg por stack)\n`;
            text += `┃ 📊 Tipo: Juggernaut\n`;
            text += `┃ ⭐ Dificuldade: ★★★☆☆\n`;
            text += `┃ 💡 _Não tem defesas robustas, mas o_\n`;
            text += `┃ _especial faz ele bater muito mais_\n`;
            text += `┃ _forte quanto menos vida tiver._\n┃\n`;
            text += `┣━━❪ ✝️ 𝗖𝗟𝗘́𝗥𝗜𝗚𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:115 ⚔️ ATK:12 🛡️ DEF:15\n`;
            text += `┃ ✦ *Milagre Curativo* (+40 HP purifica tudo)\n`;
            text += `┃ 📊 Tipo: Curandeiro / Sobrevivência\n`;
            text += `┃ ⭐ Dificuldade: ★★☆☆☆\n`;
            text += `┃ 💡 _Ganha jogo pelo cansaço. O_\n`;
            text += `┃ _Dano é baixo, mas o Milagre apaga_\n`;
            text += `┃ _qualquer Veneno ou Burn instantaneamente._\n┃\n`;
            text += `┣━━❪ 🧟‍♂️ 𝗡𝗘𝗖𝗥𝗢𝗠𝗔𝗡𝗧𝗘 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:105 ⚔️ ATK:16 🛡️ DEF:13\n`;
            text += `┃ ✦ *Almas Gêmeas* (Escudo de osso 20 HP)\n`;
            text += `┃ 📊 Tipo: Invocador (Anti-Burst)\n`;
            text += `┃ ⭐ Dificuldade: ★★★★☆\n`;
            text += `┃ 💡 _Sua vida é ilusória. O escudo não_\n`;
            text += `┃ _zera o dano como o Paladino, mas o_\n`;
            text += `┃ _Servo Sombrio recebe +20 de dano por ele._\n┃\n`;
            text += `┣━━❪ ⚙️ 𝗧𝗘𝗖𝗡𝗢𝗠𝗔𝗚𝗢 ❫━━\n┃\n`;
            text += `┃ ❤️ HP:110 ⚔️ ATK:17 🛡️ DEF:14\n`;
            text += `┃ ✦ *Pulso Elétrico* (Dano + SILENCE 2t)\n`;
            text += `┃ 📊 Tipo: Controle de Grupo (Desativador)\n`;
            text += `┃ ⭐ Dificuldade: ★★★★★\n`;
            text += `┃ 💡 _Especial proibindo Mágica! Dano não_\n`;
            text += `┃ _é o foco, mas o inimigo silenciado_\n`;
            text += `┃ _fica impossibilitado de Ultar ou Curar!_\n┃\n`;
            text += `┣━━❪ 📌 ❫━━\n┃\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 3 › Mecânicas\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 4 › Matchups\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 5 › Espécies\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 6 › Sistema RPG\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 3) {
            // PÁGINA 3: Mecânicas e Estratégias
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗠𝗘𝗖𝗔̂𝗡𝗜𝗖𝗔𝗦\n`;
            text += `┃  _Página 3/5_\n┃\n`;
            text += `┣━━❪ ⚔️ 𝗔𝗧𝗔𝗤𝗨𝗘 ❫━━\n┃\n`;
            text += `┃ Dano Base = ATK + variação(-3~+5)\n`;
            text += `┃ Dano Final = Base - (DEF inimiga × 0.5)\n`;
            text += `┃ 💥 15% de chance de CRÍTICO (dano 2x)\n`;
            text += `┃ 💨 10% de chance do inimigo ESQUIVAR\n┃\n`;
            text += `┣━━❪ 🛡️ 𝗗𝗘𝗙𝗘𝗦𝗔 ❫━━\n┃\n`;
            text += `┃ Aumenta sua DEF em +50% por 1 turno\n`;
            text += `┃ _Estratégia: Use quando prever um_\n`;
            text += `┃ _especial do inimigo (ele acaba de_\n`;
            text += `┃ _sair do cooldown)_\n┃\n`;
            text += `┣━━❪ ✨ 𝗘𝗦𝗣𝗘𝗖𝗜𝗔𝗟 ❫━━\n┃\n`;
            text += `┃ Poder único da classe (ver pág. 1)\n`;
            text += `┃ ⏳ Cooldown: 3 turnos após usar\n`;
            text += `┃ ✅ Começa pronto no turno 1!\n`;
            text += `┃ _Estratégia: Use no momento certo._\n`;
            text += `┃ _Não desperdice contra um Paladino_\n`;
            text += `┃ _com Escudo ativo!_\n┃\n`;
            text += `┣━━❪ 🧪 𝗣𝗢𝗖̧𝗔̃𝗢 ❫━━\n┃\n`;
            text += `┃ Cura 30 HP (apenas 1x por batalha)\n`;
            text += `┃ _Estratégia: Guarde para emergência._\n`;
            text += `┃ _Usar cedo demais = desperdiçar._\n`;
            text += `┃ _Ideal quando estiver entre 30-50% HP._\n┃\n`;
            text += `┣━━❪ 🔥 𝗕𝗨𝗥𝗡 (𝗤𝗨𝗘𝗜𝗠𝗔𝗗𝗨𝗥𝗔) ❫━━\n┃\n`;
            text += `┃ Causa 5 de dano no INÍCIO do seu turno\n`;
            text += `┃ Dura 3 turnos (15 dmg total!)\n`;
            text += `┃ Pode matar! (aplica antes da ação)\n`;
            text += `┃ _Apenas o 🐉 Dragão aplica burn._\n┃\n`;
            text += `┣━━❪ 🏛️ 𝗘𝗦𝗖𝗨𝗗𝗢 𝗗𝗜𝗩𝗜𝗡𝗢 ❫━━\n┃\n`;
            text += `┃ Bloqueia 100% do dano do próximo hit\n`;
            text += `┃ Funciona contra ESPECIAIS também!\n`;
            text += `┃ Desaparece após bloquear 1 ataque\n`;
            text += `┃ _Apenas o 🛡️ Paladino tem o escudo._\n┃\n`;
            text += `┣━━❪ 🎖️ 𝗧𝗜́𝗧𝗨𝗟𝗢𝗦 ❫━━\n┃\n`;
            text += `┃ 🌑 Iniciante › 0 vitórias\n`;
            text += `┃ 🌙 Aprendiz › 1+ vitória\n`;
            text += `┃ 🗡️ Guerreiro › 5+ vitórias\n`;
            text += `┃ ⚔️ Veterano › 10+ vitórias\n`;
            text += `┃ 🔥 Mestre › 20+ vitórias\n`;
            text += `┃ ⚡ Grão-Mestre › 30+ vitórias\n`;
            text += `┃ 🌟 Lenda Imortal › 50+ vitórias\n┃\n`;
            text += `┣━━❪ 📌 ❫━━\n┃\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 1 › Classes\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 4 › Matchups\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 5 › Espécies\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 4) {
            // PÁGINA 4: Matchups e Dicas Pro
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗠𝗔𝗧𝗖𝗛𝗨𝗣𝗦\n`;
            text += `┃  _Página 4/5_\n┃\n`;
            text += `┣━━❪ 🏆 𝗙𝗢𝗥𝗧𝗘 𝗖𝗢𝗡𝗧𝗥𝗔 ❫━━\n┃\n`;
            text += `┃ 🗡️ Guerreiro → bate 🏹🐉\n`;
            text += `┃ _Vida alta aguenta DPS, Fúria mata_\n┃\n`;
            text += `┃ 🧙 Mago → bate 🛡️🗡️\n`;
            text += `┃ _Meteoro ignora DEF alta dos tanques_\n┃\n`;
            text += `┃ 🏹 Arqueiro → bate 🥷🧙\n`;
            text += `┃ _Dano consistente mata frágeis rápido_\n┃\n`;
            text += `┃ 🛡️ Paladino → bate 🥷🏹\n`;
            text += `┃ _Escudo nega execução e flechas_\n┃\n`;
            text += `┃ 🥷 Assassino → bate 🧙🐉\n`;
            text += `┃ _Execução finaliza antes de reação_\n┃\n`;
            text += `┃ 🐉 Dragão → bate 🛡️🗡️\n`;
            text += `┃ _Burn ignora DEF e acumula pressão_\n┃\n`;
            text += `┣━━❪ 💀 𝗙𝗥𝗔𝗖𝗢 𝗖𝗢𝗡𝗧𝗥𝗔 ❫━━\n┃\n`;
            text += `┃ 🗡️ perde para → 🧙 (burst ignora DEF)\n`;
            text += `┃ 🧙 perde para → 🥷 (morre antes de castar)\n`;
            text += `┃ 🏹 perde para → 🗡️ (Fúria tanque vence)\n`;
            text += `┃ 🛡️ perde para → 🧙 (Meteoro ignora tudo)\n`;
            text += `┃ 🥷 perde para → 🛡️ (Escudo nega Execute)\n`;
            text += `┃ 🐉 perde para → 🏹 (DPS rápido demais)\n┃\n`;
            text += `┣━━❪ 🧠 𝗗𝗜𝗖𝗔𝗦 𝗣𝗥𝗢 ❫━━\n┃\n`;
            text += `┃ 1. Conte os turnos do cooldown inimigo\n`;
            text += `┃ 2. Defenda quando prever um especial\n`;
            text += `┃ 3. Não use poção acima de 70% HP\n`;
            text += `┃ 4. Assassino: ataque até 30% HP,\n`;
            text += `┃    depois EXECUTE para matar\n`;
            text += `┃ 5. Paladino: use Escudo quando o\n`;
            text += `┃    inimigo tiver especial pronto\n`;
            text += `┃ 6. Mago: abra com Meteoro no turno 1\n`;
            text += `┃ 7. Dragão: use Sopro cedo para burn\n`;
            text += `┃    acumular enquanto ataca normal\n`;
            text += `┃ 8. Críticos são aleatórios, mas\n`;
            text += `┃    defender reduz até críticos\n┃\n`;
            text += `┣━━❪ 📌 ❫━━\n┃\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 1 › Classes\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 3 › Mecânicas\n`;
            text += `┃ ➢ ${prefix}${commandName} guia 5 › Espécies\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 5) {
            // PÁGINA 5: Espécies (Raças)
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘𝗦 🆕\n`;
            text += `┃  _Página 5/5_\n┃\n`;
            text += `┃ Escolha sua espécie para modificar\n`;
            text += `┃ os atributos base da sua classe!\n┃\n`;
            for (const [key, spv] of Object.entries(dueloManager.ESPECIES)) {
                if (spv.hidden) continue; // Pular espécies secretas (meme/easter eggs)
                text += `┣━━❪ ${spv.emoji} ${spv.name.toUpperCase()} ❫━━\n┃\n`;
                const hpStr = spv.modifiers.hp >= 0 ? `+${spv.modifiers.hp}` : spv.modifiers.hp;
                const atkStr = spv.modifiers.atk >= 0 ? `+${spv.modifiers.atk}` : spv.modifiers.atk;
                const defStr = spv.modifiers.def >= 0 ? `+${spv.modifiers.def}` : spv.modifiers.def;
                text += `┃ ❤️ HP ${hpStr} │ ⚔️ ATK ${atkStr} │ 🛡️ DEF ${defStr}\n`;
                if (spv.special) {
                    text += `┃ 🧬 *${spv.special.name}* (CD: ${spv.special.cooldown}t)\n`;
                    text += `┃ └ ${spv.special.desc}\n`;
                }
                text += `┃ _${spv.lore}_\n┃\n`;
            }
            text += `┣━━❪ 📌 ❫━━\n┃\n`;
            text += `┃ ➢ 1º Escolha espécie: ${prefix}${commandName} especie <nome>\n`;
            text += `┃ ➢ 2º Entrar num duelo: ${prefix}${commandName} jogar <classe>\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 6) {
            // PÁGINA 6: Níveis e RPG
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗦𝗜𝗦𝗧𝗘𝗠𝗔 𝗗𝗘 𝗡𝗜́𝗩𝗘𝗜𝗦 🆕\n`;
            text += `┃  _Página 6/6_\n┃\n`;
            text += `┣━━❪ ✨ 𝗫𝗣 & 𝗟𝗘𝗩𝗘𝗟 ❫━━\n┃\n`;
            text += `┃ Ganhe Experiência lutando!\n`;
            text += `┃ 🟢 Vitória = +50 XP\n`;
            text += `┃ 🔴 Derrota = +10 XP\n┃\n`;
            text += `┃ A cada Nível alcançado, você\n`;
            text += `┃ recebe *+3 Pontos de Status*!\n┃\n`;
            text += `┣━━❪ 🎯 𝗔𝗧𝗥𝗜𝗕𝗨𝗧𝗢𝗦 ❫━━\n┃\n`;
            text += `┃ Gaste seus pontos para montar sua build:\n`;
            text += `┃ ❤️ 1 Ponto de HP = +5 de Vida\n`;
            text += `┃ ⚔️ 1 Ponto de ATK = +1 de Ataque\n`;
            text += `┃ 🛡️ 1 Ponto de DEF = +1 de Defesa\n┃\n`;
            text += `┣━━❪ 🎮 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ❫━━\n┃\n`;
            text += `┃ ➢ Ver nível e pontos:\n`;
            text += `┃   ${prefix}${commandName} stats (ou perfil)\n┃\n`;
            text += `┃ ➢ Gastar pontos (ex: uppar 2 de ATK):\n`;
            text += `┃   ${prefix}${commandName} uppar atk 2\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }

        if (page === 666) {
            // PÁGINA 666: Classes & Espécies Secretas (Meme)
            let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            text += `┃\n`;
            text += `┃  😈 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗦𝗘𝗖𝗥𝗘𝗧𝗢 𝟲𝟲𝟲\n`;
            text += `┃  _Área Restrita (Meme/Troll)_\n┃\n`;

            text += `┣━━❪ 💀 𝗖𝗟𝗔𝗦𝗦𝗘𝗦 𝗦𝗘𝗖𝗥𝗘𝗧𝗔𝗦 ❫━━\n┃\n`;
            for (const [key, cls] of Object.entries(dueloManager.CLASSES)) {
                if (!cls.hidden) continue;
                text += `┃ ${cls.emoji} *${cls.name}*\n`;
                text += `┃   HP:${cls.hp} ATK:${cls.atk} DEF:${cls.def}\n`;
                text += `┃   ✦ _${cls.special.name}_\n`;
                text += `┃   └ ${cls.special.desc}\n┃\n`;
            }

            text += `┣━━❪ 🧬 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘𝗦 𝗦𝗘𝗖𝗥𝗘𝗧𝗔𝗦 ❫━━\n┃\n`;
            for (const [key, spv] of Object.entries(dueloManager.ESPECIES)) {
                if (!spv.hidden) continue;
                text += `┃ ${spv.emoji} *${spv.name.toUpperCase()}*\n`;
                const hpStr = spv.modifiers.hp >= 0 ? `+${spv.modifiers.hp}` : spv.modifiers.hp;
                const atkStr = spv.modifiers.atk >= 0 ? `+${spv.modifiers.atk}` : spv.modifiers.atk;
                const defStr = spv.modifiers.def >= 0 ? `+${spv.modifiers.def}` : spv.modifiers.def;
                text += `┃   ❤️ HP ${hpStr} │ ⚔️ ATK ${atkStr} │ 🛡️ DEF ${defStr}\n`;
                if (spv.special) {
                    text += `┃   🧬 _${spv.special.name}_\n`;
                    text += `┃   └ ${spv.special.desc}\n`;
                }
                text += `┃\n`;
            }

            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text }, { quoted: msg });
            return true;
        }
    }

    // ── CHANGELOG ────────────────────────────────────
    if (subCommand === 'changelog' || subCommand === 'updates' || subCommand === 'patch') {
        let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `┃\n`;
        text += `┃  📖 𝗚𝗨𝗜𝗔 𝗥𝗣𝗚 — 𝗖𝗛𝗔𝗡𝗚𝗘𝗟𝗢𝗚 🆕\n`;
        text += `┃\n`;
        text += `┣━━❪ ⚖️ 𝗕𝗔𝗟𝗔𝗡𝗖𝗘𝗔𝗠𝗘𝗡𝗧𝗢 ❫━━\n┃\n`;
        text += `┃ _(Patch Notes - Fevereiro 2026)_\n┃\n`;
        text += `┃ 🗡️ Guerreiro: ATK (18→17), DEF (14→13)\n`;
        text += `┃ 🧙 Mago: HP (90→95), ATK (22→23), DEF (8→9)\n`;
        text += `┃ 🏹 Arqueiro: HP (100→105), ATK (16→18), DEF (10→12)\n`;
        text += `┃ 🥷 Assassino: HP (85→90), ATK (20→24), DEF (6→7)\n`;
        text += `┃ ✝️ Clérigo: HP (100→115), ATK (10→12), DEF (12→15)\n`;
        text += `┃ 🧟‍♂️ Necromante: HP (95→105), ATK (14→16), DEF (10→13)\n`;
        text += `┃ ⚙️ Tecnomago: HP (105→110), ATK (16→17), DEF (12→14)\n┃\n`;
        text += `┣━━❪ ⚙️ 𝗠𝗘𝗖𝗔̂𝗡𝗜𝗖𝗔𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ *Nova Espécie: Bruxa* 🧙‍♀️\n`;
        text += `┃ Tem anti-cura passivo (reduz a cura do\n`;
        text += `┃ inimigo pela metade) e aplica tontura\n`;
        text += `┃ que faz inimigo errar ataques básicos.\n┃\n`;
        text += `┃ ➢ *Memória de Classe:* O bot agora\n`;
        text += `┃ salva a última classe que você jogou\n`;
        text += `┃ e a seleciona automaticamente em\n`;
        text += `┃ duelos futuros se você tiver espécie!\n┃\n`;
        text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    // ── STATS ───────────────────────────────────────────
    if (subCommand === 'stats' || subCommand === 'rank' || subCommand === 'ranking') {
        const targetJid = mentionedJids[0] || commandSenderJid;
        const stats = dueloManager.getStats(targetJid);
        const nick = contactManager.getNickname(targetJid) || targetJid.split('@')[0];

        const totalGames = stats.wins + stats.losses;
        const winRate = totalGames > 0 ? ((stats.wins / totalGames) * 100).toFixed(1) : '0.0';

        // Classe favorita
        let favClass = '—';
        if (stats.classWins && Object.keys(stats.classWins).length > 0) {
            const best = Object.entries(stats.classWins).sort(([, a], [, b]) => b - a)[0];
            const cls = dueloManager.CLASSES[best[0]];
            favClass = cls ? `${cls.emoji} ${cls.name} (${best[1]}W)` : best[0];
        }

        // Rank title baseado em wins
        let rankTitle = '🌑 Iniciante';
        if (stats.wins >= 50) rankTitle = '🌟 Lenda Imortal';
        else if (stats.wins >= 30) rankTitle = '⚡ Grão-Mestre';
        else if (stats.wins >= 20) rankTitle = '🔥 Mestre';
        else if (stats.wins >= 10) rankTitle = '⚔️ Veterano';
        else if (stats.wins >= 5) rankTitle = '🗡️ Guerreiro';
        else if (stats.wins >= 1) rankTitle = '🌙 Aprendiz';

        // Espécie escolhida
        let favSpecie = '—';
        if (stats.specie) {
            const spv = dueloManager.ESPECIES[stats.specie];
            if (spv) favSpecie = `${spv.emoji} ${spv.name}`;
            else favSpecie = stats.specie;
        }

        // Classe Atual / Escolhida
        let currentClass = '—';
        if (stats.lastClass) {
            const cls = dueloManager.CLASSES[stats.lastClass];
            if (cls) currentClass = `${cls.emoji} ${cls.name}`;
            else currentClass = stats.lastClass;
        }

        let text = `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 𝗦𝗧𝗔𝗧𝗦 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗝𝗼𝗴𝗮𝗱𝗼𝗿 › *${nick}*\n`;
        text += `┃ ➢ 𝗧𝗶́𝘁𝘂𝗹𝗼 › ${rankTitle}\n`;
        text += `┃ ➢ 𝗘𝘀𝗽𝗲́𝗰𝗶𝗲 › ${favSpecie}\n`;
        text += `┃ ➢ 𝗖𝗹𝗮𝘀𝘀𝗲 › ${currentClass}\n`;
        text += `┃ ➢ ⭐ 𝗟𝗲𝘃𝗲𝗹 › *${stats.level}*\n`;
        text += `┃ ➢ ✨ 𝗫𝗣 › ${stats.xp} / ${dueloManager.getXpForNextLevel(stats.level)}\n`;
        if (stats.pointsToUse > 0) {
            text += `┃ ➢ 🆙 *${stats.pointsToUse} Pontos Disponíveis!*\n`;
            text += `┃ Use: /duelo uppar <hp|atk|def> <qtd>\n`;
        }
        text += `┃\n┣━━❪ 🎯 𝗔𝗧𝗥𝗜𝗕𝗨𝗧𝗢𝗦 ❫━━\n┃\n`;
        text += `┃ ❤️ HP Bônus: +${stats.allocatedStats.hp * 5}\n`;
        text += `┃ ⚔️ ATK Bônus: +${stats.allocatedStats.atk}\n`;
        text += `┃ 🛡️ DEF Bônus: +${stats.allocatedStats.def}\n┃\n`;
        text += `┣━━❪ 📊 𝗥𝗘𝗖𝗢𝗥𝗗 ❫━━\n┃\n`;
        text += `┃ ➢ 𝗩𝗶𝘁𝗼́𝗿𝗶𝗮𝘀 › *${stats.wins}*\n`;
        text += `┃ ➢ 𝗗𝗲𝗿𝗿𝗼𝘁𝗮𝘀 › *${stats.losses}*\n`;
        text += `┃ ➢ 𝗪𝗶𝗻𝗥𝗮𝘁𝗲 › *${winRate}%*\n`;
        text += `┃ ➢ 𝗦𝗲𝗾𝘂𝗲̂𝗻𝗰𝗶𝗮 › 🔥 ${stats.streak} (máx: ${stats.maxStreak})\n`;
        text += `┃ ➢ 𝗙𝗮𝘃𝗼𝗿𝗶𝘁𝗮 › ${favClass}\n┃\n`;
        text += `┗━━━━━━━━━━━━━━`;

        const mentions = targetJid !== commandSenderJid ? [targetJid] : [];
        await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
        return true;
    }

    // ── TOP / LEADERBOARD ───────────────────────────────
    if (subCommand === 'top' || subCommand === 'leaderboard' || subCommand === 'lb') {
        const top = dueloManager.getTopPlayers(10);

        if (top.length === 0) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗧𝗢𝗣 ❫━━\n┃\n┃ ➢ 𝗜𝗡𝗙𝗢 › Nenhum duelo registrado ainda!\n┃ ➢ 𝗗𝗶𝗰𝗮 › Use ${prefix}${commandName} @user\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        let text = `┏━━❪ 🏆 𝗟𝗘𝗔𝗗𝗘𝗥𝗕𝗢𝗔𝗥𝗗 ❫━━\n┃\n`;
        const mentions = [];

        top.forEach((p, i) => {
            const nick = contactManager.getNickname(p.jid) || p.jid.split('@')[0];
            const medal = medals[i] || '•';
            text += `┃ ${medal} *${nick}* › ${p.wins}W/${p.losses}L`;
            if (p.streak > 0) text += ` 🔥${p.streak}`;
            text += `\n`;
            mentions.push(p.jid);
        });

        text += `┃\n┗━━━━━━━━━━━━━━`;
        await sock.sendMessage(sender, { text, mentions }, { quoted: msg });
        return true;
    }

    // ── UPPAR / LEVELS ──────────────────────────────────
    if (subCommand === 'uppar' || subCommand === 'up' || subCommand === 'upar') {
        const statName = args[1];
        const amount = args[2] || '1';

        if (!statName) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 🆙 𝗨𝗣𝗣𝗔𝗥 𝗦𝗧𝗔𝗧𝗦 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Faltou o Atributo!\n┃ ➢ Use: ${prefix}${commandName} uppar <hp|atk|def> <qtd>\n┃ ➢ Ex: ${prefix}${commandName} uppar atk 2\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const result = dueloManager.allocatePoints(commandSenderJid, statName, amount);

        if (!result.success) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 🆙 𝗨𝗣𝗣𝗔𝗥 𝗦𝗧𝗔𝗧𝗦 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        let statEmoji = '❤️';
        if (statName.toLowerCase() === 'atk') statEmoji = '⚔️';
        if (statName.toLowerCase() === 'def') statEmoji = '🛡️';

        await sock.sendMessage(sender, {
            text: `┏━━❪ 🆙 𝗨𝗣𝗣𝗔𝗥 𝗦𝗧𝗔𝗧𝗦 ❫━━\n┃\n┃ ✨ ${statEmoji} Atributo elevado com sucesso!\n┃ ➢ Foram alocados ${amount} pontos.\n┃ ➢ Bônus Total em ${statName.toUpperCase()}: +${result.newTotal}\n┃\n┃ ➢ _Restam ${result.remaining} pontos._\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // ── ACEITAR DESAFIO ─────────────────────────────────
    if (subCommand === 'aceitar' || subCommand === 'accept') {
        const result = dueloManager.acceptChallenge(sender, commandSenderJid);

        if (!result.success) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const game = dueloManager.getGame(sender);

        // Auto-selecionar classes anteriores se existirem
        const cStats = dueloManager.getStats(game.challenger);
        const tStats = dueloManager.getStats(game.target);

        let cNick = contactManager.getNickname(game.challenger) || game.challenger.split('@')[0];
        let tNick = contactManager.getNickname(game.target) || game.target.split('@')[0];

        if (cStats.specie && cStats.lastClass) {
            dueloManager.selectBuild(sender, game.challenger, cStats.lastClass);
        }
        if (tStats.specie && tStats.lastClass) {
            dueloManager.selectBuild(sender, game.target, tStats.lastClass);
        }

        if (game.status === 'ongoing') {
            await startBattleUI(sock, sender, prefix, commandName, game);
            return true;
        }

        let text = `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 𝗔𝗖𝗘𝗜𝗧𝗢 ❫━━\n┃\n`;
        text += `┃ ➢ _O desafio foi aceito!_\n┃\n`;

        if (game.players[game.challenger]) {
            text += `┃ ➢ *${cNick}* já estava preparado como *${game.players[game.challenger].className}*!\n`;
        }
        if (game.players[game.target]) {
            text += `┃ ➢ *${tNick}* já estava preparado como *${game.players[game.target].className}*!\n`;
        }

        text += `┗━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text,
            mentions: [game.challenger, game.target]
        }, { quoted: msg });
        return true;
    }

    // ── DEFINIR ESPÉCIE ──────────────────────────────────
    if (subCommand === 'especie' || subCommand === 'raca') {
        const specieName = args[1] || '';
        if (!specieName) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ 🧬 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Forneça uma espécie!\n┃ ➢ Ex: ${prefix}${commandName} especie humano\n┃ ➢ (Veja as opções em: ${prefix}${commandName} guia 4)\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const result = dueloManager.setSpecie(commandSenderJid, specieName);
        if (!result.success) {
            let errorText = `┏━━❪ 🧬 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n`;
            if (result.especies) {
                errorText += `┃\n┣━━❪ 𝗗𝗜𝗦𝗣𝗢𝗡𝗜́𝗩𝗘𝗜𝗦 ❫━━\n┃\n`;
                result.especies.forEach(e => {
                    const spv = dueloManager.ESPECIES[e];
                    if (spv && !spv.hidden) errorText += `┃ ${spv.emoji} *${spv.name}*\n`;
                });
            }
            errorText += `┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text: errorText }, { quoted: msg });
            return true;
        }

        const spv = result.specieData;
        const nick = contactManager.getNickname(commandSenderJid) || commandSenderJid.split('@')[0];
        await sock.sendMessage(sender, {
            text: `┏━━❪ 🧬 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘 ❫━━\n┃\n┃ ➢ *${nick}* agora é da espécie:\n┃ ➢ ${spv.emoji} *${spv.name}*\n┃\n┃ _${spv.lore}_\n┃\n┗━━━━━━━━━━━━━━`
        });
        return true;
    }

    // ── SELECIONAR BUILD ───────────────────────────────
    if (subCommand === 'jogar' || subCommand === 'play' || subCommand === 'choose' || subCommand === 'classe') {
        const className = args[1] || '';

        if (!className) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Formato inválido!\n┃ ➢ Use: ${prefix}${commandName} jogar <classe>\n┃ ➢ Ex: ${prefix}${commandName} jogar mago\n┃\n┃ ➢ (Você escolheu sua espécie? Use: ${prefix}${commandName} especie <nome>)\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const result = dueloManager.selectBuild(sender, commandSenderJid, className);

        if (!result.success) {
            if (result.requireSpecie) {
                await sock.sendMessage(sender, {
                    text: `┏━━❪ 🧬 𝗘𝗦𝗣𝗘́𝗖𝗜𝗘 ❫━━\n┃\n┃ ➢ ⚠️ ${result.message}\n┃ ➢ Defina sua raça com: ${prefix}${commandName} especie <nome>\n┃ ➢ (Opções: ${prefix}${commandName} guia 4)\n┃\n┗━━━━━━━━━━━━━━`
                }, { quoted: msg });
                return true;
            }

            let errorText = `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n`;
            if (result.classes) {
                errorText += `┃\n┣━━❪ 📜 𝗖𝗟𝗔𝗦𝗦𝗘𝗦 ❫━━\n┃\n`;
                result.classes.forEach(c => {
                    const cls = dueloManager.CLASSES[c];
                    if (cls && !cls.hidden) errorText += `┃ ${cls.emoji} *${cls.name}*\n`;
                });
            }
            errorText += `┃\n┗━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text: errorText }, { quoted: msg });
            return true;
        }

        if (result.savedOutsideBattle) {
            const cls = result.classData;
            const nick = contactManager.getNickname(commandSenderJid) || commandSenderJid.split('@')[0];
            await sock.sendMessage(sender, {
                text: `┏━━❪ 📜 𝗖𝗟𝗔𝗦𝗦𝗘 ❫━━\n┃\n┃ ➢ *${nick}* guardou sua poeira.\n┃ Agora sua classe preferida é:\n┃ ➢ ${cls.emoji} *${cls.name}*\n┃\n┃ _Entrará na próxima batalha com ela!_\n┃\n┗━━━━━━━━━━━━━━`
            });
            return true;
        }

        const game = dueloManager.getGame(sender);
        const pState = game.players[commandSenderJid];
        const nick = contactManager.getNickname(commandSenderJid) || commandSenderJid.split('@')[0];

        if (!game.turn) {
            // Apenas um escolheu
            await sock.sendMessage(sender, {
                text: `┏━━❪ ${pState.classEmoji} 𝗕𝗨𝗜𝗟𝗗 ❫━━\n┃\n┃ ➢ *${nick}* escolheu ser um\n┃ ${pState.emoji} ${pState.classEmoji} *${pState.specieName} ${pState.className}*!\n┃\n┃ ➢ ❤️ HP:${pState.hp} ⚔️ ATK:${pState.atk} 🛡️ DEF:${pState.def}\n┃ ➢ ✦ ${pState.specialName}\n┃\n┃ ➢ _Aguardando o oponente..._\n┃\n┗━━━━━━━━━━━━━━`
            });
            return true;
        }

        // Ambos prontos — INICIAR BATALHA!
        await startBattleUI(sock, sender, prefix, commandName, game);
        return true;
    }

    // ── AÇÕES DE COMBATE ────────────────────────────────
    const combatActions = ['atacar', 'attack', 'defender', 'defend', 'especial', 'special', 'racial', 'pocao', 'potion'];
    if (combatActions.includes(subCommand)) {
        // Normalizar ação
        let action = subCommand;
        if (action === 'attack') action = 'atacar';
        if (action === 'defend') action = 'defender';
        if (action === 'special') action = 'especial';
        if (action === 'potion') action = 'pocao';
        if (action === 'racial') action = 'racial';

        const result = dueloManager.performAction(sender, commandSenderJid, action);

        if (!result.success) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const game = dueloManager.getGame(sender);
        const attackerNick = contactManager.getNickname(result.attackerJid) || result.attackerJid.split('@')[0];
        const defenderNick = contactManager.getNickname(result.defenderJid) || result.defenderJid.split('@')[0];

        // Construir mensagem de combate
        let text = `┏━━❪ ⚔️ 𝗖𝗢𝗠𝗕𝗔𝗧𝗘 ❫━━\n┃\n`;
        text += `┃ *${attackerNick}*\n`;
        text += `┃ ${result.narration}\n┃\n`;

        if (result.damage > 0) {
            text += `┃ 💥 *-${result.damage} HP* em ${defenderNick}\n`;
        }
        if (result.healed > 0) {
            text += `┃ 💚 *+${result.healed} HP* curado\n`;
        }
        if (result.isDodge) {
            text += `┃ 💨 ${defenderNick} esquivou do ataque!\n`;
        }

        // --- GERANDO NARRAÇÃO DA IA ---
        try {
            const prompt = `Narre a batalha de RPG no WhatsApp. Resumo do turno: "${result.narration}". Jogador ${attackerNick} agiu contra ${defenderNick}. Dano: ${result.damage}. Cura: ${result.healed}. Esquiva: ${result.isDodge}. Crie um comentário sarcástico, marrento e debochado sobre o que aconteceu neste turno. Máximo de 2 frases curtas. Sem uso de emojis e sem se identificar, vá direto ao comentário.`;
            const systemPrompt = `Você é ${BOT_NAME}. Narre a batalha de RPG de forma extremamente sarcástica e seca. Max 1-2 frases. Zero emojis. NUNCA diga seu nome.`;
            // Timeout de 3s para evitar atrasar o duelo
            const narracaoPromise = rawCompletion([{ role: 'user', content: prompt }], systemPrompt);
            const narracao = await Promise.race([
                narracaoPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de narração')), 3500))
            ]);

            if (narracao) {
                text += `┃\n┣━━❪ 🎙️ ${BOT_NAME.toUpperCase()} ❫━━\n┃\n┃ _"${narracao}"_\n`;
            }
        } catch (e) {
            // Ignorar erro silenciosamente para não quebrar o duelo
            console.log(`[Duelo] Pulo de narração: ${e.message}`);
        }

        if (result.gameOver) {
            // FIM DE JOGO
            const gameBeforeDeletion = dueloManager.getGame(sender);
            const winnerNick = contactManager.getNickname(result.winner) || result.winner.split('@')[0];
            const loserNick = contactManager.getNickname(result.loser) || result.loser.split('@')[0];
            const winnerStats = dueloManager.getStats(result.winner);

            text += `┃\n┣━━━━━━━━━━━━━━━━━━━━━━━━\n┃\n`;
            text += `┃    🏆 𝗙𝗜𝗠 𝗗𝗘 𝗣𝗢𝗠𝗢 🏆\n┃\n`;
            text += `┃ 👑 *${winnerNick}* venceu!\n`;
            text += `┃ 💀 *${loserNick}* foi derrotado!\n┃\n`;
            text += `┃ 📊 Record: ${winnerStats.wins}W/${winnerStats.losses}L\n`;
            if (winnerStats.streak > 1) {
                text += `┃ 🔥 Sequência de *${winnerStats.streak}* vitórias!\n`;
            }

            // Anunciar XP e Level UP se não for partida Meme
            if (gameBeforeDeletion && gameBeforeDeletion.xpResults) {
                const wRes = gameBeforeDeletion.xpResults.winner;
                const lRes = gameBeforeDeletion.xpResults.loser;

                text += `┃\n┣━━❪ ✨ 𝗥𝗣𝗚 𝗫𝗣 ❫━━\n┃\n`;
                text += `┃ 🟢 *${winnerNick}* +50 XP\n`;
                if (wRes.leveledUp) {
                    text += `┃ ⭐ 𝗟𝗘𝗩𝗘𝗟 𝗨𝗣! Nível ${wRes.newLevel} (+${wRes.pointsEarned}pts)\n`;
                }

                text += `┃ 🔴 *${loserNick}* +10 XP\n`;
                if (lRes.leveledUp) {
                    text += `┃ ⭐ 𝗟𝗘𝗩𝗘𝗟 𝗨𝗣! Nível ${lRes.newLevel} (+${lRes.pointsEarned}pts)\n`;
                }
            }

            text += `┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            // Tentar gerar victory card
            const winnerClass = gameBeforeDeletion?.players[result.winner]?.class || 'guerreiro';
            const loserClass = gameBeforeDeletion?.players[result.loser]?.class || 'guerreiro';
            try {
                const cardPath = await generateVictoryCard(
                    winnerNick, loserNick, winnerClass, loserClass,
                    winnerStats, gameBeforeDeletion?.turnCount || 0
                );
                await sock.sendMessage(sender, {
                    image: { url: cardPath },
                    caption: text,
                    mentions: [result.attackerJid, result.defenderJid]
                });
                fs.unlink(cardPath).catch(() => { });
            } catch (e) {
                console.error('[Duelo] Erro ao gerar victory card:', e.message);
                await sock.sendMessage(sender, { text, mentions: [result.attackerJid, result.defenderJid] });
            }
        } else {
            // Estado atual da batalha
            const p1Jid = game.challenger;
            const p2Jid = game.target;
            const p1 = game.players[p1Jid];
            const p2 = game.players[p2Jid];
            const n1 = contactManager.getNickname(p1Jid) || p1Jid.split('@')[0];
            const n2 = contactManager.getNickname(p2Jid) || p2Jid.split('@')[0];
            const turnNick = contactManager.getNickname(game.turn) || game.turn.split('@')[0];

            const formatBuffs = (p) => {
                const buffs = [];
                if (p.buffs.burn > 0) buffs.push(`🔥 Queimando(${p.buffs.burn}t)`);
                if (p.buffs.poison > 0) buffs.push(`☠️ Veneno(${p.buffs.poison}t)`);
                if (p.buffs.shielded) buffs.push(`🛡️ Escudo`);
                if (p.buffs.atkMultiplier > 1) buffs.push(`⚡ ATK+(${p.buffs.atkBuffTurns}t)`);
                if (p.buffs.magicBarrier) buffs.push(`🔮 Barreira`);
                if (p.buffs.precisionAim) buffs.push(`🎯 Mira`);
                if (p.buffs.silenced > 0) buffs.push(`🔌 Silenciado(${p.buffs.silenced}t)`);
                if (p.buffs.boneShield > 0) buffs.push(`🦴 Osso`);
                if (p.buffs.ironSkinTurns > 0) buffs.push(`🧔‍♂️ Aço(${p.buffs.ironSkinTurns}t)`);
                if (p.buffs.dizzy > 0) buffs.push(`💫 Tonto(${p.buffs.dizzy}t)`);

                // Quebrar linhas se tiver muitos buffs pra não desformatar (a cada 3)
                if (buffs.length === 0) return '';
                let buffStr = '';
                for (let i = 0; i < buffs.length; i += 3) {
                    const line = buffs.slice(i, i + 3).join(' │ ');
                    buffStr += `┃ ↳ ${line}\n`;
                }
                return buffStr;
            };

            text += `┃\n┣━━❪ 📊 𝗦𝗧𝗔𝗧𝗨𝗦 ❫━━\n┃\n`;
            text += `┃ ${p1.emoji}${p1.classEmoji} *${n1}* — ❤️ HP: ${p1.hp}/${p1.maxHp}\n`;
            text += formatBuffs(p1);
            text += `┃\n`;
            text += `┃ ${p2.emoji}${p2.classEmoji} *${n2}* — ❤️ HP: ${p2.hp}/${p2.maxHp}\n`;
            text += formatBuffs(p2);
            text += `┃\n`;

            // Mostrar ações e especial status
            const currentPlayer = game.players[game.turn];
            const specialStatus = currentPlayer.specialCooldown > 0
                ? `(⏳ ${currentPlayer.specialCooldown}t)`
                : '(✅ Pronto)';
            const potionStatus = currentPlayer.potions > 0 ? `(✅ ${currentPlayer.potions}x)` : '(❌ Esgotado)';

            text += `┣━━❪ ⏳ 𝗧𝗨𝗥𝗡𝗢 ${game.turnCount} ❫━━\n┃\n`;
            text += `┃ ➢ Vez de *${turnNick}*!\n┃\n`;
            text += `┃ ⚔️ atacar │ 🛡️ defender\n`;
            text += `┃ ✨ especial ${specialStatus}\n`;
            text += `┃ 🧬 racial ${currentPlayer.racialCooldown > 0 ? `(⏳ ${currentPlayer.racialCooldown}t)` : '(✅ Pronto)'}\n`;
            text += `┃ 🧪 pocao ${potionStatus}\n┃\n`;
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

            // Tentar gerar action card
            try {
                const cardPath = await generateActionCard(game, result, n1, n2);
                await sock.sendMessage(sender, {
                    image: { url: cardPath },
                    caption: text,
                    mentions: [result.attackerJid, result.defenderJid]
                });
                fs.unlink(cardPath).catch(() => { });
            } catch (e) {
                console.error('[Duelo] Erro ao gerar action card:', e.message);
                await sock.sendMessage(sender, { text, mentions: [result.attackerJid, result.defenderJid] });
            }
        }

        return true;
    }

    // ── DESISTIR ────────────────────────────────────────
    if (subCommand === 'desistir' || subCommand === 'surrender' || subCommand === 'ff') {
        const game = dueloManager.getGame(sender);
        if (!game) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhum duelo ativo!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }
        if (game.challenger !== commandSenderJid && game.target !== commandSenderJid) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Você não faz parte deste duelo!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const winnerJid = commandSenderJid === game.challenger ? game.target : game.challenger;
        const loserNick = contactManager.getNickname(commandSenderJid) || commandSenderJid.split('@')[0];
        const winnerNick = contactManager.getNickname(winnerJid) || winnerJid.split('@')[0];

        dueloManager.deleteGame(sender);

        await sock.sendMessage(sender, {
            text: `┏━━❪ 🏳️ 𝗗𝗘𝗦𝗜𝗦𝗧𝗘̂𝗡𝗖𝗜𝗔 ❫━━\n┃\n┃ ➢ *${loserNick}* desistiu da batalha!\n┃ ➢ 👑 *${winnerNick}* vence por W.O.!\n┃\n┃ ➢ _(Desistências pacíficas não alteram o Rank)_ \n┃\n┗━━━━━━━━━━━━━━`,
            mentions: [commandSenderJid, winnerJid]
        });
        return true;
    }

    // ── CANCELAR (antes de aceitar) ─────────────────────
    if (subCommand === 'cancelar' || subCommand === 'cancel') {
        const game = dueloManager.getGame(sender);
        if (!game || game.status !== 'pending') {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Nenhum desafio pendente!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }
        if (game.challenger !== commandSenderJid) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Apenas o desafiante pode cancelar!\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        dueloManager.deleteGame(sender);
        await sock.sendMessage(sender, {
            text: `┏━━❪ ❌ 𝗖𝗔𝗡𝗖𝗘𝗟𝗔𝗗𝗢 ❫━━\n┃\n┃ ➢ O desafio foi cancelado.\n┃\n┗━━━━━━━━━━━━━━`
        }, { quoted: msg });
        return true;
    }

    // ── DESAFIAR ALGUÉM ─────────────────────────────────
    if (mentionedJids.length === 1) {
        const targetJid = mentionedJids[0];

        if (targetJid === commandSenderJid) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › Você não pode duelar consigo mesmo!\n┃ ➢ _( a menos que tenha dupla personalidade )_\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const result = dueloManager.createGame(sender, commandSenderJid, targetJid);

        if (!result.success) {
            await sock.sendMessage(sender, {
                text: `┏━━❪ ⚔️ 𝗗𝗨𝗘𝗟𝗢 ❫━━\n┃\n┃ ➢ 𝗘𝗥𝗥𝗢 › ${result.message}\n┃\n┗━━━━━━━━━━━━━━`
            }, { quoted: msg });
            return true;
        }

        const challengerNick = contactManager.getNickname(commandSenderJid) || commandSenderJid.split('@')[0];
        const targetNick = contactManager.getNickname(targetJid) || targetJid.split('@')[0];

        let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        text += `┃\n`;
        text += `┃    ⚔️ 𝗗𝗘𝗦𝗔𝗙𝗜𝗢 ⚔️\n┃\n`;
        text += `┃ 🗡️ *${challengerNick}* desafia\n`;
        text += `┃ 🎯 *${targetNick}* para um duelo!\n`;

        text += `┃\n┣━━❪ 📌 𝗖𝗢𝗠𝗢 ❫━━\n┃\n`;
        text += `┃ ➢ @${targetJid.split('@')[0]} digite:\n`;
        text += `┃   ${prefix}${commandName} aceitar\n┃\n`;
        text += `┃ ➢ _Expira em 5 minutos_\n┃\n`;
        text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

        await sock.sendMessage(sender, {
            text,
            mentions: [commandSenderJid, targetJid]
        });
        return true;
    }

    // ── MENU DE AJUDA ───────────────────────────────────
    let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `┃\n`;
    text += `┃   ⚔️ 𝗗𝗨𝗘𝗟𝗢 — 𝗥𝗣𝗚 𝗕𝗔𝗧𝗧𝗟𝗘 ⚔️\n┃\n`;
    text += `┃ _Sistema de combate épico por turnos!_\n`;
    text += `┃ _Escolha sua classe e destrua oponentes._\n┃\n`;
    text += `┣━━❪ 🎮 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 ❫━━\n┃\n`;
    text += `┃ ➢ ${prefix}${commandName} @user › Desafiar\n`;
    text += `┃ ➢ ${prefix}${commandName} aceitar › Aceitar duelo\n`;
    text += `┃ ➢ ${prefix}${commandName} especie › Escolher raça\n`;
    text += `┃ ➢ ${prefix}${commandName} jogar [cls] › Batalhar\n`;
    text += `┃ ➢ ${prefix}${commandName} atacar › Ataque normal\n`;
    text += `┃ ➢ ${prefix}${commandName} defender › +50% DEF\n`;
    text += `┃ ➢ ${prefix}${commandName} especial › Poder único\n`;
    text += `┃ ➢ ${prefix}${commandName} pocao › +30 HP (1x)\n`;
    text += `┃ ➢ ${prefix}${commandName} desistir › Render-se\n┃\n`;
    text += `┣━━❪ 📊 𝗥𝗔𝗡𝗞𝗜𝗡𝗚 ❫━━\n┃\n`;
    text += `┃ ➢ ${prefix}${commandName} stats › Suas stats\n`;
    text += `┃ ➢ ${prefix}${commandName} top › Leaderboard\n`;
    text += `┃ ➢ ${prefix}${commandName} guia › Guia completo\n`;
    text += `┃ ➢ ${prefix}${commandName} changelog › Atualizações\n┃\n`;
    text += `┣━━❪ ⚔️ 𝗖𝗟𝗔𝗦𝗦𝗘𝗦 ❫━━\n┃\n`;

    for (const [key, cls] of Object.entries(dueloManager.CLASSES)) {
        text += `┃ ${cls.emoji} *${cls.name}*\n`;
        text += `┃   _"${cls.lore}"_\n`;
    }

    text += `┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

async function startBattleUI(sock, sender, prefix, commandName, game) {
    const p1 = game.players[game.challenger];
    const p2 = game.players[game.target];
    const n1 = contactManager.getNickname(game.challenger) || game.challenger.split('@')[0];
    const n2 = contactManager.getNickname(game.target) || game.target.split('@')[0];
    const turnNick = contactManager.getNickname(game.turn) || game.turn.split('@')[0];

    // Mensagem épica de início
    let text = `┏━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `┃\n`;
    text += `┃    ⚔️ 𝗗 𝗨 𝗘 𝗟 𝗢 ⚔️\n`;
    text += `┃\n`;
    text += `┣━━❪ 🔴 𝗥𝗘𝗗 𝗖𝗢𝗥𝗡𝗘𝗥 ❫━━\n┃\n`;
    text += `┃ ${p1.emoji}${p1.classEmoji} *${n1}* — ${p1.specieName} ${p1.className}\n`;
    text += `┃ ❤️ ${dueloManager.hpBar(p1.hp, p1.maxHp)}\n`;
    text += `┃ ⚔️ ATK:${p1.atk} 🛡️ DEF:${p1.def}\n┃\n`;
    text += `┃          ⚡ 𝗩𝗦 ⚡\n┃\n`;
    text += `┣━━❪ 🔵 𝗕𝗟𝗨𝗘 𝗖𝗢𝗥𝗡𝗘𝗥 ❫━━\n┃\n`;
    text += `┃ ${p2.emoji}${p2.classEmoji} *${n2}* — ${p2.specieName} ${p2.className}\n`;
    text += `┃ ❤️ ${dueloManager.hpBar(p2.hp, p2.maxHp)}\n`;
    text += `┃ ⚔️ ATK:${p2.atk} 🛡️ DEF:${p2.def}\n┃\n`;
    text += `┣━━❪ 🎮 𝗔𝗖̧𝗢̃𝗘𝗦 ❫━━\n┃\n`;
    text += `┃ ➢ ${prefix}${commandName} atacar\n`;
    text += `┃ ➢ ${prefix}${commandName} defender\n`;
    text += `┃ ➢ ${prefix}${commandName} especial\n`;
    text += `┃ ➢ ${prefix}${commandName} racial\n`;
    text += `┃ ➢ ${prefix}${commandName} pocao\n┃\n`;
    text += `┣━━❪ ⏳ 𝗧𝗨𝗥𝗡𝗢 𝟭 ❫━━\n┃\n`;
    text += `┃ ➢ Vez de *${turnNick}*!\n┃\n`;
    text += `┗━━━━━━━━━━━━━━━━━━━━━━━━`;

    // Tentar gerar card visual
    try {
        const cardPath = await generateArenaCard(game, n1, n2);
        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: text,
            mentions: [game.challenger, game.target]
        });
        // Limpar arquivo temporário
        fs.unlink(cardPath).catch(() => { });
    } catch (e) {
        console.error('[Duelo] Erro ao gerar arena card:', e.message);
        await sock.sendMessage(sender, {
            text,
            mentions: [game.challenger, game.target]
        });
    }
}

module.exports = handleDueloCommand;

module.exports.commandData = {
    name: "duelo",
    description: "RPG Battle — Desafie e lute com classes e poderes!",
    category: "jogos",
    usage: "/duelo [@user]",
    aliases: ["/duel", "/battle", "/rpg", "/batalha"]
};
