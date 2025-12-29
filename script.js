// --- 1. CONFIGURATION & NIVEAUX ---

const SurfaceColors = {
    GRASS: '#00c853', GRASS_DARK: '#00a040', ICE: '#b3e5fc', SAND: '#ffd54f',
    PINK_SAND: '#f48fb1', WATER: '#0288d1', OIL: '#424242'
};

const Friction = {
    GRASS: 0.975, ICE: 0.992, SAND: 0.94, PINK_SAND: 0.88
};

const levelsData = [
    {
        id: 1, start: { x: 300, y: 800 }, hole: { x: 300, y: 150 },
        walls: [{ x: 100, y: 400, w: 400, h: 30 }], zones: []
    },
    {
        id: 2, start: { x: 100, y: 800 }, hole: { x: 500, y: 100 },
        walls: [{ x: 290, y: 300, w: 20, h: 300 }],
        zones: [{ x: 0, y: 300, w: 600, h: 300, type: 'ICE' }, { x: 400, y: 50, w: 200, h: 200, type: 'SAND' }]
    },
    {
        id: 3, start: { x: 300, y: 850 }, hole: { x: 300, y: 100 }, walls: [],
        zones: [{ x: 100, y: 300, w: 400, h: 300, type: 'PINK_SAND' }]
    },
    {
        id: 4, start: { x: 100, y: 800 }, hole: { x: 500, y: 200 },
        walls: [{ x: 250, y: 400, w: 350, h: 30 }],
        zones: [{ x: 0, y: 0, w: 200, h: 600, type: 'WATER' }]
    },
    {
        id: 5, start: { x: 300, y: 850 }, hole: { x: 300, y: 100 },
        walls: [{x: 150, y: 600, w: 300, h: 30}, {x: 150, y: 300, w: 300, h: 30}],
        zones: [{ x: 0, y: 450, w: 600, h: 100, type: 'OIL' }, { x: 0, y: 150, w: 600, h: 100, type: 'OIL' }]
    }
];

// --- 2. MOTEUR DU JEU ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// Force le mode tactile pour éviter le scroll sur mobile
canvas.style.touchAction = "none";

const VIRTUAL_WIDTH = 600;
const VIRTUAL_HEIGHT = 900;
let scaleFactor = 1;

const playerColors = ['#ff3d00', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#00b0ff'];

let gameState = {
    players: [], currentPlayerIndex: 0, currentLevelIndex: 0, levelsQueue: [],
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: 18, moving: false, lastStablePos: {x:0, y:0} },
    isDragging: false, dragStart: { x: 0, y: 0 }, dragVector: { x: 0, y: 0 }, dragPower: 0
};

const MAX_POWER_DIST = 250;
const POWER_MULTIPLIER = 0.08;
const STOP_VELOCITY = 0.15;

// --- INITIALISATION ---
window.addEventListener('DOMContentLoaded', () => {
    resizeGame();
    window.addEventListener('resize', resizeGame);

    // Initialisation des inputs
    setupInputs();

    const slider = document.getElementById('player-count');
    const display = document.getElementById('player-count-val');
    if(slider && display) slider.addEventListener('input', (e) => display.innerText = e.target.value);

    const btnPlay = document.getElementById('btn-play');
    if(btnPlay) btnPlay.addEventListener('click', () => showScreen('setup-screen'));

    const btnStart = document.getElementById('btn-start-game');
    if(btnStart) btnStart.addEventListener('click', startGame);

    const btnHome = document.getElementById('btn-home');
    if(btnHome) btnHome.addEventListener('click', () => location.reload());
});

function resizeGame() {
    if(!container || !canvas) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    scaleFactor = Math.min(rect.width / VIRTUAL_WIDTH, rect.height / VIRTUAL_HEIGHT);
    
    // On centre le jeu
    const offsetX = (rect.width - VIRTUAL_WIDTH * scaleFactor) / 2;
    const offsetY = (rect.height - VIRTUAL_HEIGHT * scaleFactor) / 2;
    
    // Réinitialise la matrice de transformation
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); 
    ctx.translate(offsetX * dpr, offsetY * dpr);
    ctx.scale(scaleFactor, scaleFactor);
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(id);
    if(screen) screen.classList.add('active');
}

function showMessage(msg, isBad = false) {
    const overlay = document.getElementById('message-overlay');
    if(!overlay) return;
    overlay.innerText = msg;
    overlay.style.color = isBad ? '#d32f2f' : '#009624';
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 2000);
}

function startGame() {
    const playerCount = parseInt(document.getElementById('player-count').value);
    const courseCount = parseInt(document.getElementById('course-count').value);

    gameState.players = [];
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({
            id: i + 1, name: `Joueur ${i + 1}`, score: 0, totalScore: 0, color: playerColors[i % playerColors.length]
        });
    }

    gameState.levelsQueue = levelsData.slice(0, courseCount);
    gameState.currentLevelIndex = 0;
    gameState.currentPlayerIndex = 0;

    resizeGame();
    startLevel();
    showScreen('game-screen');
    requestAnimationFrame(gameLoop);
}

function startLevel() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if(!level) return;
    resetBall(level.start);
    gameState.players.forEach(p => p.score = 0);
    updateHUD();
    showMessage(`Niveau ${gameState.currentLevelIndex + 1}`);
}

function resetBall(pos) {
    gameState.ball.x = pos.x;
    gameState.ball.y = pos.y;
    gameState.ball.vx = 0; gameState.ball.vy = 0;
    gameState.ball.moving = false;
    gameState.ball.lastStablePos = { x: pos.x, y: pos.y };
}

function gameLoop() {
    update();
    draw();
    if (document.getElementById('game-screen').classList.contains('active')) {
        requestAnimationFrame(gameLoop);
    }
}

// --- PHYSIQUE ---
function update() {
    if (gameState.ball.moving) updatePhysics();
}

function updatePhysics() {
    const b = gameState.ball;
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    let currentFriction = Friction.GRASS;
    let onHazard = null;

    if (level && level.zones) {
        for (const zone of level.zones) {
            if (b.x > zone.x && b.x < zone.x + zone.w && b.y > zone.y && b.y < zone.y + zone.h) {
                if (zone.type === 'WATER') onHazard = 'WATER';
                else if (zone.type === 'OIL') onHazard = 'OIL';
                else if (Friction[zone.type]) currentFriction = Friction[zone.type];
                break;
            }
        }
    }

    if (onHazard === 'WATER') {
        showMessage("PLOUF !", true);
        resetBall(b.lastStablePos);
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
        return;
    } else if (onHazard === 'OIL') {
        showMessage("GLISSADE !", true);
        resetBall(level.start);
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
        return;
    }

    b.vx *= currentFriction; b.vy *= currentFriction;
    b.x += b.vx; b.y += b.vy;

    if (Math.abs(b.vx) < STOP_VELOCITY && Math.abs(b.vy) < STOP_VELOCITY) {
        b.vx = 0; b.vy = 0; b.moving = false;
        b.lastStablePos = { x: b.x, y: b.y };
        checkHoleOrNextTurn();
    }

    // Collisions Murs Monde
    if (b.x < b.radius) { b.x = b.radius; b.vx *= -1; }
    if (b.x > VIRTUAL_WIDTH - b.radius) { b.x = VIRTUAL_WIDTH - b.radius; b.vx *= -1; }
    if (b.y < b.radius) { b.y = b.radius; b.vy *= -1; }
    if (b.y > VIRTUAL_HEIGHT - b.radius) { b.y = VIRTUAL_HEIGHT - b.radius; b.vy *= -1; }

    // Collisions Obstacles
    if (level && level.walls) {
        level.walls.forEach(w => {
            const cx = Math.max(w.x, Math.min(b.x, w.x + w.w));
            const cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
            if (Math.hypot(b.x - cx, b.y - cy) < b.radius) {
                if (Math.abs(b.x - cx) > Math.abs(b.y - cy)) {
                    b.vx *= -1.1; b.x = cx + (b.x > cx ? b.radius : -b.radius);
                } else {
                    b.vy *= -1.1; b.y = cy + (b.y > cy ? b.radius : -b.radius);
                }
            }
        });
    }
}

function checkHoleOrNextTurn() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if (Math.hypot(gameState.ball.x - level.hole.x, gameState.ball.y - level.hole.y) < 25) {
        showMessage("Trou réussi !");
        const p = gameState.players[gameState.currentPlayerIndex];
        p.totalScore += p.score;
        gameState.currentPlayerIndex++;
        
        if (gameState.currentPlayerIndex >= gameState.players.length) {
            gameState.currentPlayerIndex = 0;
            gameState.currentLevelIndex++;
            if (gameState.currentLevelIndex >= gameState.levelsQueue.length) endGame();
            else setTimeout(startLevel, 1500);
        } else {
            setTimeout(startLevel, 1500);
        }
    } else {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
        updateHUD();
        showMessage(`À ${gameState.players[gameState.currentPlayerIndex].name}`);
    }
}

// --- DESSIN ---
function draw() {
    // Effacer avec la couleur de fond
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if (!level) return;

    // Fond Herbe
    const tileSize = 50;
    for (let i = 0; i < VIRTUAL_WIDTH / tileSize; i++) {
        for (let j = 0; j < VIRTUAL_HEIGHT / tileSize; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? SurfaceColors.GRASS : SurfaceColors.GRASS_DARK;
            ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
    }

    // Zones
    if (level.zones) {
        level.zones.forEach(zone => {
            ctx.fillStyle = SurfaceColors[zone.type] || 'rgba(0,0,0,0.2)';
            ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
            if (zone.type === 'WATER' || zone.type === 'OIL') {
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4;
                ctx.strokeRect(zone.x+2, zone.y+2, zone.w-4, zone.h-4);
            }
        });
    }

    // Trou
    ctx.beginPath(); ctx.arc(level.hole.x, level.hole.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#212121'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(level.hole.x, level.hole.y); ctx.lineTo(level.hole.x, level.hole.y - 60);
    ctx.strokeStyle = '#cfd8dc'; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(level.hole.x, level.hole.y - 60);
    ctx.lineTo(level.hole.x + 30, level.hole.y - 50); ctx.lineTo(level.hole.x, level.hole.y - 40);
    ctx.fillStyle = '#ff3d00'; ctx.fill();

    // Murs
    if(level.walls) {
        ctx.fillStyle = '#795548'; ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 4;
        level.walls.forEach(w => {
            ctx.fillRect(w.x, w.y, w.w, w.h); ctx.strokeRect(w.x+2, w.y+2, w.w-4, w.h-4);
        });
    }

    // Flèche de visée (Affichée dès qu'on touche l'écran)
    if (gameState.isDragging && !gameState.ball.moving) drawAimArrow();
    
    // Balle
    const b = gameState.ball;
    const p = gameState.players[gameState.currentPlayerIndex];
    ctx.beginPath(); ctx.ellipse(b.x+3, b.y+3, b.radius, b.radius*0.8, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
    ctx.fillStyle = p ? p.color : 'white'; ctx.fill();
    
    // Feedback visuel quand on touche (la balle devient blanche brillante)
    if (gameState.isDragging) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'white';
    } else {
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; 
    }
    ctx.stroke();
}

function drawAimArrow() {
    const b = gameState.ball;
    const dx = gameState.dragVector.x; const dy = gameState.dragVector.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.max(40, gameState.dragPower * 1.5) + b.radius + 10;
    
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    const col = `hsl(${120 - (gameState.dragPower * 1.2)}, 100%, 50%)`;
    ctx.fillStyle = col; ctx.strokeStyle = 'white'; ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.rect(b.radius + 5, -b.radius/2, length - b.radius - 25, b.radius);
    ctx.fill(); ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(length - 20, -b.radius);
    ctx.lineTo(length + 10, 0);
    ctx.lineTo(length - 20, b.radius);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    
    ctx.rotate(-angle);
    ctx.fillStyle = col; ctx.font = '900 20px Nunito'; ctx.textAlign = 'center';
    // Affiche le % uniquement si on tire vraiment
    if(gameState.dragPower > 2) {
        ctx.fillText(`${Math.round(gameState.dragPower)}%`, -dx*0.3, -dy*0.3 - 30);
    }
    ctx.restore();
}

// --- CONTROLES UNIFIÉS (Correctifs Mobile) ---

function getVirtualPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); // Important : utiliser canvas, pas container
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Position dans le canvas en pixels physiques
    const physX = (clientX - rect.left) * scaleX;
    const physY = (clientY - rect.top) * scaleY;
    
    // Annuler les transformations du contexte (translation et scale)
    // On doit recalculer les offsets utilisés dans resizeGame
    const rectContainer = container.getBoundingClientRect();
    const currentScale = Math.min(rectContainer.width / VIRTUAL_WIDTH, rectContainer.height / VIRTUAL_HEIGHT);
    const offsetX = (rectContainer.width - VIRTUAL_WIDTH * currentScale) / 2;
    const offsetY = (rectContainer.height - VIRTUAL_HEIGHT * currentScale) / 2;

    // Conversion finale
    // Note: On utilise direct la position relative au canvas, mais on doit ajuster si le canvas a des marges internes
    // Méthode simplifiée qui marche avec le centering actuel :
    
    // Re-calcul simple basé sur le dessin
    const dpr = window.devicePixelRatio || 1;
    const xInCanvas = (clientX - rect.left);
    const yInCanvas = (clientY - rect.top);
    
    // On retire l'offset visuel (bandes noires potentielles)
    const activeWidth = VIRTUAL_WIDTH * currentScale;
    const activeHeight = VIRTUAL_HEIGHT * currentScale;
    const marginX = (rect.width - activeWidth) / 2;
    const marginY = (rect.height - activeHeight) / 2;
    
    const virtualX = (xInCanvas - marginX) / currentScale;
    const virtualY = (yInCanvas - marginY) / currentScale;

    return { x: virtualX, y: virtualY };
}

function handleStart(e) {
    if (gameState.ball.moving) return;
    
    // Empêche le comportement par défaut (scroll, zoom)
    if(e.cancelable) e.preventDefault();
    
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    
    gameState.isDragging = true;
    gameState.dragStart = getVirtualPos(cx, cy);
    gameState.dragVector = { x: 0, y: 0 };
    gameState.dragPower = 0;
}

function handleMove(e) {
    if (!gameState.isDragging) return;
    if(e.cancelable) e.preventDefault();

    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const cur = getVirtualPos(cx, cy);

    let dx = gameState.dragStart.x - cur.x;
    let dy = gameState.dragStart.y - cur.y;
    let dist = Math.hypot(dx, dy);
    
    if (dist > MAX_POWER_DIST) {
        dx = (dx / dist) * MAX_POWER_DIST;
        dy = (dy / dist) * MAX_POWER_DIST;
        dist = MAX_POWER_DIST;
    }
    
    gameState.dragVector = { x: dx, y: dy };
    gameState.dragPower = (dist / MAX_POWER_DIST) * 100;
}

function handleEnd(e) {
    if (!gameState.isDragging) return;
    // Sur mobile, touchend n'a pas de touches, donc pas de preventDefault nécessaire souvent
    
    gameState.isDragging = false;
    
    // Seuil de tir réduit pour faciliter le jeu sur mobile
    if (gameState.dragPower > 2) {
        gameState.ball.vx = gameState.dragVector.x * POWER_MULTIPLIER;
        gameState.ball.vy = gameState.dragVector.y * POWER_MULTIPLIER;
        gameState.ball.moving = true;
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
    }
    
    gameState.dragVector = { x: 0, y: 0 }; 
    gameState.dragPower = 0;
}

function setupInputs() {
    // Souris
    canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);

    // Tactile (Important : passive: false pour autoriser preventDefault)
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
}

function updateHUD() {
    const p = gameState.players[gameState.currentPlayerIndex];
    if(p) {
        document.getElementById('player-name').innerText = p.name;
        document.getElementById('player-score').innerText = `Coups: ${p.score}`;
        document.getElementById('player-avatar').style.backgroundColor = p.color;
    }
    document.getElementById('hole-display').innerText = `Trou ${gameState.currentLevelIndex + 1}/${gameState.levelsQueue.length}`;
}

function endGame() {
    const sorted = [...gameState.players].sort((a, b) => a.totalScore - b.totalScore);
    let html = `<table><thead><tr><th>#</th><th>Joueur</th><th>Total</th></tr></thead><tbody>`;
    sorted.forEach((p, i) => {
        html += `<tr><td>${i+1}</td><td style="color:${p.color}">${p.name}</td><td>${p.totalScore}</td></tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('scoreboard').innerHTML = html;
    showScreen('end-screen');
}
