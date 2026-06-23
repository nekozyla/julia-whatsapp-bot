const profileCardTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Press+Start+2P&family=Poppins:wght@400;600;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        @keyframes liquid-move {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
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

            /* Custom Border Support */
            border-radius: {{theme.borderRadius}};
            border: {{theme.cardBorder}};


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

            /* Real Liquid Glass Background - WebGL is handled via script below */
            {{#if isLiquid}}
            display: none; /* Hide CSS Blur if using WebGL, or maybe keep as fallback? Let's hide it */
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

            {{#if isLiquid}}
            /* Additional padding for floating feel */
            padding: 50px;
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
            border-radius: {{#if theme.avatarBorderRadius}}{{theme.avatarBorderRadius}}{{else}}50%{{/if}};
            object-fit: cover;
            border: {{#if theme.avatarBorder}}{{theme.avatarBorder}}{{else}}4px solid {{theme.borderColor}}{{/if}};

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
            
            {{#if isLiquid}}
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
            border-radius: 20px;
            {{/if}}

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
            text-align: center;
            font-weight: 600;
        }

        /* SOCIAL MEDIA ICONS */
        .socials-row {
            display: flex;
            gap: 12px;
            margin-top: 10px;
            justify-content: flex-start;
            flex-wrap: wrap;
        }

        .social-item {
            display: flex;
            align-items: center;
            background: rgba(255,255,255,0.1);
            padding: 4px 8px;
            border-radius: 6px;
            gap: 6px;
            backdrop-filter: blur(5px);
            border: 1px solid rgba(255,255,255,0.1);
            
            {{#if isMinecraft}}
            background: #555;
            border: 2px solid #fff;
            border-radius: 0;
            box-shadow: 2px 2px 0 #000;
            padding: 2px 4px;
            {{/if}}
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #f0f0f0, #d0d0d0);
            border: 1px solid #999;
            box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            border-radius: 4px;
            {{/if}}
            
            {{#if theme.screenBg}}
            background: transparent;
            border: 1px solid {{theme.borderColor}};
            border-radius: 0;
            padding: 2px 4px;
            {{/if}}
        }

        .social-icon {
            width: 14px;
            height: 14px;
            fill: {{theme.subTextColor}};
            {{#if isMinecraft}}fill: #fff;{{/if}}
            {{#if isSkeuo}}fill: #333;{{/if}}
            {{#if theme.screenBg}}fill: {{theme.textColor}};{{/if}}
        }

        .social-text {
            font-size: 10px;
            color: {{theme.subTextColor}};
            font-family: {{theme.fontFamily}};
            {{#if isMinecraft}}font-family: 'Press Start 2P', cursive; font-size: 6px; color: #fff;{{/if}}
            {{#if isSkeuo}}color: #333; font-weight: 600; font-family: Arial, sans-serif;{{/if}}
            {{#if theme.screenBg}}color: {{theme.textColor}};{{/if}}
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

        .badge-specie {
            background: rgba(230, 126, 34, 0.3);
            color: #fbd38d;
            border: 1px solid rgba(230, 126, 34, 0.4);
            
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #d4af37, #aa8000);
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 10px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3);
            border: 1px solid #7a5c00;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            {{/if}}
        }

        .badge-pronouns {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: lowercase;
            letter-spacing: 0.3px;
            {{#if isMinecraft}}
            border-radius: 0;
            font-family: 'Press Start 2P', cursive;
            font-size: 7px;
            {{/if}}
            {{#if isSkeuo}}
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 10px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3);
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            {{/if}}
        }

        .badge-gender {
            background: rgba(167, 139, 250, 0.25);
            color: #ddd6fe;
            border: 1px solid rgba(167, 139, 250, 0.4);
            display: flex;
            align-items: center;
            gap: 4px;
            {{#if isMinecraft}}
            border-radius: 0;
            font-family: 'Press Start 2P', cursive;
            font-size: 7px;
            background: #8b5cf6;
            color: #fff;
            border: 2px solid #fff;
            box-shadow: 2px 2px 0 #000;
            {{/if}}
            {{#if isSkeuo}}
            background: linear-gradient(to bottom, #c084fc, #9333ea);
            color: #fff;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 10px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.3);
            border: 1px solid #7c3aed;
            text-shadow: 0 -1px 0 rgba(0,0,0,0.3);
            {{/if}}
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
                        {{#if pronouns}}
                        <div class="badge badge-pronouns" style="background: {{pronouns.color}}33; border: 1px solid {{pronouns.color}}66; color: {{pronouns.color}};">
                            {{pronouns.display}}
                        </div>
                        {{/if}}
                        {{#if gender}}
                        <div class="badge badge-gender">
                            {{gender.emoji}} {{gender.display}}
                        </div>
                        {{/if}}
                        {{#if isDev}}
                        <div class="badge badge-dev">DEV</div>
                        {{/if}}
                        {{#if spouseName}}
                        <div class="badge badge-spouse">
                            <span class="spouse-heart">❤️</span> {{spouseName}}
                        </div>
                        {{/if}}
                        {{#if specie}}
                        <div class="badge badge-specie">
                            {{specie.emoji}} {{specie.name}}
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
                    
                    <!-- Social Media Section -->
                    {{#if socials}}
                    <div class="socials-row">
                        {{#if socials.instagram}}
                        <div class="social-item">
                            <svg class="social-icon" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                            <span class="social-text">{{socials.instagram}}</span>
                        </div>
                        {{/if}}

                        {{#if socials.twitter}}
                        <div class="social-item">
                            <svg class="social-icon" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                            <span class="social-text">{{socials.twitter}}</span>
                        </div>
                        {{/if}}

                        {{#if socials.tiktok}}
                        <div class="social-item">
                            <svg class="social-icon" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.65-1.62-1.12-1.76-1.65-2.3-4.25-1.44-6.52l-5.01-.02c-.01.53-.05 1.08-.06 1.65-.01 5.95-.08 11.89-6.35 14.73-3.6 1.68-7.98-.12-9.45-3.71-.5-1.39-.68-2.9-.29-4.38.74-2.77 3-4.99 5.86-5.46 1.83-.3 3.7.09 5.3 1.02l.14 4.19c-1.55-1-3.69-1.04-5.28-.27-1.59.77-2.42 2.72-1.92 4.49.53 1.96 2.59 3.25 4.56 2.71 1.9-.53 3.19-2.39 3.19-4.38v-8.82c-1.11 0-2.25 0-3.34 0 .01-1.05.01-2.09.02-3.14z"/></svg>
                            <span class="social-text">{{socials.tiktok}}</span>
                        </div>
                        {{/if}}

                        {{#if socials.github}}
                        <div class="social-item">
                            <svg class="social-icon" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                            <span class="social-text">{{socials.github}}</span>
                        </div>
                        {{/if}}

                        {{#if socials.linkedin}}
                        <div class="social-item">
                            <svg class="social-icon" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                            <span class="social-text">{{socials.linkedin}}</span>
                        </div>
                        {{/if}}
                    {{#if socials.linktree}}
                    <div class="social-item">
                        <i class="fas fa-tree social-icon" style="display: flex; align-items: center; justify-content: center;"></i>
                        <span class="social-text">{{socials.linktree}}</span>
                    </div>
                    {{/if}}
                </div>
                {{/if}}
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
    {{#if isLiquid}}
    <canvas id="canvas" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1;"></canvas>
    <script id="fragmentShader" type="x-shader/x-fragment">
        precision mediump float;
        uniform float u_dpr;
        uniform sampler2D u_background;
        uniform vec2 u_resolution;
        uniform vec2 u_mouse;
        varying vec2 v_uv;

        float roundedBoxSDF(vec2 p, vec2 b, float r) {
            vec2 d = abs(p) - b + vec2(r);
            return length(max(d, 0.0)) - r;
        }

        void main() {
            vec2 pixelUV = (v_uv * u_resolution) / u_dpr;
            vec2 center = u_resolution / 2.0 / u_dpr;
            vec2 size = vec2(600.0, 600.0) * 0.5;

            vec2 local = (pixelUV - center) / size;
            float dist = roundedBoxSDF(pixelUV - center, size, 20.0);
            
            vec4 bgCol = texture2D(u_background, v_uv);
            
            if (dist < 0.0) {
                vec2 distort = local * 0.05 * sin(v_uv.y * 10.0 + 1.0);
                vec2 refractUV = v_uv + distort;
                vec4 refrCol = texture2D(u_background, refractUV);
                gl_FragColor = mix(refrCol, vec4(1.0), 0.1);
            } else {
                gl_FragColor = bgCol;
            }
        }
    </script>
    <script id="vertexShader" type="x-shader/x-vertex">
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            v_uv = vec2(a_position.x, -a_position.y) * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
    </script>
    <script>
        (function() {
            const canvas = document.getElementById("canvas");
            if(!canvas) return;
            const gl = canvas.getContext("webgl", { antialias: true, preserveDrawingBuffer: true });
            
            canvas.width = 600;
            canvas.height = 600;
            
            function compile(type, src) {
                const s = gl.createShader(type);
                gl.shaderSource(s, src);
                gl.compileShader(s);
                return s;
            }
            
            const vs = compile(gl.VERTEX_SHADER, document.getElementById("vertexShader").textContent);
            const fs = compile(gl.FRAGMENT_SHADER, document.getElementById("fragmentShader").textContent);
            const p = gl.createProgram();
            gl.attachShader(p, vs);
            gl.attachShader(p, fs);
            gl.linkProgram(p);
            gl.useProgram(p);
            
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
            const bloc = gl.getAttribLocation(p, "a_position");
            gl.enableVertexAttribArray(bloc);
            gl.vertexAttribPointer(bloc, 2, gl.FLOAT, false, 0, 0);
            
            const uRes = gl.getUniformLocation(p, "u_resolution");
            const uDpr = gl.getUniformLocation(p, "u_dpr");
            const uBg = gl.getUniformLocation(p, "u_background");
            
            gl.uniform2f(uRes, 600, 600);
            gl.uniform1f(uDpr, 1);
            
            const tex = gl.createTexture();
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = 600;
            tmpCanvas.height = 600;
            const ctx = tmpCanvas.getContext("2d");
            
            const grad = ctx.createLinearGradient(0,0,600,600);
            grad.addColorStop(0, "#8EC5FC");
            grad.addColorStop(1, "#E0C3FC");
            ctx.fillStyle = grad;
            ctx.fillRect(0,0,600,600);
            
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.beginPath(); ctx.arc(100, 100, 150, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(0,0,255,0.1)";
            ctx.beginPath(); ctx.arc(500, 500, 200, 0, Math.PI*2); ctx.fill();

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmpCanvas);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.uniform1i(uBg, 0);
            
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        })();
    </script>
    {{/if}}
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
            height: 800px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Inter', sans-serif;
        }

        .container {
            width: 800px;
            height: 800px;
            background: #111;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 60px 50px;
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
        .blob-1 { top: -80px; right: -80px; width: 400px; height: 400px; background: #fff; }
        .blob-2 { bottom: -80px; left: -80px; width: 400px; height: 400px; background: #666; }

        .avatar-section {
            flex-shrink: 0;
            margin-bottom: 50px;
            position: relative;
            z-index: 2;
        }

        .avatar {
            width: 240px;
            height: 240px;
            border-radius: 50%;
            object-fit: cover;
            border: 5px solid #333;
            box-shadow: 0 14px 40px rgba(0,0,0,0.6);
        }

        .content-section {
            width: 100%;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .quote-symbol {
            font-size: 100px;
            color: #444;
            font-family: serif;
            line-height: 1;
            margin-bottom: 20px;
        }

        .text {
            font-size: 40px;
            color: #fff;
            font-weight: 600;
            line-height: 1.4;
            margin-bottom: 48px;
            
            /* Limit lines to prevent overflow */
            display: -webkit-box;
            -webkit-line-clamp: 6;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .meta {
            display: flex;
            flex-direction: column;
            align-items: center;
            border-top: 1px solid #333;
            padding-top: 20px;
            width: 100%;
        }

        .username {
            font-size: 28px;
            color: #ccc;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .handle {
            font-size: 18px;
            color: #666;
            font-weight: 400;
        }
        
        .timestamp {
            font-size: 18px;
            color: #555;
            margin-top: 8px;
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

const welcomeTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            width: 800px;
            height: 400px;
            font-family: 'Inter', sans-serif;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }

        .container {
            width: 800px;
            height: 400px;
            position: relative;
            background: #0f0f0f;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('{{avatarUrl}}');
            background-size: cover;
            background-position: center;
            filter: blur(40px) brightness(0.3);
            z-index: 0;
            opacity: 0.8;
            transform: scale(1.1);
        }

        .card {
            position: relative;
            z-index: 10;
            width: 90%;
            height: 80%;
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: row;
            align-items: center;
            padding: 40px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .avatar-container {
            width: 200px;
            height: 200px;
            border-radius: 50%;
            padding: 5px;
            background: linear-gradient(135deg, #FF0080, #7928CA);
            margin-right: 40px;
            flex-shrink: 0;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            position: relative;
        }

        .avatar {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            object-fit: cover;
            border: 5px solid #1a1a1a;
            background: #1a1a1a;
        }

        .content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .welcome-badge {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50px;
            color: #ccc;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-bottom: 15px;
            width: fit-content;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        h1 {
            font-size: 42px;
            font-weight: 800;
            color: #fff;
            margin-bottom: 5px;
            line-height: 1.1;
            background: linear-gradient(to right, #fff, #bbb);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }

        .group-name {
            font-size: 20px;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 500;
            margin-bottom: 25px;
            display: flex;
            align-items: center;
        }
        
        .member-count {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            background: rgba(0, 0, 0, 0.3);
            padding: 8px 12px;
            border-radius: 8px;
            width: fit-content;
        }

        .dot {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            box-shadow: 0 0 10px #4ade80;
        }

    </style>
</head>
<body>
    <div class="container">
        <div class="background"></div>
        <div class="card">
            <div class="avatar-container">
                <img src="{{avatarUrl}}" class="avatar" crossorigin="anonymous" onerror="this.src='https://telegra.ph/file/24fa902ead26340f3df2c.png'"/>
            </div>
            <div class="content">
                <div class="welcome-badge">Bem-vindo(a)</div>
                <h1>{{username}}</h1>
                <div class="group-name">ao {{groupName}}</div>
                
                <div class="member-count">
                    <div class="dot"></div>
                    Membro #{{memberCount}}
                </div>
            </div>
        </div>
    </div>
</body>
</html>
`;

const wantedTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Rye&family=Special+Elite&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            width: 600px;
            height: 900px; /* Increased height */
            font-family: 'Rye', serif;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .poster {
            width: 600px;
            height: 900px;
            background-color: #f4e4bc;
            background-image: url("data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E");
            position: relative;
            padding: 30px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 10px 10px 20px rgba(0,0,0,0.5);
            overflow: hidden;
            filter: sepia(0.4) contrast(1.1);
        }

        .poster::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, transparent 55%, rgba(139, 69, 19, 0.4) 95%, rgba(60, 30, 0, 0.8) 100%);
            pointer-events: none;
            z-index: 10;
        }

        .header {
            font-size: 75px;
            font-weight: 900;
            color: #3e2723;
            letter-spacing: 5px;
            margin-bottom: 10px;
            text-transform: uppercase;
            text-shadow: 2px 2px 0px rgba(0,0,0,0.2);
            z-index: 5;
            border-bottom: 4px solid #3e2723;
            padding-bottom: 5px;
            width: 95%;
            text-align: center;
        }

        .dead-alive {
            font-family: 'Special Elite', cursive;
            font-size: 24px;
            color: #5d4037;
            margin-top: -5px;
            margin-bottom: 25px;
            text-transform: uppercase;
            font-weight: bold;
            z-index: 5;
        }

        .image-container {
            width: 380px;
            height: 380px;
            border: 6px solid #3e2723;
            padding: 8px;
            background: #eaddcf;
            margin-bottom: 20px;
            position: relative;
            transform: rotate(-1deg);
            box-shadow: 3px 3px 10px rgba(0,0,0,0.3);
            z-index: 5;
        }

        .image-container img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: grayscale(100%) contrast(1.2) sepia(0.3);
        }

        .name {
            font-size: 38px;
            color: #3e2723;
            text-transform: uppercase;
            margin-bottom: 15px;
            text-align: center;
            word-break: break-all;
            max-width: 90%;
            line-height: 1;
            z-index: 5;
        }

        /* New Details Section */
        .details-box {
            font-family: 'Special Elite', cursive;
            width: 90%;
            margin-bottom: 15px;
            text-align: center;
            z-index: 5;
            background: rgba(62, 39, 35, 0.05);
            padding: 10px;
            border: 1px dashed #3e2723;
            transform: rotate(1deg);
        }

        .detail-row {
            margin-bottom: 8px;
            font-size: 18px;
            color: #4e342e;
        }
        
        .detail-label {
            font-weight: bold;
            text-decoration: underline;
            margin-right: 5px;
        }

        .reward-section {
            margin-top: auto;
            margin-bottom: 20px;
            text-align: center;
            z-index: 5;
        }

        .reward-label {
            font-family: 'Special Elite', cursive;
            font-size: 24px;
            color: #5d4037;
            margin-bottom: 0px;
        }

        .reward-value {
            font-size: 55px;
            color: #3e2723;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .currency {
            font-size: 28px;
            margin-right: 8px;
            vertical-align: top;
            margin-top: 10px;
        }

        .stamp {
            position: absolute;
            bottom: 30px;
            right: 30px;
            border: 4px solid #8b0000;
            padding: 5px 15px;
            color: #8b0000;
            font-size: 24px;
            font-weight: bold;
            text-transform: uppercase;
            transform: rotate(-15deg);
            opacity: 0.8;
            border-radius: 8px;
            font-family: 'Special Elite', cursive;
            z-index: 6;
            mask-image: url("data:image/svg+xml,%3Csvg width='200' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='white'/%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E");
        }

    </style>
</head>
<body>
    <div class="poster">
        <div class="header">WANTED</div>
        <div class="dead-alive">DEAD OR ALIVE</div>
        
        <div class="image-container">
            <img src="{{avatarUrl}}" alt="Target">
        </div>
        
        <div class="name">{{name}}</div>
        
        <div class="details-box">
            <div class="detail-row">
                <span class="detail-label">CRIME:</span> {{crime}}
            </div>
            <div class="detail-row">
                <span class="detail-label">LAST SEEN:</span> {{location}}
            </div>
        </div>
        
        <div class="reward-section">
            <div class="reward-label">REWARD</div>
            <div class="reward-value">
                <span class="currency">฿</span> {{reward}}
            </div>
        </div>

        <div class="stamp">BOT CORP</div>
    </div>
</body>
</html>
`;

const lutoTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cardo:ital,wght@0,400;0,700;1,400&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            width: 700px;
            height: 900px;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Cardo', serif;
        }

        .card {
            width: 700px;
            height: 900px;
            position: relative;
            overflow: hidden;
            background: radial-gradient(circle at center, #2a2a2a 0%, #111 55%, #000 100%);
            border: 10px solid #2f2f2f;
            box-shadow: inset 0 0 60px rgba(255,255,255,0.05), 0 10px 30px rgba(0,0,0,0.8);
            color: #e8e2d7;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 45px 35px;
        }

        .card::before {
            content: '';
            position: absolute;
            inset: 14px;
            border: 2px solid rgba(220, 205, 180, 0.28);
            pointer-events: none;
        }

        .title {
            font-family: 'Cinzel', serif;
            font-size: 70px;
            letter-spacing: 6px;
            margin-top: 12px;
            text-transform: uppercase;
            color: #f1ece3;
            text-shadow: 0 2px 8px rgba(255,255,255,0.12);
        }

        .subtitle {
            margin-top: 6px;
            font-size: 22px;
            letter-spacing: 2px;
            color: #c8bba8;
            text-transform: uppercase;
        }

        .photo-frame {
            width: 370px;
            height: 370px;
            margin-top: 42px;
            padding: 12px;
            border: 3px solid #a99473;
            background: linear-gradient(180deg, #4a4134 0%, #2f2a22 100%);
            box-shadow: 0 0 0 6px rgba(169, 148, 115, 0.25), 0 12px 20px rgba(0,0,0,0.5);
        }

        .photo {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: grayscale(100%) contrast(1.12);
        }

        .name {
            margin-top: 36px;
            font-family: 'Cinzel', serif;
            font-size: 48px;
            text-align: center;
            max-width: 90%;
            line-height: 1.1;
            text-transform: uppercase;
            letter-spacing: 2px;
            word-break: break-word;
        }

        .years {
            margin-top: 20px;
            font-size: 40px;
            letter-spacing: 4px;
            color: #d8c8af;
        }

        .cross {
            margin-top: auto;
            margin-bottom: 28px;
            font-size: 56px;
            color: rgba(232, 226, 215, 0.75);
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="title">LUTO</div>
        <div class="subtitle">Em memória</div>

        <div class="photo-frame">
            <img class="photo" src="{{avatarUrl}}" alt="Foto" crossorigin="anonymous" onerror="this.src='https://telegra.ph/file/24fa902ead26340f3df2c.png'">
        </div>

        <div class="name">{{name}}</div>
        <div class="years">{{birthYear}} — {{deathYear}}</div>
        <div class="cross">✝</div>
    </div>
</body>
</html>
`;

const newsTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body {
            width: 800px;
            height: 450px;
            font-family: 'Roboto', sans-serif;
            background: #000;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .container {
            width: 800px;
            height: 450px;
            position: relative;
            background-color: #333;
        }

        /* Image Background */
        .bg-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 1;
        }
        
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to right, rgba(0,0,0,0.4), transparent);
            z-index: 2;
        }

        /* Live Badge */
        .live-badge {
            position: absolute;
            top: 20px;
            left: 20px;
            background: #cc0000;
            color: white;
            padding: 5px 15px;
            font-weight: 900;
            text-transform: uppercase;
            font-size: 18px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            z-index: 10;
            animation: blink 2s infinite;
        }

        @keyframes blink {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        /* Logo / Channel Name */
        .channel-logo {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255,255,255,0.9);
            color: #000;
            padding: 5px 10px;
            font-weight: 900;
            font-style: italic;
            font-size: 20px;
            z-index: 10;
            border-radius: 2px;
        }

        /* Lower Thirds Container */
        .lower-third {
            position: absolute;
            bottom: 40px;
            left: 0;
            width: 100%;
            z-index: 20;
            display: flex;
            flex-direction: column;
        }

        /* Breaking News Bar */
        .breaking-bar {
            background: linear-gradient(90deg, #cc0000 0%, #990000 100%);
            color: white;
            padding: 5px 20px;
            font-weight: 900;
            font-size: 20px;
            text-transform: uppercase;
            width: fit-content;
            min-width: 200px;
            clip-path: polygon(0 0, 95% 0, 100% 100%, 0% 100%);
            margin-bottom: -2px; /* Connect to next bar */
            box-shadow: 2px 0 5px rgba(0,0,0,0.3);
        }

        /* Headline Box */
        .headline-box {
            background: rgba(255, 255, 255, 0.95);
            padding: 15px 20px;
            width: 90%;
            clip-path: polygon(0 0, 100% 0, 98% 100%, 0% 100%);
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }

        .headline {
            font-size: 32px;
            font-weight: 900;
            color: #000;
            line-height: 1.1;
            text-transform: uppercase;
        }
        
        .category {
            color: #cc0000;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
        }
        
        .category::before {
            content: '';
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #cc0000;
            margin-right: 5px;
            border-radius: 50%;
        }

        /* Ticker Bottom */
        .ticker-wrap {
            position: absolute;
            bottom: 0;
            width: 100%;
            height: 35px;
            background-color: #000;
            z-index: 15;
            display: flex;
            align-items: center;
            overflow: hidden;
            border-top: 2px solid #cc0000;
        }
        
        .ticker-label {
            background: #cc0000;
            color: #fff;
            padding: 0 15px;
            height: 100%;
            display: flex;
            align-items: center;
            font-weight: bold;
            font-size: 14px;
            z-index: 20;
        }

        .ticker-text {
            white-space: nowrap;
            color: #fff;
            font-size: 16px;
            font-weight: 500;
            padding-left: 20px;
            animation: ticker 20s linear infinite;
        }
        
        @keyframes ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
        }

    </style>
</head>
<body>
    <div class="container">
        <img src="{{imageUrl}}" class="bg-image" alt="Background">
        <div class="overlay"></div>
        
        <div class="live-badge">AO VIVO</div>
        <div class="channel-logo">BOT NEWS</div>

        <div class="lower-third">
            <div class="breaking-bar">PLANTÃO URGENTE</div>
            <div class="headline-box">
                <div class="category">{{category}}</div>
                <div class="headline">{{headline}}</div>
            </div>
        </div>

        <div class="ticker-wrap">
            <div class="ticker-label">AGORA</div>
            <div class="ticker-text">Bot atinge marca recorde de interações • Cientistas confirmam que água é molhada • Cotação do dólar sobe para R$ 999,00 • Previsão do tempo: Chuva de memes a qualquer momento • </div>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
    fakeQuoteTemplate,
    profileCardTemplate,
    shippCardTemplate,
    welcomeTemplate,
    wantedTemplate,
    lutoTemplate,
    newsTemplate
};
