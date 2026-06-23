
const themes = {
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

module.exports = themes;
