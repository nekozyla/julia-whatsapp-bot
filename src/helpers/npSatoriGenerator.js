const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const axios = require('axios');
const React = require('react');
const satoriModule = require('satori');
const { Resvg } = require('@resvg/resvg-js');
const opentype = require('@shuding/opentype.js');

const satori = satoriModule.default || satoriModule;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getThemeColor(theme, key, fallback) {
    if (!theme || !theme[key]) return fallback;
    return theme[key];
}

function adjustAlpha(color, alpha) {
    if (!color) return `rgba(0, 0, 0, ${alpha})`;
    if (typeof color !== 'string') return color;
    if (color.startsWith('rgba')) {
        return color.replace(/[\d\.]+\)$/, `${alpha})`);
    }
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (color.startsWith('#')) {
        let hex = color;
        if (hex.length === 4) {
            hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
        }
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
}

async function getImageAsDataUri(url, fallbackDataUri, fallbackUrl) {
    if (!url || typeof url !== 'string') return fallbackDataUri;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 12000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });
        const mime = response.headers['content-type'] || 'image/jpeg';
        const base64 = Buffer.from(response.data).toString('base64');
        return `data:${mime};base64,${base64}`;
    } catch (_) {
        if (fallbackUrl) {
            try {
                const response = await axios.get(fallbackUrl, {
                    responseType: 'arraybuffer',
                    timeout: 12000,
                    maxRedirects: 5,
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                });
                const mime = response.headers['content-type'] || 'image/jpeg';
                const base64 = Buffer.from(response.data).toString('base64');
                return `data:${mime};base64,${base64}`;
            } catch (_) {
                return fallbackDataUri;
            }
        }
        return fallbackDataUri;
    }
}

async function tryReadOpenType(fontPath) {
    if (!fontPath || !fsSync.existsSync(fontPath)) return null;
    try {
        const data = await fs.readFile(fontPath);
        if (!data || data.length === 0) return null;
        const arr = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        opentype.parse(arr);
        return data;
    } catch (_) {
        return null;
    }
}

async function resolveFontBuffers() {
    // Priorizamos famílias sans (visual mais próximo do NP original) e evitamos mono.
    const pairs = [
        {
            regular: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Regular.woff'),
            bold: path.join(__dirname, '..', 'assets', 'fonts', 'Inter-Bold.woff')
        },
        {
            regular: '/usr/share/fonts/abattis-cantarell-fonts/Cantarell-Regular.otf',
            bold: '/usr/share/fonts/abattis-cantarell-fonts/Cantarell-Bold.otf'
        },
        {
            regular: '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
            bold: '/usr/share/fonts/liberation/LiberationSans-Bold.ttf'
        },
        {
            regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
        },
        {
            regular: '/usr/share/fonts/dejavu/DejaVuSans.ttf',
            bold: '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'
        },
        {
            regular: path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Regular.ttf'),
            bold: path.join(__dirname, '..', 'assets', 'fonts', 'NotoSans-Bold.ttf')
        }
    ];

    for (const pair of pairs) {
        const regular = await tryReadOpenType(pair.regular);
        if (!regular) continue;
        const bold = await tryReadOpenType(pair.bold);
        return { regular, bold: bold || regular };
    }

    throw new Error('Nenhuma fonte OpenType valida encontrada para o renderer Satori.');
}

async function generateNPSatoriCard({ track, user, username, theme, currentDuration, totalDuration, progressPercent, outputPath }) {
    const safeProgress = clamp(Number(progressPercent) || 0, 0, 100);

    const fallbackArt = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNjAwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjEiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMWRiOTU0Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMGI2YzM1Ii8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSI2MDAiIGZpbGw9IiMwZTBmMTIiLz48cmVjdCB4PSI2MCIgeT0iNjAiIHdpZHRoPSI0ODAiIGhlaWdodD0iNDgwIiByeD0iMzIiIGZpbGw9InVybCgjZykiIG9wYWNpdHk9IjAuOTIiLz48dGV4dCB4PSI1MCUiIHk9IjQ4JSIgZmlsbD0iI2ZmZmZmZiIgZm9udC1zaXplPSI1NiIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5QPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNTYlIiBmaWxsPSIjZWRmN2YxIiBmb250LXNpemU9IjI0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Tk8gQ09WRVI8L3RleHQ+PC9zdmc+';
    const fallbackAvatar = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjEwMCIgZmlsbD0iIzJiMmIyYiIvPjxjaXJjbGUgY3g9IjEwMCIgY3k9Ijc4IiByPSIzNiIgZmlsbD0iI2M4YzhjOCIvPjxwYXRoIGQ9Ik0zOCAxNzZjMTQtMzAgMzktNDYgNjItNDZoMGMyMyAwIDQ4IDE2IDYyIDQ2IiBmaWxsPSIjYzhjOGM4Ii8+PC9zdmc+';
    const trackArt = await getImageAsDataUri(track?.image, fallbackArt, 'https://community.spotify.com/t5/image/serverpage/image-id/25294i2836BD1C1A31BDF2?v=v2');
    const avatar = await getImageAsDataUri(user?.image, fallbackAvatar, 'https://i.imgur.com/6X2v6lX.png');
    const fontData = await resolveFontBuffers();

    const cardBg = getThemeColor(theme, 'cardBg', '#171717');
    const accentColor = getThemeColor(theme, 'accentColor', '#1db954');
    const textColor = getThemeColor(theme, 'textColor', '#f4f4f4');
    const subTextColor = getThemeColor(theme, 'subTextColor', 'rgba(255,255,255,0.72)');
    const borderColor = getThemeColor(theme, 'borderColor', 'rgba(255,255,255,0.18)');
    const statusColor = getThemeColor(theme, 'statusColor', accentColor);
    const statusBg = getThemeColor(theme, 'statusBg', 'rgba(29,185,84,0.2)');
    const cardSurface = adjustAlpha(cardBg, 0.6);
    const accentShadow = adjustAlpha(accentColor, 0.5);

    const e = React.createElement;

    const tree = e(
        'div',
        {
            style: {
                width: '600px',
                height: '600px',
                display: 'flex',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: '#080808',
                color: textColor,
                fontFamily: 'NP Sans'
            }
        },
        [
            e('img', {
                key: 'bg-art',
                src: trackArt,
                style: {
                    position: 'absolute',
                    left: '-60px',
                    top: '-60px',
                    width: '720px',
                    height: '720px',
                    objectFit: 'cover',
                    opacity: 0.45
                }
            }),
            e('div', {
                key: 'overlay',
                style: {
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    width: '600px',
                    height: '600px',
                    background: 'rgba(0,0,0,0.45)'
                }
            }),
            e(
                'div',
                {
                    key: 'card',
                    style: {
                        width: '530px',
                        height: '530px',
                        marginLeft: '35px',
                        marginTop: '35px',
                        borderRadius: '32px',
                        border: `1px solid ${borderColor}`,
                        background: cardSurface,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingLeft: '35px',
                        paddingRight: '35px',
                        paddingTop: '35px',
                        paddingBottom: '50px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.45)'
                    }
                },
                [
                    e('svg', {
                        key: 'logo',
                        viewBox: '0 0 24 24',
                        style: {
                            position: 'absolute',
                            top: '25px',
                            right: '25px',
                            width: '24px',
                            height: '24px',
                            opacity: 0.9,
                            fill: textColor
                        }
                    }, e('path', {
                        d: 'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.299z',
                        fill: textColor
                    })),
                    e(
                        'div',
                        {
                            key: 'badge',
                            style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                paddingLeft: '14px',
                                paddingRight: '14px',
                                paddingTop: '6px',
                                paddingBottom: '6px',
                                borderRadius: '99px',
                                fontSize: '11px',
                                fontWeight: 800,
                                letterSpacing: '0.09em',
                                textTransform: 'uppercase',
                                color: statusColor,
                                background: statusBg,
                                border: `1px solid ${adjustAlpha(statusColor, 0.3)}`,
                                marginBottom: '15px'
                            }
                        },
                        [
                            e('div', {
                                key: 'badge-dot',
                                style: {
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '999px',
                                    background: statusColor,
                                    marginRight: '6px'
                                }
                            }),
                            e('span', { key: 'badge-text' }, track?.nowPlaying ? 'LISTENING NOW' : 'LAST PLAYED')
                        ]
                    ),
                    e('img', {
                        key: 'cover',
                        src: trackArt,
                        style: {
                            width: '230px',
                            height: '230px',
                            borderRadius: '20px',
                            objectFit: 'cover',
                            marginTop: '10px',
                            marginBottom: '22px',
                            boxShadow: '0 15px 40px rgba(0,0,0,0.6)'
                        }
                    }),
                    e(
                        'div',
                        {
                            key: 'title',
                            style: {
                                width: '100%',
                                fontSize: '26px',
                                lineHeight: 1.2,
                                fontWeight: 800,
                                textAlign: 'center',
                                display: 'flex',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: textColor,
                                minHeight: '32px',
                                marginBottom: '6px',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                            }
                        },
                        track?.name || 'Unknown track'
                    ),
                    e(
                        'div',
                        {
                            key: 'artist',
                            style: {
                                width: '90%',
                                fontSize: '17px',
                                fontWeight: 500,
                                textAlign: 'center',
                                display: 'flex',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: subTextColor,
                                marginTop: '0',
                                marginBottom: '25px',
                                minHeight: '22px',
                                lineHeight: 1.2
                            }
                        },
                        track?.artist || 'Unknown artist'
                    ),
                    e(
                        'div',
                        {
                            key: 'progress-row',
                            style: {
                                width: '90%',
                                display: 'flex',
                                alignItems: 'center',
                                marginTop: '5px',
                                marginBottom: '25px'
                            }
                        },
                        [
                            e(
                                'div',
                                {
                                    key: 'time-left',
                                    style: {
                                        width: '50px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: subTextColor,
                                        minWidth: '50px'
                                    }
                                },
                                currentDuration || '0:00'
                            ),
                            e(
                                'div',
                                {
                                    key: 'bar-bg',
                                    style: {
                                        display: 'flex',
                                        flexGrow: 1,
                                        height: '5px',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: '10px',
                                        overflow: 'hidden',
                                        marginLeft: '8px',
                                        marginRight: '8px'
                                    }
                                },
                                e('div', {
                                    key: 'bar-fill',
                                    style: {
                                        width: `${safeProgress}%`,
                                        height: '5px',
                                        background: accentColor,
                                        borderRadius: '10px',
                                        boxShadow: `0 0 10px ${accentShadow}`
                                    }
                                })
                            ),
                            e(
                                'div',
                                {
                                    key: 'time-right',
                                    style: {
                                        width: '50px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: subTextColor,
                                        minWidth: '50px'
                                    }
                                },
                                totalDuration || '0:00'
                            )
                        ]
                    ),
                    e(
                        'div',
                        {
                            key: 'user-row',
                            style: {
                                width: '100%',
                                marginTop: 'auto',
                                borderTop: `1px solid ${borderColor}`,
                                paddingTop: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }
                        },
                        [
                            e('img', {
                                key: 'avatar',
                                src: avatar,
                                style: {
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '999px',
                                    objectFit: 'cover',
                                    border: `2px solid ${subTextColor}`
                                }
                            }),
                            e(
                                'div',
                                {
                                    key: 'user-text',
                                    style: {
                                        fontSize: '12px',
                                        color: subTextColor,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }
                                },
                                [
                                    e('span', { key: 'u', style: { color: textColor, marginRight: '4px', fontWeight: 700 } }, username || 'user'),
                                    e('span', { key: 'dot', style: { marginRight: '4px' } }, '•'),
                                    e('span', { key: 's' }, `${Number(user?.scrobbles || 0).toLocaleString('pt-BR')} scrobbles`)
                                ]
                            )
                        ]
                    )
                ]
            )
        ]
    );

    const svg = await satori(tree, {
        width: 600,
        height: 600,
        fonts: [
            {
                name: 'NP Sans',
                data: fontData.regular,
                weight: 400,
                style: 'normal'
            },
            {
                name: 'NP Sans',
                data: fontData.bold,
                weight: 700,
                style: 'normal'
            }
        ]
    });

    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: 600
        }
    });

    const pngData = resvg.render().asPng();
    await fs.writeFile(outputPath, pngData);
    return outputPath;
}

module.exports = { generateNPSatoriCard };
