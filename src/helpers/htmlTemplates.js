const profileCardTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            width: 600px;
            height: 600px;
            font-family: {{{theme.fontFamily}}};
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .card {
            width: 600px;
            height: 600px;
            background: {{theme.cardBg}};
            
            /* LCD / GameBoy Theme Support */
            {{#if theme.screenBg}}
            background-color: {{theme.cardBg}};
            border-radius: 0; /* Squared corners */
            box-shadow: inset -5px -5px 10px rgba(0,0,0,0.2), 5px 5px 15px rgba(0,0,0,0.5);
            padding: 0; /* Remove padding to lift screen */
            {{/if}}

            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            color: {{theme.textColor}};
            
            /* Minecraft Support */
            {{#if isMinecraft}}
            background-color: #000000;
            border: none;
            font-family: 'Press Start 2P', cursive;
            color: #404040;
            justify-content: center; /* Center the window vertically */
            {{/if}}
        }

        /* Ambient Glow/Background similar to NP card */

        .background-blur {
            position: absolute;
            top: -50px;
            left: -50px;
            width: 120%;
            height: 120%;
            background-image: url('{{avatarUrl}}');
            background-size: cover;
            background-position: center;
            filter: blur(50px) brightness(0.3) saturate(1.2);
            z-index: 0;
            opacity: 0.8;
            
            /* Hide blur for LCD */
            {{#if theme.screenBg}}display: none;{{/if}}
            
            /* Minecraft: Dirt Texture */
            {{#if isMinecraft}}
            display: block;
            filter: none;
            background-image: url('{{{dirtTexture}}}');
            background-size: 64px;
            background-repeat: repeat;
            image-rendering: pixelated;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            opacity: 0.3;
            {{/if}}
            
            /* iOS 6 Skeuomorphic Leather Texture */
            {{#if isSkeuo}}
            opacity: 1;
            filter: none;
            background-color: #4b4036;
            background-image: url('{{{leatherTexture}}}');
            background-size: 100% 100%;
            background-position: center;
            box-shadow: inset 0 0 100px rgba(0,0,0,0.7);
            /* Reset geometry to show full image */
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            {{/if}}

            /* Snow Background */
            {{#if snowTexture}}
            opacity: 0.8;
            filter: none;
            background-image: url('{{{snowTexture}}}');
            background-size: cover;
            background-position: center;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            {{/if}}

            /* Custom Background */
            {{#if theme.customBackground}}
            filter: none;
            background-image: url('{{{theme.customBackground}}}');
            background-size: cover;
            background-position: center;
            opacity: 0.6; /* Adjust opacity as needed */
            {{/if}}

        }

        
        /* Minecraft Background Override - Removed as we used .background-blur */

        .content-layer {
            z-index: 10;
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 40px;
            background: rgba(0,0,0,0.0);
            
            /* LCD / GameBoy Screen */
            {{#if theme.screenBg}}
            margin: 20px 40px 140px 40px; /* Reduced chin from 180px to 140px to prevent overflow */
            flex: 1;
            background: {{theme.screenBg}}; /* Green Screen */
            border: 30px solid #555; /* Grey Bezel */
            border-radius: 15px 15px 50px 15px;
            box-shadow: inset 3px 3px 10px rgba(0,0,0,0.4);
            padding: 15px; /* Compact padding */
            position: relative;
            
            /* Scanlines */
            background-image: linear-gradient(transparent 50%, rgba(0,0,0,0.05) 50%);
            background-size: 100% 4px;
            {{/if}}
            
            {{#if isMinecraft}}
            /* The Grey Window */
            margin: 25px; /* Reduced margin to optimize space */
            height: auto;
            flex: 0; /* Don't stretch */
            background: #C6C6C6;
            border-top: 4px solid #fff;
            border-left: 4px solid #fff;
            border-right: 4px solid #555;
            border-bottom: 4px solid #555;
            padding: 15px; /* Reduced padding */
            box-shadow: 6px 6px 0 rgba(0,0,0,0.5);
            image-rendering: pixelated;
            {{/if}}
            
            {{#if isSkeuo}}
            padding: 30px; /* Reduced from 50px */
            {{/if}}
        }
        
        /* Battery LED for GameBoy */
        {{#if theme.screenBg}}
        .content-layer::after {
            content: 'BATTERY';
            position: absolute;
            top: -20px; /* On the bezel */
            left: 10px;
            color: #888;
            font-size: 8px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        .content-layer::before {
            content: '';
            position: absolute;
            top: -22px;
            left: -15px; /* Adjust based on text */
            width: 8px;
            height: 8px;
            background: #f00; /* Red LED */
            border-radius: 50%;
            box-shadow: 0 0 5px #f00;
            transform: translateX(5px);
            /* Actually putting the dot before text */
            margin-right: 5px;
        }
        /* Adjusting pseudo elements is tricky with text content. 
           Let's use specific positioning.
        */
        .content-layer::before {
            left: 5px;
            top: -20px;
        }
        .content-layer::after {
            left: 20px;
            top: -22px;
        }
        {{/if}}

        /* Header: Avatar + Names */
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            {{#if isMinecraft}}margin-bottom: 15px;{{/if}}
            {{#if theme.screenBg}}margin-bottom: 10px;{{/if}}
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #f2f2f2 0%, #bebebe 100%);
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8);
            border: 1px solid #999;
            {{/if}}
        }

        .avatar-container {
            width: 130px;
            height: 130px;
            margin-right: 25px;
            position: relative;
            {{#if isMinecraft}}
            width: 100px; 
            height: 100px;
            margin-right: 15px;
            {{/if}}
            {{#if theme.screenBg}}
            width: 100px; 
            height: 100px;
            margin-right: 15px;
            {{/if}}
        }

        .avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid {{theme.borderColor}};
            box-shadow: 0 8px 20px rgba(0,0,0,0.5);
            
            {{#if theme.screenBg}}
            border-radius: 0;
            border: 4px solid {{theme.borderColor}};
            box-shadow: none;
            image-rendering: pixelated;
            {{/if}}
            
            {{#if isMinecraft}}
            border-radius: 0;
            border: 2px solid #555;
            border-bottom: 2px solid #fff;
            border-right: 2px solid #fff;
            border-top: 2px solid #373737;
            border-left: 2px solid #373737;
            image-rendering: pixelated;
            box-shadow: none;
            {{/if}}
            
            {{#if isSkeuo}}
            border: 4px solid #c0c0c0;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4), inset 0 2px 5px rgba(0,0,0,0.2);
            {{/if}}
        }

        .names-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .username {
            font-size: 36px;
            font-weight: 800;
            line-height: 1.1;
            color: {{theme.textColor}};
            text-shadow: 0 4px 10px rgba(0,0,0,0.3);
            margin-bottom: 4px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            width: 100%;
            
            {{#if isMinecraft}}
            font-family: 'Press Start 2P', cursive;
            font-size: 18px; /* Compact */
            color: #404040; /* Dark grey for visibility on light grey bg */
            text-shadow: none;
            line-height: 1.4;
            margin-bottom: 8px;
            {{/if}}
            
            {{#if isSkeuo}}
            color: #333; /* Dark text for light metal bg */
            text-shadow: 0 1px 0 rgba(255,255,255,0.8); /* Embossed look */
            padding-bottom: 5px; /* Prevent shadow clipping */
            {{/if}}
            
            {{#if theme.screenBg}}
            margin-bottom: 2px;
            line-height: 1;
            {{/if}}
        }

        .nickname {
            font-size: 18px;
            color: {{theme.subTextColor}};
            font-weight: 500;
            font-family: {{theme.fontFamily}}, sans-serif;
            {{#if isMinecraft}}
            font-family: 'Press Start 2P', cursive;
            font-size: 10px;
            color: #555;
            {{/if}}
            
            {{#if isSkeuo}}
            color: #555;
            text-shadow: 0 1px 0 rgba(255,255,255,0.8);
            {{/if}}
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 30px;
            {{#if isMinecraft}}margin-bottom: 15px; gap: 10px;{{/if}}
            {{#if theme.screenBg}}margin-bottom: 10px; gap: 8px;{{/if}}
        }

        .stat-box {
            background: {{#if theme.screenBg}}transparent{{else}}rgba(255, 255, 255, 0.08){{/if}};
            border: 1px solid {{theme.borderColor}};
            border-radius: {{#if isMinecraft}}0{{else}}16px{{/if}};
            padding: 15px 20px;
            display: flex;
            flex-direction: column;
            {{#if theme.screenBg}}border: none; padding: 10px 15px;{{/if}} 
            /* If not LCD, add backdrop */
            {{#unless theme.screenBg}}backdrop-filter: blur(10px);{{/unless}}
            
            {{#if isMinecraft}}
            background: #8b8b8b;
            border-right: 2px solid #fff;
            border-bottom: 2px solid #fff;
            border-left: 2px solid #373737;
            border-top: 2px solid #373737;
            box-shadow: inset 2px 2px 0 #000; /* Deep slot look */
            {{/if}}
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #e6e6e6, #bfbfbf);
            border-radius: 6px;
            border: 1px solid #999;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.8);
            /* Pseudo-screws */
            position: relative;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            {{/if}}
        }
        
        /* Screws for Skeuo Stats */
        {{#if isSkeuo}}
        .stat-box::after {
            content: '⊕';
            position: absolute;
            top: 2px;
            left: 2px;
            font-size: 8px;
            color: #888;
            text-shadow: 0 1px 0 rgba(255,255,255,0.8);
        }
        .stat-box::before {
            content: '⊕';
            position: absolute;
            bottom: 2px;
            right: 2px;
            font-size: 8px;
            color: #888;
            text-shadow: 0 1px 0 rgba(255,255,255,0.8);
        }
        {{/if}}

        .stat-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: {{theme.subTextColor}};
            margin-bottom: 6px;
            font-family: {{theme.fontFamily}}, sans-serif;
            {{#if isMinecraft}}
            font-family: 'Press Start 2P', cursive;
            color: #e0e0e0; 
            text-shadow: 1px 1px 0 #000; 
            font-weight: normal; 
            font-size: 8px;
            {{/if}}
            
            {{#if isSkeuo}}
            margin-bottom: 0;
            color: #555;
            text-shadow: 0 1px 0 #fff;
            font-weight: 700;
            font-size: 10px;
            {{/if}}
            
            {{#if theme.screenBg}}
            margin-bottom: 2px;
            {{/if}}
        }

        .stat-value {
            font-size: 22px;
            font-weight: 700;
            color: {{theme.textColor}};
            {{#if isMinecraft}}
            font-family: 'Press Start 2P', cursive;
            color: #ffffff; 
            text-shadow: 2px 2px 0 rgba(0,0,0,0.5); 
            font-size: 12px;
            line-height: 1.5;
            {{/if}}
            
            {{#if isSkeuo}}
            /* Black Glass Box */
            background: #000;
            background-image: linear-gradient(to bottom, #222 0%, #111 50%, #000 50%, #000 100%);
            color: #fff;
            padding: 5px 10px;
            border-radius: 4px;
            border: 1px solid #444;
            box-shadow: 0 1px 0 rgba(255,255,255,0.2), inset 0 2px 5px rgba(0,0,0,0.8);
            font-family: Helvetica, Arial, sans-serif; /* Cleaner */
            text-shadow: 0 0 5px rgba(255,255,255,0.5);
            font-size: 14px; /* Reduced from 18px */
            min-width: 60px;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            {{/if}}
        }
        
        .rank-value {
             color: {{#if isMinecraft}}#ffff55{{else}}#FCD34D{{/if}};
             {{#if isMinecraft}}text-shadow: 1px 1px 0 #3f3f00;{{/if}}
             {{#if isSkeuo}}color: #FCD34D;{{/if}}
        }

        /* Music / Activity Section */
        .music-section {
            margin-top: auto; /* Push to bottom */
            {{#if isMinecraft}}margin-top: 10px;{{/if}} /* Reduced gap for Minecraft */
            {{#if theme.screenBg}}margin-top: 5px;{{/if}}
            background: {{#if theme.screenBg}}transparent{{else}}rgba(0, 0, 0, 0.4){{/if}};
            border-radius: {{#if isMinecraft}}0{{else}}20px{{/if}};
            padding: 20px;
            {{#if theme.screenBg}}padding: 10px;{{/if}}
            display: flex;
            align-items: center;
            border: 1px solid {{theme.borderColor}};
            {{#unless theme.screenBg}}backdrop-filter: blur(10px);{{/unless}}
            
            {{#if theme.screenBg}}
            border: 2px solid {{theme.borderColor}};
            border-radius: 4px;
            {{/if}}
            
            {{#if isMinecraft}}
            background: #8b8b8b;
            border-right: 2px solid #fff;
            border-bottom: 2px solid #fff;
            border-left: 2px solid #373737;
            border-top: 2px solid #373737;
            box-shadow: inset 2px 2px 0 #000;
            border: none;
            {{/if}}
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #d9d9d9, #b3b3b3);
            border-radius: 8px;
            border: 1px solid #777;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.8);
            {{/if}}
        }

        .music-art {
            width: 70px;
            height: 70px;
            border-radius: 8px;
            object-fit: cover;
            background: #333;
            margin-right: 15px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            flex-shrink: 0;
            
            {{#if theme.screenBg}}
            border-radius: 0;
            box-shadow: none;
            border: 2px solid {{theme.borderColor}};
            image-rendering: pixelated;
            {{/if}}
            
            {{#if isMinecraft}}
            border-radius: 0;
            border: 2px solid #555;
            border-bottom: 2px solid #fff;
            border-right: 2px solid #fff;
            border-top: 2px solid #373737;
            border-left: 2px solid #373737;
            box-shadow: none;
            {{/if}}
            
            {{#if isSkeuo}}
            border-radius: 2px;
            border: 1px solid #333;
            box-shadow: 0 1px 3px rgba(0,0,0,0.6);
            {{/if}}
        }

        .music-info {
            flex: 1;
            overflow: hidden;
        }
        
        .music-status {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: {{#if isMinecraft}}#55ff55{{else}}#1DB954{{/if}}; /* Spotify Green (Brighter for MC) */
            font-weight: 700;
            margin-bottom: 4px;
            display:  flex;
            align-items: center;
            {{#if isMinecraft}}text-shadow: 1px 1px 0 #000;{{/if}}
        }
        
        .music-status svg {
            width: 12px;
            height: 12px;
            margin-right: 4px;
            fill: {{#if isMinecraft}}#55ff55{{else}}#1DB954{{/if}};
        }

        .track-name {
            font-size: 16px;
            font-weight: 700;
            color: {{theme.textColor}};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
            {{#if isMinecraft}}color: #ffffff; font-size: 14px; text-shadow: 1px 1px 0 rgba(0,0,0,0.5);{{/if}}
            
            {{#if isSkeuo}}
            /* Green Glossy Button for Track */
            background: linear-gradient(to bottom, #86d67e, #4caf50);
            border: 1px solid #26801c;
            border-radius: 4px;
            padding: 4px 12px;
            color: #fff;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.2);
            font-size: 14px;
            display: inline-block;
            margin-bottom: 4px;
            width: 100%;
            text-align: center;
            {{/if}}
        }

        .artist-name {
            font-size: 14px;
            color: {{theme.subTextColor}};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            {{#if isMinecraft}}font-size: 10px; color: #dddddd; text-shadow: 1px 1px 0 #000; font-weight: normal;{{/if}}
            
            {{#if isSkeuo}}
            /* Green Glossy Button for Artist */
            background: linear-gradient(to bottom, #86d67e, #4caf50);
            border: 1px solid #26801c;
            border-radius: 4px;
            padding: 2px 12px;
            color: #fff;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.2);
            font-size: 12px;
            display: inline-block;
            width: 100%;
            text-align: center;
            font-weight: 600;
            {{/if}}
        }

        /* Badges row inline */
        .badges-row {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .badge {
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 20px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: rgba(255,255,255,0.15);
            color: #fff;
            backdrop-filter: blur(5px);
            white-space: nowrap;
        }
        
        .badge-admin {
            background: rgba(139, 92, 246, 0.3);
            color: #ddd6fe;
            border: 1px solid rgba(139, 92, 246, 0.4);
            
            {{#if isSkeuo}}
            /* Admin pill style */
            background: linear-gradient(to bottom, #a0a0a0, #707070);
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 10px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3);
            border: 1px solid #555;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            {{/if}}
        }

        .badge-dev {
            background: rgba(6, 182, 212, 0.3); /* Cyan */
            color: #a5f3fc;
            border: 1px solid rgba(6, 182, 212, 0.4);
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #00bfff, #009acd);
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 10px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3);
            border: 1px solid #00688b;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            {{/if}}
        }

        .badge-spouse {
            background: rgba(236, 72, 153, 0.3);
            color: #fbcfe8;
            border: 1px solid rgba(236, 72, 153, 0.4);
            display: flex;
            align-items: center;
        }
        
        .spouse-heart {
            margin-right: 4px;
            font-size: 12px;
        }

        /* Decoration circles */
        .deco-circle {
            position: absolute;
            border-radius: 50%;
            border: 1px solid rgba(255,255,255,0.05);
            z-index: 1;
        }
        .c1 { width: 400px; height: 400px; top: -100px; right: -100px; }
        .c2 { width: 300px; height: 300px; bottom: 50px; left: -80px; }

        /* Snowflake Overlay */
        .snow-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='%23ffcccc'%3E%3Cpath d='M12 0L10 4H14L12 0ZM12 24L10 20H14L12 24Z'/%3E%3Cpath d='M0 12L4 10V14L0 12ZM24 12L20 10V14L24 12Z'/%3E%3Cpath d='M3.5 3.5L6.5 6.5L6.5 3.5L3.5 3.5Z'/%3E%3Cpath d='M20.5 3.5L17.5 6.5L20.5 6.5L20.5 3.5Z'/%3E%3Cpath d='M3.5 20.5L6.5 17.5L3.5 17.5L3.5 20.5Z'/%3E%3Cpath d='M20.5 20.5L17.5 17.5L20.5 17.5L20.5 20.5Z'/%3E%3C/g%3E%3C/svg%3E");
            opacity: 0.6;
            z-index: 5; /* Above background, below content if content is higher */
            pointer-events: none;
            animation: snow 20s linear infinite;
        }
        @keyframes snow {
            from { background-position: 0 0; }
            to { background-position: 48px 48px; }
        }


        .bio-section {
            font-size: 15px;
            color: {{theme.subTextColor}};
            margin-bottom: 25px;
            {{#if isMinecraft}}margin-bottom: 15px;{{/if}}
            {{#if theme.screenBg}}margin-bottom: 10px; font-size: 10px;{{/if}}
            text-align: left;
            font-style: italic;
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            padding: 10px 15px;
            border-radius: 8px;
            border-left: 3px solid {{theme.accentColor}};
            line-height: 1.4;
            
            {{#if isMinecraft}}
            font-family: 'Press Start 2P', cursive;
            font-size: 10px;
            color: #ddd;
            background: rgba(0,0,0,0.3);
            border: none;
            border-left: 2px solid #fff;
            text-shadow: 1px 1px 0 #000;
            font-style: normal;
            {{/if}}
            
             {{#if isSkeuo}}
            background: #fdfdfd; 
            border: 1px solid #aaa;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);
            color: #333;
            font-style: normal;
            font-family: "Courier New", Courier, monospace;
            border-left: none;
            background-image: linear-gradient(#fdfdfd 0%, #f0f0f0 100%);
            {{/if}}

            {{#if theme.customBackground}}
            background: rgba(0, 0, 0, 0.6);
            color: #ffffff;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            font-weight: 500;
            border: 1px solid rgba(255,255,255,0.1);
            {{/if}}
        }



        .donation-box {
            background: linear-gradient(135deg, #FFD700, #FDB931);
            color: #5c3a00;
            padding: 6px 12px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.4);
            border: 1px solid #eec95e;
            margin-left: 10px;
            position: absolute;
            top: 25px;
            right: 25px;
            z-index: 20;
            
            {{#if theme.screenBg}}
            position: static;
            background: transparent;
            border: 2px solid {{theme.textColor}};
            box-shadow: none;
            color: {{theme.textColor}};
            border-radius: 4px;
            margin-top: 0;
            padding: 4px 8px;
            {{/if}}
            
            {{#if isMinecraft}}
            background: #FFD700;
            color: #000;
            border: 2px solid #fff;
            border-bottom: 2px solid #b8860b;
            border-right: 2px solid #b8860b;
            border-radius: 0;
            box-shadow: 4px 4px 0 rgba(0,0,0,0.5);
            font-family: 'Press Start 2P', cursive;
            top: 15px;
            right: 15px;
            padding: 8px;
            {{/if}}
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #fffbed 0%, #ffd700 100%);
            border: 1px solid #b8860b;
            color: #5c3a00;
            text-shadow: 0 1px 0 rgba(255,255,255,0.5);
            box-shadow: 0 2px 5px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.8);
            border-radius: 6px;
            {{/if}}
        }
        
        .donation-icon {
            font-size: 14px;
            {{#if isMinecraft}}font-size: 10px;{{/if}}
        }
        
        .donation-info {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            line-height: 1;
        }
        
        .donation-label {
            font-size: 7px;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 0.5px;
            opacity: 0.8;
            margin-bottom: 2px;
            {{#if isMinecraft}}font-size: 6px; display: none;{{/if}} /* Hide label in MC for cleaner look */
        }
        
        .donation-amount {
            font-size: 12px;
            font-weight: 800;
            {{#if isMinecraft}}font-size: 10px;{{/if}}
        }

    </style>
</head>
<body>
    <div class="card">
        <div class="background-blur"></div>
        {{#if theme.snow}}
        <div class="snow-overlay"></div>
        {{/if}}
        <div class="deco-circle c1"></div>
        <div class="deco-circle c2"></div>
        
        <div class="content-layer">
            
            <div class="header">
                <div class="avatar-container">
                    <img src="{{avatarUrl}}" class="avatar" onerror="this.src='https://telegra.ph/file/24fa902ead26340f3df2c.png'">
                </div>
                <div class="names-col">
                    <div class="username">{{pushName}}</div>
                    <div class="nickname">@{{nickname}}</div>
                    
                <div class="badges-row">
                        {{#if isDev}}
                        <div class="badge badge-dev">DEV</div>
                        {{/if}}
                        {{#if spouseName}}
                        <div class="badge badge-spouse">
                            <span class="spouse-heart">❤️</span> {{spouseName}}
                        </div>
                        {{/if}}
                        {{#each customTags}}
                            {{#if this.color}}
                                <div class="badge" style="background: {{this.color}}CC; border: 1px solid {{this.color}};">{{this.text}}</div>
                            {{else}}
                                <div class="badge" style="background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255,255,255,0.3);">{{this}}</div>
                            {{/if}}
                        {{/each}}
                    </div>
                </div>
                
                {{#if donation}}
                <div class="donation-box">
                    <div class="donation-icon">💎</div>
                    <div class="donation-info">
                        <span class="donation-label">Doação</span>
                        <span class="donation-amount">R$ {{donation}}</span>
                    </div>
                </div>
                {{/if}}
            </div>

            {{#if bio}}
            <div class="bio-section">
                "{{bio}}"
            </div>
            {{/if}}

            <div class="stats-grid">
                <div class="stat-box">
                    <span class="stat-label">Ranking</span>
                    <span class="stat-value rank-value">#{{rank}}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Mensagens</span>
                    <span class="stat-value">{{messageCount}}</span>
                </div>
                <div class="stat-box">
                    <span class="stat-label">Rep</span>
                    <span class="stat-value" style="color: {{#if isMinecraft}}#55ffff{{else}}#60A5FA{{/if}};">{{rep}}</span>
                </div>
                <div class="stat-box">
                    {{#if birthday}}
                        <span class="stat-label">Aniversário</span>
                        <span class="stat-value" style="font-size: {{#if isMinecraft}}10px{{else}}{{#if theme.screenBg}}12px{{else}}18px{{/if}}{{/if}};">{{birthday}} {{sign}}</span>
                    {{else}}
                        <span class="stat-label">Entrou em</span>
                        <span class="stat-value" style="font-size: 18px;">{{joinDate}}</span>
                    {{/if}}
                </div>
            </div>

            {{#if trackName}}
            <div class="music-section">
                <img src="{{trackImage}}" class="music-art" crossorigin="anonymous" onerror="this.style.display='none'">
                <div class="music-info">
                    <div class="music-status">
                        {{#if isPlaying}}
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg> 
                            Ouvindo Agora
                        {{else}}
                            {{#if isFavorite}}
                            <span style="font-size: 16px; margin-right: 4px;">❤️</span> Música Favorita
                            {{else}}
                            <svg viewBox="0 0 24 24" style="fill: #aaa;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
                            Última Tocada
                            {{/if}}
                        {{/if}}
                    </div>
                    <div class="track-name">{{trackName}}</div>
                    <div class="artist-name">{{trackArtist}}</div>
                </div>
            </div>
            {{else}}
            <div class="music-section" style="justify-content: center; opacity: 0.5;">
                <div class="artist-name">Nenhuma música reproduzida recentemente</div>
            </div>
            {{/if}}

        </div>
    </div>
</body>
</html>
`;

const fakeQuoteTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            width: 800px;
            height: 400px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Inter', sans-serif;
        }

        .container {
            width: 800px;
            height: 400px;
            background: #111;
            display: flex;
            align-items: center;
            padding: 50px;
            position: relative;
            overflow: hidden;
        }

        /* Abstract Background Elements */
        .bg-blob {
            position: absolute;
            border-radius: 50%;
            filter: blur(80px);
            opacity: 0.15;
        }
        .blob-1 { top: -50px; right: -50px; width: 300px; height: 300px; background: #fff; }
        .blob-2 { bottom: -50px; left: -50px; width: 300px; height: 300px; background: #666; }

        .avatar-section {
            flex-shrink: 0;
            margin-right: 40px;
            position: relative;
            z-index: 2;
        }

        .avatar {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            object-fit: cover;
            border: 4px solid #333;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .content-section {
            flex: 1;
            z-index: 2;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .quote-symbol {
            font-size: 60px;
            color: #444;
            font-family: serif;
            line-height: 1;
            margin-bottom: 10px;
        }

        .text {
            font-size: 28px;
            color: #fff;
            font-weight: 600;
            line-height: 1.3;
            margin-bottom: 20px;
            
            /* Limit lines to prevent overflow */
            display: -webkit-box;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .meta {
            display: flex;
            align-items: center;
            border-top: 1px solid #333;
            padding-top: 15px;
        }

        .username {
            font-size: 18px;
            color: #ccc;
            font-weight: 700;
            margin-right: 15px;
        }

        .handle {
            font-size: 14px;
            color: #666;
            font-weight: 400;
        }
        
        .timestamp {
            margin-left: auto;
            font-size: 14px;
            color: #555;
        }

    </style>
</head>
<body>
    <div class="container">
        <div class="bg-blob blob-1"></div>
        <div class="bg-blob blob-2"></div>
        
        <div class="avatar-section">
            <img src="{{avatarUrl}}" class="avatar" />
        </div>
        
        <div class="content-section">
            <div class="quote-symbol">“</div>
            <div class="text">{{text}}</div>
            <div class="meta">
                <div class="username">{{username}}</div>
                <div class="timestamp">{{timestamp}}</div>
            </div>
        </div>
    </div>
</body>
</html>
`;

const shippCardTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            width: 800px;
            height: 400px;
            background: #1a1a1a;
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }

        .container {
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #2a0845 0%, #6441A5 50%, #ff0099 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
        }
        
        /* Ambient particles */
        .particle {
            position: absolute;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
        }
        .p1 { top: 10%; left: 10%; width: 100px; height: 100px; }
        .p2 { bottom: 20%; right: 10%; width: 150px; height: 150px; background: rgba(255, 0, 153, 0.2); }
        .p3 { top: 40%; left: 50%; width: 50px; height: 50px; }

        .main-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 80%;
            z-index: 2;
        }

        .user-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 200px;
        }

        .avatar {
            width: 180px;
            height: 180px;
            border-radius: 50%;
            object-fit: cover;
            border: 6px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }

        .name {
            margin-top: 15px;
            font-size: 24px;
            font-weight: 700;
            color: #fff;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
        }

        .heart-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            margin: 0 20px;
        }

        .heart-icon {
            font-size: 80px;
            animation: pulse 1s infinite alternate;
            filter: drop-shadow(0 0 10px rgba(255,0,0,0.5));
        }

        @keyframes pulse {
            from { transform: scale(1); }
            to { transform: scale(1.1); }
        }

        .percentage {
            font-size: 48px;
            font-weight: 900;
            color: #fff;
            text-shadow: 0 4px 10px rgba(0,0,0,0.4);
            margin-top: -10px;
        }
        
        .message {
            margin-top: 30px;
            font-size: 20px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.9);
            background: rgba(0, 0, 0, 0.3);
            padding: 8px 16px;
            border-radius: 20px;
            text-align: center;
            z-index: 2;
            max-width: 80%;
        }

        .progress-bar-bg {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 15px;
            background: rgba(0,0,0,0.3);
        }
        
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #ff0099, #493240);
            width: {{percentage}}%;
            box-shadow: 0 0 10px #ff0099;
        }

    </style>
</head>
<body>
    <div class="container">
        <div class="particle p1"></div>
        <div class="particle p2"></div>
        <div class="particle p3"></div>
        
        <div class="main-content">
            <div class="user-box">
                <img src="{{avatar1}}" class="avatar" onerror="this.src='https://telegra.ph/file/24fa902ead26340f3df2c.png'" />
                <div class="name">{{name1}}</div>
            </div>
            
            <div class="heart-box">
                <div class="heart-icon">❤️</div>
                <div class="percentage">{{percentage}}%</div>
            </div>
            
            <div class="user-box">
                <img src="{{avatar2}}" class="avatar" onerror="this.src='https://telegra.ph/file/24fa902ead26340f3df2c.png'" />
                <div class="name">{{name2}}</div>
            </div>
        </div>

        <div class="message">{{text}}</div>
        
        <div class="progress-bar-bg">
            <div class="progress-bar-fill"></div>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
    fakeQuoteTemplate,
    profileCardTemplate,
    shippCardTemplate
};
