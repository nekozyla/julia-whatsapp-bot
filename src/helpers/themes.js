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
        shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
        fontFamily: "'Inter', sans-serif"
    },
    'liquid': {
        name: 'Liquid Glass',
        cardBg: 'rgba(255, 255, 255, 0.25)',
        textColor: '#ffffff',
        subTextColor: 'rgba(255, 255, 255, 0.9)',
        accentColor: 'linear-gradient(135deg, #8EC5FC, #E0C3FC)',
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        fontFamily: "'Poppins', sans-serif"
    },
    'neon': {
        name: 'Neon Green',
        cardBg: 'rgba(0, 0, 0, 0.7)',
        textColor: '#0f0',
        subTextColor: '#0f0',
        accentColor: 'linear-gradient(90deg, #0f0, #00ff00)',
        borderColor: '#0f0',
        shadow: '0 0 20px rgba(0, 255, 0, 0.3)',
        fontFamily: "'Inter', sans-serif"
    },
    'roxo': {
        name: 'Roxo Neon',
        cardBg: 'rgba(20, 0, 40, 0.8)',
        textColor: '#d000ff',
        subTextColor: '#e055ff',
        accentColor: 'linear-gradient(90deg, #bf00ff, #ff00ff)',
        borderColor: '#d000ff',
        shadow: '0 0 20px rgba(180, 0, 255, 0.4)',
        fontFamily: "'Inter', sans-serif"
    },
    'lilas': {
        name: 'Lilás Soft',
        cardBg: 'rgba(245, 240, 255, 0.8)',
        textColor: '#6a5acd',
        subTextColor: 'rgba(106, 90, 205, 0.8)',
        accentColor: 'linear-gradient(90deg, #b0c4de, #dda0dd)',
        borderColor: '#ffffff',
        shadow: '0 8px 32px 0 rgba(200, 190, 220, 0.5)',
        fontFamily: "'Inter', sans-serif"
    },
    'redwhite': {
        name: 'Vermelho e Branco',
        cardBg: 'rgba(255, 255, 255, 0.9)',
        textColor: '#b30000',
        subTextColor: 'rgba(179, 0, 0, 0.7)',
        accentColor: 'linear-gradient(90deg, #ff0000, #ff4d4d)',
        borderColor: '#ff0000',
        shadow: '0 8px 32px 0 rgba(255, 0, 0, 0.2)',
        fontFamily: "'Inter', sans-serif",
        backgroundImage: 'snow'
    },
    'pink': {
        name: 'Pink Vibe',
        cardBg: 'rgba(50, 0, 20, 0.6)',
        textColor: '#ffb6c1',
        subTextColor: 'rgba(255, 182, 193, 0.8)',
        accentColor: 'linear-gradient(90deg, #ff69b4, #ff1493)',
        borderColor: 'rgba(255, 105, 180, 0.3)',
        shadow: '0 8px 32px 0 rgba(100, 0, 50, 0.3)',
        fontFamily: "'Inter', sans-serif"
    },
    'blue': {
        name: 'Deep Blue',
        cardBg: 'rgba(0, 20, 60, 0.6)',
        textColor: '#87ceeb',
        subTextColor: 'rgba(135, 206, 235, 0.8)',
        accentColor: 'linear-gradient(90deg, #00bfff, #1e90ff)',
        borderColor: 'rgba(0, 191, 255, 0.3)',
        shadow: '0 8px 32px 0 rgba(0, 50, 100, 0.3)',
        fontFamily: "'Inter', sans-serif"
    },
    'skeuo': {
        name: 'iOS 6 Legacy',
        cardBg: '#2b2b2b',
        textColor: '#fff',
        subTextColor: '#ccc',
        accentColor: 'linear-gradient(180deg, #51a7f9 0%, #007bf7 100%)',
        borderColor: '#000',
        shadow: '0 10px 40px rgba(0,0,0,0.6)',
        fontFamily: "'Inter', sans-serif"
    },
    'lcd': {
        name: 'GameBoy Classic',
        cardBg: '#c0c0c0',
        screenBg: '#8bac0f',
        textColor: '#0f380f',
        subTextColor: '#306230',
        accentColor: '#306230',
        borderColor: '#0f380f',
        shadow: '10px 10px 20px rgba(0,0,0,0.4)',
        fontFamily: "'Press Start 2P', cursive",
        statusColor: '#0f380f',
        statusBg: 'rgba(15, 56, 15, 0.1)'
    },
    'dynamic': {
        name: 'Dynamic (Album Art)',
        cardBg: '#121212',
        textColor: '#ffffff',
        subTextColor: 'rgba(255,255,255,0.7)',
        accentColor: '#1db954',
        borderColor: 'rgba(255,255,255,0.1)',
        shadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        fontFamily: "'Inter', sans-serif",
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
    },
    'custom_html': {
        name: 'Custom HTML',
        cardBg: 'transparent',
        textColor: '#ffffff',
        borderColor: 'transparent',
        shadow: 'none',
        fontFamily: "'Inter', sans-serif"
    }
};

module.exports = themes;
