
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const Vibrant = require('node-vibrant');
const { generateImage } = require('./imageGenerator');
const { generateNPSatoriCard } = require('./npSatoriGenerator');

const dirtTexturePath = path.join(__dirname, '..', 'assets', 'dirt.jpg');
const snowTexturePath = path.join(__dirname, '..', 'assets', 'snow.jpg');

let minecraftDirtBase64 = '';
let snowBase64 = '';

async function loadTextures() {
    try {
        const dirtData = await fs.readFile(dirtTexturePath);
        minecraftDirtBase64 = `data:image/jpeg;base64,${dirtData.toString('base64')}`;
    } catch (e) {
        // Ignorar se não existir, fallback
    }

    try {
        const snowData = await fs.readFile(snowTexturePath);
        snowBase64 = `data:image/jpeg;base64,${snowData.toString('base64')}`;
    } catch (e) {
        // Ignorar
    }
}

// Carregar texturas na inicialização
loadTextures();

function adjustAlpha(color, alpha) {
    if (!color) return `rgba(0, 0, 0, ${alpha})`;
    if (color.startsWith('rgba')) {
        return color.replace(/[\d\.]+\)$/, `${alpha})`);
    }
    if (color.startsWith('#')) {
        let hex = color;
        if (hex.length === 4) {
            hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
}

async function generateNPCard(track, user, username, theme, currentDuration, totalDuration, progressPercent, options = {}) {
    // Lógica para lidar com tema dinâmico
    if (theme.dynamic && track.image && !track.image.includes('default')) {
        try {
            const response = await axios.get(track.image, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = {
                ...theme,
                cardBg: dark.hex,
                accentColor: vibrant.hex,
                textColor: light.hex,
                subTextColor: adjustAlpha(light.hex, 0.7),
                borderColor: adjustAlpha(vibrant.hex, 0.3),
                statusColor: vibrant.hex,
                statusBg: adjustAlpha(vibrant.hex, 0.2),
                shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}`
            };
        } catch (e) {
            console.error("Error extracting colors for dynamic theme:", e.message);
        }
    }

    const tempPath = path.join(__dirname, '..', '..', 'temp', `np_${Date.now()}.png`);
    const preferredRenderer = (options.renderer || '').toLowerCase();
    if (preferredRenderer === 'satori') {
        try {
            await generateNPSatoriCard({
                track,
                user,
                username,
                theme,
                currentDuration,
                totalDuration,
                progressPercent,
                outputPath: tempPath
            });
            return tempPath;
        } catch (e) {
            console.error('[NP Satori] Falha no render, usando fallback HTML:', e.message);
        }
    }

    const isFree = theme.layout === 'free';
    const pos = theme.elementPositions || {};
    const decorations = theme.decorations || [];
    const progressShadowColor = adjustAlpha(theme.accentColor || '#1db954', 0.5);

    const getStyle = (id, defX, defY, defW, defH) => {
        if (!isFree) return '';
        const p = pos[id] || { x: defX, y: defY, scale: 1, rotation: 0 };
        return `position:absolute;left:${p.x}px;top:${p.y}px;transform:translate(-50%,-50%) scale(${p.scale}) rotate(${p.rotation}deg);width:${defW}px;height:${defH}px;`;
    };

    const decorationsHTML = decorations.map(dec => {
        const style = `position:absolute;left:${dec.x}px;top:${dec.y}px;width:${dec.width}px;height:${dec.height}px;transform:translate(-50%,-50%) rotate(${dec.rotation}deg);opacity:${dec.opacity / 100};z-index:${dec.zIndex};`;
        const content = dec.type === 'text' ? dec.content :
            (dec.type === 'image' ? `<img src="${dec.src}" style="width:100%;height:100%;object-fit:cover;border-radius:${dec.borderRadius}px;">` :
                (dec.type === 'shape' ? `<div style="width:100%;height:100%;background:${dec.color};border-radius:${dec.shapeStyle === 'circle' ? '50%' : (dec.shapeStyle === 'rounded' ? '12px' : '0')};border:${dec.borderWidth}px solid ${dec.borderColor};"></div>` : dec.content));
        return `<div class="decoration" style="${style}color:${dec.color};font-size:${dec.size}px;font-weight:${dec.fontWeight};font-family:${dec.font};text-align:center;">${content}</div>`;
    }).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&display=swap');
            
            body {
                margin: 0;
                padding: 0;
                width: 600px;
                height: 600px;
                font-family: ${theme.fontFamily || "'Inter', sans-serif"};
                background-color: #000;
                color: ${theme.textColor};
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .container {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 35px;
                box-sizing: border-box;
                z-index: 1;
                background: rgba(0, 0, 0, 0.4);
            }

            ${theme.snow ? `
            .snow-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url("${snowBase64 || ''}");
                opacity: 0.6;
                z-index: 1;
                animation: snow 20s linear infinite;
                pointer-events: none;
            }
            @keyframes snow {
                from { background-position: 0 0; }
                to { background-position: 48px 48px; }
            }
            ` : ''}

            .background {
                position: absolute;
                top: -50px;
                left: -50px;
                width: 120%;
                height: 120%;
                background-image: url('${track.image}');
                background-size: cover;
                background-position: center;
                filter: blur(40px) brightness(0.5) saturate(1.2);
                z-index: 0;
            }

            ${theme.type === 'minecraft' ? `
            .background {
                filter: none;
                background-image: url('${minecraftDirtBase64}');
                background-size: 64px;
                background-repeat: repeat;
                image-rendering: pixelated;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                opacity: 0.8; 
            }
            .container {
                padding: 0; 
                background: rgba(0,0,0,0.6); 
            }
            ` : ''}

            ${theme.customBackground ? `
            .background {
                filter: none;
                background-image: url('${theme.customBackground}');
                background-size: cover;
                background-position: center;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                opacity: 0.6;
            }
            ` : ''}

            .card-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                width: 100%;
                height: 100%;
                background: ${theme.screenBg ? theme.screenBg : adjustAlpha(theme.cardBg, 0.6)};
                ${theme.screenBg ? `
                    background-image: 
                        linear-gradient(${theme.screenBg} 100%, transparent 0),
                        linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.05) 95%),
                        linear-gradient(transparent 95%, rgba(0,0,0,0.05) 95%);
                    background-size: 100% 100%, 3px 3px, 3px 3px;
                    border: 8px solid ${theme.cardBg}; 
                    outline: 1px solid rgba(0,0,0,0.1); 
                ` : ''}
                
                border-radius: ${theme.screenBg ? '10px' : '32px'};
                padding: ${theme.screenBg ? '25px' : '35px 35px 50px 35px'};
                box-sizing: border-box;
                box-shadow: ${theme.shadow};
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: ${theme.screenBg ? 'none' : `1px solid ${theme.borderColor}`};
                
                ${theme.screenBg ? `
                    position: relative;
                ` : 'position: relative;'}
                
                ${theme.type === 'minecraft' ? `
                    width: 500px;
                    height: auto;
                    min-height: 250px;
                    border-radius: 0;
                    background: #c6c6c6;
                    border-top: 4px solid #ffffff;
                    border-left: 4px solid #ffffff;
                    border-right: 4px solid #555555;
                    border-bottom: 4px solid #555555;
                    box-shadow: 10px 10px 0px rgba(0,0,0,0.5);
                    padding: 20px;
                    image-rendering: pixelated;
                ` : ''}
                
                z-index: 2;
                justify-content: space-between;
            }
            
            ${theme.screenBg ? `
            .background {
                display: none;
            }
            ` : ''}

            ${theme.screenBg ? `
            .container {
                background: ${theme.cardBg}; 
                border-radius: 0; 
                padding: 40px;
                box-shadow: inset 10px 10px 50px rgba(0,0,0,0.1);
            }
            ` : ''}

            .album-art {
                width: 230px;
                height: 230px;
                border-radius: 20px;
                box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
                object-fit: cover;
                margin-bottom: 22px;
                margin-top: 10px;
                
                ${theme.type === 'minecraft' ? `
                    border-radius: 0;
                    box-shadow: none;
                    border: 4px solid #000;
                    image-rendering: pixelated;
                ` : ''}
            }

            .info {
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }

            .status-badge {
                display: inline-flex;
                align-items: center;
                background: ${theme.statusBg || 'rgba(29, 185, 84, 0.2)'};
                color: ${theme.statusColor || '#1db954'};
                padding: 6px 14px;
                border-radius: 50px;
                font-size: 11px;
                font-weight: ${theme.screenBg ? '400' : '800'};
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 15px;
                border: 1px solid ${theme.statusBg ? theme.statusBg : 'rgba(29, 185, 84, 0.3)'};
            }

            .status-badge span {
                margin-left: 6px;
            }

            h1 {
                font-size: 26px;
                margin: 0 0 6px 0;
                font-weight: ${theme.screenBg ? '400' : '800'};
                line-height: 1.2;
                max-width: 100%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-shadow: 0 2px 10px rgba(0,0,0,0.5);
                width: 100%;
                color: ${theme.textColor};
                padding-bottom: 10px;
                margin-bottom: -4px; 
                padding-left: 2px;
                padding-right: 2px;
            }

            h2 {
                font-size: 17px;
                color: ${theme.subTextColor};
                margin: 0 0 25px 0;
                font-weight: ${theme.screenBg ? '400' : '500'};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                max-width: 90%;
            }

            .progress-container {
                width: 90%;
                display: flex;
                align-items: center;
                margin-bottom: 25px;
                margin-top: 5px;
            }
            
            .timestamp {
                font-size: 11px;
                color: ${theme.subTextColor};
                font-weight: ${theme.screenBg ? '400' : '600'};
                width: 50px;
                min-width: 50px;
                text-align: center;
            }

            .progress-bar-bg {
                flex: 1;
                height: 5px;
                background: rgba(255,255,255,0.1);
                border-radius: 10px;
                margin: 0 8px;
                overflow: hidden;
                
                ${theme.type === 'minecraft' ? `
                    height: 14px; 
                    border-radius: 0;
                    background: #3a3a3a; 
                    border: 2px solid #fff;
                    box-shadow: inset 2px 2px 0px #000;
                ` : ''}
            }

            .progress-bar-fill {
                height: 100%;
                background: ${theme.accentColor};
                width: ${progressPercent}%;
                border-radius: 10px;
                box-shadow: 0 0 10px ${progressShadowColor};
                
                ${theme.type === 'minecraft' ? `
                    border-radius: 0;
                    box-shadow: none;
                    background: linear-gradient(to bottom, #80ff00 50%, #4da600 50%); 
                    position: relative;
                ` : ''}
            }
            
            ${theme.type === 'minecraft' ? `
            .progress-bar-bg {
                position: relative;
            }
            .progress-bar-fill::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                
                background: repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 18px,
                    rgba(0,0,0,0.4) 18px,
                    rgba(0,0,0,0.4) 20px
                );
            }
            ` : ''}

            .user-row {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-top: auto;
                border-top: 1px solid ${theme.borderColor};
                padding-top: 15px;
                width: 100%;
                margin-bottom: 0px; 
                
                ${theme.type === 'minecraft' ? `
                    border-top: 2px solid #999;
                    border-bottom: 2px solid #fff; 
                ` : ''}
            }

            .user-avatar {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 2px solid ${theme.subTextColor};
                margin-right: 10px;
            }

            .user-data {
                font-size: 12px;
                color: ${theme.subTextColor};
                font-weight: ${theme.screenBg ? '400' : '600'};
            }
            
            .user-data b {
                color: ${theme.textColor};
            }

            .logo-icon {
                position: absolute;
                top: 25px;
                right: 25px;
                opacity: 0.9;
                width: 24px;
                height: 24px;
            }

            ${isFree ? `
            .card-content { border: none; background: transparent; box-shadow: none; backdrop-filter: none; padding: 0; }
            .info { position: absolute; display: contents; }
            .user-row { border: none; padding: 0; }
            .logo-icon { pointer-events: none; }
            .decoration { position: absolute; pointer-events: none; }
            ` : ''}

        </style>
    </head>
    <body>
        <div class="background"></div>
        <div class="container">
            ${theme.snow ? '<div class="snow-overlay"></div>' : ''}
            ${decorationsHTML}
            <div class="card-content">
                <svg class="logo-icon" style="${getStyle('logo', 550, 50, 24, 24)}" viewBox="0 0 24 24" fill="${theme.textColor}">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z"/>
                </svg>

                <img src="${track.image}" class="album-art" style="${getStyle('art', 300, 200, 230, 230)}" crossorigin="anonymous" onerror="this.src='https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2?v=v2'"/>
                
                <div class="info">
                    <div class="status-badge" style="${getStyle('badge', 300, 50, 200, 30)}">
                        ${track.nowPlaying ?
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="${theme.statusColor || '#1db954'}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg> <span>LISTENING NOW</span>` :
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="#aaa"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg> <span>LAST PLAYED</span>`
        }
                    </div>
                    
                    <h1 style="${getStyle('title', 300, 350, 500, 50)}">${track.name}</h1>
                    <h2 style="${getStyle('artist', 300, 390, 400, 40)}">${track.artist}</h2>

                    <div class="progress-container" style="${getStyle('pbar', 300, 440, 500, 30)}">
                        <span class="timestamp">${currentDuration}</span>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill"></div>
                        </div>
                        <span class="timestamp">${totalDuration}</span>
                    </div>

                    <div class="user-row" style="${getStyle('user', 300, 520, 400, 50)}">
                        <img src="${user.image || 'https://i.imgur.com/6X2v6lX.png'}" class="user-avatar" crossorigin="anonymous">
                        <div class="user-data">
                             <b>${username}</b> • ${Number(user.scrobbles).toLocaleString('pt-BR')} scrobbles
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    await generateImage(html, tempPath, {}, { width: 600, height: 600 });
    return tempPath;
}

async function generateTopTracksCard(tracks, periodTitle, username, theme) {
    if (theme.dynamic && tracks.length > 0) {
        const artUrl = tracks[0].spotifyImage || (tracks[0].image && tracks[0].image.find(i => i.size === 'extralarge')?.['#text']);
        if (artUrl && !artUrl.includes('default')) {
            try {
                const response = await axios.get(artUrl, { responseType: 'arraybuffer' });
                const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
                const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
                const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
                const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
                theme = {
                    ...theme,
                    cardBg: dark.hex,
                    textColor: light.hex,
                    subTextColor: adjustAlpha(light.hex, 0.7),
                    borderColor: adjustAlpha(vibrant.hex, 0.3),
                    statusColor: vibrant.hex,
                    statusBg: adjustAlpha(vibrant.hex, 0.2),
                    shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}`
                };
            } catch (e) {
                console.error("Error extracting colors for dynamic theme (TopTracks):", e.message);
            }
        }
    }

    const getArt = (t) => {
        if (t.spotifyImage) return t.spotifyImage;
        const images = t.image;
        if (!images || !Array.isArray(images)) return 'https://i.imgur.com/To2300W.png';
        return (images.find(i => i.size === 'extralarge') ||
            images.find(i => i.size === 'large') ||
            images.find(i => i.size === 'medium') ||
            images[0])?.['#text'] || 'https://i.imgur.com/To2300W.png';
    };

    const mainArt = getArt(tracks[0]);

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&display=swap');
            body {
                margin: 0; padding: 0; width: 600px; height: 800px;
                font-family: ${theme.fontFamily || "'Inter', sans-serif"};
                background-color: #000; color: ${theme.textColor};
                display: flex; align-items: center; justify-content: center; overflow: hidden;
            }
            .background {
                position: absolute; top: -50px; left: -50px; width: 120%; height: 120%;
                background-image: url('${mainArt}'); background-size: cover; background-position: center;
                filter: blur(50px) brightness(0.4); z-index: 0;
            }
            .container {
                position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;
                align-items: center; padding: 40px; box-sizing: border-box; z-index: 1;
                background: rgba(0,0,0,0.2);
            }
            .header {
                text-align: center; margin-bottom: 30px; width: 100%;
            }
            .title {
                font-size: 28px; font-weight: 800; margin: 0; color: ${theme.textColor};
                text-shadow: 0 4px 12px rgba(0,0,0,0.3); letter-spacing: -0.5px;
            }
            .subtitle {
                font-size: 14px; color: ${theme.accentColor}; margin-top: 5px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;
            }
            .track-list {
                width: 100%; display: flex; flex-direction: column; gap: 12px;
            }
            .track-item {
                display: flex; align-items: center; background: ${adjustAlpha(theme.cardBg, 0.7)};
                padding: 10px; border-radius: 12px; backdrop-filter: blur(10px);
                border: 1px solid ${theme.borderColor}; box-shadow: ${theme.shadow};
            }
            .rank {
                font-size: 18px; font-weight: 800; color: ${theme.subTextColor}; width: 30px; text-align: center; margin-right: 10px;
            }
            .art {
                width: 48px; height: 48px; border-radius: 8px; object-fit: cover; margin-right: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
            .info {
                flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;
            }
            .name {
                font-size: 15px; font-weight: 700; color: ${theme.textColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
            }
            .artist {
                font-size: 12px; color: ${theme.subTextColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            .plays {
                font-size: 11px; font-weight: 600; color: ${theme.textColor}; background: ${theme.statusBg || 'rgba(255,255,255,0.1)'};
                padding: 4px 8px; border-radius: 20px; margin-left: 10px; white-space: nowrap;
            }
        </style>
    </head>
    <body>
        <div class="background"></div>
        <div class="container">
            <div class="header">
                <h1 class="title">Top Tracks</h1>
                <div class="subtitle">${periodTitle} • ${username}</div>
            </div>
            <div class="track-list">
                ${tracks.map((t, i) => `
                <div class="track-item">
                    <div class="rank">#${i + 1}</div>
                    <img src="${getArt(t)}" class="art">
                    <div class="info">
                        <div class="name">${t.name}</div>
                        <div class="artist">${t.artist.name}</div>
                    </div>
                    ${t.playcount ? `<div class="plays">${Number(t.playcount).toLocaleString()} scrobbles</div>` : ''}
                </div>
                `).join('')}
            </div>
        </div>
    </body>
    </html>
    `;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `top_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 800 });
    return tempPath;
}

async function generateLyricsCard(track, theme, username, text, scrobbles, userProfilePic) {
    if (theme.dynamic && track.image && !track.image.includes('default')) {
        try {
            const response = await axios.get(track.image, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            const muted = palette.Muted || palette.LightMuted || { hex: '#535353' };

            theme = {
                ...theme,
                cardBg: `linear-gradient(135deg, ${adjustAlpha(dark.hex, 0.6)} 0%, ${adjustAlpha(muted.hex, 0.6)} 100%)`,
                accentColor: vibrant.hex,
                textColor: light.hex,
                subTextColor: adjustAlpha(light.hex, 0.8),
                borderColor: adjustAlpha(vibrant.hex, 0.3),
                statusColor: vibrant.hex,
                statusBg: adjustAlpha(vibrant.hex, 0.2),
                shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}`
            };
        } catch (e) {
            console.error("Error extracting colors for dynamic theme (Lyrics):", e.message);
        }
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=720, height=1280, initial-scale=1">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&family=Caveat:wght@700&display=swap');
            
            * { box-sizing: border-box; }
            html, body {
                margin: 0; padding: 0; width: 100vw; height: 100vh;
                background-color: #000; overflow: hidden;
            }
            body {
                font-family: ${theme.fontFamily || "'Inter', sans-serif"};
                color: ${theme.textColor};
                display: flex; align-items: center; justify-content: center; position: relative;
            }

            /* --- BACKGROUND LAYER --- */
            .background-layer {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background-image: url('${track.image}'); background-size: cover; background-position: center;
                filter: brightness(0.65); z-index: 0;
            }
            ${theme.customBackground ? `.background-layer { background-image: url('${theme.customBackground}'); }` : ''}
            ${theme.type === 'minecraft' ? `.background-layer { background-image: url('${minecraftDirtBase64}'); background-size: 64px; background-repeat: repeat; filter: none; opacity: 1; }` : ''}
            ${theme.screenBg ? `.background-layer { background: ${theme.cardBg}; filter: none; background-image: none; }` : ''}

            /* --- FLOATING CARD BOX --- */
            .floating-card {
                position: relative; z-index: 2; width: 580px; min-height: 600px; max-height: 1000px;
                background: ${theme.screenBg ? theme.screenBg : adjustAlpha(theme.cardBg, 0.5)}; 
                border-radius: 32px; padding: 50px; box-sizing: border-box;
                display: flex; flex-direction: column; justify-content: space-between;
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
                ${theme.type !== 'minecraft' && !theme.screenBg ? `border: 1px solid ${theme.borderColor || 'rgba(255,255,255,0.2)'};` : ''}
                ${theme.type === 'minecraft' ? `border: 6px solid #fff; background: rgba(0,0,0,0.6); border-radius: 0; box-shadow: 15px 15px 0 #000;` : ''}
                backdrop-filter: blur(25px);
            }
            ${theme.screenBg ? `
            .floating-card {
                 background-image: linear-gradient(${theme.screenBg} 100%, transparent 0), linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.05) 95%), linear-gradient(transparent 95%, rgba(0,0,0,0.05) 95%);
                background-size: 100% 100%, 3px 3px, 3px 3px; border: none; box-shadow: inset 5px 5px 15px rgba(0,0,0,0.3); border-radius: 12px;
            }` : ''}

            /* --- HEADER --- */
            .header {
                display: flex; align-items: center; width: 100%; margin-bottom: 30px;
                border-bottom: 1px solid ${adjustAlpha(theme.textColor, 0.1)}; padding-bottom: 25px;
            }
            .album-art {
                width: 70px; height: 70px; border-radius: 16px; box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                object-fit: cover; margin-right: 20px; border: 2px solid ${theme.accentColor};
                ${theme.type === 'minecraft' ? 'border-radius: 0; border: 2px solid #fff; box-shadow: none;' : ''}
            }
            .track-meta { display: flex; flex-direction: column; justify-content: center; }
            .song-title {
                font-size: 22px; font-weight: 800; color: ${theme.textColor}; margin-bottom: 6px;
                letter-spacing: 0.5px; text-transform: uppercase;
                ${theme.textShadow ? `text-shadow: ${theme.textShadow};` : ''}
            }
            .song-detail { font-size: 15px; font-weight: 600; color: ${theme.accentColor}; text-transform: uppercase; letter-spacing: 1.5px; }

            /* --- BODY --- */
            .lyrics-body { flex: 1; display: flex; flex-direction: column; justify-content: center; width: 100%; margin: 20px 0; }
            .quote-mark {
                font-size: 80px; line-height: 0; color: ${theme.accentColor}; opacity: 0.3; margin-bottom: 40px; font-family: serif;
                ${theme.type === 'minecraft' ? 'font-family: "Press Start 2P";' : ''}
            }
            .lyrics-text {
                font-family: ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? "'Press Start 2P', cursive" : "'Inter', sans-serif"};
                font-size: ${text.length > 150 ? '28px' : '36px'};
                font-weight: ${theme.type === 'minecraft' ? '400' : '700'};
                font-style: ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? 'normal' : 'italic'};
                line-height: 1.5; color: ${theme.textColor}; white-space: pre-wrap; text-align: left;
                display: -webkit-box; -webkit-line-clamp: 10; -webkit-box-orient: vertical; overflow: hidden;
                ${theme.name.toLowerCase().includes('neon') ? `text-shadow: 0 0 10px ${theme.textColor};` : 'text-shadow: 0 2px 10px rgba(0,0,0,0.2);'}
            }

            /* --- FOOTER --- */
            .footer { width: 100%; display: flex; align-items: center; justify-content: flex-end; margin-top: 30px; }
            .user-tag {
                font-size: 14px; font-weight: 600; color: ${theme.subTextColor};
                background: ${adjustAlpha(theme.textColor, 0.1)}; padding: 10px 20px; border-radius: 30px;
                display: flex; align-items: center; gap: 10px;
                ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? 'border-radius: 0;' : ''}
            }
            .user-avatar {
                width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid ${theme.accentColor};
                 ${theme.type === 'minecraft' ? 'border-radius: 0;' : ''}
            }
            .scrobble-count {
                opacity: 0.8; font-size: 12px; margin-left: 6px;
                border-left: 1px solid ${adjustAlpha(theme.textColor, 0.3)}; padding-left: 10px;
            }
            .scrobble-icon {
                width: 10px; height: 10px; background: ${theme.statusColor || theme.accentColor};
                border-radius: 50%; animation: pulse 2s infinite;
                ${theme.type === 'minecraft' ? 'border-radius: 0;' : ''}
            }
            @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
        </style>
    </head>
    <body>
        <div class="background-layer"></div>
        <div class="floating-card">
            <div class="header">
                <img src="${track.image}" class="album-art" crossorigin="anonymous">
                <div class="track-meta">
                    <span class="song-title">${track.name}</span>
                    <span class="song-detail">${track.artist}</span>
                </div>
            </div>
            <div class="lyrics-body">
                <div class="quote-mark">“</div>
                <div class="lyrics-text">${text}</div>
            </div>
            <div class="footer">
                <div class="user-tag">
                    ${userProfilePic ? `<img src="${userProfilePic}" class="user-avatar" crossorigin="anonymous">` : '<div class="scrobble-icon"></div>'}
                    <span>@${username}</span>
                    <span class="scrobble-count">${scrobbles} plays</span>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `quote_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 720, height: 1280 });
    return tempPath;
}

async function generateChartCard(albums, width, height, periodTitle, username, showTitles, theme) {
    // Dynamic theme based on first album cover
    if (theme.dynamic && albums.length > 0 && albums[0].image && !albums[0].image.includes('default')) {
        try {
            const response = await axios.get(albums[0].image, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = {
                ...theme,
                cardBg: dark.hex,
                textColor: light.hex,
                subTextColor: adjustAlpha(light.hex, 0.7),
                accentColor: vibrant.hex,
                borderColor: adjustAlpha(vibrant.hex, 0.3),
                shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}`
            };
        } catch (e) { /* fallback */ }
    }

    const cellSize = width * height > 25 ? 150 : 200;
    const totalW = cellSize * width;
    const headerH = 60;
    const totalH = cellSize * height + headerH;

    const cells = albums.slice(0, width * height).map((a, i) => {
        const imgUrl = a.image || 'https://i.imgur.com/To2300W.png';
        const titleHtml = showTitles ? `
            <div class="overlay">
                <div class="overlay-artist">${(a.artist || '').replace(/</g, '&lt;')}</div>
                <div class="overlay-album">${(a.name || '').replace(/</g, '&lt;')}</div>
            </div>` : '';
        return `<div class="cell" style="width:${cellSize}px;height:${cellSize}px;">
            <img src="${imgUrl}" onerror="this.src='https://i.imgur.com/To2300W.png'">
            ${titleHtml}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: ${totalW}px; height: ${totalH}px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .header { width: 100%; height: ${headerH}px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: ${adjustAlpha(theme.cardBg || '#121212', 0.95)}; border-bottom: 2px solid ${theme.accentColor || '#1db954'}; }
        .header-title { font-size: 18px; font-weight: 800; color: ${theme.textColor || '#fff'}; letter-spacing: -0.3px; }
        .header-sub { font-size: 12px; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .grid { display: grid; grid-template-columns: repeat(${width}, ${cellSize}px); grid-template-rows: repeat(${height}, ${cellSize}px); }
        .cell { position: relative; overflow: hidden; }
        .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.85)); pointer-events: none; }
        .overlay-artist { font-size: ${cellSize > 150 ? '11px' : '9px'}; color: rgba(255,255,255,0.8); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .overlay-album { font-size: ${cellSize > 150 ? '10px' : '8px'}; color: rgba(255,255,255,0.55); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style></head><body>
        <div class="header">
            <span class="header-title">${username} — Album Chart</span>
            <span class="header-sub">${periodTitle} • ${width}x${height}</span>
        </div>
        <div class="grid">${cells}</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `chart_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: totalW, height: totalH });
    return tempPath;
}

async function generateArtistChartCard(artists, width, height, periodTitle, username, showTitles, theme) {
    if (theme.dynamic && artists.length > 0 && artists[0].image && !artists[0].image.includes('default')) {
        try {
            const response = await axios.get(artists[0].image, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = {
                ...theme,
                cardBg: dark.hex,
                textColor: light.hex,
                subTextColor: adjustAlpha(light.hex, 0.7),
                accentColor: vibrant.hex,
                borderColor: adjustAlpha(vibrant.hex, 0.3),
                shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}`
            };
        } catch (e) { /* fallback */ }
    }

    const cellSize = width * height > 25 ? 150 : 200;
    const totalW = cellSize * width;
    const headerH = 60;
    const totalH = cellSize * height + headerH;

    const cells = artists.slice(0, width * height).map((a, i) => {
        const imgUrl = a.image || 'https://i.imgur.com/To2300W.png';
        const titleHtml = showTitles ? `
            <div class="overlay">
                <div class="overlay-name">${(a.name || '').replace(/</g, '&lt;')}</div>
                <div class="overlay-plays">${a.playcount ? Number(a.playcount).toLocaleString() + ' plays' : ''}</div>
            </div>` : '';
        return `<div class="cell" style="width:${cellSize}px;height:${cellSize}px;">
            <img src="${imgUrl}" onerror="this.src='https://i.imgur.com/To2300W.png'">
            ${titleHtml}
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: ${totalW}px; height: ${totalH}px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .header { width: 100%; height: ${headerH}px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: ${adjustAlpha(theme.cardBg || '#121212', 0.95)}; border-bottom: 2px solid ${theme.accentColor || '#1db954'}; }
        .header-title { font-size: 18px; font-weight: 800; color: ${theme.textColor || '#fff'}; letter-spacing: -0.3px; }
        .header-sub { font-size: 12px; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
        .grid { display: grid; grid-template-columns: repeat(${width}, ${cellSize}px); grid-template-rows: repeat(${height}, ${cellSize}px); }
        .cell { position: relative; overflow: hidden; }
        .cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 8px; background: linear-gradient(transparent, rgba(0,0,0,0.85)); pointer-events: none; }
        .overlay-name { font-size: ${cellSize > 150 ? '12px' : '9px'}; color: rgba(255,255,255,0.95); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .overlay-plays { font-size: ${cellSize > 150 ? '10px' : '8px'}; color: rgba(255,255,255,0.5); font-weight: 400; }
    </style></head><body>
        <div class="header">
            <span class="header-title">${username} — Artist Chart</span>
            <span class="header-sub">${periodTitle} • ${width}x${height}</span>
        </div>
        <div class="grid">${cells}</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `achart_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: totalW, height: totalH });
    return tempPath;
}

async function generateTopArtistsCard(artists, periodTitle, username, theme) {
    if (theme.dynamic && artists.length > 0 && artists[0].image && !artists[0].image.includes('default')) {
        try {
            const response = await axios.get(artists[0].image, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = { ...theme, cardBg: dark.hex, textColor: light.hex, subTextColor: adjustAlpha(light.hex, 0.7), borderColor: adjustAlpha(vibrant.hex, 0.3), statusColor: vibrant.hex, statusBg: adjustAlpha(vibrant.hex, 0.2), shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}` };
        } catch (e) { }
    }

    const mainArt = artists[0]?.image || 'https://i.imgur.com/To2300W.png';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body { margin:0;padding:0;width:600px;height:800px;font-family:${theme.fontFamily||"'Inter',sans-serif"};background:#000;color:${theme.textColor};display:flex;align-items:center;justify-content:center;overflow:hidden; }
        .background { position:absolute;top:-50px;left:-50px;width:120%;height:120%;background-image:url('${mainArt}');background-size:cover;background-position:center;filter:blur(50px) brightness(0.4);z-index:0; }
        .container { position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;padding:40px;box-sizing:border-box;z-index:1;background:rgba(0,0,0,0.2); }
        .header { text-align:center;margin-bottom:30px;width:100%; }
        .title { font-size:28px;font-weight:800;margin:0;color:${theme.textColor};text-shadow:0 4px 12px rgba(0,0,0,0.3);letter-spacing:-0.5px; }
        .subtitle { font-size:14px;color:${theme.statusColor||theme.accentColor};margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:1px; }
        .track-list { width:100%;display:flex;flex-direction:column;gap:12px; }
        .track-item { display:flex;align-items:center;background:${adjustAlpha(theme.cardBg,0.7)};padding:10px;border-radius:12px;backdrop-filter:blur(10px);border:1px solid ${theme.borderColor};box-shadow:${theme.shadow}; }
        .rank { font-size:18px;font-weight:800;color:${theme.subTextColor};width:30px;text-align:center;margin-right:10px; }
        .art { width:48px;height:48px;border-radius:50%;object-fit:cover;margin-right:15px;box-shadow:0 4px 8px rgba(0,0,0,0.3); }
        .info { flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center; }
        .name { font-size:15px;font-weight:700;color:${theme.textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px; }
        .artist-sub { font-size:12px;color:${theme.subTextColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .plays { font-size:11px;font-weight:600;color:${theme.textColor};background:${theme.statusBg||'rgba(255,255,255,0.1)'};padding:4px 8px;border-radius:20px;margin-left:10px;white-space:nowrap; }
    </style></head><body>
        <div class="background"></div>
        <div class="container">
            <div class="header"><h1 class="title">Top Artists</h1><div class="subtitle">${periodTitle} • ${username}</div></div>
            <div class="track-list">
                ${artists.map((a, i) => `<div class="track-item">
                    <div class="rank">#${i+1}</div>
                    <img src="${a.image||'https://i.imgur.com/To2300W.png'}" class="art" onerror="this.src='https://i.imgur.com/To2300W.png'">
                    <div class="info"><div class="name">${a.name}</div></div>
                    ${a.playcount ? `<div class="plays">${Number(a.playcount).toLocaleString()} plays</div>` : ''}
                </div>`).join('')}
            </div>
        </div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `ta_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 800 });
    return tempPath;
}

async function generateTopAlbumsCard(albums, periodTitle, username, theme) {
    const firstArt = albums[0]?.image || 'https://i.imgur.com/To2300W.png';
    if (theme.dynamic && firstArt && !firstArt.includes('default')) {
        try {
            const response = await axios.get(firstArt, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = { ...theme, cardBg: dark.hex, textColor: light.hex, subTextColor: adjustAlpha(light.hex, 0.7), borderColor: adjustAlpha(vibrant.hex, 0.3), statusColor: vibrant.hex, statusBg: adjustAlpha(vibrant.hex, 0.2), shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}` };
        } catch (e) { }
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body { margin:0;padding:0;width:600px;height:800px;font-family:${theme.fontFamily||"'Inter',sans-serif"};background:#000;color:${theme.textColor};display:flex;align-items:center;justify-content:center;overflow:hidden; }
        .background { position:absolute;top:-50px;left:-50px;width:120%;height:120%;background-image:url('${firstArt}');background-size:cover;background-position:center;filter:blur(50px) brightness(0.4);z-index:0; }
        .container { position:relative;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;padding:40px;box-sizing:border-box;z-index:1;background:rgba(0,0,0,0.2); }
        .header { text-align:center;margin-bottom:30px;width:100%; }
        .title { font-size:28px;font-weight:800;margin:0;color:${theme.textColor};text-shadow:0 4px 12px rgba(0,0,0,0.3); }
        .subtitle { font-size:14px;color:${theme.statusColor||theme.accentColor};margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:1px; }
        .track-list { width:100%;display:flex;flex-direction:column;gap:12px; }
        .track-item { display:flex;align-items:center;background:${adjustAlpha(theme.cardBg,0.7)};padding:10px;border-radius:12px;backdrop-filter:blur(10px);border:1px solid ${theme.borderColor};box-shadow:${theme.shadow}; }
        .rank { font-size:18px;font-weight:800;color:${theme.subTextColor};width:30px;text-align:center;margin-right:10px; }
        .art { width:48px;height:48px;border-radius:8px;object-fit:cover;margin-right:15px;box-shadow:0 4px 8px rgba(0,0,0,0.3); }
        .info { flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center; }
        .name { font-size:15px;font-weight:700;color:${theme.textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px; }
        .artist { font-size:12px;color:${theme.subTextColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .plays { font-size:11px;font-weight:600;color:${theme.textColor};background:${theme.statusBg||'rgba(255,255,255,0.1)'};padding:4px 8px;border-radius:20px;margin-left:10px;white-space:nowrap; }
    </style></head><body>
        <div class="background"></div>
        <div class="container">
            <div class="header"><h1 class="title">Top Albums</h1><div class="subtitle">${periodTitle} • ${username}</div></div>
            <div class="track-list">
                ${albums.map((a, i) => `<div class="track-item">
                    <div class="rank">#${i+1}</div>
                    <img src="${a.image||'https://i.imgur.com/To2300W.png'}" class="art" onerror="this.src='https://i.imgur.com/To2300W.png'">
                    <div class="info"><div class="name">${a.name}</div><div class="artist">${a.artist||''}</div></div>
                    ${a.playcount ? `<div class="plays">${Number(a.playcount).toLocaleString()} plays</div>` : ''}
                </div>`).join('')}
            </div>
        </div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `tab_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 800 });
    return tempPath;
}

async function generateReceiptCard(tracks, periodTitle, username, theme, totalScrobbles) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        * { margin:0;padding:0;box-sizing:border-box; }
        body { width:420px;height:${Math.max(700, 280 + tracks.length * 38)}px;font-family:'Space Mono',monospace;background:#f5f0e8;overflow:hidden;display:flex;justify-content:center;padding:20px 0; }
        .receipt { width:380px;background:#fff;padding:30px 25px;border:2px dashed #ccc;position:relative; }
        .receipt::before { content:'';position:absolute;top:-10px;left:0;right:0;height:10px;background:repeating-linear-gradient(90deg,transparent,transparent 4px,#f5f0e8 4px,#f5f0e8 8px); }
        .receipt::after { content:'';position:absolute;bottom:-10px;left:0;right:0;height:10px;background:repeating-linear-gradient(90deg,transparent,transparent 4px,#f5f0e8 4px,#f5f0e8 8px); }
        .store-name { text-align:center;font-size:22px;font-weight:700;letter-spacing:3px;margin-bottom:4px;text-transform:uppercase; }
        .store-sub { text-align:center;font-size:10px;color:#666;margin-bottom:15px;letter-spacing:1px; }
        .divider { border:none;border-top:1px dashed #333;margin:12px 0; }
        .meta { display:flex;justify-content:space-between;font-size:10px;color:#555;margin-bottom:2px; }
        .items { margin:8px 0; }
        .item { display:flex;justify-content:space-between;align-items:flex-start;font-size:11px;padding:4px 0;border-bottom:1px dotted #ddd; }
        .item-num { width:24px;color:#999;flex-shrink:0; }
        .item-name { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px; }
        .item-artist { font-size:9px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .item-plays { flex-shrink:0;font-weight:700;text-align:right;min-width:30px; }
        .total-row { display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:6px; }
        .barcode { text-align:center;margin-top:15px;font-size:8px;color:#aaa;letter-spacing:2px; }
        .barcode-lines { display:flex;justify-content:center;gap:1px;margin-bottom:4px;height:30px; }
        .barcode-lines div { background:#000;width:2px; }
        .barcode-lines div:nth-child(even) { width:1px; }
        .barcode-lines div:nth-child(3n) { width:3px; }
    </style></head><body>
        <div class="receipt">
            <div class="store-name">RECEIPTIFY</div>
            <div class="store-sub">${username.toUpperCase()} • LAST.FM</div>
            <hr class="divider">
            <div class="meta"><span>DATA: ${dateStr}</span><span>HORA: ${timeStr}</span></div>
            <div class="meta"><span>PERÍODO: ${periodTitle}</span><span>ORDEM: #001</span></div>
            <hr class="divider">
            <div class="items">
                ${tracks.map((t, i) => `<div class="item">
                    <span class="item-num">${String(i+1).padStart(2,'0')}</span>
                    <span class="item-name">${(t.name||'').replace(/</g,'&lt;')}<br><span class="item-artist">${(t.artist||'').replace(/</g,'&lt;')}</span></span>
                    <span class="item-plays">${t.playcount ? Number(t.playcount).toLocaleString() : '-'}</span>
                </div>`).join('')}
            </div>
            <hr class="divider">
            <div class="total-row"><span>TOTAL SCROBBLES</span><span>${Number(totalScrobbles||0).toLocaleString()}</span></div>
            <div class="total-row"><span>ITENS</span><span>${tracks.length}</span></div>
            <hr class="divider">
            <div class="barcode">
                <div class="barcode-lines">${Array(30).fill(0).map(()=>'<div style="height:'+Math.floor(Math.random()*15+15)+'px"></div>').join('')}</div>
                ${username.toUpperCase()} - ${periodTitle}
            </div>
        </div>
    </body></html>`;

    const h = Math.max(700, 280 + tracks.length * 38);
    const tempPath = path.join(__dirname, '..', '..', 'temp', `rcpt_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 420, height: h });
    return tempPath;
}

async function generateProfileCard(userData, topData, theme) {
    const { username, scrobbles, registered, country, profilePic } = userData;
    const mainImg = topData.topArtistImg || topData.topAlbumImg || profilePic || 'https://i.imgur.com/To2300W.png';

    if (theme.dynamic && mainImg && !mainImg.includes('default')) {
        try {
            const response = await axios.get(mainImg, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = { ...theme, cardBg: dark.hex, textColor: light.hex, subTextColor: adjustAlpha(light.hex, 0.7), accentColor: vibrant.hex, borderColor: adjustAlpha(vibrant.hex, 0.3), shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}` };
        } catch (e) { }
    }

    const regDate = registered ? new Date(Number(registered) * 1000).toLocaleDateString('pt-BR') : '?';
    const avgDaily = registered ? Math.round(Number(scrobbles) / Math.max(1, (Date.now() - Number(registered) * 1000) / 86400000)) : '?';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body { margin:0;padding:0;width:600px;height:600px;font-family:${theme.fontFamily||"'Inter',sans-serif"};background:#000;color:${theme.textColor};display:flex;align-items:center;justify-content:center;overflow:hidden; }
        .bg { position:absolute;top:-50px;left:-50px;width:120%;height:120%;background-image:url('${mainImg}');background-size:cover;background-position:center;filter:blur(50px) brightness(0.35);z-index:0; }
        .container { position:relative;z-index:1;width:100%;height:100%;display:flex;flex-direction:column;padding:40px;box-sizing:border-box;background:rgba(0,0,0,0.25); }
        .profile-header { display:flex;align-items:center;gap:20px;margin-bottom:30px; }
        .avatar { width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${theme.accentColor};box-shadow:0 4px 15px rgba(0,0,0,0.4); }
        .user-info h1 { font-size:26px;font-weight:800;margin:0;text-shadow:0 2px 8px rgba(0,0,0,0.4); }
        .user-info p { font-size:13px;color:${theme.subTextColor};margin:4px 0 0;font-weight:600; }
        .stats-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:25px; }
        .stat-box { background:${adjustAlpha(theme.cardBg,0.6)};backdrop-filter:blur(12px);border:1px solid ${theme.borderColor};border-radius:16px;padding:18px;text-align:center; }
        .stat-val { font-size:24px;font-weight:800;color:${theme.textColor}; }
        .stat-label { font-size:11px;color:${theme.subTextColor};text-transform:uppercase;letter-spacing:1px;margin-top:4px;font-weight:600; }
        .tops { display:flex;flex-direction:column;gap:10px; }
        .top-row { display:flex;align-items:center;background:${adjustAlpha(theme.cardBg,0.5)};backdrop-filter:blur(10px);border:1px solid ${theme.borderColor};border-radius:12px;padding:10px 14px; }
        .top-label { font-size:10px;color:${theme.subTextColor};text-transform:uppercase;letter-spacing:1px;font-weight:700;width:55px;flex-shrink:0; }
        .top-name { font-size:14px;font-weight:700;color:${theme.textColor};flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .top-plays { font-size:11px;color:${theme.subTextColor};font-weight:600;margin-left:10px;flex-shrink:0; }
    </style></head><body>
        <div class="bg"></div>
        <div class="container">
            <div class="profile-header">
                <img src="${profilePic||'https://i.imgur.com/6X2v6lX.png'}" class="avatar" crossorigin="anonymous">
                <div class="user-info"><h1>${username}</h1><p>Membro desde ${regDate}${country ? ' • '+country : ''}</p></div>
            </div>
            <div class="stats-grid">
                <div class="stat-box"><div class="stat-val">${Number(scrobbles||0).toLocaleString('pt-BR')}</div><div class="stat-label">Scrobbles</div></div>
                <div class="stat-box"><div class="stat-val">${avgDaily}</div><div class="stat-label">Média/Dia</div></div>
                <div class="stat-box"><div class="stat-val">${Number(topData.artistCount||0).toLocaleString('pt-BR')}</div><div class="stat-label">Artistas</div></div>
                <div class="stat-box"><div class="stat-val">${Number(topData.albumCount||0).toLocaleString('pt-BR')}</div><div class="stat-label">Álbuns</div></div>
            </div>
            <div class="tops">
                ${topData.topArtist ? `<div class="top-row"><span class="top-label">Artista</span><span class="top-name">${topData.topArtist}</span><span class="top-plays">${Number(topData.topArtistPlays||0).toLocaleString()} plays</span></div>` : ''}
                ${topData.topAlbum ? `<div class="top-row"><span class="top-label">Álbum</span><span class="top-name">${topData.topAlbum}</span><span class="top-plays">${Number(topData.topAlbumPlays||0).toLocaleString()} plays</span></div>` : ''}
                ${topData.topTrack ? `<div class="top-row"><span class="top-label">Faixa</span><span class="top-name">${topData.topTrack}</span><span class="top-plays">${Number(topData.topTrackPlays||0).toLocaleString()} plays</span></div>` : ''}
            </div>
        </div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `profile_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 600 });
    return tempPath;
}

async function generateStreakCard(streakData, theme, username) {
    const mainImg = streakData.image || 'https://i.imgur.com/To2300W.png';
    if (theme.dynamic && mainImg && !mainImg.includes('default')) {
        try {
            const response = await axios.get(mainImg, { responseType: 'arraybuffer' });
            const palette = await Vibrant.from(Buffer.from(response.data)).getPalette();
            const vibrant = palette.Vibrant || palette.LightVibrant || { hex: '#1db954' };
            const dark = palette.DarkMuted || palette.DarkVibrant || { hex: '#121212' };
            const light = palette.LightVibrant || palette.Vibrant || { hex: '#ffffff' };
            theme = { ...theme, cardBg: dark.hex, textColor: light.hex, subTextColor: adjustAlpha(light.hex, 0.7), accentColor: vibrant.hex, borderColor: adjustAlpha(vibrant.hex, 0.3), shadow: `0 8px 32px 0 ${adjustAlpha(dark.hex, 0.5)}` };
        } catch (e) { }
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        body { margin:0;padding:0;width:600px;height:400px;font-family:${theme.fontFamily||"'Inter',sans-serif"};background:#000;color:${theme.textColor};display:flex;align-items:center;justify-content:center;overflow:hidden; }
        .bg { position:absolute;top:-50px;left:-50px;width:120%;height:120%;background-image:url('${mainImg}');background-size:cover;background-position:center;filter:blur(50px) brightness(0.35);z-index:0; }
        .container { position:relative;z-index:1;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:40px;box-sizing:border-box;background:rgba(0,0,0,0.25); }
        .streak-header { font-size:12px;text-transform:uppercase;letter-spacing:2px;color:${theme.subTextColor};font-weight:700;margin-bottom:10px; }
        .streak-main { display:flex;align-items:center;gap:25px;margin-bottom:25px; }
        .streak-art { width:100px;height:100px;border-radius:16px;object-fit:cover;box-shadow:0 8px 25px rgba(0,0,0,0.5);border:2px solid ${theme.accentColor}; }
        .streak-info h1 { font-size:40px;font-weight:800;margin:0;line-height:1; }
        .streak-info h1 span { font-size:16px;color:${theme.subTextColor};font-weight:600; }
        .streak-info p { font-size:15px;color:${theme.subTextColor};margin:6px 0 0;font-weight:600; }
        .streak-rows { display:flex;gap:20px;width:100%; }
        .sr { flex:1;background:${adjustAlpha(theme.cardBg,0.6)};backdrop-filter:blur(10px);border:1px solid ${theme.borderColor};border-radius:12px;padding:12px;text-align:center; }
        .sr-val { font-size:20px;font-weight:800;color:${theme.textColor}; }
        .sr-label { font-size:9px;color:${theme.subTextColor};text-transform:uppercase;letter-spacing:1px;margin-top:3px;font-weight:600; }
        .user-tag { font-size:11px;color:${theme.subTextColor};margin-top:20px;font-weight:600; }
    </style></head><body>
        <div class="bg"></div>
        <div class="container">
            <div class="streak-header">STREAK ATUAL</div>
            <div class="streak-main">
                <img src="${mainImg}" class="streak-art" crossorigin="anonymous" onerror="this.src='https://i.imgur.com/To2300W.png'">
                <div class="streak-info">
                    <h1>${streakData.trackStreak} <span>plays seguidos</span></h1>
                    <p>${streakData.trackName} — ${streakData.artistName}</p>
                </div>
            </div>
            <div class="streak-rows">
                <div class="sr"><div class="sr-val">${streakData.artistStreak}</div><div class="sr-label">Artista seguido</div></div>
                <div class="sr"><div class="sr-val">${streakData.albumStreak}</div><div class="sr-label">Álbum seguido</div></div>
                <div class="sr"><div class="sr-val">${streakData.trackStreak}</div><div class="sr-label">Faixa seguida</div></div>
            </div>
            <div class="user-tag">${username}</div>
        </div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `streak_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 400 });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  🧊 ICEBERG CARD
// ═══════════════════════════════════════════════════════════
async function generateIcebergCard(layers, username, theme) {
    const layerColors = [
        { bg: 'rgba(135, 206, 250, 0.9)', label: 'Mainstream' },
        { bg: 'rgba(100, 180, 230, 0.85)', label: 'Popular' },
        { bg: 'rgba(60, 140, 200, 0.8)', label: 'Conhecido' },
        { bg: 'rgba(30, 100, 170, 0.75)', label: 'Nicho' },
        { bg: 'rgba(15, 60, 130, 0.7)', label: 'Underground' },
        { bg: 'rgba(5, 30, 80, 0.8)', label: 'Obscuro' }
    ];

    const layerHeight = 100;
    const totalHeight = 80 + (layers.length * layerHeight) + 60;

    const layersHtml = layers.map((layer, i) => {
        const color = layerColors[Math.min(i, layerColors.length - 1)];
        const artists = layer.artists.map(a => 
            `<span class="artist-tag">${a.name} <small>(${Number(a.playcount).toLocaleString('pt-BR')})</small></span>`
        ).join('');
        
        // Iceberg shape: wider at top, narrower at bottom
        const widthPct = 100 - (i * 8);
        const clipLeft = (100 - widthPct) / 2;
        
        return `<div class="layer" style="background:${color.bg}; width:${widthPct}%; margin:0 auto;">
            <div class="layer-label">${color.label}</div>
            <div class="layer-artists">${artists}</div>
        </div>`;
    }).join('');

    const accentLine = theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 650px; height: ${totalHeight}px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: linear-gradient(180deg, #87CEEB 0%, #1a3a5c 40%, #0a1628 100%); overflow: hidden; }
        .header { text-align: center; padding: 20px 20px 10px; }
        .title { font-size: 18px; font-weight: 700; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
        .subtitle { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px; }
        .layers { padding: 0 10px; }
        .layer { border-radius: 8px; padding: 10px 15px; margin-bottom: 4px; min-height: 80px; display: flex; flex-direction: column; justify-content: center; backdrop-filter: blur(5px); }
        .layer-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
        .layer-artists { display: flex; flex-wrap: wrap; gap: 4px; }
        .artist-tag { font-size: 11px; color: #fff; background: rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 12px; white-space: nowrap; }
        .artist-tag small { opacity: 0.6; font-size: 9px; }
        .user-tag { text-align: center; padding: 10px; font-size: 11px; color: rgba(255,255,255,0.5); }
    </style></head><body>
        <div class="header">
            <div class="title">🧊 ICEBERG</div>
            <div class="subtitle">Profundidade musical de ${username}</div>
        </div>
        <div class="layers">${layersHtml}</div>
        <div class="user-tag">${username} • last.fm</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `iceberg_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 650, height: totalHeight });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  🔍 DISCOVERY CARD
// ═══════════════════════════════════════════════════════════
async function generateDiscoveryCard(artists, username, theme) {
    const itemsHtml = artists.slice(0, 10).map((a, i) => {
        const imgUrl = a.image || '';
        const imgBlock = imgUrl ? `<img src="${imgUrl}" class="art-img"/>` : `<div class="art-img placeholder">${a.name[0]}</div>`;
        return `<div class="item">
            <div class="rank">${i + 1}</div>
            ${imgBlock}
            <div class="info">
                <div class="name">${a.name}</div>
                <div class="detail">${Number(a.playcount).toLocaleString('pt-BR')} scrobbles</div>
            </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 600px; height: 800px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .header { padding: 25px 25px 15px; border-bottom: 1px solid ${adjustAlpha(theme.borderColor || '#333', 0.3)}; }
        .title { font-size: 18px; font-weight: 700; color: ${theme.textColor || '#fff'}; }
        .subtitle { font-size: 12px; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; margin-top: 4px; }
        .list { padding: 10px 25px; }
        .item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${adjustAlpha(theme.borderColor || '#333', 0.1)}; }
        .rank { font-size: 14px; font-weight: 700; color: ${theme.subTextColor || 'rgba(255,255,255,0.4)'}; width: 20px; text-align: center; }
        .art-img { width: 45px; height: 45px; border-radius: 50%; object-fit: cover; }
        .placeholder { background: ${adjustAlpha(theme.textColor || '#fff', 0.1)}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: ${theme.textColor || '#fff'}; }
        .info { flex: 1; min-width: 0; }
        .name { font-size: 14px; font-weight: 600; color: ${theme.textColor || '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .detail { font-size: 11px; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; margin-top: 2px; }
        .accent-bar { height: 3px; background: ${theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954'}; }
        .user-tag { text-align: center; padding: 15px; font-size: 11px; color: ${theme.subTextColor || 'rgba(255,255,255,0.4)'}; }
    </style></head><body>
        <div class="accent-bar"></div>
        <div class="header">
            <div class="title">🔍 DESCOBERTAS</div>
            <div class="subtitle">Artistas novos de ${username}</div>
        </div>
        <div class="list">${itemsHtml}</div>
        <div class="user-tag">${username} • last.fm</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `discovery_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 800 });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  🎵 TASTE COMPARISON CARD
// ═══════════════════════════════════════════════════════════
async function generateTasteCard(user1, user2, commonArtists, score, theme) {
    const artistsHtml = commonArtists.slice(0, 8).map(a => {
        const imgBlock = a.image ? `<img src="${a.image}" class="taste-img"/>` : `<div class="taste-img placeholder">${a.name[0]}</div>`;
        return `<div class="taste-item">
            ${imgBlock}
            <div class="taste-info">
                <div class="taste-name">${a.name}</div>
                <div class="taste-plays">${user1.name}: ${a.plays1} • ${user2.name}: ${a.plays2}</div>
            </div>
        </div>`;
    }).join('');

    const scoreColor = score >= 75 ? '#4CAF50' : score >= 50 ? '#FFC107' : score >= 25 ? '#FF9800' : '#F44336';
    const scoreLabel = score >= 75 ? 'Super compatíveis!' : score >= 50 ? 'Gosto parecido' : score >= 25 ? 'Alguma coisa em comum' : 'Gostos bem diferentes';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 600px; height: 700px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .header { display: flex; align-items: center; justify-content: center; gap: 20px; padding: 25px; }
        .user-block { text-align: center; }
        .user-name { font-size: 13px; font-weight: 600; color: ${theme.textColor || '#fff'}; margin-top: 6px; }
        .vs { font-size: 24px; font-weight: 800; color: ${theme.subTextColor || 'rgba(255,255,255,0.3)'}; }
        .score-section { text-align: center; padding: 10px 25px 15px; }
        .score-bar-bg { height: 8px; background: ${adjustAlpha(theme.borderColor || '#333', 0.2)}; border-radius: 4px; margin: 8px 40px; }
        .score-bar { height: 100%; border-radius: 4px; background: ${scoreColor}; width: ${score}%; }
        .score-value { font-size: 36px; font-weight: 800; color: ${scoreColor}; }
        .score-label { font-size: 12px; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; margin-top: 4px; }
        .common-title { font-size: 12px; font-weight: 700; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; padding: 0 25px 8px; text-transform: uppercase; letter-spacing: 1px; }
        .taste-list { padding: 0 25px; }
        .taste-item { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid ${adjustAlpha(theme.borderColor || '#333', 0.1)}; }
        .taste-img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
        .placeholder { background: ${adjustAlpha(theme.textColor || '#fff', 0.1)}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: ${theme.textColor || '#fff'}; }
        .taste-info { flex: 1; min-width: 0; }
        .taste-name { font-size: 13px; font-weight: 600; color: ${theme.textColor || '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .taste-plays { font-size: 10px; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; }
        .accent-bar { height: 3px; background: ${theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954'}; }
    </style></head><body>
        <div class="accent-bar"></div>
        <div class="header">
            <div class="user-block"><div class="user-name">${user1.name}</div></div>
            <div class="vs">VS</div>
            <div class="user-block"><div class="user-name">${user2.name}</div></div>
        </div>
        <div class="score-section">
            <div class="score-value">${score}%</div>
            <div class="score-label">${scoreLabel}</div>
            <div class="score-bar-bg"><div class="score-bar"></div></div>
        </div>
        <div class="common-title">Artistas em comum (${commonArtists.length})</div>
        <div class="taste-list">${artistsHtml}</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `taste_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 700 });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  🏆 WHO KNOWS CARD
// ═══════════════════════════════════════════════════════════
async function generateWhoKnowsCard(artistName, artistImage, listeners, theme) {
    const medals = ['🥇', '🥈', '🥉'];
    const listHtml = listeners.slice(0, 12).map((l, i) => {
        const medal = i < 3 ? medals[i] : `<span class="rank-num">${i + 1}</span>`;
        const barWidth = listeners[0]?.playcount ? Math.max(5, (l.playcount / listeners[0].playcount) * 100) : 50;
        return `<div class="wk-item">
            <div class="wk-rank">${medal}</div>
            <div class="wk-info">
                <div class="wk-name">${l.displayName || l.username}</div>
                <div class="wk-bar-bg"><div class="wk-bar" style="width:${barWidth}%"></div></div>
            </div>
            <div class="wk-plays">${Number(l.playcount).toLocaleString('pt-BR')}</div>
        </div>`;
    }).join('');

    const imgBlock = artistImage ? `<img src="${artistImage}" class="wk-artist-img"/>` : '';
    const totalHeight = 140 + Math.min(12, listeners.length) * 46;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 600px; height: ${totalHeight}px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .header { display: flex; align-items: center; gap: 15px; padding: 20px 25px; border-bottom: 1px solid ${adjustAlpha(theme.borderColor || '#333', 0.2)}; }
        .wk-artist-img { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid ${adjustAlpha(theme.borderColor || '#fff', 0.3)}; }
        .header-info { flex: 1; }
        .header-title { font-size: 11px; font-weight: 700; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; text-transform: uppercase; letter-spacing: 1px; }
        .artist-name { font-size: 20px; font-weight: 800; color: ${theme.textColor || '#fff'}; margin-top: 2px; }
        .wk-list { padding: 10px 25px; }
        .wk-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
        .wk-rank { width: 28px; text-align: center; font-size: 16px; }
        .rank-num { font-size: 13px; font-weight: 600; color: ${theme.subTextColor || 'rgba(255,255,255,0.4)'}; }
        .wk-info { flex: 1; min-width: 0; }
        .wk-name { font-size: 13px; font-weight: 600; color: ${theme.textColor || '#fff'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
        .wk-bar-bg { height: 4px; background: ${adjustAlpha(theme.borderColor || '#333', 0.15)}; border-radius: 2px; }
        .wk-bar { height: 100%; border-radius: 2px; background: ${theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954'}; }
        .wk-plays { font-size: 12px; font-weight: 700; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; min-width: 50px; text-align: right; }
        .accent-bar { height: 3px; background: ${theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954'}; }
    </style></head><body>
        <div class="accent-bar"></div>
        <div class="header">
            ${imgBlock}
            <div class="header-info">
                <div class="header-title">Who Knows?</div>
                <div class="artist-name">${artistName}</div>
            </div>
        </div>
        <div class="wk-list">${listHtml}</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `whoknows_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: totalHeight });
    return tempPath;
}

// ═══════════════════════════════════════════════════════════
//  📅 YEAR CARD
// ═══════════════════════════════════════════════════════════
async function generateYearCard(yearData, username, year, theme) {
    const { scrobbles, topArtists, topAlbums, topTracks } = yearData;

    const topArtistsHtml = topArtists.slice(0, 5).map((a, i) =>
        `<div class="yr-item"><span class="yr-rank">${i + 1}.</span> <span class="yr-name">${a.name}</span> <span class="yr-count">${Number(a.playcount).toLocaleString('pt-BR')}</span></div>`
    ).join('');

    const topAlbumsHtml = topAlbums.slice(0, 5).map((a, i) =>
        `<div class="yr-item"><span class="yr-rank">${i + 1}.</span> <span class="yr-name">${a.name} — ${a.artist?.name || ''}</span> <span class="yr-count">${Number(a.playcount).toLocaleString('pt-BR')}</span></div>`
    ).join('');

    const topTracksHtml = topTracks.slice(0, 5).map((a, i) =>
        `<div class="yr-item"><span class="yr-rank">${i + 1}.</span> <span class="yr-name">${a.name} — ${a.artist?.name || ''}</span> <span class="yr-count">${Number(a.playcount).toLocaleString('pt-BR')}</span></div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 600px; height: 900px; font-family: ${theme.fontFamily || "'Inter', sans-serif"}; background: ${theme.cardBg || '#121212'}; overflow: hidden; }
        .accent-bar { height: 3px; background: ${theme.accentColor?.includes('gradient') ? theme.accentColor : theme.accentColor || '#1db954'}; }
        .header { text-align: center; padding: 25px 20px 15px; }
        .year-num { font-size: 48px; font-weight: 800; color: ${theme.textColor || '#fff'}; line-height: 1; }
        .header-sub { font-size: 12px; color: ${theme.subTextColor || 'rgba(255,255,255,0.6)'}; margin-top: 6px; }
        .scrobble-count { font-size: 28px; font-weight: 800; color: ${theme.textColor || '#fff'}; text-align: center; margin: 5px 0; }
        .scrobble-label { font-size: 11px; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; text-align: center; }
        .section { padding: 12px 25px 5px; }
        .section-title { font-size: 11px; font-weight: 700; color: ${theme.subTextColor || 'rgba(255,255,255,0.4)'}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid ${adjustAlpha(theme.borderColor || '#333', 0.2)}; padding-bottom: 5px; }
        .yr-item { display: flex; align-items: center; gap: 4px; padding: 3px 0; font-size: 12px; color: ${theme.textColor || '#fff'}; }
        .yr-rank { color: ${theme.subTextColor || 'rgba(255,255,255,0.4)'}; font-weight: 600; min-width: 20px; }
        .yr-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .yr-count { font-size: 11px; color: ${theme.subTextColor || 'rgba(255,255,255,0.5)'}; font-weight: 600; }
        .user-tag { text-align: center; padding: 15px; font-size: 11px; color: ${theme.subTextColor || 'rgba(255,255,255,0.3)'}; }
    </style></head><body>
        <div class="accent-bar"></div>
        <div class="header">
            <div class="year-num">${year}</div>
            <div class="header-sub">${username}'s Year in Music</div>
        </div>
        <div class="scrobble-count">${Number(scrobbles).toLocaleString('pt-BR')}</div>
        <div class="scrobble-label">scrobbles</div>
        <div class="section">
            <div class="section-title">🎤 Top Artistas</div>
            ${topArtistsHtml}
        </div>
        <div class="section">
            <div class="section-title">💿 Top Álbuns</div>
            ${topAlbumsHtml}
        </div>
        <div class="section">
            <div class="section-title">🎵 Top Faixas</div>
            ${topTracksHtml}
        </div>
        <div class="user-tag">${username} • last.fm</div>
    </body></html>`;

    const tempPath = path.join(__dirname, '..', '..', 'temp', `year_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 900 });
    return tempPath;
}

module.exports = { generateNPCard, generateTopTracksCard, generateLyricsCard, generateChartCard, generateArtistChartCard, generateTopArtistsCard, generateTopAlbumsCard, generateReceiptCard, generateProfileCard, generateStreakCard, generateIcebergCard, generateDiscoveryCard, generateTasteCard, generateWhoKnowsCard, generateYearCard, adjustAlpha };

