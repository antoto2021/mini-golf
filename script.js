// --- CONFIGURATION & DONNÉES ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Définition des 5 parcours (levels)
// Type: 0 = vide, 1 = mur
const levelsData = [
    {
        id: 1, difficulty: 'easy',
        start: { x: 100, y: 300 },
        hole: { x: 700, y: 300 },
        walls: [] // Tout droit
    },
    {
        id: 2, difficulty: 'easy',
        start: { x: 100, y: 100 },
        hole: { x: 700, y: 500 },
        walls: [
            { x: 300, y: 0, w: 20, h: 400 } // Un mur vertical simple
        ]
    },
    {
        id: 3, difficulty: 'medium',
        start: { x: 50, y: 50 },
        hole: { x: 750, y: 550 },
        walls: [
            { x: 200, y: 150, w: 400, h: 20 },
            { x: 200, y: 450, w: 400, h: 20 }
        ]
    },
    {
        id: 4, difficulty: 'medium',
        start: { x: 50, y: 300 },
        hole: { x: 750, y: 300 },
        walls: [
            { x: 350, y: 200, w: 20, h: 200 }, // Bloc central
            { x: 300, y: 100, w: 20, h: 50 },
            { x: 500, y: 450, w: 20, h: 50 }
        ]
    },
    {
        id: 5, difficulty: 'hard',
        start: { x: 100, y: 500 },
        hole: { x: 700, y: 100 },
        walls: [
            { x: 0, y: 400, w: 600, h: 20 }, // Zig Zag
            { x: 200, y: 200, w: 600, h: 20 }
        ]
    }
];

// --- ÉTAT DU JEU ---
let gameState = {
    players: [], // { id: 1, score: 0, totalScore: 0, color: '...' }
    currentPlayerIndex: 0,
    currentLevelIndex: 0,
    levelsQueue: [], // Liste des niveaux à jouer
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: 10, moving: false },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 }
};

// Couleurs des joueurs
const playerColors = ['#ff5252', '#448aff', '#e040fb', '#ffab40', '#69f0ae', '#ffd740', '#536dfe', '#ff6e40', '#18ffff', '#b2ff59'];

// --- NAVIGATION ÉCRANS ---
const screens = document.querySelectorAll('.screen');
function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- INITIALISATION ---
document.getElementById('btn-play').addEventListener('click', () => {
    showScreen('setup-screen');
});

document.getElementById('btn-start-game').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', () => showScreen('start-screen'));

// --- LOGIQUE DE JEU ---

function startGame() {
    // 1. Récupérer les paramètres
    const playerCount = parseInt(document.getElementById('player-count').value);
    const courseCount = parseInt(document.getElementById('course-count').value);
    const difficulty = document.getElementById('difficulty').value;

    // 2. Initialiser les joueurs
    gameState.players = [];
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({
            id: i + 1,
            name: `Joueur ${i + 1}`,
            score: 0, // Score du trou actuel
            totalScore: 0,
            color: playerColors[i % playerColors.length]
        });
    }

    // 3. Sélectionner les niveaux
    let availableLevels = levelsData;
    if (difficulty !== 'random') {
        availableLevels = levelsData.filter(l => l.difficulty === difficulty);
        // Si pas assez de niveaux de cette difficulté, on complète avec d'autres
        if (availableLevels.length === 0) availableLevels = levelsData; 
    }

    // Mélanger ou sélectionner
    gameState.levelsQueue = [];
    for (let i = 0; i < courseCount; i++) {
        const level = availableLevels[i % availableLevels.length];
        gameState.levelsQueue.push(level);
    }

    // 4. Lancer le premier niveau
    gameState.currentLevelIndex = 0;
    gameState.currentPlayerIndex = 0;
    startLevel();
    showScreen('game-screen');
    requestAnimationFrame(gameLoop);
}

function startLevel() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    
    // Reset balle
    gameState.ball.x = level.start.x;
    gameState.ball.y = level.start.y;
    gameState.ball.vx = 0;
    gameState.ball.vy = 0;
    gameState.ball.moving = false;

    // Reset score du trou pour le joueur actuel
    gameState.players[gameState.currentPlayerIndex].score = 0;
    
    updateHUD();
    showMessage(`Joueur ${gameState.players[gameState.currentPlayerIndex].id} - À toi !`);
}

function nextTurn() {
    // Le joueur actuel a fini le trou ?
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    const dx = gameState.ball.x - level.hole.x;
    const dy = gameState.ball.y - level.hole.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 15) {
        // TROU REUSSI
        showMessage("Trou réussi !");
        
        // Ajouter au score total
        gameState.players[gameState.currentPlayerIndex].totalScore += gameState.players[gameState.currentPlayerIndex].score;

        // Passer au joueur suivant
        gameState.currentPlayerIndex++;

        if (gameState.currentPlayerIndex >= gameState.players.length) {
            // Tous les joueurs ont fini ce niveau -> Niveau suivant
            gameState.currentPlayerIndex = 0;
            gameState.currentLevelIndex++;

            if (gameState.currentLevelIndex >= gameState.levelsQueue.length) {
                endGame();
            } else {
                setTimeout(startLevel, 2000);
            }
        } else {
            // Au tour du joueur suivant sur le même trou
            setTimeout(startLevel, 2000);
        }
    }
}

function endGame() {
    const scoreboard = document.getElementById('scoreboard');
    
    // Trier les joueurs par score croissant (le golf, moins c'est mieux)
    const sortedPlayers = [...gameState.players].sort((a, b) => a.totalScore - b.totalScore);

    let html = `<table><thead><tr><th>Rang</th><th>Joueur</th><th>Score Total</th></tr></thead><tbody>`;
    sortedPlayers.forEach((p, index) => {
        html += `<tr><td>${index + 1}</td><td style="color:${p.color}; font-weight:bold;">${p.name}</td><td>${p.totalScore}</td></tr>`;
    });
    html += `</tbody></table>`;
    
    scoreboard.innerHTML = html;
    showScreen('end-screen');
}

// --- PHYSIQUE & CONTROLES ---

canvas.addEventListener('mousedown', (e) => {
    if (gameState.ball.moving) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Vérifier si on clique près de la balle
    const dist = Math.hypot(mouseX - gameState.ball.x, mouseY - gameState.ball.y);
    if (dist < 30) {
        gameState.isDragging = true;
        gameState.dragStart = { x: gameState.ball.x, y: gameState.ball.y };
        gameState.dragCurrent = { x: mouseX, y: mouseY };
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (gameState.isDragging) {
        const rect = canvas.getBoundingClientRect();
        gameState.dragCurrent = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
});

window.addEventListener('mouseup', () => {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        
        // Calculer la force
        const dx = gameState.dragStart.x - gameState.dragCurrent.x;
        const dy = gameState.dragStart.y - gameState.dragCurrent.y;
        
        // Limiter la vitesse max
        const power = 0.15;
        gameState.ball.vx = dx * power;
        gameState.ball.vy = dy * power;
        
        // Limite de vitesse absolue
        const maxSpeed = 15;
        const speed = Math.hypot(gameState.ball.vx, gameState.ball.vy);
        if (speed > maxSpeed) {
            const ratio = maxSpeed / speed;
            gameState.ball.vx *= ratio;
            gameState.ball.vy *= ratio;
        }

        if (speed > 0.5) {
            gameState.ball.moving = true;
            gameState.players[gameState.currentPlayerIndex].score++;
            updateHUD();
        }
    }
});

function gameLoop() {
    updatePhysics();
    draw();
    if (document.getElementById('game-screen').classList.contains('active')) {
        requestAnimationFrame(gameLoop);
    }
}

function updatePhysics() {
    if (!gameState.ball.moving) return;

    const ball = gameState.ball;
    
    // Friction (ralentissement)
    ball.vx *= 0.97;
    ball.vy *= 0.97;

    // Mise à jour position
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Arrêt si très lent
    if (Math.abs(ball.vx) < 0.1 && Math.abs(ball.vy) < 0.1) {
        ball.vx = 0;
        ball.vy = 0;
        ball.moving = false;
        nextTurn(); // Vérifie si on est dans le trou ou prépare le prochain coup
    }

    // Collisions Murs (Bords du canvas)
    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx *= -1; }
    if (ball.x + ball.radius > canvas.width) { ball.x = canvas.width - ball.radius; ball.vx *= -1; }
    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy *= -1; }
    if (ball.y + ball.radius > canvas.height) { ball.y = canvas.height - ball.radius; ball.vy *= -1; }

    // Collisions Obstacles
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if (level && level.walls) {
        level.walls.forEach(w => {
            // Détection collision simple AABB modifiée pour cercle
            // Point le plus proche sur le rectangle par rapport au centre du cercle
            const closestX = Math.max(w.x, Math.min(ball.x, w.x + w.w));
            const closestY = Math.max(w.y, Math.min(ball.y, w.y + w.h));

            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < ball.radius) {
                // Collision détectée, on inverse la vitesse selon l'axe dominant
                // C'est une physique simplifiée
                if (Math.abs(dx) > Math.abs(dy)) {
                    ball.vx *= -1;
                    ball.x += Math.sign(dx) * (ball.radius - distance); // Repousse la balle
                } else {
                    ball.vy *= -1;
                    ball.y += Math.sign(dy) * (ball.radius - distance);
                }
            }
        });
    }
}

function draw() {
    // Effacer
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameState.levelsQueue[gameState.currentLevelIndex]) return;

    const level = gameState.levelsQueue[gameState.currentLevelIndex];

    // 1. Dessiner le trou
    ctx.beginPath();
    ctx.arc(level.hole.x, level.hole.y, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    // Drapeau
    ctx.beginPath();
    ctx.moveTo(level.hole.x, level.hole.y);
    ctx.lineTo(level.hole.x, level.hole.y - 50);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = 'red';
    ctx.fillRect(level.hole.x, level.hole.y - 50, 20, 15);

    // 2. Dessiner les obstacles
    ctx.fillStyle = '#5d4037'; // Bois
    if (level.walls) {
        level.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.w, w.h);
            // Bordure claire pour effet 3D simple
            ctx.strokeStyle = '#8d6e63';
            ctx.strokeRect(w.x, w.y, w.w, w.h);
        });
    }

    // 3. Dessiner la ligne de visée (si on drag)
    if (gameState.isDragging) {
        ctx.beginPath();
        ctx.moveTo(gameState.ball.x, gameState.ball.y);
        ctx.lineTo(gameState.dragCurrent.x, gameState.dragCurrent.y);
        ctx.strokeStyle = 'white';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
    }

    // 4. Dessiner la balle
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI * 2);
    // Couleur du joueur actuel
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    ctx.fillStyle = currentPlayer ? currentPlayer.color : 'white';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
}

function updateHUD() {
    const p = gameState.players[gameState.currentPlayerIndex];
    document.getElementById('current-player-display').innerText = p.name;
    document.getElementById('current-player-display').style.color = p.color;
    document.getElementById('stroke-display').innerText = `Coups : ${p.score}`;
    document.getElementById('hole-display').innerText = `Trou ${gameState.currentLevelIndex + 1}/${gameState.levelsQueue.length}`;
}

function showMessage(msg) {
    const overlay = document.getElementById('message-overlay');
    overlay.innerText = msg;
    overlay.classList.add('show');
    overlay.style.display = 'block';
    
    setTimeout(() => {
        overlay.classList.remove('show');
        overlay.style.display = 'none';
    }, 1500);
}
