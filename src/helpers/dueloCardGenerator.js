const path = require('path');
const fs = require('fs').promises;
const { generateImage } = require('./imageGenerator');

// ═══════════════════════════════════════════════════════════
//  ⚔️  D U E L O   C A R D   G E N E R A T O R
// ═══════════════════════════════════════════════════════════

// Cores temáticas por classe
const CLASS_COLORS = {
    guerreiro: { primary: '#e74c3c', secondary: '#c0392b', gradient: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)', glow: 'rgba(231,76,60,0.4)' },
    mago: { primary: '#9b59b6', secondary: '#8e44ad', gradient: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)', glow: 'rgba(155,89,182,0.4)' },
    arqueiro: { primary: '#27ae60', secondary: '#219a52', gradient: 'linear-gradient(135deg, #27ae60 0%, #219a52 100%)', glow: 'rgba(39,174,96,0.4)' },
    paladino: { primary: '#f1c40f', secondary: '#f39c12', gradient: 'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)', glow: 'rgba(241,196,15,0.4)' },
    assassino: { primary: '#636e72', secondary: '#2d3436', gradient: 'linear-gradient(135deg, #636e72 0%, #2d3436 100%)', glow: 'rgba(99,110,114,0.4)' },
    dragao: { primary: '#e67e22', secondary: '#d35400', gradient: 'linear-gradient(135deg, #e67e22 0%, #d35400 100%)', glow: 'rgba(230,126,34,0.4)' },
    barbaro: { primary: '#c0392b', secondary: '#8e44ad', gradient: 'linear-gradient(135deg, #c0392b 0%, #8e44ad 100%)', glow: 'rgba(192,57,43,0.4)' },
    clerigo: { primary: '#fada5e', secondary: '#f1c40f', gradient: 'linear-gradient(135deg, #fada5e 0%, #f1c40f 100%)', glow: 'rgba(250,218,94,0.4)' },
    necromante: { primary: '#34495e', secondary: '#2c3e50', gradient: 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)', glow: 'rgba(52,73,94,0.4)' },
    tecnomago: { primary: '#3498db', secondary: '#2980b9', gradient: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)', glow: 'rgba(52,152,219,0.4)' }
};

function hpPercent(hp, maxHp) {
    return Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
}

function hpColor(percent) {
    if (percent <= 25) return '#e74c3c';
    if (percent <= 50) return '#f39c12';
    return '#2ecc71';
}

function statusIcons(buffs) {
    const icons = [];
    if (buffs.burn > 0) icons.push(`<span class="status-icon burn">🔥${buffs.burn}</span>`);
    if (buffs.shielded) icons.push(`<span class="status-icon shield">🛡️</span>`);
    if (buffs.atkMultiplier > 1) icons.push(`<span class="status-icon buff">⚡ATK</span>`);
    if (buffs.poison > 0) icons.push(`<span class="status-icon poison">☠️${buffs.poison}</span>`);
    if (buffs.magicBarrier) icons.push(`<span class="status-icon barrier">🔮</span>`);
    if (buffs.precisionAim) icons.push(`<span class="status-icon aim">🎯</span>`);
    if (buffs.silenced > 0) icons.push(`<span class="status-icon silenced">🔌${buffs.silenced}</span>`);
    if (buffs.boneShield > 0) icons.push(`<span class="status-icon bone">🦴${buffs.boneShield}</span>`);
    return icons.join('');
}

// ── CARD BASE CSS ───────────────────────────────────────
function baseCSS() {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 600px;
            font-family: 'Inter', sans-serif;
            background: #0a0a0f;
            color: #fff;
            overflow: hidden;
        }
        .card {
            position: relative;
            width: 600px;
            padding: 30px;
            background: linear-gradient(180deg, #12121a 0%, #0a0a12 100%);
            overflow: hidden;
        }
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 3px;
            background: linear-gradient(90deg, #e74c3c, #9b59b6, #3498db, #2ecc71, #f1c40f, #e67e22);
        }
        .noise {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            opacity: 0.03;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
            pointer-events: none;
        }

        /* Player panels */
        .player-panel {
            display: flex;
            align-items: center;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px;
            padding: 16px 20px;
            margin-bottom: 12px;
            backdrop-filter: blur(10px);
            position: relative;
            overflow: hidden;
        }
        .player-panel::before {
            content: '';
            position: absolute;
            top: 0; left: 0; bottom: 0;
            width: 4px;
            border-radius: 4px 0 0 4px;
        }
        .player-panel.p1::before { background: var(--p1-color); }
        .player-panel.p2::before { background: var(--p2-color); }

        .class-icon {
            font-size: 36px;
            margin-right: 16px;
            filter: drop-shadow(0 0 8px rgba(255,255,255,0.15));
        }
        .player-info { flex: 1; }
        .player-name {
            font-size: 16px;
            font-weight: 800;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .hp-bar-container {
            width: 100%;
            height: 12px;
            background: rgba(255,255,255,0.08);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }
        .hp-bar-fill {
            height: 100%;
            border-radius: 6px;
            transition: width 0.3s ease;
            position: relative;
            overflow: hidden;
        }
        .hp-bar-fill::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 50%;
            background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%);
        }
        .hp-text {
            font-size: 11px;
            font-weight: 700;
            color: rgba(255,255,255,0.7);
            margin-top: 4px;
            display: flex;
            justify-content: space-between;
        }

        .stats-row {
            display: flex;
            gap: 8px;
            margin-top: 4px;
        }
        .stat-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            background: rgba(255,255,255,0.08);
            color: rgba(255,255,255,0.6);
        }

        .status-icons {
            display: flex;
            gap: 4px;
            margin-left: auto;
            flex-shrink: 0;
        }
        .status-icon {
            font-size: 11px;
            padding: 3px 6px;
            border-radius: 8px;
            font-weight: 700;
        }
        .status-icon.burn { background: rgba(231,76,60,0.2); color: #e74c3c; }
        .status-icon.shield { background: rgba(241,196,15,0.2); color: #f1c40f; }
        .status-icon.buff { background: rgba(52,152,219,0.2); color: #3498db; }
        .status-icon.poison { background: rgba(155,89,182,0.2); color: #9b59b6; }
        .status-icon.barrier { background: rgba(142,68,173,0.2); color: #8e44ad; }
        .status-icon.aim { background: rgba(39,174,96,0.2); color: #27ae60; }
        .status-icon.silenced { background: rgba(52,152,219,0.2); color: #3498db; }
        .status-icon.bone { background: rgba(189,195,199,0.2); color: #bdc3c7; }
    `;
}

// ═══════════════════════════════════════════════════════════
//  🏟️  ARENA CARD — Início da Batalha
// ═══════════════════════════════════════════════════════════

async function generateArenaCard(game, p1Name, p2Name) {
    const p1 = game.players[game.challenger];
    const p2 = game.players[game.target];
    const c1 = CLASS_COLORS[p1.class] || CLASS_COLORS.guerreiro;
    const c2 = CLASS_COLORS[p2.class] || CLASS_COLORS.guerreiro;
    const turnName = game.turn === game.challenger ? p1Name : p2Name;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
    ${baseCSS()}
    .card { height: 420px; }
    .title-section {
        text-align: center;
        margin-bottom: 25px;
    }
    .title-section h1 {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 6px;
        text-transform: uppercase;
        background: linear-gradient(135deg, ${c1.primary}, ${c2.primary});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 4px;
    }
    .title-section .sub {
        font-size: 11px;
        color: rgba(255,255,255,0.4);
        letter-spacing: 3px;
        text-transform: uppercase;
    }
    .vs-divider {
        text-align: center;
        font-size: 22px;
        font-weight: 900;
        color: rgba(255,255,255,0.15);
        letter-spacing: 8px;
        margin: 8px 0;
    }
    .turn-indicator {
        text-align: center;
        margin-top: 16px;
        font-size: 13px;
        font-weight: 700;
        color: rgba(255,255,255,0.5);
        background: rgba(255,255,255,0.05);
        padding: 10px 20px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08);
    }
    .turn-indicator span { color: #f1c40f; }
    .glow-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        opacity: 0.15;
        pointer-events: none;
    }
    .glow-1 { width: 200px; height: 200px; background: ${c1.primary}; top: 20px; left: -40px; }
    .glow-2 { width: 200px; height: 200px; background: ${c2.primary}; bottom: 20px; right: -40px; }
</style></head>
<body>
<div class="card" style="--p1-color:${c1.primary};--p2-color:${c2.primary}">
    <div class="noise"></div>
    <div class="glow-orb glow-1"></div>
    <div class="glow-orb glow-2"></div>
    <div class="title-section">
        <h1>⚔️ DUELO ⚔️</h1>
        <div class="sub">batalha rpg por turnos</div>
    </div>
    <div class="player-panel p1">
        <div class="class-icon" style="white-space:nowrap">${p1.emoji} ${p1.classEmoji}</div>
        <div class="player-info">
            <div class="player-name" style="color:${c1.primary}">${p1Name}</div>
            <div class="hp-bar-container">
                <div class="hp-bar-fill" style="width:100%;background:${c1.gradient}"></div>
            </div>
            <div class="hp-text">
                <span>${p1.specieName} ${p1.className}</span>
                <span>${p1.hp}/${p1.maxHp} HP</span>
            </div>
            <div class="stats-row">
                <span class="stat-badge">⚔️ ATK:${p1.atk}</span>
                <span class="stat-badge">🛡️ DEF:${p1.def}</span>
                <span class="stat-badge">✨ ${p1.specialName || 'Especial'}</span>
            </div>
        </div>
    </div>
    <div class="vs-divider">— — VS — —</div>
    <div class="player-panel p2">
        <div class="class-icon" style="white-space:nowrap">${p2.emoji} ${p2.classEmoji}</div>
        <div class="player-info">
            <div class="player-name" style="color:${c2.primary}">${p2Name}</div>
            <div class="hp-bar-container">
                <div class="hp-bar-fill" style="width:100%;background:${c2.gradient}"></div>
            </div>
            <div class="hp-text">
                <span>${p2.specieName} ${p2.className}</span>
                <span>${p2.hp}/${p2.maxHp} HP</span>
            </div>
            <div class="stats-row">
                <span class="stat-badge">⚔️ ATK:${p2.atk}</span>
                <span class="stat-badge">🛡️ DEF:${p2.def}</span>
                <span class="stat-badge">✨ ${p2.specialName || 'Especial'}</span>
            </div>
        </div>
    </div>
    <div class="turn-indicator">⏳ TURNO 1 — Vez de <span>${turnName}</span></div>
</div>
</body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `duelo_arena_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 420 });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  ⚔️  ACTION CARD — Turno de Combate
// ═══════════════════════════════════════════════════════════

async function generateActionCard(game, result, p1Name, p2Name) {
    const p1 = game.players[game.challenger];
    const p2 = game.players[game.target];
    const c1 = CLASS_COLORS[p1.class] || CLASS_COLORS.guerreiro;
    const c2 = CLASS_COLORS[p2.class] || CLASS_COLORS.guerreiro;

    const p1Hp = hpPercent(p1.hp, p1.maxHp);
    const p2Hp = hpPercent(p2.hp, p2.maxHp);

    // Determinar qual panel é o atacante
    const isP1Attacker = result.attackerJid === game.challenger;
    const attackerColor = isP1Attacker ? c1 : c2;

    // Action badge
    const actionLabels = {
        atacar: '⚔️ ATAQUE',
        defender: '🛡️ DEFESA',
        especial: '✨ ESPECIAL',
        pocao: '🧪 POÇÃO'
    };
    const actionLabel = actionLabels[result.action] || '⚔️ AÇÃO';

    // Evento especial
    let eventBadge = '';
    if (result.isCrit) eventBadge = '<div class="event-badge crit">💥 CRÍTICO!</div>';
    else if (result.isDodge) eventBadge = '<div class="event-badge dodge">💨 ESQUIVA!</div>';
    else if (result.isCounter) eventBadge = '<div class="event-badge counter">🔄 CONTRA-ATAQUE!</div>';
    else if (result.isLastBreath) eventBadge = '<div class="event-badge lastbreath">💀 ÚLTIMO SUSPIRO!</div>';
    else if (result.isCombo) eventBadge = '<div class="event-badge combo">⚡ COMBO!</div>';

    // Damage/heal display
    let impactHTML = '';
    if (result.damage > 0) {
        impactHTML += `<div class="impact-number damage">-${result.damage} HP</div>`;
    }
    if (result.healed > 0) {
        impactHTML += `<div class="impact-number heal">+${result.healed} HP</div>`;
    }
    if (result.burnDmg > 0) {
        impactHTML += `<div class="impact-number burn-dmg">🔥 -${result.burnDmg} burn</div>`;
    }
    if (result.poisonDmg > 0) {
        impactHTML += `<div class="impact-number poison-dmg">☠️ -${result.poisonDmg} veneno</div>`;
    }
    if (result.counterDmg > 0) {
        impactHTML += `<div class="impact-number counter-dmg">🔄 -${result.counterDmg} refletido</div>`;
    }

    const turnName = game.turn ? (game.turn === game.challenger ? p1Name : p2Name) : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
    ${baseCSS()}
    .card { height: 380px; }
    .action-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
    }
    .action-badge {
        font-size: 13px;
        font-weight: 800;
        padding: 6px 16px;
        border-radius: 10px;
        background: ${attackerColor.gradient};
        color: #fff;
        letter-spacing: 1px;
    }
    .turn-badge {
        font-size: 11px;
        font-weight: 700;
        color: rgba(255,255,255,0.4);
        padding: 6px 12px;
        border-radius: 10px;
        background: rgba(255,255,255,0.05);
    }

    .event-badge {
        text-align: center;
        font-size: 16px;
        font-weight: 900;
        padding: 8px;
        border-radius: 10px;
        margin-bottom: 12px;
        letter-spacing: 2px;
    }
    .event-badge.crit { background: rgba(231,76,60,0.15); color: #e74c3c; border: 1px solid rgba(231,76,60,0.3); }
    .event-badge.dodge { background: rgba(52,152,219,0.15); color: #3498db; border: 1px solid rgba(52,152,219,0.3); }
    .event-badge.counter { background: rgba(241,196,15,0.15); color: #f1c40f; border: 1px solid rgba(241,196,15,0.3); }
    .event-badge.lastbreath { background: rgba(142,68,173,0.15); color: #9b59b6; border: 1px solid rgba(142,68,173,0.3); }
    .event-badge.combo { background: rgba(230,126,34,0.15); color: #e67e22; border: 1px solid rgba(230,126,34,0.3); }

    .impact-row {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin: 10px 0;
    }
    .impact-number {
        font-size: 14px;
        font-weight: 800;
        padding: 4px 14px;
        border-radius: 8px;
    }
    .impact-number.damage { background: rgba(231,76,60,0.15); color: #e74c3c; }
    .impact-number.heal { background: rgba(46,204,113,0.15); color: #2ecc71; }
    .impact-number.burn-dmg { background: rgba(230,126,34,0.15); color: #e67e22; }
    .impact-number.poison-dmg { background: rgba(155,89,182,0.15); color: #9b59b6; }
    .impact-number.counter-dmg { background: rgba(241,196,15,0.15); color: #f1c40f; }

    ${!game.turn ? '' : `.next-turn {
        text-align: center;
        font-size: 12px;
        font-weight: 700;
        color: rgba(255,255,255,0.4);
        margin-top: 8px;
    }
    .next-turn span { color: #f1c40f; }`}
    .glow-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        opacity: 0.12;
        pointer-events: none;
    }
    .glow-1 { width: 150px; height: 150px; background: ${c1.primary}; top: -20px; left: -30px; }
    .glow-2 { width: 150px; height: 150px; background: ${c2.primary}; bottom: -20px; right: -30px; }
</style></head>
<body>
<div class="card" style="--p1-color:${c1.primary};--p2-color:${c2.primary}">
    <div class="noise"></div>
    <div class="glow-orb glow-1"></div>
    <div class="glow-orb glow-2"></div>
    <div class="action-header">
        <div class="action-badge">${actionLabel}</div>
        <div class="turn-badge">TURNO ${game.turnCount}</div>
    </div>
    ${eventBadge}
    <div class="player-panel p1">
        <div class="class-icon" style="font-size:30px;white-space:nowrap">${p1.emoji} ${p1.classEmoji}</div>
        <div class="player-info">
            <div class="player-name" style="color:${c1.primary}">${p1Name}</div>
            <div class="hp-bar-container">
                <div class="hp-bar-fill" style="width:${p1Hp}%;background:${hpColor(p1Hp)}"></div>
            </div>
            <div class="hp-text">
                <span>${p1.specieName} ${p1.className}</span>
                <span>${p1.hp}/${p1.maxHp}</span>
            </div>
        </div>
        <div class="status-icons">${statusIcons(p1.buffs)}</div>
    </div>
    <div class="impact-row">${impactHTML}</div>
    <div class="player-panel p2">
        <div class="class-icon" style="font-size:30px;white-space:nowrap">${p2.emoji} ${p2.classEmoji}</div>
        <div class="player-info">
            <div class="player-name" style="color:${c2.primary}">${p2Name}</div>
            <div class="hp-bar-container">
                <div class="hp-bar-fill" style="width:${p2Hp}%;background:${hpColor(p2Hp)}"></div>
            </div>
            <div class="hp-text">
                <span>${p2.specieName} ${p2.className}</span>
                <span>${p2.hp}/${p2.maxHp}</span>
            </div>
        </div>
        <div class="status-icons">${statusIcons(p2.buffs)}</div>
    </div>
    ${game.turn ? `<div class="next-turn">⏳ Vez de <span>${turnName}</span></div>` : ''}
</div>
</body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `duelo_action_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 380 });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  🏆  VICTORY CARD — Fim de Jogo
// ═══════════════════════════════════════════════════════════

async function generateVictoryCard(winnerName, loserName, winnerClass, loserClass, winnerStats, turnCount) {
    const wc = CLASS_COLORS[winnerClass] || CLASS_COLORS.guerreiro;
    const lc = CLASS_COLORS[loserClass] || CLASS_COLORS.guerreiro;
    const CLASSES_META = {
        guerreiro: { emoji: '🗡️', name: 'Guerreiro' },
        mago: { emoji: '🧙', name: 'Mago' },
        arqueiro: { emoji: '🏹', name: 'Arqueiro' },
        paladino: { emoji: '🛡️', name: 'Paladino' },
        assassino: { emoji: '🥷', name: 'Assassino' },
        dragao: { emoji: '🐉', name: 'Dragão' }
    };
    const wMeta = CLASSES_META[winnerClass] || { emoji: '⚔️', name: '???' };
    const lMeta = CLASSES_META[loserClass] || { emoji: '💀', name: '???' };

    // Rank do vencedor
    let rankTitle = '🌑 Iniciante';
    const w = winnerStats.wins || 0;
    if (w >= 50) rankTitle = '🌟 Lenda Imortal';
    else if (w >= 30) rankTitle = '⚡ Grão-Mestre';
    else if (w >= 20) rankTitle = '🔥 Mestre';
    else if (w >= 10) rankTitle = '⚔️ Veterano';
    else if (w >= 5) rankTitle = '🗡️ Guerreiro';
    else if (w >= 1) rankTitle = '🌙 Aprendiz';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
    ${baseCSS()}
    .card { height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .victory-crown {
        font-size: 48px;
        margin-bottom: 8px;
        filter: drop-shadow(0 0 20px ${wc.glow});
    }
    .victory-title {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: 6px;
        text-transform: uppercase;
        background: linear-gradient(135deg, #f1c40f 0%, #e67e22 50%, #f1c40f 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 20px;
    }
    .winner-box {
        display: flex;
        align-items: center;
        background: rgba(255,255,255,0.05);
        border: 1px solid ${wc.primary}33;
        border-radius: 16px;
        padding: 16px 28px;
        margin-bottom: 10px;
        min-width: 400px;
    }
    .winner-emoji { font-size: 40px; margin-right: 16px; filter: drop-shadow(0 0 12px ${wc.glow}); }
    .winner-info {}
    .winner-name {
        font-size: 20px;
        font-weight: 800;
        color: ${wc.primary};
        margin-bottom: 2px;
    }
    .winner-class { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 600; }

    .loser-box {
        display: flex;
        align-items: center;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 10px 28px;
        margin-bottom: 20px;
        min-width: 400px;
        opacity: 0.6;
    }
    .loser-emoji { font-size: 28px; margin-right: 16px; opacity: 0.5; }
    .loser-name { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.4); }
    .loser-class { font-size: 11px; color: rgba(255,255,255,0.25); }
    .skull { margin-right: 8px; }

    .stats-footer {
        display: flex;
        gap: 16px;
        margin-top: 4px;
    }
    .stat-pill {
        font-size: 11px;
        font-weight: 700;
        padding: 6px 14px;
        border-radius: 20px;
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.5);
    }
    .stat-pill.accent { background: ${wc.primary}22; color: ${wc.primary}; }

    .glow-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.2;
        pointer-events: none;
    }
    .glow-center { width: 300px; height: 300px; background: ${wc.primary}; top: 50%; left: 50%; transform: translate(-50%, -50%); }
</style></head>
<body>
<div class="card">
    <div class="noise"></div>
    <div class="glow-orb glow-center"></div>
    <div class="victory-crown">👑</div>
    <div class="victory-title">VITÓRIA</div>
    <div class="winner-box">
        <div class="winner-emoji">${wMeta.emoji}</div>
        <div class="winner-info">
            <div class="winner-name">${winnerName}</div>
            <div class="winner-class">${wMeta.name} • ${rankTitle}</div>
        </div>
    </div>
    <div class="loser-box">
        <div class="loser-emoji"><span class="skull">💀</span>${lMeta.emoji}</div>
        <div>
            <div class="loser-name">${loserName}</div>
            <div class="loser-class">${lMeta.name} • Derrotado</div>
        </div>
    </div>
    <div class="stats-footer">
        <div class="stat-pill accent">${winnerStats.wins || 0}W / ${winnerStats.losses || 0}L</div>
        ${(winnerStats.streak || 0) > 1 ? `<div class="stat-pill accent">🔥 ${winnerStats.streak} streak</div>` : ''}
        <div class="stat-pill">${turnCount} turnos</div>
    </div>
</div>
</body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `duelo_victory_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 400 });
    return tempPath;
}

module.exports = { generateArenaCard, generateActionCard, generateVictoryCard };
