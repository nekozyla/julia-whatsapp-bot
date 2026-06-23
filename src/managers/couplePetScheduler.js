const relationshipCommand = require('../commands/relacionamentos.js');

const CHECK_INTERVAL = 30 * 60 * 1000;
const ALERT_COOLDOWN_HOURS = 6;
const HAPPY_COOLDOWN_HOURS = 12;
const LEAVE_AFTER_NEGLECT_HOURS = 48;
const LEAVE_GRACE_AFTER_WARNING_HOURS = 8;

const SAD_LETTERS = [
    (pet, ownersText) => `💔 *Cartinha do ${pet.name}*\n\n${ownersText},\n\nEu tentei esperar mais um pouco, mas fiquei com muita saudade de carinho, comida e atenção. Talvez eu tenha amado vocês mais do que fui lembrado.\n\nVou embora procurando um cantinho mais quentinho.\n\nCom tristeza,\n*${pet.name}* ${pet.emoji}`,
    (pet, ownersText) => `🥀 *Bilhetinho deixado por ${pet.name}*\n\nOi, ${ownersText}...\n\nEu fiquei aqui olhando cada mensagem, torcendo para vocês aparecerem. Quando percebi que o silêncio era maior que o cuidado, entendi que era hora de partir.\n\nNão fiquem bravos. Eu só não queria continuar sozinho.\n\nAssinado: *${pet.name}* ${pet.emoji}`,
    (pet, ownersText) => `📭 *Uma cartinha triste foi encontrada...*\n\nPara ${ownersText},\n\nSe vocês estiverem lendo isso, eu já fui. Meu potinho ficou vazio, meu coração também. Eu esperei brincar, esperei carinho, esperei vocês.\n\nTomara que um dia lembrem de mim com amor.\n\n— *${pet.name}* ${pet.emoji}`,
    (pet, ownersText) => `🌧️ *Carta de despedida do ${pet.name}*\n\n${ownersText},\n\nEu não queria ir embora, de verdade. Mas bichinhos também ficam tristes quando não são cuidados. Cada hora sozinho pesou demais.\n\nEstou indo antes de esquecer como era ser amado.\n\nAdeus,\n*${pet.name}* ${pet.emoji}`,
    (pet, ownersText) => `🕊️ *Última mensagem do ${pet.name}*\n\nMeus queridos ${ownersText},\n\nEu fui ficando fraquinho e quietinho. Achei que vocês iam voltar logo, então continuei esperando. Só que a espera doeu demais.\n\nVou descansar longe daqui.\n\nCom carinho triste,\n*${pet.name}* ${pet.emoji}`
];

let schedulerIntervalId = null;
let activeSock = null;

function hoursSince(dateValue) {
    if (!dateValue) return Number.POSITIVE_INFINITY;
    const timestamp = new Date(dateValue).getTime();
    if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
    return (Date.now() - timestamp) / (1000 * 60 * 60);
}

function isPositivePet(pet) {
    return [pet.satiety, pet.energy, pet.hygiene, pet.joy, pet.health].every(value => value >= 82);
}

function getUrgencyScore(pet) {
    const values = [pet.satiety, pet.energy, pet.hygiene, pet.joy, pet.health];
    return 100 - Math.min(...values);
}

function getAlertType(pet, warnings) {
    if (pet.health <= 25) return 'health';
    if (pet.satiety <= 25) return 'hunger';
    if (pet.energy <= 25) return 'sleep';
    if (pet.hygiene <= 25) return 'hygiene';
    if (pet.joy <= 25) return 'joy';
    if (warnings.length >= 2) return 'attention';
    if (isPositivePet(pet)) return 'happy';
    return null;
}

function getNeglectHours(pet) {
    return hoursSince(pet.lastCareAt || pet.createdAt || pet.lastUpdate);
}

function shouldPetLeave(pet, warnings) {
    const neglectHours = getNeglectHours(pet);
    if (pet.health <= 0) return true;
    if (neglectHours < LEAVE_AFTER_NEGLECT_HOURS) return false;
    if (hoursSince(pet.lastNeglectWarningAt) < LEAVE_GRACE_AFTER_WARNING_HOURS) return false;
    if ((pet.neglectWarningCount || 0) < 2) return false;
    if (warnings.length >= 4 && pet.health <= 10) return true;
    return false;
}

function buildSadLetter(pet, ownersDisplay) {
    const ownersText = ownersDisplay.map(owner => owner.display).join(' e ');
    const mentionIds = ownersDisplay.map(owner => owner.jid);
    const letter = SAD_LETTERS[Math.floor(Math.random() * SAD_LETTERS.length)](pet, ownersText);
    return {
        text: letter,
        mentions: mentionIds
    };
}

function buildAutomaticMessage(pet, ownersDisplay, warnings, alertType) {
    const ownersText = ownersDisplay.map(owner => owner.display).join(' e ');
    const mentionIds = ownersDisplay.map(owner => owner.jid);

    const messages = {
        health: `🚑 *${pet.name}* está abatido(a)! ${ownersText}, o bichinho de vocês precisa de cuidado urgente.\n\nUse \`/bichinho cuidar\` para ajudar.`,
        hunger: `🍽️ *${pet.name}* está com muita fome, ${ownersText}!\n\nUse \`/bichinho alimentar\` antes que ele fique tristinho.`,
        sleep: `😴 *${pet.name}* está caindo de sono, ${ownersText}.\n\nUse \`/bichinho dormir\` para recuperar a energia.`,
        hygiene: `🧼 *${pet.name}* está precisando de um banho, ${ownersText}.\n\nUse \`/bichinho limpar\` para deixar tudo brilhando.`,
        joy: `🎾 *${pet.name}* quer atenção, ${ownersText}!\n\nUse \`/bichinho brincar\` para animar o bichinho.`,
        attention: `🐾 *${pet.name}* está chamando ${ownersText}!\n\nHumor atual: *${relationshipCommand.couplePetApi.getCouplePetMood(pet)}*\n${warnings.map(item => `• ${item}`).join('\n')}\n\nCorram lá com \`/bichinho status\`.`,
        happy: `✨ *${pet.name}* está super feliz com ${ownersText}!\n\nContinuem assim. O bichinho de vocês está radiante. 💖`
    };

    return {
        text: messages[alertType] || messages.attention,
        mentions: mentionIds
    };
}

async function checkAndSendCouplePetMessages() {
    if (!activeSock) return;

    const petApi = relationshipCommand.couplePetApi;
    const allGroups = petApi.getAllCouplePets();
    let changed = false;

    for (const [groupJid, petsByCouple] of Object.entries(allGroups)) {
        if (!petsByCouple || typeof petsByCouple !== 'object') continue;

        const candidates = [];

        for (const [coupleKey, rawPet] of Object.entries(petsByCouple)) {
            if (!rawPet || !Array.isArray(rawPet.owners) || rawPet.owners.length < 2) continue;

            const pet = petApi.refreshCouplePet(rawPet);
            petApi.setCouplePetByKey(groupJid, coupleKey, pet);
            changed = true;

            const warnings = petApi.buildCouplePetWarnings(pet);
            if (shouldPetLeave(pet, warnings)) {
                const ownersDisplay = pet.owners.map(jid => ({ jid, ...petApi.getUserDisplay(jid) }));
                const letter = buildSadLetter(pet, ownersDisplay);

                try {
                    await activeSock.sendMessage(groupJid, {
                        text: letter.text,
                        mentions: letter.mentions
                    });
                } catch (error) {
                    console.error(`[Couple Pet Scheduler] Falha ao enviar cartinha triste para ${groupJid}:`, error);
                }

                petApi.removeCouplePetByKey(groupJid, coupleKey);
                changed = true;
                continue;
            }

            const alertType = getAlertType(pet, warnings);
            if (!alertType) continue;

            const cooldown = alertType === 'happy' ? HAPPY_COOLDOWN_HOURS : ALERT_COOLDOWN_HOURS;
            if (hoursSince(pet.lastAutoMessageAt) < cooldown) continue;

            if (alertType === 'happy' && Math.random() > 0.25) continue;

            candidates.push({
                coupleKey,
                pet,
                warnings,
                alertType,
                urgency: alertType === 'happy' ? -1 : getUrgencyScore(pet)
            });
        }

        if (candidates.length === 0) continue;

        candidates.sort((a, b) => b.urgency - a.urgency);
        const selected = candidates[0];
        const ownersDisplay = selected.pet.owners.map(jid => ({ jid, ...petApi.getUserDisplay(jid) }));
        const message = buildAutomaticMessage(selected.pet, ownersDisplay, selected.warnings, selected.alertType);

        try {
            await activeSock.sendMessage(groupJid, {
                text: message.text,
                mentions: message.mentions
            });

            selected.pet.lastAutoMessageAt = new Date().toISOString();
            selected.pet.lastAutoMessageType = selected.alertType;
            if (selected.alertType !== 'happy') {
                selected.pet.lastNeglectWarningAt = selected.pet.lastAutoMessageAt;
                selected.pet.neglectWarningCount = (selected.pet.neglectWarningCount || 0) + 1;
            }
            petApi.setCouplePetByKey(groupJid, selected.coupleKey, selected.pet);
            changed = true;
        } catch (error) {
            console.error(`[Couple Pet Scheduler] Falha ao enviar mensagem automática para ${groupJid}:`, error);
        }
    }

    if (changed) {
        await petApi.saveCouplePets();
    }
}

function initializeCouplePetScheduler(sock) {
    activeSock = sock;

    if (schedulerIntervalId) return;



    setTimeout(() => {
        checkAndSendCouplePetMessages().catch(error => {
            console.error('[Couple Pet Scheduler] Erro na checagem inicial:', error);
        });
    }, 20 * 1000);

    schedulerIntervalId = setInterval(() => {
        checkAndSendCouplePetMessages().catch(error => {
            console.error('[Couple Pet Scheduler] Erro no agendador:', error);
        });
    }, CHECK_INTERVAL);
}

function stopCouplePetScheduler() {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
    }

    activeSock = null;
}

module.exports = {
    initializeCouplePetScheduler,
    stopCouplePetScheduler
};