const config = require('../../config.js');
const minecraftManager = require('../managers/minecraftManager.js');

const MC_API = `http://localhost:${process.env.MC_API_PORT || 19134}`;
const MC_SECRET = process.env.MC_API_SECRET || config.MC_API_SECRET || 'mude-esta-senha-aqui';

async function fetchMinecraft() {
    try {
        const res = await fetch(`${MC_API}/api/info`, { signal: AbortSignal.timeout(5000) });
        return await res.json();
    } catch (e) {
        return { success: false, error: `Servidor offline ou inacessivel: ${e.message}` };
    }
}

async function sendCommand(cmd) {
    try {
        const res = await fetch(`${MC_API}/api/command`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: MC_SECRET, command: cmd }),
            signal: AbortSignal.timeout(15000)
        });
        return await res.json();
    } catch (e) {
        return { success: false, error: `Falha ao enviar comando: ${e.message}` };
    }
}

async function fetchMinimap(player, radius = 15) {
    try {
        const res = await fetch(`${MC_API}/api/minimap?player=${encodeURIComponent(player)}&radius=${radius}`, { signal: AbortSignal.timeout(5000) });
        return await res.json();
    } catch (e) {
        return { success: false, error: `Falha ao obter minimapa: ${e.message}` };
    }
}

async function fetchPlayers() {
    try {
        const res = await fetch(`${MC_API}/api/players`, { signal: AbortSignal.timeout(5000) });
        return await res.json();
    } catch (e) {
        return { success: false, error: `Falha ao listar jogadores: ${e.message}` };
    }
}

function formatUptime(ms) {
    const seg = Math.floor(ms / 1000);
    const min = Math.floor(seg / 60);
    const hr = Math.floor(min / 60);
    const dia = Math.floor(hr / 24);
    return `${dia}d ${hr % 24}h ${min % 60}m ${seg % 60}s`;
}

function makeProgressBar(percent, length = 15) {
    const filled = Math.round((percent / 100) * length);
    const empty = length - filled;
    return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function formatDurationMs(ms) {
    const seg = Math.floor(ms / 1000);
    const min = Math.floor(seg / 60);
    const hr = Math.floor(min / 60);
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m`;
    return `${seg}s`;
}

function getBlockColor(material) {
    if (!material) return '#111827';
    const mat = material.toLowerCase();
    if (mat.includes('grass')) return '#4c7f3b';
    if (mat.includes('water')) return '#3b5e8c';
    if (mat.includes('lava')) return '#d44e13';
    if (mat.includes('sand') || mat.includes('clay')) return '#dbcb91';
    if (mat.includes('stone') || mat.includes('ore') || mat.includes('deepslate') || mat.includes('andesite') || mat.includes('diorite') || mat.includes('granite') || mat.includes('tuff') || mat.includes('bedrock')) return '#737373';
    if (mat.includes('dirt') || mat.includes('gravel') || mat.includes('path') || mat.includes('farmland') || mat.includes('podzol')) return '#82613d';
    if (mat.includes('log') || mat.includes('plank') || mat.includes('wood') || mat.includes('fence') || mat.includes('door') || mat.includes('chest') || mat.includes('crafting')) return '#9c744c';
    if (mat.includes('leaves') || mat.includes('moss') || mat.includes('plant') || mat.includes('flower') || mat.includes('rose') || mat.includes('dandelion') || mat.includes('tulip') || mat.includes('orchid')) return '#2b5220';
    if (mat.includes('snow') || mat.includes('ice') || mat.includes('powder')) return '#f0f8ff';
    if (mat.includes('netherrack') || mat.includes('magma') || mat.includes('basalt') || mat.includes('blackstone')) return '#5a1a1a';
    if (mat.includes('glowstone') || mat.includes('lantern') || mat.includes('torch') || mat.includes('light')) return '#eab308';
    if (mat.includes('obsidian')) return '#100c1c';
    if (mat.includes('end_stone') || mat.includes('purpur')) return '#dee3a8';
    if (mat === 'air') return '#111827';
    return '#4b5563';
}

function getDirection(yaw) {
    let normalized = (yaw % 360 + 360) % 360;
    if (normalized >= 337.5 || normalized < 22.5) return 'Sul ⬇️';
    if (normalized >= 22.5 && normalized < 67.5) return 'Sudoeste ↙️';
    if (normalized >= 67.5 && normalized < 112.5) return 'Oeste ⬅️';
    if (normalized >= 112.5 && normalized < 157.5) return 'Noroeste ↖️';
    if (normalized >= 157.5 && normalized < 202.5) return 'Norte ⬆️';
    if (normalized >= 202.5 && normalized < 247.5) return 'Nordeste ↗️';
    if (normalized >= 247.5 && normalized < 292.5) return 'Leste ➡️';
    return 'Sudeste ↘️';
}

const MINIMAP_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background: linear-gradient(135deg, #07050f 0%, #110e20 100%);
            color: #ffffff;
            width: 800px;
            height: 480px;
            padding: 24px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            display: flex;
            width: 100%;
            height: 100%;
            gap: 24px;
        }
        .map-section {
            flex: 1.2;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .compass-ring {
            width: 410px;
            height: 410px;
            border-radius: 50%;
            border: 2px dashed rgba(168, 85, 247, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background: rgba(168, 85, 247, 0.02);
            box-shadow: inset 0 0 30px rgba(168, 85, 247, 0.05);
        }
        .compass-label {
            position: absolute;
            font-size: 14px;
            font-weight: 800;
            color: #c084fc;
            text-shadow: 0 0 6px rgba(192, 132, 252, 0.6);
        }
        .compass-label.n { top: 6px; }
        .compass-label.s { bottom: 6px; }
        .compass-label.e { right: 8px; }
        .compass-label.w { left: 8px; }

        .map-viewport {
            width: 350px;
            height: 350px;
            border-radius: 50%;
            overflow: hidden;
            border: 4px solid #a855f7;
            box-shadow: 0 0 25px rgba(168, 85, 247, 0.4);
            position: relative;
        }
        .grid-container {
            width: 100%;
            height: 100%;
            display: grid;
            grid-template-columns: repeat({{gridSize}}, 1fr);
            grid-template-rows: repeat({{gridSize}}, 1fr);
            position: relative;
        }
        .grid-cell {
            width: 100%;
            height: 100%;
        }
        .markers-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
        }
        .marker {
            position: absolute;
            width: 24px;
            height: 24px;
            z-index: 10;
        }
        .marker-avatar {
            width: 100%;
            height: 100%;
            border-radius: 6px;
            border: 2px solid #ffffff;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
            background: #111827;
        }
        .pointer {
            position: absolute;
            top: -8px;
            left: 8px;
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-bottom: 8px solid #c084fc;
            transform-origin: bottom center;
        }
        .other-player .pointer {
            border-bottom-color: #3b82f6;
        }
        .marker-name {
            position: absolute;
            bottom: -16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            color: #ffffff;
            font-size: 8px;
            font-weight: 600;
            padding: 1px 4px;
            border-radius: 4px;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .panel-section {
            flex: 0.8;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            backdrop-filter: blur(10px);
        }
        .dimension-badge {
            align-self: flex-start;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 12px;
        }
        .dimension-badge.overworld {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #10b981;
        }
        .dimension-badge.nether {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
        }
        .dimension-badge.end {
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.3);
            color: #a855f7;
        }
        .pulse {
            width: 6px;
            height: 6px;
            border-radius: 50%;
        }
        .overworld .pulse { background: #10b981; box-shadow: 0 0 6px #10b981; }
        .nether .pulse { background: #ef4444; box-shadow: 0 0 6px #ef4444; }
        .end .pulse { background: #a855f7; box-shadow: 0 0 6px #a855f7; }

        .player-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 18px;
        }
        .player-header img {
            width: 42px;
            height: 42px;
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .player-title h2 {
            font-size: 20px;
            font-weight: 800;
            color: #f1f5f9;
        }
        .player-title p {
            font-size: 12px;
            color: #94a3b8;
        }

        .stats-box {
            background: rgba(255, 255, 255, 0.01);
            border: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            padding: 12px;
            margin-bottom: 14px;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            border-bottom: 1px dashed rgba(255,255,255,0.03);
        }
        .stat-row:last-child {
            border-bottom: none;
        }
        .stat-label {
            color: #94a3b8;
            font-weight: 500;
        }
        .stat-value {
            color: #f1f5f9;
            font-weight: 600;
            font-family: monospace;
        }

        .nearby-title {
            font-size: 12px;
            font-weight: 700;
            color: #a855f7;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .nearby-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex-grow: 1;
            overflow-y: auto;
            max-height: 110px;
        }
        .nearby-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #cbd5e1;
            background: rgba(255,255,255,0.02);
            padding: 4px 8px;
            border-radius: 6px;
        }
        .nearby-item img {
            width: 18px;
            height: 18px;
            border-radius: 3px;
        }

        .body-render {
            position: absolute;
            right: -20px;
            bottom: -20px;
            height: 180px;
            opacity: 0.15;
            pointer-events: none;
            z-index: 1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="map-section">
            <div class="compass-ring">
                <span class="compass-label n">N</span>
                <span class="compass-label e">E</span>
                <span class="compass-label s">S</span>
                <span class="compass-label w">W</span>
                
                <div class="map-viewport">
                    <div class="grid-container">
                        {{{gridHtml}}}
                    </div>
                    <div class="markers-container">
                        {{{markersHtml}}}
                    </div>
                </div>
            </div>
        </div>

        <div class="panel-section">
            <img class="body-render" src="https://mc-heads.net/body/{{player}}/right.png" alt="Render">
            
            <div style="z-index: 2;">
                <div class="dimension-badge {{dimensionClass}}">
                    <span class="pulse"></span>
                    {{dimensionName}}
                </div>

                <div class="player-header">
                    <img src="https://mc-heads.net/avatar/{{player}}.png" alt="{{player}}">
                    <div class="player-title">
                        <h2>{{player}}</h2>
                        <p>Focalizado</p>
                    </div>
                </div>

                <div class="stats-box">
                    <div class="nearby-title">📍 Coordenadas</div>
                    <div class="stat-row">
                        <span class="stat-label">Coord X</span>
                        <span class="stat-value">{{x}}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Coord Y</span>
                        <span class="stat-value">{{y}}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Coord Z</span>
                        <span class="stat-value">{{z}}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Direção</span>
                        <span class="stat-value">{{direction}}</span>
                    </div>
                </div>

                <div class="nearby-title">👥 Próximos (Raio {{radius}}m)</div>
                <div class="nearby-list">
                    {{#if hasNearby}}
                        {{#each nearbyList}}
                            <div class="nearby-item">
                                <img src="https://mc-heads.net/avatar/{{nome}}.png" alt="{{nome}}">
                                <span><strong>{{nome}}</strong> (dist: {{dist}}m)</span>
                            </div>
                        {{/each}}
                    {{else}}
                        <div style="font-size: 11px; color: #64748b; font-style: italic;">Nenhum jogador próximo.</div>
                    {{/if}}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

const TIMELINE_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Outfit', sans-serif;
            background: linear-gradient(135deg, #0e0b16 0%, #1a1429 100%);
            color: #ffffff;
            width: 800px;
            height: 480px;
            padding: 24px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .title-area h1 {
            font-size: 26px;
            font-weight: 800;
            background: linear-gradient(45deg, #a855f7, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }
        .title-area p {
            font-size: 13px;
            color: #94a3b8;
            margin-top: 2px;
        }
        .server-status {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #10b981;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .pulse {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 8px #10b981;
        }
        .main-container {
            display: flex;
            gap: 20px;
            flex: 1;
        }
        .active-sessions-panel {
            flex: 1.2;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
        }
        .panel-title {
            font-size: 15px;
            font-weight: 600;
            color: #c084fc;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sessions-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow-y: auto;
            flex: 1;
        }
        .session-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .session-card img {
            width: 32px;
            height: 32px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.05);
        }
        .player-info {
            flex: 1;
        }
        .player-name {
            font-size: 14px;
            font-weight: 600;
            color: #f1f5f9;
        }
        .player-duration {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 2px;
        }
        .timeline-bar-bg {
            height: 5px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            margin-top: 6px;
            overflow: hidden;
            width: 100%;
        }
        .timeline-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #a855f7);
            border-radius: 10px;
        }
        .timeline-panel {
            flex: 1;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            flex-direction: column;
        }
        .timeline-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
            flex: 1;
            overflow-y: auto;
            position: relative;
            padding-left: 15px;
        }
        .timeline-list::before {
            content: '';
            position: absolute;
            left: 4px;
            top: 5px;
            bottom: 5px;
            width: 2px;
            background: rgba(255, 255, 255, 0.05);
        }
        .timeline-item {
            position: relative;
            font-size: 13px;
        }
        .timeline-dot {
            position: absolute;
            left: -15px;
            top: 4px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: 2px solid #1a1429;
        }
        .timeline-dot.entrou {
            background: #10b981;
            box-shadow: 0 0 6px #10b981;
        }
        .timeline-dot.saiu {
            background: #f43f5e;
            box-shadow: 0 0 6px #f43f5e;
        }
        .item-time {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
        }
        .item-content {
            margin-top: 1px;
            color: #cbd5e1;
        }
        .item-player {
            font-weight: 600;
            color: #f8fafc;
        }
        .no-data {
            text-align: center;
            color: #64748b;
            font-size: 13px;
            margin: auto;
        }
    </style>
</head>
<body>
    <header>
        <div class="title-area">
            <h1>Neko Server</h1>
            <p>Timeline de Atividade & Eventos dos Jogadores</p>
        </div>
        <div class="server-status">
            <span class="pulse"></span>
            Online
        </div>
    </header>
    <div class="main-container">
        <div class="active-sessions-panel">
            <div class="panel-title">
                🟢 Jogadores Ativos & Período Online
            </div>
            <div class="sessions-list">
                {{#if hasActive}}
                    {{#each activeList}}
                        <div class="session-card">
                            <img src="https://mc-heads.net/avatar/{{name}}.png" alt="{{name}}">
                            <div class="player-info">
                                <div class="player-name">{{name}}</div>
                                <div class="player-duration">Online há {{durationStr}}</div>
                                <div class="timeline-bar-bg">
                                    <div class="timeline-bar-fill" style="width: {{percent}}%;"></div>
                                </div>
                            </div>
                        </div>
                    {{/each}}
                {{else}}
                    <div class="no-data">Nenhum jogador online no momento.</div>
                {{/if}}
            </div>
        </div>

        <div class="timeline-panel">
            <div class="panel-title">
                ⏳ Histórico de Eventos Recentes
            </div>
            <div class="timeline-list">
                {{#if hasLogs}}
                    {{#each logsList}}
                        <div class="timeline-item">
                            <span class="timeline-dot {{acao}}"></span>
                            <div class="item-time">{{timeStr}}</div>
                            <div class="item-content">
                                <span class="item-player">{{jogador}}</span> {{detalheSemJogador}}
                            </div>
                        </div>
                    {{/each}}
                {{else}}
                    <div class="no-data">Sem registros de eventos nas últimas horas.</div>
                {{/if}}
            </div>
        </div>
    </div>
</body>
</html>`;

async function minecraft(sock, msg, msgDetails) {
    const { sender, commandSenderJid, args = [], prefix, commandName } = msgDetails;
    const authManager = require('../managers/authManager.js');
    const userJid = commandSenderJid || msg.key.participant || msg.key.remoteJid;
    const isAdmin = authManager.isSuperAdmin(userJid);

    const sub = (args[0] || '').toLowerCase();

    if (sub === 'info' || sub === 'status' || !sub) {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Minecraft Server*\n${info.error || 'Erro desconhecido'}`
            }, { quoted: msg });
            return true;
        }

        const playerNames = (info.jogadores || []).map(p => p.nome).join(', ') || 'Ninguem';

        const text = `🎮 *Neko Server*\n\n` +
            `📋 *Versao:* ${info.minecraftVersion} (API ${info.apiVersion})\n` +
            `⏱ *Uptime:* ${info.uptime}\n` +
            `⚡ *TPS:* ${info.tps?.['1m'] || '?'} (1m) / ${info.tps?.['5m'] || '?'} (5m) / ${info.tps?.['15m'] || '?'} (15m)\n` +
            `💾 *RAM:* ${info.memoriaUsadaMB}MB / ${info.memoriaMaxMB}MB\n` +
            `👥 *Jogadores (${info.jogadoresOnline}/${info.maxJogadores}):* ${playerNames}\n` +
            `🌍 *Mundos:* ${(info.mundos || []).map(w => w.nome).join(', ')}\n` +
            `📝 *MOTD:* ${info.motd || '-'}`;

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'players' || sub === 'jogadores') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const players = info.jogadores || [];
        if (players.length === 0) {
            await sock.sendMessage(sender, {
                text: `👥 *Jogadores Online (0/${info.maxJogadores})*\nNinguem esta online no momento.`
            }, { quoted: msg });
            return true;
        }

        let text = `👥 *Jogadores Online (${info.jogadoresOnline}/${info.maxJogadores})*\n\n`;
        for (const p of players) {
            const opTag = p.op ? ' ⭐' : '';
            text += `▸ *${p.nome}*${opTag}\n` +
                `  Ping: ${p.ping}ms | Mundo: ${p.mundo} | Modo: ${p.gamemode}\n`;
        }

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'seed') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (info.success) {
            const world = (info.mundos || []).find(w => w.nome === 'world') || (info.mundos || [])[0];
            if (world && world.seed !== undefined) {
                await sock.sendMessage(sender, {
                    text: `🌱 *Seed do Mapa (Minecraft)*\n\nMundo: *${world.nome}*\nSeed: \`${world.seed}\``
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Falha ao obter a seed do mapa:*\nNenhuma seed encontrada nas informações do servidor.`
                }, { quoted: msg });
            }
        } else {
            await sock.sendMessage(sender, {
                text: `❌ *Falha ao obter a seed do mapa:*\n${info.error || 'Servidor offline ou erro desconhecido.'}`
            }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'worlds' || sub === 'mundos') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const worldsList = info.mundos || [];
        if (worldsList.length === 0) {
            await sock.sendMessage(sender, {
                text: `🌍 *Mundos do Servidor*\nNenhum mundo encontrado.`
            }, { quoted: msg });
            return true;
        }

        let text = `🌍 *Mundos do Servidor (${worldsList.length})*\n\n`;
        for (const w of worldsList) {
            const difficultyEmoji = w.dificuldade === 'peaceful' ? '☮️' : w.dificuldade === 'easy' ? '🟢' : w.dificuldade === 'normal' ? '🟡' : '🔴';
            text += `▸ 🗺 *${w.nome}*\n` +
                `  Tipo: ${w.tipo || 'normal'} | Dificuldade: ${difficultyEmoji} ${w.dificuldade}\n` +
                `  Entidades: ${w.entidades} | Chunks: ${w.chunksCarregados}\n` +
                `  Seed: \`${w.seed !== undefined ? w.seed : '?'}\`\n\n`;
        }

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'plugins') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const pluginsList = info.plugins || [];
        if (pluginsList.length === 0) {
            await sock.sendMessage(sender, {
                text: `🔌 *Plugins do Servidor*\nNenhum plugin detectado.`
            }, { quoted: msg });
            return true;
        }

        let text = `🔌 *Plugins Instalados (${pluginsList.length})*\n\n`;
        pluginsList.forEach((p, idx) => {
            text += `${idx + 1}. 📦 *${p}*\n`;
        });

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'mods') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const API_PORT = process.env.PORT || 19132;
        try {
            const res = await fetch(`http://localhost:${API_PORT}/api/mods`, { signal: AbortSignal.timeout(5000) });
            const modsList = await res.json();
            
            if (!Array.isArray(modsList)) {
                throw new Error("Resposta inválida da API de mods.");
            }

            // Ordenar alfabeticamente
            modsList.sort((a, b) => a.name.localeCompare(b.name));

            // Identificar versão do auto-updater
            const updater = modsList.find(m => m.name.startsWith('modpackupdater-'));
            const updaterVersion = updater ? updater.name.replace('modpackupdater-', '').replace('.jar', '') : 'desconhecido';

            let text = `🎮 *Modpack - Mods Ativos (${modsList.length})*\n\n` +
                `🔄 *Auto-Updater:* v${updaterVersion}\n` +
                `🌐 *Url:* http://12237514.xyz:19132/public/mods/\n\n` +
                `📂 *Arquivos (.jar):*\n`;

            modsList.forEach(m => {
                const sizeMb = (m.size / (1024 * 1024)).toFixed(2);
                text += `• \`${m.name}\` (${sizeMb} MB)\n`;
            });

            await sock.sendMessage(sender, { text }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(sender, {
                text: `❌ *Erro ao listar mods do modpack:*\n${e.message}`
            }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'player' || sub === 'jogador') {
        const targetName = args.slice(1).join(' ').trim();
        if (!targetName) {
            await sock.sendMessage(sender, {
                text: `Uso: ${prefix}${commandName} player <nome_do_jogador>\nExemplo: ${prefix}${commandName} player Emily`
            }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();
        const onlinePlayer = info.success 
            ? (info.jogadores || []).find(p => p.nome.toLowerCase() === targetName.toLowerCase())
            : null;

        let text = `🎮 *Jogador - Minecraft*\n\n` +
            `👤 *Nome:* ${targetName}\n`;

        if (onlinePlayer) {
            const opTag = onlinePlayer.op ? 'Sim ⭐' : 'Não';
            text += `🟢 *Status:* Online no servidor\n` +
                `🆔 *UUID:* \`${onlinePlayer.uuid}\`\n` +
                `🌍 *Mundo:* ${onlinePlayer.mundo}\n` +
                `🎮 *Modo de Jogo:* ${onlinePlayer.gamemode}\n` +
                `⚡ *Ping:* ${onlinePlayer.ping}ms\n` +
                `👑 *Operador (OP):* ${opTag}`;
        } else {
            text += `🔴 *Status:* Offline ou não cadastrado\n\n` +
                `ℹ️ _Mostrando renderização da skin premium associada a este nome._`;
        }

        // URL para a renderização do corpo 3D do jogador
        const imageUrl = `https://mc-heads.net/body/${targetName}/right.png`;

        try {
            await sock.sendMessage(sender, {
                image: { url: imageUrl },
                caption: text
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(sender, { text }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'perf' || sub === 'performance' || sub === 'hardware') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const tps1m = info.tps?.['1m'] || 0;
        const tpsPercent = Math.min(100, Math.max(0, (tps1m / 20) * 100));
        const tpsBar = makeProgressBar(tpsPercent);

        const ramUsed = info.memoriaUsadaMB || 0;
        const ramMax = info.memoriaMaxMB || 1;
        const ramPercent = Math.min(100, Math.max(0, (ramUsed / ramMax) * 100));
        const ramBar = makeProgressBar(ramPercent);

        const text = `⚡ *Neko Server - Performance*\n\n` +
            `⏱ *Uptime:* ${info.uptime}\n\n` +
            `🟢 *TPS (1m):* ${tps1m} / 20.0\n` +
            `\`[${tpsBar}]\` (${Math.round(tpsPercent)}%)\n\n` +
            `💾 *Uso de RAM:* ${ramUsed}MB / ${ramMax}MB\n` +
            `\`[${ramBar}]\` (${Math.round(ramPercent)}%)\n\n` +
            `🌍 *Mundos:* ${(info.mundos || []).length}\n` +
            `👥 *Jogadores:* ${info.jogadoresOnline} / ${info.maxJogadores}\n` +
            `🔌 *Plugins:* ${(info.plugins || []).length} ativos`;

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'cmd' || sub === 'command') {
        if (!isAdmin) {
            await sock.sendMessage(sender, {
                text: '🚫 Apenas super admins podem executar comandos do console.'
            }, { quoted: msg });
            return true;
        }

        const cmdArgs = args.slice(1).join(' ').trim();
        if (!cmdArgs) {
            await sock.sendMessage(sender, {
                text: `Uso: ${prefix}${commandName} cmd <comando>\n` +
                    `Exemplo: ${prefix}${commandName} cmd list\n` +
                    `Exemplo: ${prefix}${commandName} cmd say Ola!`
            }, { quoted: msg });
            return true;
        }

        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const result = await sendCommand(cmdArgs);

        if (result.success) {
            await sock.sendMessage(sender, {
                text: `✅ *Comando executado:*\n\`/${cmdArgs}\`\n\n📤 *Resposta:*\n${result.output || 'OK'}`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ *Falha ao executar:*\n\`/${cmdArgs}\`\n\n${result.error || 'Erro desconhecido'}`
            }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'mapa' || sub === 'map') {
        let targetPlayer = args[1] ? args[1].trim() : '';

        // Se não forneceu o jogador, busca quem está online
        if (!targetPlayer) {
            const playersInfo = await fetchPlayers();
            if (!playersInfo.success) {
                await sock.sendMessage(sender, {
                    text: `❌ *Erro ao listar jogadores:* ${playersInfo.error || 'Servidor offline'}`
                }, { quoted: msg });
                return true;
            }

            const onlineCount = playersInfo.online || 0;
            const playersList = playersInfo.jogadores || [];

            if (onlineCount === 0) {
                await sock.sendMessage(sender, {
                    text: `❌ Não há nenhum jogador online no momento para gerar o minimapa.`
                }, { quoted: msg });
                return true;
            } else if (onlineCount === 1) {
                targetPlayer = playersList[0].nome;
            } else {
                const names = playersList.map(p => p.nome).join(', ');
                await sock.sendMessage(sender, {
                    text: `⚠️ *Vários jogadores online.*\n\nPor favor, escolha um jogador digitando:\n\`${prefix}${commandName} mapa [nome]\`\n\nJogadores ativos: *${names}*`
                }, { quoted: msg });
                return true;
            }
        }

        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const mapData = await fetchMinimap(targetPlayer, 15);

        if (!mapData.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Falha ao obter o minimapa de ${targetPlayer}:*\n${mapData.error || 'Jogador não encontrado ou offline.'}`
            }, { quoted: msg });
            return true;
        }

        // Construir o Grid HTML
        let gridHtml = '';
        const gridSize = 2 * mapData.radius + 1;
        for (let z = 0; z < mapData.grid.length; z++) {
            for (let x = 0; x < mapData.grid[z].length; x++) {
                const block = mapData.grid[z][x];
                const color = getBlockColor(block);
                gridHtml += `<div class="grid-cell" style="background-color: ${color};" title="${block}"></div>`;
            }
        }

        // Construir os Marcadores HTML
        const mainPlayerX = mapData.radius;
        const mainPlayerZ = mapData.radius;
        const mainPlayerRot = (mapData.yaw + 180) % 360;

        let markersHtml = `
        <div class="marker main-player" style="left: calc(${mainPlayerX} * 100% / ${gridSize}); top: calc(${mainPlayerZ} * 100% / ${gridSize}); transform: translate(-50%, -50%);">
            <div class="pointer" style="transform: rotate(${mainPlayerRot}deg);"></div>
            <img src="https://mc-heads.net/avatar/${mapData.player}.png" class="marker-avatar" />
        </div>
        `;

        const nearbyList = [];
        if (mapData.nearbyPlayers && mapData.nearbyPlayers.length > 0) {
            mapData.nearbyPlayers.forEach(p => {
                const distance = Math.round(Math.sqrt(Math.pow(p.realX - mapData.x, 2) + Math.pow(p.realZ - mapData.z, 2)));
                if (p.nome !== mapData.player) {
                    const otherRot = (p.yaw + 180) % 360;
                    markersHtml += `
                    <div class="marker other-player" style="left: calc(${p.x} * 100% / ${gridSize}); top: calc(${p.z} * 100% / ${gridSize}); transform: translate(-50%, -50%);">
                        <div class="pointer" style="transform: rotate(${otherRot}deg);"></div>
                        <img src="https://mc-heads.net/avatar/${p.nome}.png" class="marker-avatar" />
                        <span class="marker-name">${p.nome}</span>
                    </div>
                    `;
                    nearbyList.push({ nome: p.nome, dist: distance });
                }
            });
        }

        // Mapear dimensão para badge
        let dimensionClass = 'overworld';
        let dimensionName = 'Overworld';
        if (mapData.world.includes('nether')) {
            dimensionClass = 'nether';
            dimensionName = 'Nether';
        } else if (mapData.world.includes('end')) {
            dimensionClass = 'end';
            dimensionName = 'The End';
        }

        const templateData = {
            player: mapData.player,
            gridSize,
            gridHtml,
            markersHtml,
            dimensionClass,
            dimensionName,
            x: mapData.x,
            y: mapData.y,
            z: mapData.z,
            direction: getDirection(mapData.yaw),
            radius: mapData.radius,
            hasNearby: nearbyList.length > 0,
            nearbyList
        };

        const path = require('path');
        const tempImagePath = path.resolve(`./temp/minimap_${Date.now()}.png`);

        try {
            const { generateImage } = require('../helpers/imageGenerator.js');
            await generateImage(MINIMAP_TEMPLATE, tempImagePath, templateData, { width: 800, height: 480 });

            await sock.sendMessage(sender, {
                image: { url: tempImagePath },
                caption: `🗺️ *Minimapa de ${mapData.player}* (Raio: ${mapData.radius}m)\n\n` +
                    `📍 *Localização:* \`[X: ${mapData.x}, Y: ${mapData.y}, Z: ${mapData.z}]\`\n` +
                    `🌐 *Mundo:* ${dimensionName} (${mapData.world})\n` +
                    `🧭 *Olhando para:* ${getDirection(mapData.yaw)}\n\n` +
                    (nearbyList.length > 0 
                        ? `👥 *Jogadores próximos:* ${nearbyList.map(p => `_${p.nome}_ (${p.dist}m)`).join(', ')}`
                        : `👥 Nenhum outro jogador próximo detectado.`)
            }, { quoted: msg });

            const fs = require('fs').promises;
            await fs.unlink(tempImagePath).catch(() => {});
        } catch (e) {
            console.error("Erro ao gerar imagem do minimapa:", e);
            await sock.sendMessage(sender, {
                text: `❌ *Erro ao gerar imagem do minimapa:*\n${e.message}`
            }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'logs' || sub === 'eventos') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const logsList = info.logs || [];
        if (logsList.length === 0) {
            await sock.sendMessage(sender, {
                text: `⏳ *Logs do Servidor*\nNenhum evento registrado recentemente.`
            }, { quoted: msg });
            return true;
        }

        let text = `⏳ *Logs e Eventos Recentes*\n\n`;
        const recentLogs = logsList.slice(-15).reverse();
        recentLogs.forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const emoji = log.acao === 'entrou' ? '🟢' : '🔴';
            text += `[${timeStr}] ${emoji} *${log.jogador}* ${log.detalhe.replace(log.jogador, '').trim()}\n`;
        });

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'chat' || sub === 'chatlogs' || sub === 'batepapo') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const chatLogs = (info.logs || []).filter(log => log.acao === 'chat');
        if (chatLogs.length === 0) {
            await sock.sendMessage(sender, {
                text: `💬 *Chat do Servidor*\nNenhuma mensagem enviada no chat recentemente.`
            }, { quoted: msg });
            return true;
        }

        let text = `💬 *Últimas Conversas no Chat do Minecraft*\n\n`;
        const recentChat = chatLogs.slice(-20);
        recentChat.forEach(log => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            text += `[${timeStr}] *${log.jogador}*: ${log.detalhe}\n`;
        });

        await sock.sendMessage(sender, { text }, { quoted: msg });
        return true;
    }

    if (sub === 'setchatgroup' || sub === 'definirchat') {
        if (!isAdmin) {
            await sock.sendMessage(sender, {
                text: '🚫 Apenas super admins podem definir o grupo de chat integrado.'
            }, { quoted: msg });
            return true;
        }

        await minecraftManager.setChatGroupJid(sender);
        await sock.sendMessage(sender, {
            text: '✅ *Grupo de Chat Integrado Definido!*\n\nA partir de agora, as mensagens comuns deste grupo serão retransmitidas para dentro do Minecraft, e os logs de entrada/saída do jogo serão publicados aqui.'
        }, { quoted: msg });
        return true;
    }

    if (sub === 'vincular' || sub === 'link') {
        const targetNick = args[1]?.trim();
        if (!targetNick) {
            await sock.sendMessage(sender, {
                text: `❌ *Uso incorreto!*\nUtilize: \`${prefix}${commandName} vincular <seu_nickname_no_minecraft>\``
            }, { quoted: msg });
            return true;
        }

        minecraftManager.addPendingRequest(targetNick, commandSenderJid);

        await sock.sendMessage(sender, {
            text: `🔗 *Solicitação de Vínculo Criada!*\n\nNickname: *${targetNick}*\n\n👉 Agora, entre no servidor de Minecraft com a conta *${targetNick}* e digite o comando abaixo no chat do jogo:\n\`/vincular aceitar\`\n\n_Nota: A solicitação expirará se o bot for reiniciado._`
        }, { quoted: msg });
        return true;
    }

    if (sub === 'config') {
        const option = args[1]?.trim().toLowerCase();
        const valueStr = args[2]?.trim().toLowerCase();

        if (!option) {
            const cfg = minecraftManager.getConfig();
            const textCfg = `⚙️ *Neko Server - Configurações de Mensagens*\n\n` +
                `💬 Mensagens de Chat: *${cfg.chat ? 'Ativado ✅' : 'Desativado ❌'}*\n` +
                `🟢 Logs de Entrada (join): *${cfg.join ? 'Ativado ✅' : 'Desativado ❌'}*\n` +
                `🔴 Logs de Saída (quit): *${cfg.quit ? 'Ativado ✅' : 'Desativado ❌'}*\n\n` +
                `👉 *Para alterar*, use:\n` +
                `\`${prefix}${commandName} config <chat|join|quit> <on|off>\``;

            await sock.sendMessage(sender, { text: textCfg }, { quoted: msg });
            return true;
        }

        if (!isAdmin) {
            await sock.sendMessage(sender, {
                text: '🚫 Apenas super admins podem alterar as configurações do Minecraft.'
            }, { quoted: msg });
            return true;
        }

        if (!['chat', 'join', 'quit'].includes(option)) {
            await sock.sendMessage(sender, {
                text: `❌ *Opção inválida!*\nEscolha entre: *chat*, *join* ou *quit*.`
            }, { quoted: msg });
            return true;
        }

        if (!['on', 'off'].includes(valueStr)) {
            await sock.sendMessage(sender, {
                text: `❌ *Estado inválido!*\nUse *on* para ativar ou *off* para desativar.`
            }, { quoted: msg });
            return true;
        }

        const valueBool = valueStr === 'on';
        const success = await minecraftManager.updateConfig(option, valueBool);

        if (success) {
            await sock.sendMessage(sender, {
                text: `✅ *Configuração atualizada!*\nA mensagem de *${option}* agora está *${valueBool ? 'ATIVADA' : 'DESATIVADA'}*.`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(sender, {
                text: `❌ Erro ao atualizar a configuração.`
            }, { quoted: msg });
        }
        return true;
    }

    if (sub === 'tag') {
        const option = args[1]?.trim().toLowerCase();

        if (!option) {
            const tags = minecraftManager.getAllUserTags();
            const presets = minecraftManager.getTagPresets();
            
            let textTags = `🏷️ *Lista de Tags Personalizadas - Minecraft*\n\n`;
            const entries = Object.entries(tags);
            
            if (entries.length === 0) {
                textTags += `_Nenhuma tag personalizada cadastrada para usuários._\n\n`;
            } else {
                for (const [jid, tag] of entries) {
                    const cleanNum = jid.split('@')[0];
                    textTags += `• *@${cleanNum}* ➔ [${tag.name}] (Cor: \`${tag.color}\`)\n`;
                }
                textTags += `\n`;
            }

            textTags += `🏷️ *Presets de Tags Disponíveis*\n`;
            const presetEntries = Object.entries(presets);
            if (presetEntries.length === 0) {
                textTags += `_Nenhum preset de tag cadastrado._\n\n`;
            } else {
                for (const [name, preset] of presetEntries) {
                    textTags += `• *${name}* ➔ [${preset.name}] (Cor: \`${preset.color}\`)\n`;
                }
                textTags += `\n`;
            }

            textTags += `👉 *Uso do comando (Admins)*:\n` +
                `\`${prefix}${commandName} tag criar <NomeTag> <CodigoCor>\`\n` +
                `\`${prefix}${commandName} tag apagar <NomeTag>\`\n` +
                `\`${prefix}${commandName} tag atribuir <@mencao|numero> <NomeTag>\`\n` +
                `\`${prefix}${commandName} tag definir <@mencao|numero> <NomeTag> <CodigoCor>\`\n` +
                `\`${prefix}${commandName} tag remover <@mencao|numero>\`\n` +
                `\`${prefix}${commandName} tag perm add <NomeTag> <permissao>\`\n` +
                `\`${prefix}${commandName} tag perm remove <NomeTag> <permissao>\`\n` +
                `\`${prefix}${commandName} tag perm list <NomeTag>\`\n\n` +
                `Exemplo:\n` +
                `\`${prefix}${commandName} tag criar VIP &a\`\n` +
                `\`${prefix}${commandName} tag perm add VIP whatsappbridge.enderchest\`\n` +
                `\`${prefix}${commandName} tag atribuir @Nekozila VIP\``;

            await sock.sendMessage(sender, { 
                text: textTags,
                mentions: entries.map(([jid]) => jid)
            }, { quoted: msg });
            return true;
        }

        if (!isAdmin) {
            await sock.sendMessage(sender, {
                text: '🚫 Apenas super admins podem gerenciar tags personalizadas.'
            }, { quoted: msg });
            return true;
        }

        if (option === 'perm') {
            const action = args[2]?.trim().toLowerCase();
            const tagName = args[3]?.trim();
            const permission = args[4]?.trim();

            if (!action || !tagName) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n` +
                        `\`${prefix}${commandName} tag perm add <NomeTag> <permissao>\`\n` +
                        `\`${prefix}${commandName} tag perm remove <NomeTag> <permissao>\`\n` +
                        `\`${prefix}${commandName} tag perm list <NomeTag>\``
                }, { quoted: msg });
                return true;
            }

            let mcCommand = '';
            if (action === 'add') {
                if (!permission) {
                    await sock.sendMessage(sender, {
                        text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag perm add <NomeTag> <permissao>\``
                    }, { quoted: msg });
                    return true;
                }
                mcCommand = `wbtag perm add ${tagName} ${permission}`;
            } else if (action === 'remove' || action === 'delete') {
                if (!permission) {
                    await sock.sendMessage(sender, {
                        text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag perm remove <NomeTag> <permissao>\``
                    }, { quoted: msg });
                    return true;
                }
                mcCommand = `wbtag perm remove ${tagName} ${permission}`;
            } else if (action === 'list') {
                mcCommand = `wbtag perm list ${tagName}`;
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Subcomando inválido!*\nEscolha entre: *add*, *remove* ou *list*.`
                }, { quoted: msg });
                return true;
            }

            await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });
            const result = await sendCommand(mcCommand);

            if (result.success) {
                let cleanOutput = (result.output || 'OK')
                    .replace(/[&§][0-9a-fk-orx]/gi, '');
                
                await sock.sendMessage(sender, {
                    text: `✅ *Permissões Atualizadas:*\n\n${cleanOutput}`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Falha ao atualizar permissões no Minecraft:*\n${result.error || 'Erro desconhecido'}`
                }, { quoted: msg });
            }
            return true;
        }

        if (option === 'criar' || option === 'create') {
            const name = args[2]?.trim();
            const color = args[3]?.trim();

            if (!name || !color) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag criar <NomeTag> <CodigoCor>\``
                }, { quoted: msg });
                return true;
            }

            await minecraftManager.setTagPreset(name, color);
            await sock.sendMessage(sender, {
                text: `✅ *Preset de tag criado com sucesso!*\n\nTag: *[${name}]*\nCor: \`${color}\``
            }, { quoted: msg });
            return true;
        }

        if (option === 'apagar' || option === 'delete-preset') {
            const name = args[2]?.trim();

            if (!name) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag apagar <NomeTag>\``
                }, { quoted: msg });
                return true;
            }

            const removed = await minecraftManager.removeTagPreset(name);
            if (removed) {
                await sock.sendMessage(sender, {
                    text: `✅ *Preset de tag [${name}] removido com sucesso!*`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Preset de tag [${name}] não encontrado.*`
                }, { quoted: msg });
            }
            return true;
        }

        if (option === 'presets' || option === 'listar-presets') {
            const presets = minecraftManager.getTagPresets();
            let textPresets = `🏷️ *Presets de Tags Disponíveis*\n\n`;
            const entries = Object.entries(presets);

            if (entries.length === 0) {
                textPresets += `_Nenhum preset de tag cadastrado._\n\n`;
            } else {
                for (const [name, preset] of entries) {
                    textPresets += `• *${name}* ➔ [${preset.name}] (Cor: \`${preset.color}\`)\n`;
                }
                textPresets += `\n`;
            }

            textPresets += `👉 *Para atribuir a um jogador*:\n` +
                `\`${prefix}${commandName} tag atribuir <@mencao|numero> <NomeTag>\``;

            await sock.sendMessage(sender, { text: textPresets }, { quoted: msg });
            return true;
        }

        if (option === 'atribuir' || option === 'assign') {
            const targetArg = args[2]?.trim();
            const presetName = args[3]?.trim();

            if (!targetArg || !presetName) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag atribuir <@mencao|numero> <NomeTag>\``
                }, { quoted: msg });
                return true;
            }

            let targetJid = null;
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else {
                const rawNum = targetArg.replace(/\D/g, '');
                if (rawNum.length >= 8) {
                    targetJid = `${rawNum}@s.whatsapp.net`;
                }
            }

            if (!targetJid) {
                await sock.sendMessage(sender, {
                    text: `❌ *Usuário inválido!*\nMencione alguém ou digite o número com DDI/DDD.`
                }, { quoted: msg });
                return true;
            }

            const assignedPreset = await minecraftManager.assignTagPreset(targetJid, presetName);

            if (assignedPreset) {
                await sock.sendMessage(sender, {
                    text: `✅ *Tag do preset atribuída com sucesso!*\n\nUsuário: *@${targetJid.split('@')[0]}*\nTag: *[${assignedPreset.name}]*\nCor: \`${assignedPreset.color}\``,
                    mentions: [targetJid]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Falha:* Preset de tag *${presetName}* não encontrado.\n\nUse \`${prefix}${commandName} tag presets\` para ver as tags disponíveis.`
                }, { quoted: msg });
            }
            return true;
        }

        if (option === 'definir' || option === 'set') {
            const targetArg = args[2]?.trim();
            const tagName = args[3]?.trim();
            const tagColor = args[4]?.trim();

            if (!targetArg || !tagName || !tagColor) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag definir <@mencao|numero> <NomeTag> <CodigoCor>\``
                }, { quoted: msg });
                return true;
            }

            let targetJid = null;
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else {
                const rawNum = targetArg.replace(/\D/g, '');
                if (rawNum.length >= 8) {
                    targetJid = `${rawNum}@s.whatsapp.net`;
                }
            }

            if (!targetJid) {
                await sock.sendMessage(sender, {
                    text: `❌ *Usuário inválido!*\nMencione alguém ou digite o número com DDI/DDD.`
                }, { quoted: msg });
                return true;
            }

            await minecraftManager.setUserTag(targetJid, tagName, tagColor);

            await sock.sendMessage(sender, {
                text: `✅ *Tag definida com sucesso!*\n\nUsuário: *@${targetJid.split('@')[0]}*\nTag: *[${tagName}]*\nCor: \`${tagColor}\``,
                mentions: [targetJid]
            }, { quoted: msg });
            return true;
        }

        if (option === 'remover' || option === 'delete') {
            const targetArg = args[2]?.trim();

            if (!targetArg) {
                await sock.sendMessage(sender, {
                    text: `❌ *Uso incorreto!*\nUtilize:\n\`${prefix}${commandName} tag remover <@mencao|numero>\``
                }, { quoted: msg });
                return true;
            }

            let targetJid = null;
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0) {
                targetJid = mentionedJids[0];
            } else {
                const rawNum = targetArg.replace(/\D/g, '');
                if (rawNum.length >= 8) {
                    targetJid = `${rawNum}@s.whatsapp.net`;
                }
            }

            if (!targetJid) {
                await sock.sendMessage(sender, {
                    text: `❌ *Usuário inválido!*\nMencione alguém ou digite o número com DDI/DDD.`
                }, { quoted: msg });
                return true;
            }

            const removed = await minecraftManager.removeUserTag(targetJid);

            if (removed) {
                await sock.sendMessage(sender, {
                    text: `✅ *Tag removida com sucesso* para *@${targetJid.split('@')[0]}*.`,
                    mentions: [targetJid]
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, {
                    text: `❌ *Nenhuma tag encontrada* para *@${targetJid.split('@')[0]}*.`,
                    mentions: [targetJid]
                }, { quoted: msg });
            }
            return true;
        }

        await sock.sendMessage(sender, {
            text: `❌ *Subcomando inválido!*\nEscolha entre: *definir* ou *remover*.`
        }, { quoted: msg });
        return true;
    }

    if (sub === 'timeline' || sub === 'timeline_online' || sub === 'online') {
        await sock.sendMessage(sender, { react: { text: '⏳', key: msg.key } });

        const info = await fetchMinecraft();

        if (!info.success) {
            await sock.sendMessage(sender, {
                text: `❌ *Servidor offline*\n${info.error || ''}`
            }, { quoted: msg });
            return true;
        }

        const activeList = [];
        let maxDuration = 1;
        if (info.activeSessions) {
            for (const [name, duration] of Object.entries(info.activeSessions)) {
                if (duration > maxDuration) maxDuration = duration;
                activeList.push({
                    name,
                    duration,
                    durationStr: formatDurationMs(duration)
                });
            }
        }

        activeList.forEach(item => {
            item.percent = maxDuration > 0 ? Math.max(10, Math.round((item.duration / maxDuration) * 100)) : 100;
        });

        const logsList = (info.logs || []).map(log => {
            let detalheSemJogador = log.detalhe || '';
            if (detalheSemJogador.startsWith(log.jogador)) {
                detalheSemJogador = detalheSemJogador.substring(log.jogador.length).trim();
            }
            detalheSemJogador = detalheSemJogador.charAt(0).toLowerCase() + detalheSemJogador.slice(1);

            return {
                timeStr: new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                jogador: log.jogador,
                acao: log.acao,
                detalheSemJogador
            };
        }).reverse().slice(0, 7);

        const content = {
            hasActive: activeList.length > 0,
            activeList,
            hasLogs: logsList.length > 0,
            logsList
        };

        const path = require('path');
        const tempImagePath = path.resolve(`./temp/timeline_${Date.now()}.png`);

        try {
            const { generateImage } = require('../helpers/imageGenerator.js');
            await generateImage(TIMELINE_TEMPLATE, tempImagePath, content, { width: 800, height: 480 });

            await sock.sendMessage(sender, {
                image: { url: tempImagePath },
                caption: `📊 *Timeline de Atividade - Minecraft*\n\n` +
                    `🟢 Jogadores ativos: *${activeList.length}*\n` +
                    `⏳ Últimos eventos renderizados na imagem!`
            }, { quoted: msg });

            const fs = require('fs').promises;
            await fs.unlink(tempImagePath).catch(() => {});
        } catch (e) {
            console.error("Erro ao gerar imagem da timeline:", e);
            await sock.sendMessage(sender, {
                text: `❌ *Erro ao gerar imagem da timeline:*\n${e.message}`
            }, { quoted: msg });
        }
        return true;
    }

    // Help
    const text = `🎮 *Neko Server - Comandos*\n\n` +
        `${prefix}${commandName} info — Status geral do servidor\n` +
        `${prefix}${commandName} players — Lista de jogadores online\n` +
        `${prefix}${commandName} player <nome> — Visualiza a skin e info de um jogador\n` +
        `${prefix}${commandName} timeline — Timeline em imagem dos períodos online (HTML to Canvas)\n` +
        `${prefix}${commandName} mapa <nome> — Minimapa em imagem (HTML to Canvas) em volta de um jogador\n` +
        `${prefix}${commandName} eventos — Histórico de entrada e saída em texto\n` +
        `${prefix}${commandName} chat — Mostra as mensagens recentes do chat do servidor\n` +
        `${prefix}${commandName} definirchat — Seta o grupo atual como canal de chat (super admin)\n` +
        `${prefix}${commandName} vincular <nick> — Inicia a vinculação da sua conta do Minecraft\n` +
        `${prefix}${commandName} config — Gerencia ativação das mensagens do chat/join/quit (admin)\n` +
        `${prefix}${commandName} tag — Gerencia tags personalizadas (Nome e Cor) no chat do Minecraft (admin)\n` +
        `${prefix}${commandName} seed — Mostra a seed do mapa atual\n` +
        `${prefix}${commandName} mundos — Detalhes dos mundos do servidor\n` +
        `${prefix}${commandName} plugins — Lista os plugins do servidor\n` +
        `${prefix}${commandName} mods — Lista os mods do modpack (cliente)\n` +
        `${prefix}${commandName} perf — Gráficos de performance do servidor (TPS/RAM)\n` +
        `${prefix}${commandName} cmd <comando> — Executa comando no console (admin)`;

    await sock.sendMessage(sender, { text }, { quoted: msg });
    return true;
}

module.exports = minecraft;

module.exports.commandData = {
    name: 'minecraft',
    description: 'Gerencia o servidor Minecraft via WhatsApp.',
    category: 'admin',
    usage: '/minecraft [info|players|cmd|mapa|mods]',
    aliases: []
};
