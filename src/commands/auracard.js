const { sendGiratinaError } = require('../utils/utils.js');
const { generateImage } = require('../helpers/imageGenerator.js');
const authManager = require('../managers/authManager.js');
const contactManager = require('../managers/contactManager.js');
const path = require('path');
const fs = require('fs').promises;

// Template de HTML para o Card de Aura
const auraCardHtmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap');
    
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        width: 600px;
        height: 350px;
        font-family: 'Outfit', sans-serif;
        background: #020205;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .card {
        position: relative;
        width: 580px;
        height: 330px;
        background: rgba(10, 10, 18, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 30px;
        display: flex;
        align-items: center;
        overflow: hidden;
        backdrop-filter: blur(20px);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }

    /* Ambient Glow Orbs */
    .glow-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.28;
        z-index: 1;
        pointer-events: none;
    }

    .glow-1 {
        width: 250px;
        height: 250px;
        background: {{{auraColor1}}};
        top: -60px;
        left: -60px;
    }

    .glow-2 {
        width: 200px;
        height: 200px;
        background: {{{auraColor2}}};
        bottom: -50px;
        right: -50px;
    }

    .noise {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        opacity: 0.04;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
        pointer-events: none;
        z-index: 2;
    }

    .card-content {
        position: relative;
        z-index: 10;
        display: flex;
        width: 100%;
        height: 100%;
        align-items: center;
    }

    .avatar-area {
        flex-shrink: 0;
        margin-right: 30px;
        position: relative;
    }

    .avatar-wrapper {
        width: 145px;
        height: 145px;
        border-radius: 50%;
        padding: 5px;
        background: linear-gradient(135deg, {{{auraColor1}}}, {{{auraColor2}}});
        box-shadow: 0 0 35px {{{auraShadowColor}}};
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 4px solid #0a0a12;
    }

    .info-area {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        color: #fff;
        overflow: hidden;
    }

    .tag-title {
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 3px;
        color: rgba(255, 255, 255, 0.4);
        margin-bottom: 6px;
    }

    .username {
        font-size: 24px;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-bottom: 10px;
        text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 320px;
    }

    .aura-status-row {
        display: flex;
        align-items: baseline;
        margin-bottom: 8px;
    }

    .aura-points {
        font-size: 34px;
        font-weight: 950;
        background: linear-gradient(135deg, #ffffff, rgba(255, 255, 255, 0.7));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-right: 10px;
        font-family: monospace;
    }

    .aura-label {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        color: {{{auraColor1}}};
        text-shadow: 0 0 10px {{{auraShadowColor}}};
    }

    .verdict-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 12.5px;
        color: rgba(255, 255, 255, 0.7);
        font-style: italic;
        margin-bottom: 14px;
        line-height: 1.4;
    }

    .bar-container {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 4px;
        overflow: hidden;
        position: relative;
    }

    .bar-fill {
        height: 100%;
        border-radius: 4px;
        background: linear-gradient(90deg, {{{auraColor1}}}, {{{auraColor2}}});
        width: {{{auraPercent}}}%;
        box-shadow: 0 0 10px {{{auraShadowColor}}};
    }

    .bar-markers {
        display: flex;
        justify-content: space-between;
        font-size: 8.5px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.35);
        margin-top: 5px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
</style>
</head>
<body>
<div class="card">
    <div class="noise"></div>
    <div class="glow-orb glow-1"></div>
    <div class="glow-orb glow-2"></div>
    <div class="card-content">
        <div class="avatar-area">
            <div class="avatar-wrapper">
                <img class="avatar" src="{{{avatarUrl}}}" />
            </div>
        </div>
        <div class="info-area">
            <div class="tag-title">AURA ENERGY PROFILE</div>
            <div class="username">{{name}}</div>
            <div class="aura-status-row">
                <span class="aura-points">{{formattedPoints}}</span>
                <span class="aura-label">{{icon}} {{statusLabel}}</span>
            </div>
            <div class="verdict-box">
                "{{verdict}}"
            </div>
            <div class="bar-container">
                <div class="bar-fill"></div>
            </div>
            <div class="bar-markers">
                <span>Dreno (-10k)</span>
                <span>Neutro</span>
                <span>Divino (+10k)</span>
            </div>
        </div>
    </div>
</div>
</body>
</html>
`;

async function handleAuraCardCommand(sock, msg, msgDetails) {
    const { sender, pushName } = msgDetails;

    const commandSenderJid = msg.key.participant || msg.key.remoteJid;
    const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];

    let personToCheck = commandSenderJid;
    let targetName = pushName;

    if (mentionedJids.length > 0) {
        personToCheck = mentionedJids[0];
        targetName = contactManager.getNickname(personToCheck) || `@${personToCheck.split('@')[0]}`;
    }

    // Calcula os pontos de aura da mesma forma que /aura
    const min = -10000;
    const max = 10000;
    let auraPoints = Math.floor(Math.random() * (max - min + 1)) + min;

    // Super Admins têm aura máxima sempre
    if (authManager.isSuperAdmin(personToCheck)) {
        auraPoints = 10000;
    }

    // Define as características baseadas nos pontos de aura
    let statusLabel = 'AURA NEUTRA';
    let icon = '😐';
    let auraColor1 = '#95a5a6';
    let auraColor2 = '#7f8c8d';
    let auraShadowColor = 'rgba(149, 165, 166, 0.3)';
    let verdict = 'Aura estável. Nem sigma, nem beta.';

    if (auraPoints <= -5000) {
        statusLabel = 'AURA OBSCURA';
        icon = '💀';
        auraColor1 = '#e74c3c';
        auraColor2 = '#4a121a';
        auraShadowColor = 'rgba(231, 76, 60, 0.4)';
        verdict = 'Aura negativa absurda. Drenou todos ao redor.';
    } else if (auraPoints < 0) {
        statusLabel = 'AURA ENFRAQUECIDA';
        icon = '📉';
        auraColor1 = '#e67e22';
        auraColor2 = '#d35400';
        auraShadowColor = 'rgba(230, 126, 34, 0.4)';
        verdict = 'Perdeu aura recentemente. Precisa de boas ações.';
    } else if (auraPoints <= 5000) {
        statusLabel = 'AURA ESTÁVEL';
        icon = '😐';
        auraColor1 = '#2ecc71';
        auraColor2 = '#27ae60';
        auraShadowColor = 'rgba(46, 204, 113, 0.3)';
        verdict = 'Aura estável. Nem sigma, nem beta.';
    } else if (auraPoints <= 9000) {
        statusLabel = 'AURA PODEROSA';
        icon = '🗿';
        auraColor1 = '#3498db';
        auraColor2 = '#8e44ad';
        auraShadowColor = 'rgba(52, 152, 219, 0.5)';
        verdict = 'Aura poderosa! Sua presença impõe respeito.';
    } else {
        statusLabel = 'AURA TRANSCENDENTE';
        icon = '🌟';
        auraColor1 = '#f1c40f';
        auraColor2 = '#f39c12';
        auraShadowColor = 'rgba(241, 196, 15, 0.6)';
        verdict = 'AURA INFINITA! Transcendeu a realidade!';
    }

    // Calcula a porcentagem na escala de -10000 a 10000
    const auraPercent = Math.min(100, Math.max(0, ((auraPoints + 10000) / 20000) * 100));

    // Formata os pontos de aura (+5.230 ou -4.500)
    const prefix = auraPoints >= 0 ? '+' : '';
    const formattedPoints = `${prefix}${auraPoints.toLocaleString('pt-BR')}`;

    try {
        // Envia um emoji de carregamento/reação
        await sock.sendMessage(sender, { react: { text: '✨', key: msg.key } });

        // Tenta obter a foto de perfil do alvo
        let avatarUrl;
        try {
            avatarUrl = await sock.profilePictureUrl(personToCheck, 'image');
        } catch (e) {
            avatarUrl = 'https://telegra.ph/file/24fa902ead26340f3df2c.png';
        }

        // Caminho temporário para salvar a imagem gerada
        const tempPath = path.join(__dirname, '..', '..', 'temp', `auracard_${Date.now()}.png`);

        // Gera a imagem usando o helper imageGenerator
        await generateImage(auraCardHtmlTemplate, tempPath, {
            name: targetName.replace('@', ''),
            avatarUrl,
            formattedPoints,
            statusLabel,
            icon,
            verdict,
            auraColor1,
            auraColor2,
            auraShadowColor,
            auraPercent
        }, { width: 600, height: 350 });

        // Envia a imagem como resposta
        let mentions = personToCheck === commandSenderJid ? [] : [personToCheck];
        await sock.sendMessage(sender, {
            image: { url: tempPath },
            caption: `⚡ *Aura Card de ${targetName}*\n\nPontos de Aura: *${formattedPoints}*\nDiagnóstico: _"${verdict}"_`,
            mentions: mentions
        }, { quoted: msg });

        // Exclui o arquivo temporário após 30 segundos
        setTimeout(() => fs.unlink(tempPath).catch(() => {}), 30000);

    } catch (error) {
        console.error('[AURACARD] Error:', error);
        await sendGiratinaError(sock, sender, msg, error);
    }

    return true;
}

module.exports = handleAuraCardCommand;

module.exports.commandData = {
    name: "auracard",
    description: "Gera uma imagem premium com o seu card e diagnóstico de Aura.",
    category: "diversao",
    usage: "/auracard [@user]",
    aliases: ["/auracard", "/cardaura", "/pontoscard"]
};
