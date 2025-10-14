// src/commands/combate.js (v3.4: Adicionada narração 'cria')
const aliases = require('../../config/aliases.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../../config/config.js');

// --- INICIALIZAÇÃO DA IA ---
if (!config.GEMINI_API_KEY) {
    throw new Error("A GEMINI_API_KEY não foi encontrada para o comando de combate.");
}
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
// --- FIM DA INICIALIZAÇÃO ---


// --- BLOCO DE ESTILOS DE NARRAÇÃO ---
const narrationStyles = {
    'cria': {
        turn: `[CONTEXTO] tu é a julia, uma cria do rio de janeiro, comunista e trans. narra esse turno. tua regra é ser curta e direta pra caralho (1-2 frases), usando gíria e xingamento (porra, caralho). escreve em minúscula, mas usa maiúscula pra dar ênfase. o histórico da luta é: {history}. agora {attackerName} tentou isso aqui: "{move}". o filha da puta rolou um {diceRoll}. resultado: {outcome}. narra essa porra agora, na tua voz.`,
        finisher: `[CONTEXTO] tu é a julia, cria do rio de janeiro, comunista e trans. a luta acabou, porra. o histórico é esse: {history}. o golpe final do {winnerName} no {loserName} foi esse: "{finalMove}". narra essa finalização de forma curta, direta e na tua ideologia. sem enrolação, caralho.`
    },
    'comico': {
        turn: `Você é um narrador de lutas de anime exagerado e engraçado. O histórico da luta é:\n{history}\n\nAgora, {attackerName} tenta o seguinte ataque: "{move}".\n\nA rolagem de dado foi {diceRoll} (precisava de 9 ou mais para acertar). O resultado foi: {outcome}\n\nNarre o que acontece neste turno de forma criativa e curta (máximo 2 frases), incorporando o resultado (se o ataque acertou e o dano, ou se falhou de forma hilariante).`,
        finisher: `Você é um narrador de lutas de anime épico. A luta chegou ao fim. O histórico da luta é:\n{history}\n\nO golpe final que {winnerName} usou para derrotar {loserName} foi: "{finalMove}".\n\nDescreva esta finalização de forma dramática e elaborada. Fale sobre o desespero do perdedor e a glória do vencedor. Seja criativo!`
    },
    'serio': {
        turn: `Você é um narrador de combate tático e sério. O histórico da luta é:\n{history}\n\nAgora, {attackerName} executa o seguinte movimento: "{move}".\n\nA rolagem de dado de ataque foi {diceRoll} (precisava de 9 ou mais). O resultado foi: {outcome}\n\nDescreva a ação de forma precisa, direta e curta (máximo 2 frases), focando no impacto físico e na estratégia, sem humor.`,
        finisher: `Você é um narrador de combate sério e grave. A luta terminou. O histórico é:\n{history}\n\nO golpe de misericórdia de {winnerName} contra {loserName} foi: "{finalMove}".\n\nDescreva o momento final com um tom definitivo, focando na consequência do golpe e no silêncio que se segue à queda do perdedor.`
    },
    'poetico': {
        turn: `Você é um bardo que narra combates em forma de poesia. O histórico da contenda é um poema inacabado:\n{history}\n\nAgora, a estrofe é de {attackerName}, que declama seu verso com o movimento: "{move}".\n\nA sorte, em um dado de {diceRoll}, decidiu o destino. O resultado foi: {outcome}\n\nDescreva esta cena em até 2 frases, usando metáforas e linguagem floreada. Compare a luta a uma dança, uma tempestade ou uma canção.`,
        finisher: `Você é um poeta trágico. A canção da batalha chegou ao seu clímax e fim. O poema até agora:\n{history}\n\nO verso final foi escrito por {winnerName} com a tinta do golpe: "{finalMove}", selando o destino de {loserName}.\n\nDescreva o último suspiro da luta com beleza e melancolia. Fale da glória efêmera e da queda inevitável, como folhas no outono.`
    },
    'noir': {
        turn: `Você é um detetive particular cínico, narrando uma briga de beco em uma noite chuvosa. O que já rolou:\n{history}\n\nFoi a vez de {attackerName} mostrar seu repertório sujo com um: "{move}".\n\nOs dados da vida rolaram um {diceRoll}. Precisava de 9. O resultado: {outcome}\n\nNarre a cena em 2 frases curtas e grossas, com o pessimismo de quem já viu de tudo. A cidade não se importa com mais um corpo no chão.`,
        finisher: `Você é um detetive noir no final de um caso que deu errado. A luta acabou. A história até aqui:\n{history}\n\nO golpe que encerrou a conversa foi um "{finalMove}", cortesia de {winnerName}. {loserName} não vai mais se levantar. Ponto final.\n\nDescreva a cena final com um tom fatalista. A chuva continua caindo, lavando o sangue, mas não a sujeira daquela noite. Alguém venceu, mas no fundo, todos perderam.`
    },
    'documentario': {
        turn: `Você é um narrador de documentários sobre vida selvagem, como David Attenborough. Observamos o confronto:\n{history}\n\nO espécime, {attackerName}, agora exibe um comportamento agressivo, o movimento: "{move}".\n\nO resultado de sua tentativa, baseado na rolagem de {diceRoll}, foi: {outcome}\n\nAnalise esta interação em 2 frases, de forma clínica e observacional, como se estivesse descrevendo animais em uma disputa por território.`,
        finisher: `Você é um narrador de documentários da natureza. A disputa territorial chegou a uma conclusão definitiva. O histórico:\n{history}\n\nO indivíduo dominante, {winnerName}, afirmou sua posição com uma demonstração final de força: "{finalMove}", subjugando {loserName}.\n\nDescreva a conclusão da luta em tom científico. Fale sobre a hierarquia estabelecida e o ciclo da natureza, onde o mais forte prevalece para garantir sua linhagem.`
    },
    'mestre_rpg': {
        turn: `Você é um Mestre de um jogo de RPG de mesa. O resumo da sessão até agora:\n{history}\n\nOk, {attackerName}, é o seu turno. Você diz que vai usar "{move}". Certo, role seu d20 de ataque.\n\n...O resultado do dado foi {diceRoll}. Você precisava de 9. O resultado foi: {outcome}\n\nDescreva para o "jogador" o que ele e os outros na mesa veem acontecer, em até 2 frases.`,
        finisher: `Você é um Mestre de RPG narrando o fim épico de um combate. O resumo:\n{history}\n\nO golpe final foi de {winnerName}, que usou "{finalMove}" para acabar com {loserName}, que está com 0 ou menos pontos de vida.\n\nDescreva a cena final para os seus jogadores de forma épica. "Vocês veem o corpo de {loserName} caindo ao chão..." Dê detalhes sobre a vitória e o que eles podem saquear do corpo.`
    }
};
// --- FIM DO BLOCO DE ESTILOS ---


const activeCombats = {}; // { "chatJid": { fighter1, fighter2, turn, story, hp, narrationMode, ... } }

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatPrompt(prompt, replacements) {
    return Object.entries(replacements).reduce((acc, [key, value]) => {
        return acc.replace(new RegExp(`{${key}}`, 'g'), value);
    }, prompt);
}

/**
 * Pede à IA para narrar um turno da luta.
 */
async function narrateTurn(combat, attackerName, opponentName, move, diceRoll, hit, damage) {
    const history = combat.story.join('\n');
    const style = combat.narrationMode || 'comico'; // Garante um padrão
    
    let outcome;
    if (hit) {
        outcome = `O ataque foi um SUCESSO e causou ${damage} de dano! ${opponentName} agora tem ${combat.hp[combat.turn]} HP.`;
    } else {
        outcome = `O ataque FALHOU!`;
    }
    
    let basePrompt = narrationStyles[style]?.turn || narrationStyles['comico'].turn;
    const prompt = formatPrompt(basePrompt, { history, attackerName, move, diceRoll, outcome });
    
    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Pede à IA para narrar um golpe finalizador.
 */
async function narrateFinisher(combat, winnerName, loserName, finalMove) {
    const history = combat.story.join('\n');
    const style = combat.narrationMode || 'comico';

    let basePrompt = narrationStyles[style]?.finisher || narrationStyles['comico'].finisher;
    const prompt = formatPrompt(basePrompt, { history, winnerName, loserName, finalMove });

    const result = await model.generateContent(prompt);
    return result.response.text();
}


async function handleCombatCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid, commandText } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const pushName = msgDetails.pushName || commandSenderJid.split('@')[0];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "O combate só pode acontecer em grupos." });
        return;
    }

    const combat = activeCombats[chatJid];

    // --- SUBCOMANDO /ACEITARCOMBATE ---
    if (command === '/aceitarcombate') {
        if (!combat || combat.status !== 'pending' || commandSenderJid !== combat.fighter2) {
            await sock.sendMessage(chatJid, { text: `Não há nenhum desafio de combate pendente para você, @${commandSenderJid.split('@')[0]}.`, mentions: [commandSenderJid] });
            return;
        }

        combat.status = 'ongoing';
        clearTimeout(combat.timeout);
        
        const firstPlayer = Math.random() < 0.5 ? combat.fighter1 : combat.fighter2;
        combat.turn = firstPlayer;

        const startText = `🔥 O desafio foi aceite! A batalha entre @${combat.fighter1.split('@')[0]} e @${combat.fighter2.split('@')[0]} vai começar!\n\n*Modo de Narração:* ${combat.narrationMode}\n\n${combat.story[0]}\n\nAmbos começam com 100 HP!\n\nÉ a vez de @${firstPlayer.split('@')[0]} atacar! Use \`/ataque <seu golpe>\`.`;
        await sock.sendMessage(chatJid, { text: startText, mentions: [combat.fighter1, combat.fighter2, firstPlayer] });
        return;
    }

    // --- SUBCOMANDO /ATAQUE (VERSÃO MELHORADA) ---
    if (command === '/ataque') {
        if (!combat || combat.status !== 'ongoing') {
            await sock.sendMessage(chatJid, { text: "Não há nenhum combate a decorrer." });
            return;
        }
        if (commandSenderJid !== combat.turn) {
            await sock.sendMessage(chatJid, { text: `Acalme-se, @${pushName}! Ainda não é a sua vez de atacar.`, mentions: [commandSenderJid] });
            return;
        }

        const move = commandText.substring(command.length).trim();
        if (!move) {
            await sock.sendMessage(chatJid, { text: "Você precisa de descrever o seu ataque! Ex: `/ataque lanço uma cadeira`" });
            return;
        }

        await sock.sendMessage(chatJid, { react: { text: '🎲', key: msg.key } });

        const attacker = commandSenderJid;
        const opponent = combat.fighter1 === attacker ? combat.fighter2 : combat.fighter1;

        const diceRoll = Math.floor(Math.random() * 20) + 1;
        let hit = false;
        let damage = 0;
        let specialMessage = ""; 

        await sock.sendMessage(chatJid, { text: `🎲 @${attacker.split('@')[0]} rolou um *${diceRoll}*!`, mentions: [attacker] });
        await delay(1500);

        if (diceRoll === 20) {
            hit = true;
            damage = Math.floor((Math.random() * 21) + 25) * 2;
            combat.hp[opponent] -= damage;
            specialMessage = "💥 *ACERTO CRÍTICO!* O golpe foi devastador!";
        } else if (diceRoll === 1) {
            hit = false;
            damage = Math.floor(Math.random() * 10) + 5; 
            combat.hp[attacker] -= damage;
            specialMessage = `🤦‍♂️ *FALHA CRÍTICA!* @${attacker.split('@')[0]} se atrapalha todo e acaba se ferindo, perdendo ${damage} de HP!`;
        } else if (diceRoll > 8) {
            hit = true;
            damage = (diceRoll - 8) + Math.floor(Math.random() * 15) + 5; 
            combat.hp[opponent] -= damage;
        } else {
            hit = false;
        }
        
        if (specialMessage) {
            await sock.sendMessage(chatJid, { text: specialMessage, mentions: [attacker] });
            await delay(1500);
        }

        const attackerName = `@${attacker.split('@')[0]}`;
        const opponentName = `@${opponent.split('@')[0]}`;
        
        if (hit && combat.hp[opponent] <= 0) {
            combat.hp[opponent] = 0; 
            const finisherNarration = await narrateFinisher(combat, attackerName, opponentName, move);
            combat.story.push(finisherNarration);
            
            await sock.sendMessage(chatJid, { text: finisherNarration, mentions: [attacker, opponent] });
            await delay(2000);

            const finalText = `*K.O.!* knockout\n\nA vitória é de @${attacker.split('@')[0]}!`;
            await sock.sendMessage(chatJid, { text: finalText, mentions: [attacker, opponent] });
            delete activeCombats[chatJid];

        } else {
            combat.turn = opponent;

            const narration = await narrateTurn(combat, attackerName, opponentName, move, diceRoll, hit, damage);
            combat.story.push(narration);

            await sock.sendMessage(chatJid, { text: narration, mentions: [attacker, opponent] });
            await delay(2000);

            const createHpBar = (currentHp) => {
                const maxHp = 100;
                const percentage = Math.max(0, currentHp) / maxHp;
                const filledBlocks = Math.round(percentage * 10);
                const emptyBlocks = 10 - filledBlocks;
                return `[${'█'.repeat(filledBlocks)}${'─'.repeat(emptyBlocks)}] ${Math.max(0, currentHp)}/${maxHp} HP`;
            };

            const hpStatus = `*Placar:*\n❤️ ${attackerName}: ${createHpBar(combat.hp[attacker])}\n❤️ ${opponentName}: ${createHpBar(combat.hp[opponent])}`;
            await sock.sendMessage(chatJid, { text: hpStatus, mentions: [attacker, opponent] });
            await delay(1000);
            
            await sock.sendMessage(chatJid, { text: `É a vez de @${opponent.split('@')[0]} atacar!`, mentions: [opponent] });
        }
        return;
    }
    
    // --- SUBCOMANDO /DESISTIR ---
    if (command === '/desistir') {
        if (!combat || ![combat.fighter1, combat.fighter2].includes(commandSenderJid)) {
            await sock.sendMessage(chatJid, { text: "Você não está em nenhum combate para poder desistir." });
            return;
        }
        const quitter = commandSenderJid;
        const winner = combat.fighter1 === quitter ? combat.fighter2 : combat.fighter1;
        await sock.sendMessage(chatJid, { text: `🏳️ @${quitter.split('@')[0]} jogou a toalha!\n\nO vencedor por W.O. é @${winner.split('@')[0]}!`, mentions: [quitter, winner] });
        delete activeCombats[chatJid];
        return;
    }

    // --- COMANDO PRINCIPAL /COMBATE (DESAFIO) ---
    if (command === '/combate') {
        if (mentionedJids.length !== 1) {
            await sock.sendMessage(chatJid, { text: `Para desafiar alguém para um combate, mencione a pessoa e escolha um modo de narração.\n\n*Modos:* cria, comico, serio, poetico, noir, documentario, mestre_rpg.\n\n*Exemplos:*\n/combate @adversario cria\n/combate @adversario serio` });
            return;
        }
        if (combat) {
            await sock.sendMessage(chatJid, { text: "Já existe um combate ou desafio a decorrer neste grupo. Use `/desistir` para cancelar." });
            return;
        }

        const challenger = commandSenderJid;
        const challenged = mentionedJids[0];

        if (challenger === challenged) {
            await sock.sendMessage(chatJid, { text: "Lutar contra si mesmo só no clube da luta. Aqui não pode." });
            return;
        }

        const textWithoutCommand = commandText.substring(command.length).trim();
        const textWithoutMentions = textWithoutCommand.replace(/@\d+(@\w+.\w+)?/g, '').trim();
        const potentialMode = textWithoutMentions.toLowerCase();
        const chosenMode = narrationStyles[potentialMode] ? potentialMode : 'comico';
        
        activeCombats[chatJid] = {
            fighter1: challenger,
            fighter2: challenged,
            status: 'pending',
            story: [`A plateia vai à loucura!`],
            hp: { [challenger]: 100, [challenged]: 100 },
            narrationMode: chosenMode, 
            timeout: setTimeout(() => {
                if (activeCombats[chatJid] && activeCombats[chatJid].status === 'pending') {
                    sock.sendMessage(chatJid, { text: `O desafio para @${challenged.split('@')[0]} expirou! Parece que amarelou...`, mentions: [challenged] });
                    delete activeCombats[chatJid];
                }
            }, 60000)
        };
        
        const proposalText = `⚔️ DESAFIO! ⚔️\n\n@${challenger.split('@')[0]} desafiou @${challenged.split('@')[0]} para um combate no modo *${chosenMode}*!\n\n@${challenged.split('@')[0]}, você tem 60 segundos para aceitar com o comando \`/aceitarcombate\`.`;
        await sock.sendMessage(chatJid, { text: proposalText, mentions: [challenger, challenged] });
    }
}

module.exports = handleCombatCommand;
aliases['/aceitarcombate'] = '/combate';
aliases['/ataque'] = '/combate';
aliases['/desistir'] = '/combate';
