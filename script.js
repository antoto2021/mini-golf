// --- CONFIGURATION ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// Définition des parcours
const levelsData = [
    { id: 1, difficulty: 'easy', start: { x: 100, y: 300 }, hole: { x: 700, y: 300 }, walls: [] },
    { id: 2, difficulty: 'easy', start: { x: 100, y: 100 }, hole: { x: 700, y: 500 }, walls: [{ x: 300, y: 0, w: 20, h: 400 }] },
    { id: 3, difficulty: 'medium', start: { x: 50, y: 50 }, hole: { x: 750, y: 550 }, walls: [{ x: 200, y: 150, w: 400, h: 20 }, { x: 200, y: 450, w: 400, h: 20 }] },
    { id: 4, difficulty: 'medium', start: { x: 50, y: 300 }, hole: { x: 750, y: 300 }, walls: [{ x: 350, y: 200, w: 20, h: 200 }, { x: 300, y: 100, w: 20, h: 50 }, { x: 500, y: 450, w: 20, h: 50 }] },
    { id: 5, difficulty: 'hard', start: { x: 100, y: 500 }, hole: { x: 700, y: 100 }, walls: [{ x: 0, y: 400, w: 600, h: 20 }, { x: 200, y: 200, w: 600, h: 20 }] }
];

let gameState = {
    players: [],
    currentPlayerIndex: 0,
    currentLevelIndex: 0,
    levelsQueue: [],
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: 10, moving: false },
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCurrent: { x: 0, y: 0 }
};

const playerColors = ['#ff5252', '#448aff', '#e040fb', '#ffab40', '#69f0ae', '#ffd740'];
const screens = document.querySelectorAll('.screen');

// --- GESTION DU RESPONSIVE (MOBILE) ---
function resizeGame() {
    // Le jeu est conçu pour 800x600
    const originalWidth = 800;
    const originalHeight = 600;
    
    // Taille de la fenêtre actuelle
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Calcul du ratio pour tout faire rentrer
    const scaleX = Math.min(1, (windowWidth - 20) / originalWidth);
    const scaleY = Math.min(1, (windowHeight - 20) / originalHeight);
    const scale = Math.min(scaleX, scaleY);
    
    // Appliquer le zoom
    container.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', resizeGame);
resizeGame(); // Appel au démarrage

// --- NAVIGATION ---
function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

document.getElementById('btn-play').addEventListener('click', () => showScreen('setup-screen'));
document.getElementById('btn-start-game').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', () => location.reload());

function startGame() {
    const playerCount = parseInt(document.getElementById('player-count').value);
    const courseCount = parseInt(document.getElementById('course-count').value);
    const difficulty = document.getElementById('difficulty').value;

    gameState.players = [];
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({
            id: i + 1, name: `Joueur ${i + 1}`, score: 0, totalScore: 0, color: playerColors[i % playerColors.length]
        });
    }

    let availableLevels = levelsData;
    if (difficulty !== 'random') {
        availableLevels = levelsData.filter(l => l.difficulty === difficulty);
        if (availableLevels.length === 0) availableLevels = levelsData;
    }

    gameState.levelsQueue = [];
    for (let i = 0; i < courseCount; i++) {
        gameState.levelsQueue.push(availableLevels[i % availableLevels.length]);
    }

    gameState.currentLevelIndex = 0;
    gameState.currentPlayerIndex = 0;
    startLevel();
    showScreen('game-screen');
    resizeGame(); // Force resize
    requestAnimationFrame(gameLoop);
}

function startLevel() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    gameState.ball.x = level.start.x;
    gameState.ball.y = level.start.y;
    gameState.ball.vx = 0; gameState.ball.vy = 0;
    gameState.ball.moving = false;
    gameState.players[gameState.currentPlayerIndex].score = 0;
    updateHUD();
    showMessage(`Joueur ${gameState.players[gameState.currentPlayerIndex].id} à toi !`);
}

function nextTurn() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    const dist = Math.hypot(gameState.ball.x - level.hole.x, gameState.ball.y - level.hole.y);

    if (dist < 15) {
        showMessage("Trou réussi !");
        gameState.players[gameState.currentPlayerIndex].totalScore += gameState.players[gameState.currentPlayerIndex].score;
        gameState.currentPlayerIndex++;

        if (gameState.currentPlayerIndex >= gameState.players.length) {
            gameState.currentPlayerIndex = 0;
            gameState.currentLevelIndex++;
            if (gameState.currentLevelIndex >= gameState.levelsQueue.length) {
                endGame();
            } else {
                setTimeout(startLevel, 2000);
            }
        } else {
            setTimeout(startLevel, 2000);
        }
    }
}

function endGame() {
    const sorted = [...gameState.players].sort((a, b) => a.totalScore - b.totalScore);
    let html = `<table><thead><tr><th>Rang</th><th>Joueur</th><th>Total</th></tr></thead><tbody>`;
    sorted.forEach((p, i) => {
        html += `<tr><td>${i+1}</td><td style="color:${p.color}">${p.name}</td><td>${p.totalScore}</td></tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('scoreboard').innerHTML = html;
    showScreen('end-screen');
}

// --- CONTROLES (SOURIS ET TACTILE) ---
// Fonction utilitaire pour obtenir les coordonnées correctes malgré le scaling CSS
function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Si c'est du tactile (touches) ou souris (clientX)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleStart(e) {
    if (gameState.ball.moving) return;
    e.preventDefault(); // Empêcher le scroll
    const pos = getEventPos(e);
    
    if (Math.hypot(pos.x - gameState.ball.x, pos.y - gameState.ball.y) < 40) {
        gameState.isDragging = true;
        gameState.dragStart = { x: gameState.ball.x, y: gameState.ball.y };
        gameState.dragCurrent = pos;
    }
}

function handleMove(e) {
    if (gameState.isDragging) {
        e.preventDefault();
        gameState.dragCurrent = getEventPos(e);
    }
}

function handleEnd(e) {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        const dx = gameState.dragStart.x - gameState.dragCurrent.x;
        const dy = gameState.dragStart.y - gameState.dragCurrent.y;
        
        const power = 0.15;
        gameState.ball.vx = dx * power;
        gameState.ball.vy = dy * power;
        
        // Limite de vitesse
        const speed = Math.hypot(gameState.ball.vx, gameState.ball.vy);
        if (speed > 15) {
            const ratio = 15 / speed;
            gameState.ball.vx *= ratio;
            gameState.ball.vy *= ratio;
        }

        if (speed > 0.5) {
            gameState.ball.moving = true;
            gameState.players[gameState.currentPlayerIndex].score++;
            updateHUD();
        }
    }
}

// Écouteurs Souris
canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

// Écouteurs Tactiles (Mobiles)
canvas.addEventListener('touchstart', handleStart, {passive: false});
canvas.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

// --- BOUCLE DE JEU ---
function gameLoop() {
    updatePhysics();
    draw();
    if (document.getElementById('game-screen').classList.contains('active')) {
        requestAnimationFrame(gameLoop);
    }
}

function updatePhysics() {
    if (!gameState.ball.moving) return;
    const b = gameState.ball;
    b.vx *= 0.97; b.vy *= 0.97;
    b.x += b.vx; b.y += b.vy;

    if (Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1) {
        b.vx = 0; b.vy = 0; b.moving = false;
        nextTurn();
    }

    // Murs bordure
    if (b.x < b.radius) { b.x = b.radius; b.vx *= -1; }
    if (b.x > canvas.width - b.radius) { b.x = canvas.width - b.radius; b.vx *= -1; }
    if (b.y < b.radius) { b.y = b.radius; b.vy *= -1; }
    if (b.y > canvas.height - b.radius) { b.y = canvas.height - b.radius; b.vy *= -1; }

    // Obstacles
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if (level && level.walls) {
        level.walls.forEach(w => {
            const cx = Math.max(w.x, Math.min(b.x, w.x + w.w));
            const cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
            const dist = Math.hypot(b.x - cx, b.y - cy);
            if (dist < b.radius) {
                if (Math.abs(b.x - cx) > Math.abs(b.y - cy)) b.vx *= -1;
                else b.vy *= -1;
            }
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameState.levelsQueue[gameState.currentLevelIndex]) return;
    const level = gameState.levelsQueue[gameState.currentLevelIndex];

    // Trou
    ctx.beginPath(); ctx.arc(level.hole.x, level.hole.y, 15, 0, Math.PI*2);
    ctx.fillStyle = '#333'; ctx.fill();
    // Drapeau
    ctx.beginPath(); ctx.moveTo(level.hole.x, level.hole.y); ctx.lineTo(level.hole.x, level.hole.y - 40);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'red'; ctx.fillRect(level.hole.x, level.hole.y - 40, 20, 15);

    // Murs
    ctx.fillStyle = '#5d4037'; ctx.lineWidth = 1;
    level.walls.forEach(w => { ctx.fillRect(w.x, w.y, w.w, w.h); ctx.strokeRect(w.x, w.y, w.w, w.h); });

    // Trait de visée
    if (gameState.isDragging) {
        ctx.beginPath(); ctx.moveTo(gameState.ball.x, gameState.ball.y);
        ctx.lineTo(gameState.dragCurrent.x, gameState.dragCurrent.y);
        ctx.strokeStyle = 'white'; ctx.setLineDash([10, 10]); ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
    }

    // Balle
    ctx.beginPath(); ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius, 0, Math.PI*2);
    ctx.fillStyle = gameState.players[gameState.currentPlayerIndex] ? gameState.players[gameState.currentPlayerIndex].color : 'white';
    ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
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
    setTimeout(() => { overlay.classList.remove('show'); }, 1500);
}
