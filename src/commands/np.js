
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config/config.js');
const SpotifyWebApi = require('spotify-web-api-node');
const Vibrant = require('node-vibrant');
const { generateImage } = require('../helpers/imageGenerator');
const profileManager = require('../managers/profileManager');


const nicknamesFilePath = path.join(__dirname, '..', '..', 'data', 'np_users.json');
const tokensFilePath = path.join(__dirname, '..', '..', 'data', 'spotify_tokens.json');
const settingsFilePath = path.join(__dirname, '..', '..', 'data', 'np_settings.json');
const dirtTexturePath = path.join(__dirname, '..', 'assets', 'dirt.jpg');
const snowTexturePath = path.join(__dirname, '..', 'assets', 'snow.jpg');


let userNicknames = {};
let spotifyTokens = {};
let userSettings = {};
let lyricsCache = {}; 
let minecraftDirtBase64 = ''; 
let snowBase64 = ''; 


const themes = {
    'default': {
        name: 'Default (Dark Glass)',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        textColor: '#fff',
        subTextColor: 'rgba(255, 255, 255, 0.8)',
        accentColor: 'linear-gradient(90deg, #1db954, #1ed760)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        fontFamily: "'Inter', sans-serif"
    },
    'light': {
        name: 'Light Glass',
        cardBg: 'rgba(255, 255, 255, 0.6)',
        textColor: '#000',
        subTextColor: 'rgba(0, 0, 0, 0.7)',
        accentColor: 'linear-gradient(90deg, #1db954, #1ed760)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)'
    },
    'neon': {
        name: 'Neon Green',
        cardBg: 'rgba(0, 0, 0, 0.7)',
        textColor: '#0f0',
        subTextColor: '#0f0',
        accentColor: 'linear-gradient(90deg, #0f0, #00ff00)',
        borderColor: '#0f0',
        shadow: '0 0 20px rgba(0, 255, 0, 0.3)'
    },
    'roxo': {
        name: 'Roxo Neon',
        cardBg: 'rgba(20, 0, 40, 0.8)',
        textColor: '#d000ff',
        subTextColor: '#e055ff',
        accentColor: 'linear-gradient(90deg, #bf00ff, #ff00ff)',
        borderColor: '#d000ff',
        shadow: '0 0 20px rgba(180, 0, 255, 0.4)'
    },
    'lilas': {
        name: 'Lilás Soft',
        cardBg: 'rgba(245, 240, 255, 0.8)',
        textColor: '#6a5acd',
        subTextColor: 'rgba(106, 90, 205, 0.8)',
        accentColor: 'linear-gradient(90deg, #b0c4de, #dda0dd)',
        borderColor: '#ffffff',
        shadow: '0 8px 32px 0 rgba(200, 190, 220, 0.5)'
    },
    'redwhite': {
        name: 'Vermelho e Branco',
        cardBg: 'rgba(255, 255, 255, 0.9)',
        textColor: '#b30000',
        subTextColor: 'rgba(179, 0, 0, 0.7)',
        accentColor: 'linear-gradient(90deg, #ff0000, #ff4d4d)',
        borderColor: '#ff0000',
        accentColor: 'linear-gradient(90deg, #ff0000, #ff4d4d)',
        borderColor: '#ff0000',
        shadow: '0 8px 32px 0 rgba(255, 0, 0, 0.2)',
        backgroundImage: 'snow'
    },
    'pink': {
        name: 'Pink Vibe',
        cardBg: 'rgba(50, 0, 20, 0.6)',
        textColor: '#ffb6c1',
        subTextColor: 'rgba(255, 182, 193, 0.8)',
        accentColor: 'linear-gradient(90deg, #ff69b4, #ff1493)',
        borderColor: 'rgba(255, 105, 180, 0.3)',
        shadow: '0 8px 32px 0 rgba(100, 0, 50, 0.3)'
    },
    'blue': {
        name: 'Deep Blue',
        cardBg: 'rgba(0, 20, 60, 0.6)',
        textColor: '#87ceeb',
        subTextColor: 'rgba(135, 206, 235, 0.8)',
        accentColor: 'linear-gradient(90deg, #00bfff, #1e90ff)',
        borderColor: 'rgba(0, 191, 255, 0.3)',
        shadow: '0 8px 32px 0 rgba(0, 50, 100, 0.3)'
    },
    'skeuo': {
        name: 'iPod Classic',
        cardBg: 'linear-gradient(180deg, #f2f2f2 0%, #dcdcdc 100%)', 
        textColor: '#333',
        subTextColor: '#666',
        accentColor: 'linear-gradient(180deg, #5cacfc 0%, #4294f0 50%, #2b7ce6 51%, #65b0ff 100%)', 
        borderColor: '#b0b0b0',
        shadow: 'inset 1px 1px 2px white, 10px 10px 30px rgba(0,0,0,0.3)',
        fontFamily: "'Inter', sans-serif"
    },
    'lcd': {
        name: 'Retro LCD',
        
        cardBg: '#d0cfc5',
        
        screenBg: '#879a6d',
        textColor: '#1a2016',
        subTextColor: 'rgba(26, 32, 22, 0.75)',
        accentColor: '#1a2016',
        borderColor: '#9ca48e',
        
        shadow: 'inset 4px 4px 10px rgba(0,0,0,0.2), 10px 10px 30px rgba(0,0,0,0.4)',
        fontFamily: "'Press Start 2P', cursive",
        statusColor: '#1a2016',
        statusBg: 'rgba(26, 32, 22, 0.1)'
    },
    'dynamic': {
        name: 'Dynamic (Album Art)',
        cardBg: '#121212', 
        textColor: '#ffffff',
        subTextColor: 'rgba(255,255,255,0.7)',
        accentColor: '#1db954',
        borderColor: 'rgba(255,255,255,0.1)',
        shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        dynamic: true 
    },
    'minecraft': {
        name: 'Minecraft',
        type: 'minecraft',
        cardBg: '#c6c6c6',
        textColor: '#3f3f3f',
        subTextColor: '#3f3f3f',
        accentColor: '#80ff00', 
        borderColor: '#ffffff #555555 #555555 #ffffff', 
        shadow: '10px 10px 0px rgba(0,0,0,0.5)',
        fontFamily: "'Press Start 2P', cursive",
        statusColor: '#3f3f3f',
        statusBg: '#c6c6c6'
    }
};


async function loadData() {
    try {
        await fs.mkdir(path.dirname(nicknamesFilePath), { recursive: true });
        const nickData = await fs.readFile(nicknamesFilePath, 'utf-8');
        userNicknames = JSON.parse(nickData);
    } catch (e) { userNicknames = {}; }

    try {
        const tokenData = await fs.readFile(tokensFilePath, 'utf-8');
        spotifyTokens = JSON.parse(tokenData);
    } catch (e) { spotifyTokens = {}; }

    try {
        const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
        userSettings = JSON.parse(settingsData);
    } catch (e) { userSettings = {}; }

    try {
        const dirtData = await fs.readFile(dirtTexturePath);
        minecraftDirtBase64 = `data:image/jpeg;base64,${dirtData.toString('base64')}`;
    } catch (e) { console.error("Error loading dirt texture:", e.message); }

    try {
        const snowData = await fs.readFile(snowTexturePath);
        snowBase64 = `data:image/jpeg;base64,${snowData.toString('base64')}`;
    } catch (e) { console.error("Error loading snow texture:", e.message); }
}
loadData();

async function saveNicknames() {
    await fs.writeFile(nicknamesFilePath, JSON.stringify(userNicknames, null, 2));
}

async function saveSettings() {
    await fs.writeFile(settingsFilePath, JSON.stringify(userSettings, null, 2));
}


const { getSpotifyData } = require('../helpers/spotifyHelper');


const { getLyrics } = require('../helpers/lyricsHelper');


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




async function generateNPCard(track, user, username, theme = themes['default']) {

    
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
                padding: 35px; /* Middle ground padding */
                box-sizing: border-box;
                z-index: 1;
                background: rgba(0, 0, 0, 0.4);
            }

            /* Snowflake Overlay */
            ${theme.snow ? `
            .snow-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%23ffcccc'%3E%3Cpath d='M12 0L10 4H14L12 0ZM12 24L10 20H14L12 24Z'/%3E%3Cpath d='M0 12L4 10V14L0 12ZM24 12L20 10V14L24 12Z'/%3E%3Cpath d='M3.5 3.5L6.5 6.5L6.5 3.5L3.5 3.5Z'/%3E%3Cpath d='M20.5 3.5L17.5 6.5L20.5 6.5L20.5 3.5Z'/%3E%3Cpath d='M3.5 20.5L6.5 17.5L3.5 17.5L3.5 20.5Z'/%3E%3Cpath d='M20.5 20.5L17.5 17.5L20.5 17.5L20.5 20.5Z'/%3E%3C/g%3E%3C/svg%3E");
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

            /* Blurred Background */
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

            /* Minecraft Background Override */
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

            /* Custom Background Override */
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
                /* If LCD theme, add pixel grid overlay */
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
                
                /* Outer casing for LCD */
                ${theme.screenBg ? `
                    position: relative;
                ` : 'position: relative;'}
                
                /* Minecraft Card Style */
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
            
            /* LCD Theme: Hide the blurry background art */
            ${theme.screenBg ? `
            .background {
                display: none;
            }
            ` : ''}

            /* Add an outer container for the device bezel if needed, but for now we put it on the card-content's border/outline relative to container */
            ${theme.screenBg ? `
            .container {
                background: ${theme.cardBg}; 
                border-radius: 0; 
                padding: 40px;
                box-shadow: inset 10px 10px 50px rgba(0,0,0,0.1);
            }
            ` : ''}

            .album-art {
                width: 230px; /* Middle ground size */
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
                font-size: 26px; /* Middle ground font size */
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
                /* Fix for cut-off shadows: Add padding to contain the shadow */
                padding-bottom: 10px;
                margin-bottom: -4px; 
                padding-left: 2px;
                padding-right: 2px;
            }

            h2 {
                font-size: 17px; /* Middle ground font size */
                color: ${theme.subTextColor};
                margin: 0 0 25px 0; /* Increased margin to prevent overlap */
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
                margin-bottom: 25px; /* Increased margin */
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
                margin: 0 8px; /* Slightly tighter margins */
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
                width: 40%;
                border-radius: 10px;
                box-shadow: 0 0 10px rgba(29, 185, 84, 0.5);
                
                ${theme.type === 'minecraft' ? `
                    border-radius: 0;
                    box-shadow: none;
                    background: linear-gradient(to bottom, #80ff00 50%, #4da600 50%); 
                    position: relative;
                ` : ''}
            }
            
            /* XP Bar Dividers Overlay */
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

            /* Logo top right */
            .logo-icon {
                position: absolute;
                top: 25px;
                right: 25px;
                opacity: 0.9;
                width: 24px;
                height: 24px;
            }

            /* Snowflake Overlay */
            ${theme.snow ? `
            .snow-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%23ffcccc'%3E%3Cpath d='M12 0L10 4H14L12 0ZM12 24L10 20H14L12 24Z'/%3E%3Cpath d='M0 12L4 10V14L0 12ZM24 12L20 10V14L24 12Z'/%3E%3Cpath d='M3.5 3.5L6.5 6.5L6.5 3.5L3.5 3.5Z'/%3E%3Cpath d='M20.5 3.5L17.5 6.5L20.5 6.5L20.5 3.5Z'/%3E%3Cpath d='M3.5 20.5L6.5 17.5L3.5 17.5L3.5 20.5Z'/%3E%3Cpath d='M20.5 20.5L17.5 17.5L20.5 17.5L20.5 20.5Z'/%3E%3C/g%3E%3C/svg%3E");
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

        </style>
    </head>
    <body>
        <div class="background"></div>
        <div class="container">
            ${theme.snow ? '<div class="snow-overlay"></div>' : ''}
            <div class="card-content">
                <!-- Spotify Icon SVG Top Right -->
                <svg class="logo-icon" viewBox="0 0 24 24" fill="${theme.textColor}">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z"/>
                </svg>

                <img src="${track.image}" class="album-art" crossorigin="anonymous" onerror="this.src='https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2?v=v2'"/>
                
                <div class="info">
                    <div class="status-badge">
                        ${track.nowPlaying ?
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="${theme.statusColor || '#1db954'}"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg> <span>LISTENING NOW</span>` :
            `<svg width="10" height="10" viewBox="0 0 24 24" fill="#aaa"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg> <span>LAST PLAYED</span>`
        }
                    </div>
                    
                    <h1>${track.name}</h1>
                    <h2>${track.artist}</h2>

                    <div class="progress-container">
                        <span class="timestamp">1:24</span>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill"></div>
                        </div>
                        <span class="timestamp">3:45</span>
                    </div>

                    <div class="user-row">
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

    
    const tempPath = path.join(__dirname, '..', '..', 'temp', `np_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 600 });
    return tempPath;
}

async function generateTopTracksCard(tracks, periodTitle, username, theme = themes['default']) {

    
    
    if (theme.dynamic && tracks.length > 0) {
        
        const artUrl = tracks[0].spotifyImage || tracks[0].image.find(i => i.size === 'extralarge')?.['#text'];

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
                margin: 0;
                padding: 0;
                width: 600px;
                height: 800px; /* Taller for list */
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
                padding: 30px;
                box-sizing: border-box;
                z-index: 1;
                background: rgba(0, 0, 0, 0.4);
            }

            .background {
                position: absolute;
                top: -50px;
                left: -50px;
                width: 120%;
                height: 120%;
                /* Use top track art as background */
                background-image: url('${mainArt}');
                background-size: cover;
                background-position: center;
                filter: blur(50px) brightness(0.4) saturate(1.2);
                z-index: 0;
            }

            .card-content {
                display: flex;
                flex-direction: column;
                align-items: center;
                width: 100%;
                height: 100%;
                background: ${theme.screenBg ? theme.screenBg : theme.cardBg};
                /* If LCD theme, add pixel grid overlay */
                ${theme.screenBg ? `
                    background-image: 
                        linear-gradient(${theme.screenBg} 100%, transparent 0),
                        linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.05) 95%),
                        linear-gradient(transparent 95%, rgba(0,0,0,0.05) 95%);
                    background-size: 100% 100%, 3px 3px, 3px 3px;
                    border: 8px solid ${theme.cardBg};
                ` : ''}

                border-radius: ${theme.screenBg ? '10px' : '32px'};
                padding: ${theme.screenBg ? '25px' : '40px'};
                box-sizing: border-box;
                box-shadow: ${theme.shadow};
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: ${theme.screenBg ? 'none' : `1px solid ${theme.borderColor}`};
                position: relative;
                z-index: 2;
            }

            /* LCD Theme: Hide the blurry background art */
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

            h1 {
                font-size: 28px;
                font-weight: ${theme.screenBg ? '400' : '800'};
                margin: 0 0 5px 0;
                text-align: center;
                color: ${theme.textColor};
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            h2 {
                font-size: 16px;
                font-weight: ${theme.screenBg ? '400' : '600'};
                margin: 0 0 30px 0;
                color: ${theme.subTextColor};
                text-align: center;
            }

            .track-list {
                width: 100%;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .track-item {
                display: flex;
                align-items: center;
                width: 100%;
                border-bottom: 1px solid ${theme.borderColor};
                padding-bottom: 8px;
            }
            .track-item:last-child {
                border-bottom: none;
            }

            .rank {
                font-size: 20px;
                font-weight: ${theme.screenBg ? '400' : '800'};
                color: ${theme.textColor};
                width: 35px;
                opacity: 0.8;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }

            .art-small {
                width: 45px;
                height: 45px;
                border-radius: 8px;
                margin-right: 15px;
                object-fit: cover;
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }

            .track-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                overflow: hidden;
            }

            .track-name {
                font-size: 16px;
                font-weight: ${theme.screenBg ? '400' : '700'};
                color: ${theme.textColor};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .artist-name {
                font-size: 13px;
                font-weight: ${theme.screenBg ? '400' : '500'};
                color: ${theme.subTextColor};
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .scrobbles {
                font-size: 12px;
                font-weight: ${theme.screenBg ? '400' : '600'};
                color: ${theme.textColor};
                background: ${theme.statusBg};
                padding: 4px 10px;
                border-radius: 20px;
                border: 1px solid ${theme.statusColor};
                white-space: nowrap;
            }

        </style>
    </head>
    <body>
        <div class="background"></div>
        <div class="container">
            <div class="card-content">
                <h1>TOP MÚSICAS</h1>
                <h2>${periodTitle} • ${username}</h2>

                <div class="track-list">
                    ${tracks.slice(0, 8).map((t, i) => `
                        <div class="track-item">
                            <span class="rank">#${i + 1}</span>
                            <img src="${getArt(t)}" class="art-small" crossorigin="anonymous" onerror="this.src='https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2?v=v2'">
                            <div class="track-info">
                                <span class="track-name">${t.name}</span>
                                <span class="artist-name">${t.artist.name}</span>
                                ${t.spotifyAlbum ? `<span class="album-name" style="font-size: 11px; opacity: 0.7; color: ${theme.subTextColor}">${t.spotifyAlbum}</span>` : ''}
                            </div>
                            <span class="scrobbles">🎧 ${t.playcount}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    
    const tempPath = path.join(__dirname, '..', '..', 'temp', `top_${Date.now()}.png`);
    await generateImage(html, tempPath, {}, { width: 600, height: 800 });
    return tempPath;
}



async function generateLyricsCard(track, user, username, text, theme = themes['default'], scrobbles = '0', userProfilePic = null) {
    
    
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
        } catch (e) { }
    }

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=720, height=1280, initial-scale=1">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&family=Caveat:wght@700&display=swap');
            
            * {
                box-sizing: border-box;
            }

            html, body {
                margin: 0;
                padding: 0;
                width: 100vw;
                height: 100vh;
                background-color: #000;
                overflow: hidden;
            }

            body {
                font-family: ${theme.fontFamily || "'Inter', sans-serif"};
                color: ${theme.textColor};
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }

            /* --- BACKGROUND LAYER --- */
            .background-layer {
                position: fixed; /* Ensures it covers the screen even if flow changes */
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('${track.image}');
                background-size: cover;
                background-position: center;
                filter: brightness(0.65); 
                z-index: 0;
            }
            
            ${theme.customBackground ? `
            .background-layer {
                background-image: url('${theme.customBackground}');
            }
            ` : ''}

            ${theme.type === 'minecraft' ? `
            .background-layer {
                background-image: url('${minecraftDirtBase64}');
                background-size: 64px;
                background-repeat: repeat;
                filter: none;
                opacity: 1;
            }
            ` : ''}
            
            ${theme.screenBg ? `
            .background-layer { 
                 background: ${theme.cardBg}; 
                 filter: none;
                 background-image: none;
            }
            ` : ''}

            /* --- FLOATING CARD BOX --- */
            .floating-card {
                position: relative;
                z-index: 2;
                width: 580px;
                min-height: 600px;
                max-height: 1000px;
                
                /* Force transparency on cardBg */
                background: ${theme.screenBg ? theme.screenBg : adjustAlpha(theme.cardBg, 0.5)}; 
                
                border-radius: 32px;
                padding: 50px;
                box-sizing: border-box;
                
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                
                box-shadow: 0 30px 60px rgba(0,0,0,0.6);
                
                /* Border logic */
                ${theme.type !== 'minecraft' && !theme.screenBg ? `border: 1px solid ${theme.borderColor || 'rgba(255,255,255,0.2)'};` : ''}
                ${theme.type === 'minecraft' ? `
                    border: 6px solid #fff; 
                    background: rgba(0,0,0,0.6); 
                    border-radius: 0; 
                    box-shadow: 15px 15px 0 #000;
                ` : ''}
                
                backdrop-filter: blur(25px);
            }

            /* LCD Screen Pattern */
            ${theme.screenBg ? `
            .floating-card {
                 background-image: 
                    linear-gradient(${theme.screenBg} 100%, transparent 0),
                    linear-gradient(90deg, transparent 95%, rgba(0,0,0,0.05) 95%),
                    linear-gradient(transparent 95%, rgba(0,0,0,0.05) 95%);
                background-size: 100% 100%, 3px 3px, 3px 3px;
                border: none;
                box-shadow: inset 5px 5px 15px rgba(0,0,0,0.3);
                border-radius: 12px;
            }
            ` : ''}

            /* --- HEADER --- */
            .header {
                display: flex;
                align-items: center;
                width: 100%;
                margin-bottom: 30px;
                border-bottom: 1px solid ${adjustAlpha(theme.textColor, 0.1)};
                padding-bottom: 25px;
            }

            .album-art {
                width: 70px;
                height: 70px;
                border-radius: 16px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                object-fit: cover;
                margin-right: 20px;
                border: 2px solid ${theme.accentColor};

                ${theme.type === 'minecraft' ? `
                    border-radius: 0;
                    border: 2px solid #fff;
                    box-shadow: none;
                ` : ''}
            }

            .track-meta {
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .song-title {
                font-size: 22px;
                font-weight: 800;
                color: ${theme.textColor};
                margin-bottom: 6px;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                
                ${theme.textShadow ? `text-shadow: ${theme.textShadow};` : ''}
            }

            .song-detail {
                font-size: 15px;
                font-weight: 600;
                color: ${theme.accentColor}; 
                text-transform: uppercase;
                letter-spacing: 1.5px;
            }

            /* --- BODY --- */
            .lyrics-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center; 
                width: 100%;
                margin: 20px 0;
            }

            .quote-mark {
                font-size: 80px;
                line-height: 0;
                color: ${theme.accentColor};
                opacity: 0.3;
                margin-bottom: 40px;
                font-family: serif;
                
                ${theme.type === 'minecraft' ? 'font-family: "Press Start 2P";' : ''}
            }

            .lyrics-text {
                font-family: ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? "'Press Start 2P', cursive" : "'Inter', sans-serif"};
                font-size: ${text.length > 150 ? '28px' : '36px'};
                font-weight: ${theme.type === 'minecraft' ? '400' : '700'};
                font-style: ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? 'normal' : 'italic'};
                line-height: 1.5;
                color: ${theme.textColor};
                white-space: pre-wrap;
                text-align: left;
                
                 display: -webkit-box;
                -webkit-line-clamp: 10;
                -webkit-box-orient: vertical;
                overflow: hidden;
                
                ${theme.name.toLowerCase().includes('neon') ? `text-shadow: 0 0 10px ${theme.textColor};` : 'text-shadow: 0 2px 10px rgba(0,0,0,0.2);'}
            }

            /* --- FOOTER --- */
            .footer {
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: flex-end; 
                margin-top: 30px;
            }

            .user-tag {
                font-size: 14px;
                font-weight: 600;
                color: ${theme.subTextColor};
                background: ${adjustAlpha(theme.textColor, 0.1)};
                padding: 10px 20px;
                border-radius: 30px;
                display: flex;
                align-items: center;
                gap: 10px;
                
                ${theme.type === 'minecraft' || theme.name === 'Retro LCD' ? 'border-radius: 0;' : ''}
            }
            
            .user-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid ${theme.accentColor};
                
                 ${theme.type === 'minecraft' ? 'border-radius: 0;' : ''}
            }

            .scrobble-count {
                opacity: 0.8;
                font-size: 12px;
                margin-left: 6px;
                border-left: 1px solid ${adjustAlpha(theme.textColor, 0.3)};
                padding-left: 10px;
            }

            .scrobble-icon {
                width: 10px;
                height: 10px;
                background: ${theme.statusColor || theme.accentColor};
                border-radius: 50%;
                animation: pulse 2s infinite;
                
                ${theme.type === 'minecraft' ? 'border-radius: 0;' : ''}
            }

            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
            }

        </style>
    </head>
    <body>
        <div class="background-layer"></div>
        <div class="floating-card">
            
            <!-- HEADER -->
            <div class="header">
                <img src="${track.image}" class="album-art" crossorigin="anonymous">
                <div class="track-meta">
                    <span class="song-title">${track.name}</span>
                    <span class="song-detail">${track.artist}</span>
                </div>
            </div>

            <!-- BODY -->
            <div class="lyrics-body">
                <div class="quote-mark">“</div>
                <div class="lyrics-text">${text}</div>
            </div>

            <!-- FOOTER -->
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


async function handleMatch(sock, msg, msgDetails) {
    const { sender, commandSenderJid, commandText, mentions = [] } = msgDetails;

    let targetJid = mentions[0];
    if (!targetJid) {
        await sock.sendMessage(sender, { text: "Mencione alguém para ver o *match* musical! Ex: `/ np match @usuario`" }, { quoted: msg });
        return;
    }

    const user1 = userNicknames[commandSenderJid];
    const user2 = userNicknames[targetJid];

    if (!user1 || !user2) {
        await sock.sendMessage(sender, {
            text: "Ambos precisam ter o Last.fm configurado com `/np set`."
        }, { quoted: msg });
        return;
    }

    try {
        const [res1, res2] = await Promise.all([
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${user1}&period=12month&limit=20&api_key=${config.LASTFM_API_KEY}&format=json`),
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${user2}&period=12month&limit=20&api_key=${config.LASTFM_API_KEY}&format=json`)
        ]);

        const artists1 = res1.data.topartists.artist.map(a => a.name);
        const artists2 = res2.data.topartists.artist.map(a => a.name);

        const common = artists1.filter(a => artists2.includes(a));
        const score = Math.round((common.length / 20) * 100);

        let msgMatch = `*🎵 Musical Match 🎵*\n\n`;
        msgMatch += `👤 *${user1}* ✖️ *${user2}* 👤\n`;
        msgMatch += `🔥 Compatibilidade: *${score}%*\n\n`;

        if (common.length > 0) {
            msgMatch += `🎨 *Artistas em comum:*\n${common.slice(0, 5).join(', ')}`;
            if (common.length > 5) msgMatch += ` e mais ${common.length - 5}...`;
        } else {
            msgMatch += "💔 *Sem artistas em comum no Top 20.*";
        }

        await sock.sendMessage(sender, { text: msgMatch }, { quoted: msg });

    } catch (e) {
        console.error("[Match Error]", e.response?.data || e.message);
        await sock.sendMessage(sender, { text: `Erro ao calcular match: ${e.message}` }, { quoted: msg });
    }
}


async function handleTopTracks(sock, msg, msgDetails, period) {
    const { sender, commandSenderJid } = msgDetails;
    const username = userNicknames[commandSenderJid];

    if (!username) {
        return sock.sendMessage(sender, { text: "Use `/np set <nick>` para configurar seu Last.fm primeiro." }, { quoted: msg });
    }

    const periodMap = {
        'semana': '7day',
        'mes': '1month',
        'ano': '12month',
        'geral': 'overall'
    };

    const periodApi = periodMap[period] || '7day';
    const titleMap = {
        'semana': 'da Semana',
        'mes': 'do Mês',
        'ano': 'do Ano',
        'geral': 'de Todos os Tempos'
    };

    try {
        const { data } = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&period=${periodApi}&limit=10&api_key=${config.LASTFM_API_KEY}&format=json`);

        const tracks = data.toptracks.track;
        if (!tracks || tracks.length === 0) {
            return sock.sendMessage(sender, { text: "Nenhuma música encontrada para este período." }, { quoted: msg });
        }

        
        
        const top8 = tracks.slice(0, 8);
        const enrichedTracks = await Promise.all(top8.map(async (t) => {
            const spData = await getSpotifyData(t.name, t.artist.name, commandSenderJid);
            return {
                ...t,
                spotifyImage: spData?.image,
                spotifyAlbum: spData?.album
            };
        }));

        const userThemeKey = userSettings[commandSenderJid]?.theme || 'default';
        const userTheme = themes[userThemeKey] || themes['default'];

        const cardPath = await generateTopTracksCard(enrichedTracks, titleMap[period] || 'Geral', username, userTheme);

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: `🏆 *Top Músicas - ${titleMap[period] || 'Geral'}*`
        }, { quoted: msg });

        setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);

    } catch (e) {
        console.error("[TopTracks Error]", e.message);
        await sock.sendMessage(sender, { text: "Erro ao buscar top músicas." }, { quoted: msg });
    }
}


async function handleTheme(sock, msg, msgDetails, args) {
    const { sender, commandSenderJid } = msgDetails;
    const requestedTheme = args[1]?.toLowerCase();

    if (!requestedTheme) {
        
        let themeList = `🎨 *Temas do Now Playing* 🎨\n\n`;
        Object.keys(themes).forEach(key => {
            const t = themes[key];
            themeList += `• *${key}*: ${t.name}\n`;
        });
        themeList += `• *custom*: Customizado (Defina com /perfil tema custom)\n`;
        themeList += `\nUso: \`/np tema <nome>\` (Ex: \`/np tema neon\`)`;
        return sock.sendMessage(sender, { text: themeList }, { quoted: msg });
    }

    if (themes[requestedTheme] || requestedTheme === 'custom') {
        
        if (!userSettings[commandSenderJid]) userSettings[commandSenderJid] = {};
        userSettings[commandSenderJid].theme = requestedTheme;
        await saveSettings();
        const themeName = requestedTheme === 'custom' ? 'Customizado' : themes[requestedTheme].name;
        return sock.sendMessage(sender, { text: `✅ Tema definido como: *${themeName}*` }, { quoted: msg });
    } else {
        return sock.sendMessage(sender, { text: "❌ Tema não encontrado. Use `/np tema` para ver a lista." }, { quoted: msg });
    }
}


async function handleBackground(sock, msg, msgDetails) {
    const { sender, commandSenderJid } = msgDetails;
    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

    
    const messageType = Object.keys(msg.message)[0];
    const isImage = messageType === 'imageMessage';
    const isQuotedImage = messageType === 'extendedTextMessage' && msg.message.extendedTextMessage.contextInfo?.quotedMessage?.imageMessage;

    let targetMessage = null;

    if (isImage) {
        targetMessage = msg;
    } else if (isQuotedImage) {
        
        
        
        targetMessage = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
    } else {
        return sock.sendMessage(sender, { text: "❌ Envie ou marque uma imagem com `/np bg` para definir o fundo do tema Custom." }, { quoted: msg });
    }

    try {
        
        const imageMessage = targetMessage.message.imageMessage;
        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        if (buffer.length > 0) {
            const success = await profileManager.setCustomBackground(commandSenderJid, buffer);
            if (success) {
                
                
                if (!userSettings[commandSenderJid]) userSettings[commandSenderJid] = {};
                userSettings[commandSenderJid].theme = 'custom';
                await saveSettings();

                return sock.sendMessage(sender, { text: "✅ Fundo customizado atualizado! Tema alterado para *Custom*." }, { quoted: msg });
            } else {
                return sock.sendMessage(sender, { text: "❌ Erro ao salvar o fundo." }, { quoted: msg });
            }
        }
    } catch (e) {
        console.error("Error downloading media:", e);
        return sock.sendMessage(sender, { text: "❌ Erro ao baixar a imagem." }, { quoted: msg });
    }
}


module.exports = async (sock, msg, msgDetails) => {
    const { sender, commandText, commandSenderJid } = msgDetails;
    const args = commandText.split(' ').slice(1);
    const subCommand = args[0]?.toLowerCase();

    
    if (subCommand === 'set') {
        const nickname = args[1];
        if (!nickname) {
            return sock.sendMessage(sender, { text: "Uso: `/np set <user_lastfm>`" }, { quoted: msg });
        }
        userNicknames[commandSenderJid] = nickname;
        await saveNicknames();
        return sock.sendMessage(sender, { text: `✅ Nick salvo: *${nickname}*` }, { quoted: msg });
    }

    
    if (subCommand === 'tema' || subCommand === 'theme') {
        return handleTheme(sock, msg, msgDetails, args);
    }

    
    if (subCommand === 'match') {
        return handleMatch(sock, msg, msgDetails);
    }

    
    if (subCommand === 'background' || subCommand === 'bg' || subCommand === 'fundo') {
        return handleBackground(sock, msg, msgDetails);
    }

    
    if (['semana', 'mes', 'ano', 'geral'].includes(subCommand)) {
        return handleTopTracks(sock, msg, msgDetails, subCommand);
    }

    
    if (subCommand === 'lyric' || subCommand === 'letra') {
        const username = userNicknames[commandSenderJid];
        if (!username) return sock.sendMessage(sender, { text: "Configure seu Last.fm primeiro!" }, { quoted: msg });

        try {
            const resentRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
            const track = resentRes.data.recenttracks.track[0];
            const name = track.name;
            const artist = track.artist['#text'];

            await sock.sendMessage(sender, { text: `🔎 Buscando letra de *${name}* - *${artist}*...` }, { quoted: msg });
            const lyrics = await getLyrics(name, artist);

            if (lyrics) {
                
                const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                lyricsCache[commandSenderJid] = { name, artist, lines };

                
                const numberedLyrics = lines.map((line, index) => `*${index + 1}.* ${line}`).join('\n');

                return sock.sendMessage(sender, { text: `📄 *Letra: ${name}*\n\n${numberedLyrics}\n\n💡 *Dica:* Use \`/np trecho 1-3\` para criar um card com essas linhas!` }, { quoted: msg });
            } else {
                return sock.sendMessage(sender, { text: "❌ Letra não encontrada." }, { quoted: msg });
            }
        } catch (e) {
            return sock.sendMessage(sender, { text: "Erro ao buscar música atual." }, { quoted: msg });
        }
    }

    
    if (subCommand === 'quote' || subCommand === 'trecho' || subCommand === 'citar') {
        const username = userNicknames[commandSenderJid];
        if (!username) return sock.sendMessage(sender, { text: "Configure seu Last.fm primeiro com `/np set`!" }, { quoted: msg });

        let quoteText = args.slice(1).join(' ');
        let isRange = false;

        
        const rangeMatch = quoteText ? quoteText.match(/^(\d+)(?:-(\d+))?$/) : null;

        if (rangeMatch) {
            
            const cached = lyricsCache[commandSenderJid];
            if (!cached) {
                return sock.sendMessage(sender, { text: "❌ Nenhuma letra carregada. Use `/np lyric` primeiro para carregar a letra e ver os números das linhas." }, { quoted: msg });
            }

            const start = parseInt(rangeMatch[1]) - 1; 
            
            let sliceEnd;
            if (rangeMatch[2]) {
                sliceEnd = parseInt(rangeMatch[2]); 
            } else {
                sliceEnd = start + 1; 
            }

            
            if (start < 0 || start >= cached.lines.length) {
                return sock.sendMessage(sender, { text: `❌ Linha ${start + 1} inválida. A letra tem ${cached.lines.length} linhas.` }, { quoted: msg });
            }

            if (sliceEnd > cached.lines.length) {
                return sock.sendMessage(sender, { text: `❌ Intervalo inválido. A letra tem ${cached.lines.length} linhas.` }, { quoted: msg });
            }

            if (start >= sliceEnd) {
                return sock.sendMessage(sender, { text: `❌ Intervalo inválido.` }, { quoted: msg });
            }

            const selectedLines = cached.lines.slice(start, sliceEnd);
            quoteText = selectedLines.join('\n');
            isRange = true;
        }

        
        if (!quoteText) {
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg && quotedMsg.conversation) {
                quoteText = quotedMsg.conversation;
            } else if (quotedMsg && quotedMsg.extendedTextMessage) {
                quoteText = quotedMsg.extendedTextMessage.text;
            }
        }

        if (!quoteText) {
            return sock.sendMessage(sender, { text: `❌ Digite o trecho (ex: \`eu te amo\`) ou o intervalo de linhas (ex: \`1-4\`) se ja tiver usado /np lyric.` }, { quoted: msg });
        }

        try {
            await sock.sendMessage(sender, { react: { text: '🎨', key: msg.key } });

            
            let trackName, trackArtist;

            if (isRange && lyricsCache[commandSenderJid]) {
                trackName = lyricsCache[commandSenderJid].name;
                trackArtist = lyricsCache[commandSenderJid].artist;
            } else {
                
                const { data } = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`);
                const trackData = data.recenttracks.track[0];
                if (!trackData) return sock.sendMessage(sender, { text: "Nenhuma música encontrada." }, { quoted: msg });
                trackName = trackData.name;
                trackArtist = trackData.artist['#text'];
            }

            
            const spotifyData = await getSpotifyData(trackName, trackArtist, commandSenderJid);
            const image = spotifyData?.image || 'https://i.imgur.com/To2300W.png';

            const track = {
                name: trackName,
                artist: trackArtist,
                image: image
            };

            
            const userThemeKey = userSettings[commandSenderJid]?.theme || 'default';
            let userTheme = themes[userThemeKey] || themes['default'];

            
            if (userThemeKey === 'custom') {
                const customData = profileManager.getCustomTheme(commandSenderJid);
                if (customData && customData.backgroundPath) {
                    try {
                        const bgData = await fs.readFile(customData.backgroundPath);
                        userTheme = {
                            ...themes['default'],
                            name: 'Custom',
                            cardBg: customData.colors.cardBg,
                            textColor: customData.colors.textColor,
                            subTextColor: customData.colors.subTextColor,
                            accentColor: customData.colors.accentColor,
                            borderColor: customData.colors.borderColor,
                            customBackground: `data:image/jpeg;base64,${bgData.toString('base64')}`
                        };
                    } catch (e) { }
                }
            }

            
            let scrobbles = '0';
            try {
                const trackInfo = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${config.LASTFM_API_KEY}&artist=${encodeURIComponent(trackArtist)}&track=${encodeURIComponent(trackName)}&username=${username}&format=json`);
                if (trackInfo.data?.track?.userplaycount) {
                    scrobbles = trackInfo.data.track.userplaycount;
                }
            } catch (e) {
                console.log('Error fetching track info for scrobbles:', e.message);
            }

            
            let userProfilePic = null;
            try {
                userProfilePic = await sock.profilePictureUrl(commandSenderJid, 'image');
            } catch (e) {
                
            }

            const cardPath = await generateLyricsCard(track, {}, username, quoteText, userTheme, scrobbles, userProfilePic);

            await sock.sendMessage(sender, {
                image: { url: cardPath },
                caption: `❝ ${quoteText} ❞`
            }, { quoted: msg });

            setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);
            return;

        } catch (e) {
            console.error(e);
            return sock.sendMessage(sender, { text: "Erro ao gerar card de citaçao." }, { quoted: msg });
        }
    }

    
    let targetUser = subCommand && !['semana', 'mes', 'ano'].includes(subCommand) ? subCommand : userNicknames[commandSenderJid];
    if (!targetUser) return sock.sendMessage(sender, { text: "Use `/np set <nick>` para configurar." }, { quoted: msg });

    try {
        await sock.sendMessage(sender, { react: { text: '🎵', key: msg.key } });

        const [recentRes, userRes] = await Promise.all([
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${targetUser}&api_key=${config.LASTFM_API_KEY}&format=json&limit=1`),
            axios.get(`https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${targetUser}&api_key=${config.LASTFM_API_KEY}&format=json`)
        ]);

        const trackData = recentRes.data.recenttracks.track[0];
        const userData = userRes.data.user;

        if (!trackData) return sock.sendMessage(sender, { text: "Nenhuma música encontrada." }, { quoted: msg });

        const track = {
            name: trackData.name,
            artist: trackData.artist['#text'],
            album: trackData.album['#text'],
            image: trackData.image.find(i => i.size === 'extralarge')['#text'] || 'https://i.imgur.com/To2300W.png',
            nowPlaying: trackData['@attr'] && trackData['@attr'].nowplaying === 'true'
        };

        const spotifyData = await getSpotifyData(track.name, track.artist, commandSenderJid);
        const spotifyLink = spotifyData?.link;

        
        if (spotifyData?.image) {
            track.image = spotifyData.image;
        } else if (track.image.includes('2sZ') || track.image.includes('To2300W')) {
            
            
        }

        
        let trackInfo = null;
        try {
            const trackInfoRes = await axios.get(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${config.LASTFM_API_KEY}&artist=${encodeURIComponent(track.artist)}&track=${encodeURIComponent(track.name)}&username=${targetUser}&format=json`);
            trackInfo = trackInfoRes.data.track;
        } catch (e) {  }

        
        let userProfilePic = userData.image.find(i => i.size === 'large')['#text']; 
        try {
            
            const targetJid = Object.keys(userNicknames).find(key => userNicknames[key]?.toLowerCase() === targetUser.toLowerCase());

            if (targetJid) {
                
                const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                if (ppUrl) userProfilePic = ppUrl;
            } else if (targetUser === userNicknames[commandSenderJid]) {
                
                const ppUrl = await sock.profilePictureUrl(commandSenderJid, 'image');
                if (ppUrl) userProfilePic = ppUrl;
            }
        } catch (e) {
            
            if (!userProfilePic) userProfilePic = 'https://i.imgur.com/6X2v6lX.png';
        }

        const userThemeKey = userSettings[commandSenderJid]?.theme || 'default';
        let userTheme = themes[userThemeKey] || themes['default'];

        if (userThemeKey === 'custom') {
            const customData = profileManager.getCustomTheme(commandSenderJid);
            if (customData && customData.backgroundPath) {
                try {
                    const bgData = await fs.readFile(customData.backgroundPath);
                    const customBgBase64 = `data:image/jpeg;base64,${bgData.toString('base64')}`;

                    userTheme = {
                        ...themes['default'],
                        name: 'Custom',
                        cardBg: customData.colors.cardBg,
                        textColor: customData.colors.textColor,
                        subTextColor: customData.colors.subTextColor,
                        accentColor: customData.colors.accentColor,
                        borderColor: customData.colors.borderColor,
                        customBackground: customBgBase64
                    };
                } catch (e) {
                    if (e.code !== 'ENOENT') {
                        console.error('[NP] Error loading custom theme:', e);
                    }
                    userTheme = themes['default'];
                }
            }
        }

        const cardPath = await generateNPCard(track, {
            image: userProfilePic || 'https://i.imgur.com/6X2v6lX.png',
            scrobbles: userData.playcount
        }, targetUser, userTheme);

        const status = track.nowPlaying ? '🎧 Ouvindo agora' : '⏮️ Última reprodução';

        let caption = `🎵 *${track.name}*\n🎤 *${track.artist}*\n💿 *${track.album}*\n\n`;

        if (trackInfo) {
            if (trackInfo.userplaycount) caption += `👤 Você ouviu: *${trackInfo.userplaycount}x*\n`;
            if (trackInfo.playcount) caption += `🌎 Scrobbles globais: *${Number(trackInfo.playcount).toLocaleString('pt-BR')}*\n`;
            if (trackInfo.toptags && trackInfo.toptags.tag.length > 0) {
                const tags = trackInfo.toptags.tag.slice(0, 3).map(t => t.name).join(', ');
                caption += `🏷️ Tags: *${tags}*\n`;
            }
            caption += `\n`;
        }

        caption += `${status}`;
        if (spotifyLink) caption += `\n🔗 ${spotifyLink}`;

        await sock.sendMessage(sender, {
            image: { url: cardPath },
            caption: caption
        }, { quoted: msg }); 

        
        setTimeout(() => fs.unlink(cardPath).catch(() => { }), 5000);

    } catch (e) {
        console.error(e);
        if (e.response?.data?.error === 6) {
            return sock.sendMessage(sender, { text: "Usuário não encontrado." }, { quoted: msg });
        }
        return sock.sendMessage(sender, { text: "Erro ao buscar dados do Last.fm." }, { quoted: msg });
    }
};


module.exports.commandData = {
    name: "np",
    description: "Mostra o que está ouvindo.",
    category: "diversao",
    usage: "/np",
    aliases: ["/lastfm", "/music", "/tocando"]
};
