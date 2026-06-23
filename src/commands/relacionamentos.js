
const fs = require('fs').promises;
const path = require('path');
const contactManager = require('../managers/contactManager');

// Helper to get display name and determine if mention is needed
function getUserDisplay(jid) {
    const nickname = contactManager.getNickname(jid);
    if (nickname) {
        return { display: nickname, mention: false };
    }
    return { display: `@${jid.split('@')[0]}`, mention: true };
}


const relationshipsFilePath = path.join(__dirname, '..', '..', 'data', 'relacionamentos.json');
const couplePetsFilePath = path.join(__dirname, '..', '..', 'data', 'couple_pets.json');

let relationshipLog = {};
let pendingProposals = {};
let couplePetLog = {};

const PET_SPECIES = {
    gato: { emoji: '🐱', label: 'Gato' },
    cachorro: { emoji: '🐶', label: 'Cachorro' },
    coelho: { emoji: '🐰', label: 'Coelho' },
    raposa: { emoji: '🦊', label: 'Raposa' },
    capivara: { emoji: '🦫', label: 'Capivara' },
    panda: { emoji: '🐼', label: 'Panda' },
    dragaozinho: { emoji: '🐉', label: 'Dragãozinho' }
};

async function loadRelationships() {
    try {
        await fs.mkdir(path.dirname(relationshipsFilePath), { recursive: true });
        const data = await fs.readFile(relationshipsFilePath, 'utf-8');
        relationshipLog = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            relationshipLog = {};
        } else {
            console.error('[Relacionamentos] Erro ao carregar dados:', error);
        }
    }
}

async function saveRelationships() {
    try {
        await fs.writeFile(relationshipsFilePath, JSON.stringify(relationshipLog, null, 2));
    } catch (error) {
        console.error('[Relacionamentos] Erro ao salvar dados:', error);
    }
}

async function loadCouplePets() {
    try {
        await fs.mkdir(path.dirname(couplePetsFilePath), { recursive: true });
        const data = await fs.readFile(couplePetsFilePath, 'utf-8');
        couplePetLog = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            couplePetLog = {};
        } else {
            console.error('[Relacionamentos] Erro ao carregar bichinhos do casal:', error);
        }
    }
}

async function saveCouplePets() {
    try {
        await fs.writeFile(couplePetsFilePath, JSON.stringify(couplePetLog, null, 2));
    } catch (error) {
        console.error('[Relacionamentos] Erro ao salvar bichinhos do casal:', error);
    }
}

function initUser(groupJid, userJid) {
    if (!relationshipLog[groupJid]) relationshipLog[groupJid] = {};
    if (!relationshipLog[groupJid][userJid]) {
        relationshipLog[groupJid][userJid] = { parents: [], children: [], spouses: [], lovers: [] };
    }
    if (!relationshipLog[groupJid][userJid].lovers) {
        relationshipLog[groupJid][userJid].lovers = [];
    }
    if (!relationshipLog[groupJid][userJid].bestFriends) {
        relationshipLog[groupJid][userJid].bestFriends = [];
    }
    if (!relationshipLog[groupJid][userJid].friendRequests) {
        relationshipLog[groupJid][userJid].friendRequests = [];
    }
}

function calculateDuration(isoDate) {
    if (!isoDate) return "Data inválida";
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} dia(s)`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours} hora(s)`;
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minuto(s)`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizePetSpecies(input) {
    if (!input) return 'gato';
    const normalized = String(input)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (['dragao', 'dragaozinho', 'dragon'].includes(normalized)) return 'dragaozinho';
    if (['cao', 'cachorro', 'dog'].includes(normalized)) return 'cachorro';
    if (['cat', 'gato'].includes(normalized)) return 'gato';
    if (['rabbit', 'coelho'].includes(normalized)) return 'coelho';
    if (['fox', 'raposa'].includes(normalized)) return 'raposa';
    if (['capivara', 'capybara'].includes(normalized)) return 'capivara';
    if (['panda'].includes(normalized)) return 'panda';

    return PET_SPECIES[normalized] ? normalized : 'gato';
}

function getCoupleKey(user1, user2) {
    return [user1, user2].sort().join('::');
}

function ensureCouplePetGroup(groupJid) {
    if (!couplePetLog[groupJid]) couplePetLog[groupJid] = {};
}

function getMarriedPartners(groupJid, userJid, currentParticipantJids = null) {
    initUser(groupJid, userJid);
    const spouses = relationshipLog[groupJid][userJid].spouses || [];
    const uniquePartners = new Set();

    for (const spouse of spouses) {
        if (!spouse?.partner) continue;
        if (currentParticipantJids && !currentParticipantJids.has(spouse.partner)) continue;
        if (relationshipLog[groupJid]?.[spouse.partner]?.spouses?.some(s => s.partner === userJid)) {
            uniquePartners.add(spouse.partner);
        }
    }

    return [...uniquePartners];
}

function getCouplePet(groupJid, user1, user2) {
    ensureCouplePetGroup(groupJid);
    return couplePetLog[groupJid][getCoupleKey(user1, user2)] || null;
}

function setCouplePet(groupJid, user1, user2, petData) {
    ensureCouplePetGroup(groupJid);
    couplePetLog[groupJid][getCoupleKey(user1, user2)] = petData;
}

function removeCouplePet(groupJid, user1, user2) {
    ensureCouplePetGroup(groupJid);
    const key = getCoupleKey(user1, user2);
    if (!couplePetLog[groupJid][key]) return false;
    delete couplePetLog[groupJid][key];
    return true;
}

function createCouplePet(owners, name, species) {
    const normalizedSpecies = normalizePetSpecies(species);
    const speciesInfo = PET_SPECIES[normalizedSpecies] || PET_SPECIES.gato;
    const now = new Date().toISOString();

    return {
        name: String(name).trim().slice(0, 24),
        species: normalizedSpecies,
        emoji: speciesInfo.emoji,
        speciesLabel: speciesInfo.label,
        owners: [...owners].sort(),
        level: 1,
        exp: 0,
        affection: 60,
        satiety: 85,
        energy: 80,
        hygiene: 75,
        joy: 80,
        health: 100,
        createdAt: now,
        lastUpdate: now,
        lastCareAt: now,
        lastCareBy: null,
        lastAutoMessageAt: null,
        lastAutoMessageType: null,
        lastNeglectWarningAt: null,
        neglectWarningCount: 0
    };
}

function refreshCouplePet(pet) {
    if (!pet) return null;

    const now = Date.now();
    if (!pet.lastCareAt) {
        pet.lastCareAt = new Date(now).toISOString();
    }
    if (typeof pet.neglectWarningCount !== 'number') {
        pet.neglectWarningCount = 0;
    }
    if (!Object.prototype.hasOwnProperty.call(pet, 'lastNeglectWarningAt')) {
        pet.lastNeglectWarningAt = null;
    }
    const lastUpdate = new Date(pet.lastUpdate || pet.createdAt || now).getTime();
    const elapsedHours = Math.max(0, (now - lastUpdate) / (1000 * 60 * 60));

    if (elapsedHours > 0) {
        pet.satiety = clamp((pet.satiety ?? 80) - (elapsedHours * 7), 0, 100);
        pet.energy = clamp((pet.energy ?? 80) - (elapsedHours * 5), 0, 100);
        pet.hygiene = clamp((pet.hygiene ?? 80) - (elapsedHours * 4), 0, 100);
        pet.joy = clamp((pet.joy ?? 80) - (elapsedHours * 6), 0, 100);

        const lowStats = [pet.satiety, pet.energy, pet.hygiene, pet.joy].filter(value => value < 25).length;
        if (lowStats > 0) {
            pet.health = clamp((pet.health ?? 100) - (elapsedHours * lowStats * 4), 0, 100);
        } else if ([pet.satiety, pet.energy, pet.hygiene, pet.joy].every(value => value >= 70)) {
            pet.health = clamp((pet.health ?? 100) + (elapsedHours * 2), 0, 100);
            pet.affection = clamp((pet.affection ?? 60) + elapsedHours, 0, 100);
        }
    }

    pet.lastUpdate = new Date(now).toISOString();
    return pet;
}

function levelUpCouplePet(pet) {
    while (pet.exp >= pet.level * 80) {
        pet.exp -= pet.level * 80;
        pet.level += 1;
        pet.health = clamp(pet.health + 8, 0, 100);
        pet.affection = clamp(pet.affection + 5, 0, 100);
    }
}

function getCouplePetMood(pet) {
    const average = Math.round((pet.satiety + pet.energy + pet.hygiene + pet.joy + pet.health) / 5);
    if (pet.health <= 20) return '🚨 Em estado crítico';
    if (average >= 85) return '✨ Radiante';
    if (average >= 65) return '😊 Feliz';
    if (average >= 40) return '😐 Carente';
    return '🥺 Precisando de cuidados';
}

function formatPetStat(value) {
    return clamp(Number(value || 0), 0, 100).toFixed(1);
}

function statBar(value) {
    const filled = Math.round(clamp(value, 0, 100) / 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${formatPetStat(value)}%`;
}

function buildCouplePetWarnings(pet) {
    const warnings = [];
    if (pet.satiety < 35) warnings.push('🍽️ Está com fome');
    if (pet.energy < 35) warnings.push('😴 Está sem energia');
    if (pet.hygiene < 35) warnings.push('🧼 Precisa de banho');
    if (pet.joy < 35) warnings.push('🎾 Quer brincar');
    if (pet.health < 35) warnings.push('🩺 Precisa de cuidados');
    return warnings;
}

function resolveCoupleForPet(groupJid, userJid, mentionedJids, currentParticipantJids) {
    const spouses = getMarriedPartners(groupJid, userJid, currentParticipantJids);

    if (mentionedJids.length > 0) {
        const partner = mentionedJids[0];
        if (!spouses.includes(partner)) {
            return { error: 'Você só pode usar o bichinho com alguém que seja seu cônjuge neste grupo.' };
        }
        return { partner };
    }

    if (spouses.length === 0) {
        return { error: 'Você precisa estar casado(a) no grupo para ter um bichinho do casal.' };
    }

    if (spouses.length > 1) {
        return { error: 'Você tem mais de um cônjuge no grupo. Marque com quem quer cuidar do bichinho.' };
    }

    return { partner: spouses[0] };
}

async function isGroupAdmin(sock, chatJid, authorJid) {
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        const participant = groupMeta.participants.find(p => p.id === authorJid);
        return !!participant?.admin;
    } catch (e) {
        return false;
    }
}


function isIncest(groupJid, user1, user2) {
    const groupData = relationshipLog[groupJid];
    if (!groupData) return false;

    const u1Data = groupData[user1] || { parents: [], children: [] };
    const u2Data = groupData[user2] || { parents: [], children: [] };


    if (u1Data.parents.includes(user2)) return "Você não pode casar com seu pai/mãe!";
    if (u1Data.children.includes(user2)) return "Você não pode casar com seu filho(a)!";


    const siblings = u1Data.parents.some(p => u2Data.parents.includes(p));
    if (siblings) return "Você não pode casar com seu irmão/irmã!";



    const u1Grandparents = u1Data.parents.flatMap(p => groupData[p]?.parents || []);
    if (u1Grandparents.includes(user2)) return "Você não pode casar com seu avô/avó!";


    const u1Grandchildren = u1Data.children.flatMap(c => groupData[c]?.children || []);
    if (u1Grandchildren.includes(user2)) return "Você não pode casar com seu neto(a)!";

    return false;
}

loadRelationships();
loadCouplePets();



async function handleRelationshipCommand(sock, msg, msgDetails) {
    const { sender: chatJid, command, commandSenderJid, commandText } = msgDetails;
    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (!msgDetails.isGroup) {
        await sock.sendMessage(chatJid, { text: "Este comando só funciona em grupos." }, { quoted: msg });
        return;
    }


    if (!relationshipLog[chatJid]) relationshipLog[chatJid] = {};
    if (!pendingProposals[chatJid]) pendingProposals[chatJid] = {};


    let currentParticipantJids = new Set();
    try {
        const groupMeta = await sock.groupMetadata(chatJid);
        currentParticipantJids = new Set(groupMeta.participants.map(p => p.id));
    } catch (e) {

    }





    if (command === '/casar') {
        const args = commandText.split(' ');
        const force = args.includes('--force');


        if (force) {
            if (!await isGroupAdmin(sock, chatJid, commandSenderJid)) {
                return sock.sendMessage(chatJid, { text: "🚫 Apenas admins podem forçar casamento." });
            }
            if (mentionedJids.length !== 2) {
                return sock.sendMessage(chatJid, { text: "Uso forçado: `/casar --force @pessoa1 @pessoa2`" });
            }
            const [user1, user2] = mentionedJids;
            initUser(chatJid, user1);
            initUser(chatJid, user2);


            const incestError = isIncest(chatJid, user1, user2);
            if (incestError) {
                return sock.sendMessage(chatJid, { text: `🚫 *INCESTO:* ${incestError}` });
            }




            const user1Display = getUserDisplay(user1);
            const user2Display = getUserDisplay(user2);

            const mentions = [];
            if (user1Display.mention) mentions.push(user1);
            if (user2Display.mention) mentions.push(user2);

            const date = new Date().toISOString();
            relationshipLog[chatJid][user1].spouses.push({ partner: user2, date });
            relationshipLog[chatJid][user2].spouses.push({ partner: user1, date });
            await saveRelationships();

            return sock.sendMessage(chatJid, { text: `⚖️ *UNIÃO FORÇADA!* \n\n${user1Display.display} e ${user2Display.display} agora são casados por decreto!`, mentions });
        }


        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione quem você quer pedir em casamento!\nEx: `/casar @amor`" });
        }

        const proposer = commandSenderJid;
        const proposed = mentionedJids[0];

        if (proposer === proposed) return sock.sendMessage(chatJid, { text: "Amor próprio é tudo, mas casamento exige dois." });

        initUser(chatJid, proposer);
        initUser(chatJid, proposed);





        const incestError = isIncest(chatJid, proposer, proposed);
        if (incestError) {
            return sock.sendMessage(chatJid, { text: `🚫 *PROIBIDO:* ${incestError}` });
        }


        if (pendingProposals[chatJid][proposed]) {
            return sock.sendMessage(chatJid, { text: "Essa pessoa já tem um pedido pendente (de casamento ou adoção). Espere ela responder." });
        }


        pendingProposals[chatJid][proposed] = { type: 'marriage', requester: proposer };

        const proposerDisplay = getUserDisplay(proposer);
        const proposedDisplay = getUserDisplay(proposed);

        const mentions = [];
        if (proposerDisplay.mention) mentions.push(proposer);
        if (proposedDisplay.mention) mentions.push(proposed);

        const text = `💍 *PEDIDO DE CASAMENTO* 💍\n\n${proposerDisplay.display} está pedindo a mão de ${proposedDisplay.display}!\n\n${proposedDisplay.display}, você aceita? \nResponda com \`/aceitar\` em 60 segundos.`;
        await sock.sendMessage(chatJid, { text, mentions });

        setTimeout(() => {
            if (pendingProposals[chatJid][proposed]?.requester === proposer && pendingProposals[chatJid][proposed]?.type === 'marriage') {
                delete pendingProposals[chatJid][proposed];
                const pDisplay = getUserDisplay(proposed);
                const mentions = pDisplay.mention ? [proposed] : [];
                sock.sendMessage(chatJid, { text: `O pedido de casamento para ${pDisplay.display} expirou. 🥀`, mentions });
            }
        }, 60000);
        return;
    }

    if (command === '/amante') {
        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione quem você quer como amante!\nEx: `/amante @contatinho`" });
        }

        const proposer = commandSenderJid;
        const proposed = mentionedJids[0];

        if (proposer === proposed) return sock.sendMessage(chatJid, { text: "Amor próprio é bom, mas amante é outra coisa." });

        initUser(chatJid, proposer);
        initUser(chatJid, proposed);

        // Check if already lovers
        if (relationshipLog[chatJid][proposer].lovers.some(l => l.partner === proposed)) {
            return sock.sendMessage(chatJid, { text: "Vocês já são amantes! 🔥" });
        }

        // Check if married to each other
        if (relationshipLog[chatJid][proposer].spouses.some(s => s.partner === proposed)) {
            return sock.sendMessage(chatJid, { text: "Vocês já são casados! Amante é pra quem não tem aliança. 😉" });
        }

        if (pendingProposals[chatJid][proposed]) {
            return sock.sendMessage(chatJid, { text: "Essa pessoa já tem uma proposta pendente. Entre na fila." });
        }

        pendingProposals[chatJid][proposed] = { type: 'lover', requester: proposer };

        const proposerDisplay = getUserDisplay(proposer);
        const proposedDisplay = getUserDisplay(proposed);

        const mentions = [];
        if (proposerDisplay.mention) mentions.push(proposer);
        if (proposedDisplay.mention) mentions.push(proposed);

        const text = `🔥 *PROPOSTA INDECENTE* 🔥\n\n${proposerDisplay.display} quer ser seu/sua amante, ${proposedDisplay.display}!\n\nAceita essa aventura? \nResponda com \`/aceitar\` em 60 segundos.`;
        await sock.sendMessage(chatJid, { text, mentions });

        setTimeout(() => {
            if (pendingProposals[chatJid][proposed]?.requester === proposer && pendingProposals[chatJid][proposed]?.type === 'lover') {
                delete pendingProposals[chatJid][proposed];
                const pDisplay = getUserDisplay(proposed);
                const mentions = pDisplay.mention ? [proposed] : [];
                sock.sendMessage(chatJid, { text: `A proposta de amante para ${pDisplay.display} esfriou. ❄️`, mentions });
            }
        }, 60000);
        return;
    }

    if (command === '/divorcio') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const userSpouses = relationshipLog[chatJid][commandSenderJid].spouses;

            if (userSpouses.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não é casado(a) com ninguém." });
            }


            for (const spouse of userSpouses) {
                const partner = spouse.partner;
                initUser(chatJid, partner);
                const partnerSpouses = relationshipLog[chatJid][partner].spouses;
                const pIdx = partnerSpouses.findIndex(s => s.partner === commandSenderJid);
                if (pIdx > -1) partnerSpouses.splice(pIdx, 1);
                removeCouplePet(chatJid, commandSenderJid, partner);
            }


            relationshipLog[chatJid][commandSenderJid].spouses = [];
            await saveRelationships();
            await saveCouplePets();

            const senderDisplay = getUserDisplay(commandSenderJid);
            const mentions = senderDisplay.mention ? [commandSenderJid] : [];

            return sock.sendMessage(chatJid, { text: `💔 *DIVÓRCIO EM MASSA!* \n\n${senderDisplay.display} se divorciou de TODOS os seus cônjuges.`, mentions });
        }

        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione de quem você quer se divorciar ou use `/divorcio @all` para divorciar de todos." });
        }
        const partner = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        const userSpouses = relationshipLog[chatJid][commandSenderJid].spouses;
        const idx = userSpouses.findIndex(s => s.partner === partner);

        if (idx === -1) {
            return sock.sendMessage(chatJid, { text: "Vocês não são casados." });
        }


        relationshipLog[chatJid][commandSenderJid].spouses.splice(idx, 1);

        initUser(chatJid, partner);
        const partnerSpouses = relationshipLog[chatJid][partner].spouses;
        const pIdx = partnerSpouses.findIndex(s => s.partner === commandSenderJid);
        if (pIdx > -1) partnerSpouses.splice(pIdx, 1);
        const removedPet = removeCouplePet(chatJid, commandSenderJid, partner);

        await saveRelationships();
        if (removedPet) await saveCouplePets();

        const senderDisplay = getUserDisplay(commandSenderJid);
        const partnerDisplay = getUserDisplay(partner);
        const mentions = [];
        if (senderDisplay.mention) mentions.push(commandSenderJid);
        if (partnerDisplay.mention) mentions.push(partner);

        return sock.sendMessage(chatJid, { text: `💔 *DIVÓRCIO!* \n\nO casamento entre ${senderDisplay.display} e ${partnerDisplay.display} acabou.${removedPet ? '\n\n🐾 O bichinho do casal foi encaminhado para adoção responsável.' : ''}`, mentions });
    }

    if (command === '/terminar' || command === '/largar') {
        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione com quem você quer terminar!" });
        }
        const partner = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        const userLovers = relationshipLog[chatJid][commandSenderJid].lovers;
        const idx = userLovers.findIndex(l => l.partner === partner);

        if (idx === -1) {
            return sock.sendMessage(chatJid, { text: "Vocês não são amantes." });
        }

        relationshipLog[chatJid][commandSenderJid].lovers.splice(idx, 1);

        initUser(chatJid, partner);
        const partnerLovers = relationshipLog[chatJid][partner].lovers;
        const pIdx = partnerLovers.findIndex(l => l.partner === commandSenderJid);
        if (pIdx > -1) partnerLovers.splice(pIdx, 1);

        await saveRelationships();

        const senderDisplay = getUserDisplay(commandSenderJid);
        const partnerDisplay = getUserDisplay(partner);
        const mentions = [];
        if (senderDisplay.mention) mentions.push(commandSenderJid);
        if (partnerDisplay.mention) mentions.push(partner);

        return sock.sendMessage(chatJid, { text: `💔 *ACABOU TUDO!* \n\n${senderDisplay.display} largou ${partnerDisplay.display}. O fogo apagou.`, mentions });
    }

    if (command === '/casamento' || command === '/casados') {

        const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
        initUser(chatJid, target);

        const spouses = relationshipLog[chatJid][target].spouses.filter(s => currentParticipantJids.has(s.partner));

        if (spouses.length === 0) {
            const tDisplay = getUserDisplay(target);
            const mentions = tDisplay.mention ? [target] : [];
            return sock.sendMessage(chatJid, { text: `💍 ${tDisplay.display} não está casado(a) com ninguém neste grupo.`, mentions });
        }

        const tDisplay = getUserDisplay(target);
        let text = `*💍 Casamentos de ${tDisplay.display}*\n\n`;
        const mentions = [];
        if (tDisplay.mention) mentions.push(target);

        spouses.forEach(s => {
            const pDisplay = getUserDisplay(s.partner);
            text += `❤️ ${pDisplay.display} _(${calculateDuration(s.date)})_\n`;
            if (pDisplay.mention) mentions.push(s.partner);
        });

        return sock.sendMessage(chatJid, { text: text.trim(), mentions });
    }

    if (command === '/amantes') {
        const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
        initUser(chatJid, target);

        const lovers = relationshipLog[chatJid][target].lovers.filter(l => currentParticipantJids.has(l.partner));

        if (lovers.length === 0) {
            const tDisplay = getUserDisplay(target);
            const mentions = tDisplay.mention ? [target] : [];
            return sock.sendMessage(chatJid, { text: `🔍 ${tDisplay.display} não tem amantes (no grupo). Fiel? Talvez.`, mentions });
        }

        const tDisplay = getUserDisplay(target);
        let text = `*🔥 Amantes de ${tDisplay.display}*\n\n`;
        const mentions = [];
        if (tDisplay.mention) mentions.push(target);

        lovers.forEach(l => {
            const pDisplay = getUserDisplay(l.partner);
            text += `😈 ${pDisplay.display} _(${calculateDuration(l.date)})_\n`;
            if (pDisplay.mention) mentions.push(l.partner);
        });

        return sock.sendMessage(chatJid, { text: text.trim(), mentions });

    }

    if (command === '/bf' || command === '/bestfriend' || command === '/melhoresamigos') {
        const args = msgDetails.args || [];
        const subCommand = args[0] ? args[0].toLowerCase() : null;

        // === HELP ===
        if (subCommand === 'help' || subCommand === 'ajuda') {
            let helpText = `🤜🤛 *MELHORES AMIGOS — AJUDA* 🤜🤛\n\n` +
                `▸ \`/bf @pessoa\` — Enviar solicitação de amizade\n` +
                `▸ \`/bf aceitar @pessoa\` — Aceitar solicitação\n` +
                `▸ \`/bf aceitar todos\` — Aceitar todas as solicitações\n` +
                `▸ \`/bf recusar @pessoa\` — Recusar solicitação\n` +
                `▸ \`/bf recusar todos\` — Recusar todas as solicitações\n` +
                `▸ \`/bf cancelar @pessoa\` — Cancelar solicitação enviada\n` +
                `▸ \`/bf pendentes\` — Ver solicitações pendentes\n` +
                `▸ \`/bf lista\` — Listar melhores amigos\n` +
                `▸ \`/bf remover @pessoa\` — Remover amigo`;
            if (msgDetails.isSuperAdmin) {
                helpText += `\n\n🔒 *Super Admin:*\n▸ \`/bf todos\` — Enviar solicitação para todos do grupo`;
            }
            return sock.sendMessage(chatJid, { text: helpText });
        }

        // === ENVIAR SOLICITAÇÃO PARA TODOS (Super Admin) ===
        if (subCommand === 'todos' || subCommand === 'all') {
            if (!msgDetails.isSuperAdmin) return;

            const proposer = commandSenderJid;
            initUser(chatJid, proposer);

            const allMembers = [...currentParticipantJids].filter(jid => jid !== proposer);
            let sent = 0;
            let alreadyFriends = 0;
            let alreadyPending = 0;
            const date = new Date().toISOString();

            for (const member of allMembers) {
                initUser(chatJid, member);

                // Já são amigos
                if (relationshipLog[chatJid][proposer].bestFriends.some(bf => bf.partner === member)) {
                    alreadyFriends++;
                    continue;
                }

                // Já tem solicitação pendente enviada
                if (relationshipLog[chatJid][member].friendRequests.some(r => r.from === proposer)) {
                    alreadyPending++;
                    continue;
                }

                // Se o membro já enviou solicitação, aceitar mutuamente
                const reverseIdx = relationshipLog[chatJid][proposer].friendRequests.findIndex(r => r.from === member);
                if (reverseIdx > -1) {
                    relationshipLog[chatJid][proposer].friendRequests.splice(reverseIdx, 1);
                    if (!relationshipLog[chatJid][proposer].bestFriends.some(bf => bf.partner === member)) {
                        relationshipLog[chatJid][proposer].bestFriends.push({ partner: member, date });
                    }
                    if (!relationshipLog[chatJid][member].bestFriends.some(bf => bf.partner === proposer)) {
                        relationshipLog[chatJid][member].bestFriends.push({ partner: proposer, date });
                    }
                    sent++;
                    continue;
                }

                // Enviar solicitação
                relationshipLog[chatJid][member].friendRequests.push({ from: proposer, date });
                sent++;
            }

            await saveRelationships();

            const senderDisplay = getUserDisplay(proposer);
            const mentions = senderDisplay.mention ? [proposer] : [];

            return sock.sendMessage(chatJid, {
                text: `📩 *SOLICITAÇÃO EM MASSA* 📩\n\n${senderDisplay.display} enviou solicitações de amizade para o grupo!\n\n✅ Enviadas/aceitas: ${sent}\n🤝 Já eram amigos: ${alreadyFriends}\n⏳ Já pendentes: ${alreadyPending}`,
                mentions
            });
        }

        // === LISTAR AMIGOS ===
        if (!subCommand || subCommand === 'lista' || subCommand === 'list') {
            const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
            initUser(chatJid, target);

            const bfs = relationshipLog[chatJid][target].bestFriends.filter(bf => currentParticipantJids.has(bf.partner));

            if (bfs.length === 0) {
                const tDisplay = getUserDisplay(target);
                const mentions = tDisplay.mention ? [target] : [];
                return sock.sendMessage(chatJid, { text: `💔 ${tDisplay.display} não tem melhores amigos neste grupo.`, mentions });
            }

            const tDisplay = getUserDisplay(target);
            let text = `*🤜🤛 Melhores Amigos de ${tDisplay.display}*\n\n`;
            const mentions = [];
            if (tDisplay.mention) mentions.push(target);

            bfs.forEach(bf => {
                const pDisplay = getUserDisplay(bf.partner);
                text += `🔸 ${pDisplay.display} _(${calculateDuration(bf.date)})_\n`;
                if (pDisplay.mention) mentions.push(bf.partner);
            });

            return sock.sendMessage(chatJid, { text: text.trim(), mentions });
        }

        // === VER SOLICITAÇÕES PENDENTES ===
        if (subCommand === 'pendentes' || subCommand === 'pending' || subCommand === 'solicitações' || subCommand === 'solicitacoes') {
            initUser(chatJid, commandSenderJid);
            const requests = relationshipLog[chatJid][commandSenderJid].friendRequests || [];
            const activeRequests = requests.filter(r => currentParticipantJids.has(r.from));

            if (activeRequests.length === 0) {
                return sock.sendMessage(chatJid, { text: "📭 Você não tem solicitações de amizade pendentes." });
            }

            let text = `*📬 Solicitações de Amizade Pendentes*\n\n`;
            const mentions = [];

            activeRequests.forEach(r => {
                const pDisplay = getUserDisplay(r.from);
                text += `🔹 ${pDisplay.display} _(${calculateDuration(r.date)})_\n`;
                if (pDisplay.mention) mentions.push(r.from);
            });

            text += `\nUse \`/bf aceitar @pessoa\` ou \`/bf aceitar todos\``;

            return sock.sendMessage(chatJid, { text: text.trim(), mentions });
        }

        // === ACEITAR SOLICITAÇÃO ===
        if (subCommand === 'aceitar' || subCommand === 'accept') {
            initUser(chatJid, commandSenderJid);
            const requests = relationshipLog[chatJid][commandSenderJid].friendRequests || [];
            const acceptAll = args[1] && (args[1].toLowerCase() === 'todos' || args[1].toLowerCase() === 'all');

            if (acceptAll) {
                const activeRequests = requests.filter(r => currentParticipantJids.has(r.from));
                if (activeRequests.length === 0) {
                    return sock.sendMessage(chatJid, { text: "📭 Você não tem solicitações de amizade pendentes." });
                }

                const date = new Date().toISOString();
                const mentions = [];
                const accepted = [];

                for (const req of activeRequests) {
                    initUser(chatJid, req.from);

                    // Add friendship both ways (if not already)
                    if (!relationshipLog[chatJid][commandSenderJid].bestFriends.some(bf => bf.partner === req.from)) {
                        relationshipLog[chatJid][commandSenderJid].bestFriends.push({ partner: req.from, date });
                    }
                    if (!relationshipLog[chatJid][req.from].bestFriends.some(bf => bf.partner === commandSenderJid)) {
                        relationshipLog[chatJid][req.from].bestFriends.push({ partner: commandSenderJid, date });
                    }

                    // Remove the request from sender
                    const idx = relationshipLog[chatJid][commandSenderJid].friendRequests.findIndex(r => r.from === req.from);
                    if (idx > -1) relationshipLog[chatJid][commandSenderJid].friendRequests.splice(idx, 1);

                    const pDisplay = getUserDisplay(req.from);
                    accepted.push(pDisplay.display);
                    if (pDisplay.mention) mentions.push(req.from);
                }

                await saveRelationships();

                const senderDisplay = getUserDisplay(commandSenderJid);
                if (senderDisplay.mention) mentions.push(commandSenderJid);

                return sock.sendMessage(chatJid, {
                    text: `🤜🤛 *SOLICITAÇÕES ACEITAS!* 🤜🤛\n\n${senderDisplay.display} aceitou ${accepted.length} solicitação(ões) de amizade!\n\n${accepted.map(a => `✅ ${a}`).join('\n')}`,
                    mentions
                });
            }

            // Aceitar de uma pessoa específica
            if (mentionedJids.length !== 1) {
                return sock.sendMessage(chatJid, { text: "Mencione quem você quer aceitar ou use `/bf aceitar todos`." });
            }

            const from = mentionedJids[0];
            const reqIdx = requests.findIndex(r => r.from === from);

            if (reqIdx === -1) {
                return sock.sendMessage(chatJid, { text: "Essa pessoa não te enviou uma solicitação de amizade." });
            }

            initUser(chatJid, from);
            const date = new Date().toISOString();

            if (!relationshipLog[chatJid][commandSenderJid].bestFriends.some(bf => bf.partner === from)) {
                relationshipLog[chatJid][commandSenderJid].bestFriends.push({ partner: from, date });
            }
            if (!relationshipLog[chatJid][from].bestFriends.some(bf => bf.partner === commandSenderJid)) {
                relationshipLog[chatJid][from].bestFriends.push({ partner: commandSenderJid, date });
            }

            relationshipLog[chatJid][commandSenderJid].friendRequests.splice(reqIdx, 1);
            await saveRelationships();

            const senderDisplay = getUserDisplay(commandSenderJid);
            const fromDisplay = getUserDisplay(from);
            const mentions = [];
            if (senderDisplay.mention) mentions.push(commandSenderJid);
            if (fromDisplay.mention) mentions.push(from);

            return sock.sendMessage(chatJid, {
                text: `🤜🤛 *MELHORES AMIGOS!* 🤜🤛\n\n${senderDisplay.display} aceitou a solicitação de ${fromDisplay.display}! Agora são melhores amigos!`,
                mentions
            });
        }

        // === RECUSAR SOLICITAÇÃO ===
        if (subCommand === 'recusar' || subCommand === 'reject' || subCommand === 'negar') {
            initUser(chatJid, commandSenderJid);
            const requests = relationshipLog[chatJid][commandSenderJid].friendRequests || [];
            const rejectAll = args[1] && (args[1].toLowerCase() === 'todos' || args[1].toLowerCase() === 'all');

            if (rejectAll) {
                if (requests.length === 0) {
                    return sock.sendMessage(chatJid, { text: "📭 Você não tem solicitações de amizade pendentes." });
                }
                const count = requests.length;
                relationshipLog[chatJid][commandSenderJid].friendRequests = [];
                await saveRelationships();
                return sock.sendMessage(chatJid, { text: `❌ Você recusou ${count} solicitação(ões) de amizade.` });
            }

            if (mentionedJids.length !== 1) {
                return sock.sendMessage(chatJid, { text: "Mencione quem você quer recusar ou use `/bf recusar todos`." });
            }

            const from = mentionedJids[0];
            const reqIdx = requests.findIndex(r => r.from === from);

            if (reqIdx === -1) {
                return sock.sendMessage(chatJid, { text: "Essa pessoa não te enviou uma solicitação de amizade." });
            }

            relationshipLog[chatJid][commandSenderJid].friendRequests.splice(reqIdx, 1);
            await saveRelationships();

            const fromDisplay = getUserDisplay(from);
            const mentions = fromDisplay.mention ? [from] : [];

            return sock.sendMessage(chatJid, { text: `❌ Solicitação de amizade de ${fromDisplay.display} recusada.`, mentions });
        }

        // === CANCELAR SOLICITAÇÃO ENVIADA ===
        if (subCommand === 'cancelar' || subCommand === 'cancel') {
            if (mentionedJids.length !== 1) {
                return sock.sendMessage(chatJid, { text: "Mencione de quem você quer cancelar a solicitação enviada." });
            }

            const target = mentionedJids[0];
            initUser(chatJid, target);

            const targetRequests = relationshipLog[chatJid][target].friendRequests || [];
            const reqIdx = targetRequests.findIndex(r => r.from === commandSenderJid);

            if (reqIdx === -1) {
                return sock.sendMessage(chatJid, { text: "Você não tem uma solicitação pendente para essa pessoa." });
            }

            relationshipLog[chatJid][target].friendRequests.splice(reqIdx, 1);
            await saveRelationships();

            const targetDisplay = getUserDisplay(target);
            const mentions = targetDisplay.mention ? [target] : [];

            return sock.sendMessage(chatJid, { text: `↩️ Solicitação de amizade para ${targetDisplay.display} cancelada.`, mentions });
        }

        // === REMOVER AMIGO ===
        if (subCommand === 'remover' || subCommand === 'remove' || subCommand === 'delete') {
            if (mentionedJids.length !== 1) {
                return sock.sendMessage(chatJid, { text: "Mencione quem você quer remover dos melhores amigos." });
            }
            const partner = mentionedJids[0];
            initUser(chatJid, commandSenderJid);

            const userBfs = relationshipLog[chatJid][commandSenderJid].bestFriends;
            const idx = userBfs.findIndex(bf => bf.partner === partner);

            if (idx === -1) {
                return sock.sendMessage(chatJid, { text: "Essa pessoa não é sua melhor amiga." });
            }

            relationshipLog[chatJid][commandSenderJid].bestFriends.splice(idx, 1);

            initUser(chatJid, partner);
            const partnerBfs = relationshipLog[chatJid][partner].bestFriends;
            const pIdx = partnerBfs.findIndex(bf => bf.partner === commandSenderJid);
            if (pIdx > -1) partnerBfs.splice(pIdx, 1);

            await saveRelationships();

            const senderDisplay = getUserDisplay(commandSenderJid);
            const partnerDisplay = getUserDisplay(partner);
            const mentions = [];
            if (senderDisplay.mention) mentions.push(commandSenderJid);
            if (partnerDisplay.mention) mentions.push(partner);

            return sock.sendMessage(chatJid, { text: `💔 *AMIZADE DESFEITA!* \n\n${senderDisplay.display} removeu ${partnerDisplay.display} dos melhores amigos.`, mentions });
        }

        // === ENVIAR SOLICITAÇÃO (default: /bf @pessoa) ===
        if (mentionedJids.length !== 1) {
            return sock.sendMessage(chatJid, { text: "Mencione quem você quer adicionar como melhor amigo(a)!\n\nUse `/bf ajuda` para ver todos os comandos." });
        }

        const proposer = commandSenderJid;
        const proposed = mentionedJids[0];

        if (proposer === proposed) return sock.sendMessage(chatJid, { text: "Você já deveria ser seu melhor amigo." });

        initUser(chatJid, proposer);
        initUser(chatJid, proposed);

        // Já são amigos
        if (relationshipLog[chatJid][proposer].bestFriends.some(bf => bf.partner === proposed)) {
            return sock.sendMessage(chatJid, { text: "Vocês já são melhores amigos! 🤜🤛" });
        }

        // Já tem solicitação pendente
        const existingRequest = relationshipLog[chatJid][proposed].friendRequests.find(r => r.from === proposer);
        if (existingRequest) {
            return sock.sendMessage(chatJid, { text: "Você já enviou uma solicitação para essa pessoa. Aguarde a resposta." });
        }

        // Checar se a outra pessoa já enviou solicitação (aceita automaticamente)
        const reverseRequest = relationshipLog[chatJid][proposer].friendRequests.findIndex(r => r.from === proposed);
        if (reverseRequest > -1) {
            // Aceitar mutuamente
            const date = new Date().toISOString();
            relationshipLog[chatJid][proposer].friendRequests.splice(reverseRequest, 1);

            if (!relationshipLog[chatJid][proposer].bestFriends.some(bf => bf.partner === proposed)) {
                relationshipLog[chatJid][proposer].bestFriends.push({ partner: proposed, date });
            }
            if (!relationshipLog[chatJid][proposed].bestFriends.some(bf => bf.partner === proposer)) {
                relationshipLog[chatJid][proposed].bestFriends.push({ partner: proposer, date });
            }

            await saveRelationships();

            const proposerDisplay = getUserDisplay(proposer);
            const proposedDisplay = getUserDisplay(proposed);
            const mentions = [];
            if (proposerDisplay.mention) mentions.push(proposer);
            if (proposedDisplay.mention) mentions.push(proposed);

            return sock.sendMessage(chatJid, {
                text: `🤜🤛 *MELHORES AMIGOS!* 🤜🤛\n\n${proposerDisplay.display} e ${proposedDisplay.display} agora são melhores amigos!\n_(ambos se enviaram solicitação)_`,
                mentions
            });
        }

        // Enviar solicitação
        const date = new Date().toISOString();
        relationshipLog[chatJid][proposed].friendRequests.push({ from: proposer, date });
        await saveRelationships();

        const proposerDisplay = getUserDisplay(proposer);
        const proposedDisplay = getUserDisplay(proposed);

        const mentions = [];
        if (proposerDisplay.mention) mentions.push(proposer);
        if (proposedDisplay.mention) mentions.push(proposed);

        const pendingCount = relationshipLog[chatJid][proposed].friendRequests.length;

        const text = `📩 *SOLICITAÇÃO DE AMIZADE* 📩\n\n${proposerDisplay.display} enviou uma solicitação de amizade para ${proposedDisplay.display}!\n\n${proposedDisplay.display}, você tem ${pendingCount} solicitação(ões) pendente(s).\nUse \`/bf aceitar @pessoa\` ou \`/bf aceitar todos\` para aceitar.`;
        await sock.sendMessage(chatJid, { text, mentions });
        return;
    }

    if (command === '/bichinho' || command === '/petcasal' || command === '/mascotecasal') {
        const args = msgDetails.args || [];
        const subCommand = (args[0] || 'status').toLowerCase();
        const cleanArgs = args.slice(1).filter(arg => !arg.startsWith('@'));

        if (subCommand === 'help' || subCommand === 'ajuda') {
            const helpText = `🐾 *BICHINHO DO CASAL* 🐾\n\n` +
                `Só casais casados no grupo podem ter um bichinho compartilhado.\n` +
                `Ele também manda avisos automáticos no grupo quando estiver precisando de atenção.\n\n` +
                `▸ \`/bichinho adotar @amor Nome [tipo]\`\n` +
                `▸ \`/bichinho status [@amor]\`\n` +
                `▸ \`/bichinho alimentar [@amor]\`\n` +
                `▸ \`/bichinho brincar [@amor]\`\n` +
                `▸ \`/bichinho limpar [@amor]\`\n` +
                `▸ \`/bichinho dormir [@amor]\`\n` +
                `▸ \`/bichinho cuidar [@amor]\`\n` +
                `▸ \`/bichinho renomear [@amor] NovoNome\`\n\n` +
                `Tipos: gato, cachorro, coelho, raposa, capivara, panda, dragaozinho\n` +
                `Se vocês largarem ele sem cuidado por tempo demais, ele pode ir embora e deixar uma cartinha.\n` +
                `Se você só tiver 1 cônjuge no grupo, marcar a pessoa é opcional.`;

            return sock.sendMessage(chatJid, { text: helpText }, { quoted: msg });
        }

        const coupleResolution = resolveCoupleForPet(chatJid, commandSenderJid, mentionedJids, currentParticipantJids);
        if (coupleResolution.error) {
            return sock.sendMessage(chatJid, { text: `🐾 ${coupleResolution.error}` }, { quoted: msg });
        }

        const partner = coupleResolution.partner;
        const senderDisplay = getUserDisplay(commandSenderJid);
        const partnerDisplay = getUserDisplay(partner);
        const mentions = [];
        if (senderDisplay.mention) mentions.push(commandSenderJid);
        if (partnerDisplay.mention) mentions.push(partner);

        let pet = getCouplePet(chatJid, commandSenderJid, partner);

        if (subCommand === 'adotar' || subCommand === 'criar') {
            if (pet) {
                return sock.sendMessage(chatJid, { text: `🐾 Vocês já têm um bichinho: *${pet.emoji} ${pet.name}*. Use \`/bichinho status\` para ver como ele está.`, mentions }, { quoted: msg });
            }

            const petName = cleanArgs[0];
            const petSpecies = cleanArgs[1] || 'gato';

            if (!petName) {
                return sock.sendMessage(chatJid, { text: 'Use: `/bichinho adotar @amor Nome [tipo]`\nEx: `/bichinho adotar @amor Nuvem capivara`' }, { quoted: msg });
            }

            pet = createCouplePet([commandSenderJid, partner], petName, petSpecies);
            setCouplePet(chatJid, commandSenderJid, partner, pet);
            await saveCouplePets();

            return sock.sendMessage(chatJid, {
                text: `🐾 *NOVO BICHINHO DO CASAL!*\n\n${senderDisplay.display} e ${partnerDisplay.display} adotaram *${pet.emoji} ${pet.name}* (${pet.speciesLabel}).\n\nAgora cuidem bem dele com \`/bichinho alimentar\`, \`/bichinho brincar\` e \`/bichinho status\`.`,
                mentions
            }, { quoted: msg });
        }

        if (!pet) {
            return sock.sendMessage(chatJid, { text: '🐾 Vocês ainda não têm um bichinho. Use `/bichinho adotar @amor Nome [tipo]` para começar.' }, { quoted: msg });
        }

        pet = refreshCouplePet(pet);

        if (subCommand === 'status') {
            const warnings = buildCouplePetWarnings(pet);
            const warningText = warnings.length > 0 ? `\n⚠️ *Atenção:*\n${warnings.map(item => `• ${item}`).join('\n')}` : '\n✅ Tudo sob controle.';

            setCouplePet(chatJid, commandSenderJid, partner, pet);
            await saveCouplePets();

            return sock.sendMessage(chatJid, {
                text: `${pet.emoji} *${pet.name}* — bichinho de ${senderDisplay.display} e ${partnerDisplay.display}\n\n` +
                    `🧬 Tipo: *${pet.speciesLabel}*\n` +
                    `📈 Nível: *${pet.level}* (${pet.exp}/${pet.level * 80} XP)\n` +
                    `💞 Afinidade: *${formatPetStat(pet.affection)}%*\n` +
                    `🎭 Humor: *${getCouplePetMood(pet)}*\n\n` +
                    `🍽️ Saciedade: ${statBar(pet.satiety)}\n` +
                    `😴 Energia: ${statBar(pet.energy)}\n` +
                    `🧼 Higiene: ${statBar(pet.hygiene)}\n` +
                    `🎾 Alegria: ${statBar(pet.joy)}\n` +
                    `🩺 Saúde: ${statBar(pet.health)}` +
                    warningText,
                mentions
            }, { quoted: msg });
        }

        const petActions = {
            alimentar: { exp: 18, text: '🍖 deu comida', effects: { satiety: 28, health: 4, affection: 2 } },
            brincar: { exp: 20, text: '🎾 brincou com', effects: { joy: 26, affection: 4, energy: -10, satiety: -6 } },
            limpar: { exp: 16, text: '🧼 limpou', effects: { hygiene: 32, affection: 2 } },
            dormir: { exp: 15, text: '🛏️ colocou', effects: { energy: 34, health: 3 } },
            cuidar: { exp: 22, text: '🩹 cuidou de', effects: { health: 24, joy: 8, affection: 3 } },
            curar: { exp: 22, text: '🩹 cuidou de', effects: { health: 24, joy: 8, affection: 3 } },
            acariciar: { exp: 12, text: '🤍 fez carinho em', effects: { affection: 8, joy: 10 } }
        };

        if (subCommand === 'renomear') {
            const newName = cleanArgs.join(' ').trim();
            if (!newName) {
                return sock.sendMessage(chatJid, { text: 'Use: `/bichinho renomear [@amor] NovoNome`' }, { quoted: msg });
            }

            const oldName = pet.name;
            pet.name = newName.slice(0, 24);
            pet.affection = clamp(pet.affection + 2, 0, 100);
            pet.lastCareBy = commandSenderJid;
            setCouplePet(chatJid, commandSenderJid, partner, pet);
            await saveCouplePets();

            return sock.sendMessage(chatJid, {
                text: `🏷️ ${senderDisplay.display} e ${partnerDisplay.display} renomearam *${oldName}* para *${pet.name}*.`,
                mentions
            }, { quoted: msg });
        }

        const action = petActions[subCommand];
        if (!action) {
            return sock.sendMessage(chatJid, { text: 'Ação inválida. Use `/bichinho ajuda` para ver os comandos.' }, { quoted: msg });
        }

        for (const [stat, delta] of Object.entries(action.effects)) {
            pet[stat] = clamp((pet[stat] ?? 0) + delta, 0, 100);
        }

        pet.exp += action.exp;
        pet.lastCareAt = new Date().toISOString();
        pet.lastCareBy = commandSenderJid;
        pet.lastNeglectWarningAt = null;
        pet.neglectWarningCount = 0;
        levelUpCouplePet(pet);
        setCouplePet(chatJid, commandSenderJid, partner, pet);
        await saveCouplePets();

        const warnings = buildCouplePetWarnings(pet);
        const extra = warnings.length > 0 ? `\n\n⚠️ Ainda precisa de atenção em: ${warnings.join(', ')}` : `\n\n✨ ${pet.name} está se sentindo muito melhor agora!`;

        return sock.sendMessage(chatJid, {
            text: `${pet.emoji} ${senderDisplay.display} ${action.text} *${pet.name}*!\n\n` +
                `📈 Nível ${pet.level} • XP ${pet.exp}/${pet.level * 80}\n` +
                `💞 Afinidade ${formatPetStat(pet.affection)}% • 🩺 Saúde ${formatPetStat(pet.health)}% • 🎾 Alegria ${formatPetStat(pet.joy)}%` +
                extra,
            mentions
        }, { quoted: msg });
    }






    if (command === '/adotar') {
        const args = commandText.split(' ');
        const force = args.includes('--force');

        if (force) {
            if (!await isGroupAdmin(sock, chatJid, commandSenderJid)) return sock.sendMessage(chatJid, { text: "🚫 Apenas admins." });
            if (mentionedJids.length !== 2) return sock.sendMessage(chatJid, { text: "Uso: `/adotar --force @pai @filho`" });

            const [parent, child] = mentionedJids;
            initUser(chatJid, parent);
            initUser(chatJid, child);


            if (relationshipLog[chatJid][parent].spouses.some(s => s.partner === child)) {
                return sock.sendMessage(chatJid, { text: "🚫 Eles são casados! Divorcie-os antes de adotar." });
            }

            if (!relationshipLog[chatJid][parent].children.includes(child)) relationshipLog[chatJid][parent].children.push(child);
            if (!relationshipLog[chatJid][child].parents.includes(parent)) relationshipLog[chatJid][child].parents.push(parent);

            await saveRelationships();

            const parentDisplay = getUserDisplay(parent);
            const childDisplay = getUserDisplay(child);
            const mentions = [];
            if (parentDisplay.mention) mentions.push(parent);
            if (childDisplay.mention) mentions.push(child);

            return sock.sendMessage(chatJid, { text: `⚖️ *ADOÇÃO FORÇADA!* \n\n${parentDisplay.display} agora é responsável por ${childDisplay.display}.`, mentions });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione quem você quer adotar." });

        const parent = commandSenderJid;
        const child = mentionedJids[0];

        if (parent === child) return sock.sendMessage(chatJid, { text: "Não pode se adotar." });

        initUser(chatJid, parent);
        initUser(chatJid, child);

        if (relationshipLog[chatJid][parent].children.includes(child)) return sock.sendMessage(chatJid, { text: "Já é seu filho(a)!" });


        if (relationshipLog[chatJid][parent].spouses.some(s => s.partner === child)) {
            return sock.sendMessage(chatJid, { text: "🚫 Você não pode adotar seu cônjuge! Divorcie-se primeiro." });
        }

        if (pendingProposals[chatJid][child]) return sock.sendMessage(chatJid, { text: "Essa pessoa já tem um pedido pendente." });

        pendingProposals[chatJid][child] = { type: 'adoption', requester: parent };

        const parentDisplay = getUserDisplay(parent);
        const childDisplay = getUserDisplay(child);
        const mentions = [];
        if (parentDisplay.mention) mentions.push(parent);
        if (childDisplay.mention) mentions.push(child);

        const text = `📜 *PEDIDO DE ADOÇÃO* 📜\n\n${parentDisplay.display} quer te adotar, ${childDisplay.display}!\n\nAceita? Responda \`/aceitar\` em 60s.`;
        await sock.sendMessage(chatJid, { text, mentions });

        setTimeout(() => {
            if (pendingProposals[chatJid][child]?.requester === parent && pendingProposals[chatJid][child]?.type === 'adoption') {
                delete pendingProposals[chatJid][child];
                const cDisplay = getUserDisplay(child);
                const mentions = cDisplay.mention ? [child] : [];
                sock.sendMessage(chatJid, { text: `O pedido de adoção para ${cDisplay.display} expirou.`, mentions });
            }
        }, 60000);
        return;
    }

    if (command === '/deserdar') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const children = relationshipLog[chatJid][commandSenderJid].children;

            if (children.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não tem filhos para deserdar." });
            }


            for (const child of children) {
                initUser(chatJid, child);
                relationshipLog[chatJid][child].parents = relationshipLog[chatJid][child].parents.filter(p => p !== commandSenderJid);
            }


            relationshipLog[chatJid][commandSenderJid].children = [];
            await saveRelationships();

            const senderDisplay = getUserDisplay(commandSenderJid);
            const mentions = senderDisplay.mention ? [commandSenderJid] : [];

            return sock.sendMessage(chatJid, { text: `💔 *DESERDADOS!* ${senderDisplay.display} deserdou TODOS os seus filhos.`, mentions });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione o filho para deserdar ou use `/deserdar @all`." });
        const child = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        if (!relationshipLog[chatJid][commandSenderJid].children.includes(child)) return sock.sendMessage(chatJid, { text: "Não é seu filho." });

        relationshipLog[chatJid][commandSenderJid].children = relationshipLog[chatJid][commandSenderJid].children.filter(c => c !== child);

        initUser(chatJid, child);
        relationshipLog[chatJid][child].parents = relationshipLog[chatJid][child].parents.filter(p => p !== commandSenderJid);

        await saveRelationships();

        const senderDisplay = getUserDisplay(commandSenderJid);
        const childDisplay = getUserDisplay(child);
        const mentions = [];
        if (senderDisplay.mention) mentions.push(commandSenderJid);
        if (childDisplay.mention) mentions.push(child);

        return sock.sendMessage(chatJid, { text: `💔 *DESERDADO!* ${childDisplay.display} não é mais filho de ${senderDisplay.display}.`, mentions });
    }

    if (command === '/abandonar') {
        const isAll = commandText.includes('@all') || commandText.includes('all');

        if (isAll) {
            initUser(chatJid, commandSenderJid);
            const parents = relationshipLog[chatJid][commandSenderJid].parents;

            if (parents.length === 0) {
                return sock.sendMessage(chatJid, { text: "Você não tem pais para abandonar." });
            }


            for (const parent of parents) {
                initUser(chatJid, parent);
                relationshipLog[chatJid][parent].children = relationshipLog[chatJid][parent].children.filter(c => c !== commandSenderJid);
            }


            relationshipLog[chatJid][commandSenderJid].parents = [];
            await saveRelationships();

            const senderDisplay = getUserDisplay(commandSenderJid);
            const mentions = senderDisplay.mention ? [commandSenderJid] : [];

            return sock.sendMessage(chatJid, { text: `🏃‍♂️ *FUGIU DE TODOS!* ${senderDisplay.display} abandonou TODOS os seus pais.`, mentions });
        }

        if (mentionedJids.length !== 1) return sock.sendMessage(chatJid, { text: "Mencione o pai/mãe para abandonar ou use `/abandonar @all`." });
        const parent = mentionedJids[0];
        initUser(chatJid, commandSenderJid);

        if (!relationshipLog[chatJid][commandSenderJid].parents.includes(parent)) return sock.sendMessage(chatJid, { text: "Não é seu pai/mãe." });

        relationshipLog[chatJid][commandSenderJid].parents = relationshipLog[chatJid][commandSenderJid].parents.filter(p => p !== parent);

        initUser(chatJid, parent);
        relationshipLog[chatJid][parent].children = relationshipLog[chatJid][parent].children.filter(c => c !== commandSenderJid);

        await saveRelationships();

        const senderDisplay = getUserDisplay(commandSenderJid);
        const parentDisplay = getUserDisplay(parent);
        const mentions = [];
        if (senderDisplay.mention) mentions.push(commandSenderJid);
        if (parentDisplay.mention) mentions.push(parent);

        return sock.sendMessage(chatJid, { text: `🏃‍♂️ *FUGIU!* ${senderDisplay.display} abandonou ${parentDisplay.display}.`, mentions });
    }

    if (command === '/familia') {
        const target = mentionedJids.length > 0 ? mentionedJids[0] : commandSenderJid;
        initUser(chatJid, target);
        const data = relationshipLog[chatJid][target];

        const parents = data.parents.filter(p => currentParticipantJids.has(p));
        const children = data.children.filter(c => currentParticipantJids.has(c));
        const spouses = data.spouses.filter(s => currentParticipantJids.has(s.partner));

        if (parents.length === 0 && children.length === 0 && spouses.length === 0) {
            const tDisplay = getUserDisplay(target);
            const mentions = tDisplay.mention ? [target] : [];
            return sock.sendMessage(chatJid, { text: `🏚️ ${tDisplay.display} não tem família (presente) neste grupo.`, mentions });
        }

        const tDisplay = getUserDisplay(target);
        let text = `*👨‍👩‍👧‍👦 Família de ${tDisplay.display}*\n\n`;
        const mentions = [];
        if (tDisplay.mention) mentions.push(target);

        if (parents.length > 0) {
            text += `👑 *Pais:* \n`;
            parents.forEach(p => {
                const pDisplay = getUserDisplay(p);
                text += `  ${pDisplay.display}\n`;
                if (pDisplay.mention) mentions.push(p);
            });
        }
        if (spouses.length > 0) {
            text += `💍 *Cônjuges:* \n`;
            spouses.forEach(s => {
                const sDisplay = getUserDisplay(s.partner);
                text += `  ${sDisplay.display}\n`;
                if (sDisplay.mention) mentions.push(s.partner);
            });
        }
        if (children.length > 0) {
            text += `👶 *Filhos:* \n`;
            children.forEach(c => {
                const cDisplay = getUserDisplay(c);
                text += `  ${cDisplay.display}\n`;
                if (cDisplay.mention) mentions.push(c);
            });
        }

        return sock.sendMessage(chatJid, { text: text.trim(), mentions });
    }





    if (command === '/aceitar' || command === '/aceitaradocao') {
        const proposal = pendingProposals[chatJid][commandSenderJid];

        if (!proposal) {
            return sock.sendMessage(chatJid, { text: "Não há pedidos pendentes para você." });
        }

        const requester = proposal.requester;
        if (!currentParticipantJids.has(requester)) {
            delete pendingProposals[chatJid][commandSenderJid];
            return sock.sendMessage(chatJid, { text: "Quem fez o pedido saiu do grupo. Cancelado." });
        }

        if (proposal.type === 'marriage') {
            initUser(chatJid, requester);
            initUser(chatJid, commandSenderJid);


            const incestError = isIncest(chatJid, requester, commandSenderJid);
            if (incestError) {
                delete pendingProposals[chatJid][commandSenderJid];
                return sock.sendMessage(chatJid, { text: `🚫 Pedido cancelado! ${incestError}` });
            }

            const date = new Date().toISOString();
            relationshipLog[chatJid][requester].spouses.push({ partner: commandSenderJid, date });
            relationshipLog[chatJid][commandSenderJid].spouses.push({ partner: requester, date });

            await saveRelationships();
            delete pendingProposals[chatJid][commandSenderJid];

            const reqDisplay = getUserDisplay(requester);
            const senderDisplay = getUserDisplay(commandSenderJid);
            const mentions = [];
            if (reqDisplay.mention) mentions.push(requester);
            if (senderDisplay.mention) mentions.push(commandSenderJid);

            return sock.sendMessage(chatJid, { text: `🎉 *CASADOS!* 🎉\n\n${reqDisplay.display} e ${senderDisplay.display} agora estão oficialmente casados!`, mentions });
        }

        if (proposal.type === 'lover') {
            initUser(chatJid, requester);
            initUser(chatJid, commandSenderJid);

            const date = new Date().toISOString();
            relationshipLog[chatJid][requester].lovers.push({ partner: commandSenderJid, date });
            relationshipLog[chatJid][commandSenderJid].lovers.push({ partner: requester, date });

            await saveRelationships();
            delete pendingProposals[chatJid][commandSenderJid];

            const reqDisplay = getUserDisplay(requester);
            const senderDisplay = getUserDisplay(commandSenderJid);
            const mentions = [];
            if (reqDisplay.mention) mentions.push(requester);
            if (senderDisplay.mention) mentions.push(commandSenderJid);

            return sock.sendMessage(chatJid, { text: `🔥 *É FOGO NO PARQUINHO!* 🔥\n\n${reqDisplay.display} e ${senderDisplay.display} agora são amantes!`, mentions });
        }

        if (proposal.type === 'adoption') {

            const parent = requester;
            const child = commandSenderJid;

            initUser(chatJid, parent);
            initUser(chatJid, child);

            if (!relationshipLog[chatJid][parent].children.includes(child)) relationshipLog[chatJid][parent].children.push(child);
            if (!relationshipLog[chatJid][child].parents.includes(parent)) relationshipLog[chatJid][child].parents.push(parent);

            await saveRelationships();
            delete pendingProposals[chatJid][child];

            const parentDisplay = getUserDisplay(parent);
            const childDisplay = getUserDisplay(child);
            const mentions = [];
            if (parentDisplay.mention) mentions.push(parent);
            if (childDisplay.mention) mentions.push(child);

            return sock.sendMessage(chatJid, { text: `🎉 *FAMÍLIA CRESCEU!* 🎉\n\n${parentDisplay.display} adotou ${childDisplay.display}!`, mentions });
        }

    }
}

module.exports = handleRelationshipCommand;

module.exports.couplePetApi = {
    getAllCouplePets: () => couplePetLog,
    saveCouplePets,
    refreshCouplePet,
    setCouplePetByKey(groupJid, coupleKey, petData) {
        ensureCouplePetGroup(groupJid);
        couplePetLog[groupJid][coupleKey] = petData;
    },
    removeCouplePetByKey(groupJid, coupleKey) {
        ensureCouplePetGroup(groupJid);
        delete couplePetLog[groupJid][coupleKey];
    },
    getUserDisplay,
    getCouplePetMood,
    buildCouplePetWarnings
};


module.exports.commandData = {
    name: "relacionamentos",
    description: "Sem descrição disponível.",
    category: "diversao",
    usage: "/relacionamentos",
    aliases: ["/relacionamentos", "/casar", "/casamento", "/divorcio", "/casados", "/aceitar", "/adotar", "/adot", "/familia", "/aceitaradocao", "/deserdar", "/abandonar", "/filhos", "/pais", "/amante", "/amantes", "/terminar", "/largar", "/bf", "/bestfriend", "/melhoresamigos", "/bichinho", "/petcasal", "/mascotecasal"]
};
