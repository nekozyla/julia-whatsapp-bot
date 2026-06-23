/**
 * fmGameManager.js — Manages active fm games (jumble, pixel) per chat
 */

class FmGameManager {
    constructor() {
        this.activeGames = new Map(); // chatJid → game state
        this.TIMEOUT = 60 * 1000; // 60s per game
    }

    createGame(chatJid, type, answer, hint, imageUrl = null, extraData = {}) {
        // Clean up any existing game
        this.deleteGame(chatJid);

        const game = {
            type, // 'jumble' | 'pixel'
            answer: answer.toLowerCase().trim(),
            hint,
            imageUrl,
            startedAt: Date.now(),
            attempts: 0,
            maxAttempts: 15,
            solved: false,
            startedBy: extraData.startedBy || null,
            artistName: extraData.artistName || null,
            albumName: extraData.albumName || null,
            pixelLevel: extraData.pixelLevel || 1, // 1 = very pixelated, increases
            ...extraData
        };

        this.activeGames.set(chatJid, game);

        // Auto-expire
        game._timeout = setTimeout(() => {
            const g = this.activeGames.get(chatJid);
            if (g && !g.solved) {
                g.expired = true;
            }
        }, this.TIMEOUT);

        return game;
    }

    getGame(chatJid) {
        const game = this.activeGames.get(chatJid);
        if (!game) return null;
        if (game.expired || (Date.now() - game.startedAt > this.TIMEOUT)) {
            return { ...game, expired: true };
        }
        return game;
    }

    checkAnswer(chatJid, guess) {
        const game = this.getGame(chatJid);
        if (!game || game.solved || game.expired) return null;

        game.attempts++;
        const normalizedGuess = guess.toLowerCase().trim();
        const normalizedAnswer = game.answer.toLowerCase().trim();

        if (normalizedGuess === normalizedAnswer) {
            game.solved = true;
            return { correct: true, attempts: game.attempts, game };
        }

        // Partial match check (> 80% similar)
        const similarity = this._similarity(normalizedGuess, normalizedAnswer);
        const isClose = similarity > 0.75 && similarity < 1;

        if (game.attempts >= game.maxAttempts) {
            return { correct: false, maxAttemptsReached: true, game };
        }

        return { correct: false, close: isClose, attempts: game.attempts, game };
    }

    deleteGame(chatJid) {
        const game = this.activeGames.get(chatJid);
        if (game?._timeout) clearTimeout(game._timeout);
        this.activeGames.delete(chatJid);
    }

    _similarity(a, b) {
        if (a === b) return 1;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0) return 1;
        const editDist = this._editDistance(longer, shorter);
        return (longer.length - editDist) / longer.length;
    }

    _editDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    // Scramble a word keeping spaces but shuffling letters within each word
    static scramble(text) {
        return text.split(' ').map(word => {
            if (word.length <= 2) return word;
            const chars = word.split('');
            // Fisher-Yates shuffle
            for (let i = chars.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [chars[i], chars[j]] = [chars[j], chars[i]];
            }
            // Avoid returning the same word
            const scrambled = chars.join('');
            if (scrambled === word && word.length > 2) {
                // Swap first two chars
                [chars[0], chars[1]] = [chars[1], chars[0]];
                return chars.join('');
            }
            return scrambled;
        }).join(' ');
    }
}

module.exports = new FmGameManager();
