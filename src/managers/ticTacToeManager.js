class TicTacToeManager {
    constructor() {
        this.activeGames = new Map(); 
    }

    createGame(chatJid, playerX, playerO) {
        this.activeGames.set(chatJid, {
            playerX, 
            playerO, 
            board: Array(9).fill(null), 
            turn: playerX, 
            status: 'pending', 
            createdAt: Date.now()
        });
    }

    getGame(chatJid) {
        return this.activeGames.get(chatJid);
    }

    deleteGame(chatJid) {
        this.activeGames.delete(chatJid);
    }

    makeMove(chatJid, player, position) {
        const game = this.getGame(chatJid);
        if (!game || game.status !== 'ongoing') return { success: false, message: 'Não há jogo ativo.' };
        if (game.turn !== player) return { success: false, message: 'Não é sua vez!' };

        const index = position - 1; 
        if (index < 0 || index > 8 || game.board[index] !== null) {
            return { success: false, message: 'Posição inválida ou já ocupada.' };
        }

        const symbol = player === game.playerX ? 'X' : 'O';
        game.board[index] = symbol;

        
        const win = this.checkWin(game.board);
        if (win) {
            this.deleteGame(chatJid);
            return { success: true, status: 'win', winner: player, board: game.board };
        }

        if (game.board.every(cell => cell !== null)) {
            this.deleteGame(chatJid);
            return { success: true, status: 'draw', board: game.board };
        }

        
        game.turn = player === game.playerX ? game.playerO : game.playerX;
        return { success: true, status: 'continue', nextTurn: game.turn, board: game.board };
    }

    checkWin(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], 
            [0, 3, 6], [1, 4, 7], [2, 5, 8], 
            [0, 4, 8], [2, 4, 6]             
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return true;
            }
        }
        return false;
    }

    renderBoard(board) {
        
        const mapCell = (val, idx) => {
            if (val === 'X') return '❌';
            if (val === 'O') return '⭕';
            
            const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
            return numberEmojis[idx];
        };

        let str = '';
        for (let i = 0; i < 9; i += 3) {
            str += `${mapCell(board[i], i)} | ${mapCell(board[i + 1], i + 1)} | ${mapCell(board[i + 2], i + 2)}\n`;
            if (i < 6) str += '---|---|---\n';
        }
        return str;
    }
}

module.exports = new TicTacToeManager();
