// --- CONFIGURATION & VARIABLES GLOBALES ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// Dimensions virtuelles du jeu (ratio portrait 2:3)
// Le jeu est calculé sur cette base, puis dessiné à l'échelle de l'écran.
const VIRTUAL_WIDTH = 600;
const VIRTUAL_HEIGHT = 900;
let scaleFactor = 1; // Facteur de mise à l'échelle actuel

// Couleurs des joueurs (Palette moderne)
const playerColors = ['#ff3d00', '#2979ff', '#00e676', '#ffc400', '#d500f9', '#00b0ff'];

let gameState = {
    players: [],
    currentPlayerIndex: 0,
    currentLevelIndex: 0,
    levelsQueue: [],
    // Balle : rayon augmenté pour le style cartoon
    ball: { x: 0, y: 0, vx: 0, vy: 0, radius: 18, moving: false, lastStablePos: {x:0, y:0} },
    // Contrôles
    isDragging: false,
    dragStart: { x: 0, y: 0 }, // Position virtuelle du début du drag
    dragVector: { x: 0, y: 0 }, // Vecteur de tir actuel
    dragPower: 0 // Pourcentage de puissance (0-100)
};

// CONSTANTES PHYSIQUES
const MAX_POWER_DIST = 250; // Distance de tir max en pixels virtuels
const POWER_MULTIPLIER = 0.08; // Force du tir
const STOP_VELOCITY = 0.15; // Vitesse sous laquelle la balle s'arrête

// --- GESTION DU REDIMENSIONNEMENT (RESPONSIVE MOBILE NET) ---
function resizeGame() {
    // 1. Obtenir la taille affichée du conteneur CSS
    const rect = container.getBoundingClientRect();
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // 2. Tenir compte du pixel ratio pour les écrans Retina/HDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // 3. Normaliser le contexte pour dessiner en coordonnées virtuelles
    ctx.scale(dpr, dpr); // On met à l'échelle du DPR
    // Calculer le facteur pour passer de VIRTUAL_WIDTH/HEIGHT à l'affichage réel
    scaleFactor = Math.min(displayWidth / VIRTUAL_WIDTH, displayHeight / VIRTUAL_HEIGHT);
    
    // Centrer le rendu si le ratio de l'écran est différent
    const offsetX = (displayWidth - VIRTUAL_WIDTH * scaleFactor) / 2;
    const offsetY = (displayHeight - VIRTUAL_HEIGHT * scaleFactor) / 2;
    
    ctx.translate(offsetX, offsetY);
    ctx.scale(scaleFactor, scaleFactor);
}
window.addEventListener('resize', resizeGame);
// Appel initial retardé pour être sûr que le CSS est chargé
setTimeout(resizeGame, 100);

// --- UI HELPERS ---
const playerSlider = document.getElementById('player-count');
const playerValDisplay = document.getElementById('player-count-val');
playerSlider.addEventListener('input', (e) => playerValDisplay.innerText = e.target.value);

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function showMessage(msg, isBad = false) {
    const overlay = document.getElementById('message-overlay');
    overlay.innerText = msg;
    overlay.style.color = isBad ? '#d32f2f' : '#009624';
    overlay.classList.add('show');
    setTimeout(() => overlay.classList.remove('show'), 2000);
}

// --- BOUCLE DE JEU PRINCIPALE ---
function gameLoop() {
    update();
    draw();
    if (document.getElementById('game-screen').classList.contains('active')) {
        requestAnimationFrame(gameLoop);
    }
}

// --- INITIALISATION ---
document.getElementById('btn-play').addEventListener('click', () => showScreen('setup-screen'));
document.getElementById('btn-start-game').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', () => location.reload());

function startGame() {
    const playerCount = parseInt(playerSlider.value);
    const courseCount = parseInt(document.getElementById('course-count').value);

    gameState.players = [];
    for (let i = 0; i < playerCount; i++) {
        gameState.players.push({
            id: i + 1, name: `Joueur ${i + 1}`, score: 0, totalScore: 0, color: playerColors[i % playerColors.length]
        });
    }

    // Sélection simple des N premiers niveaux
    gameState.levelsQueue = levelsData.slice(0, courseCount);
    gameState.currentLevelIndex = 0;
    gameState.currentPlayerIndex = 0;

    resizeGame(); // Force un resize propre avant de commencer
    startLevel();
    showScreen('game-screen');
    requestAnimationFrame(gameLoop);
}

function startLevel() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    resetBall(level.start);
    gameState.players.forEach(p => p.score = 0);
    updateHUD();
    showMessage(`Niveau ${gameState.currentLevelIndex + 1} - ${gameState.players[0].name}`);
}

function resetBall(pos) {
    gameState.ball.x = pos.x;
    gameState.ball.y = pos.y;
    gameState.ball.vx = 0; gameState.ball.vy = 0;
    gameState.ball.moving = false;
    // Sauvegarde la position sûre pour le respawn "Eau"
    gameState.ball.lastStablePos = { x: pos.x, y: pos.y };
}

// --- LOGIQUE ET PHYSIQUE ---
function update() {
    if (gameState.ball.moving) {
        updatePhysics();
    }
}

function updatePhysics() {
    const b = gameState.ball;
    const level = gameState.levelsQueue[gameState.currentLevelIndex];

    // 1. Déterminer la surface sous la balle
    let currentFriction = Friction.GRASS; // Par défaut
    let onHazard = null;

    if (level && level.zones) {
        for (const zone of level.zones) {
            // Détection simple si le centre de la balle est dans le rectangle de la zone
            if (b.x > zone.x && b.x < zone.x + zone.w &&
                b.y > zone.y && b.y < zone.y + zone.h) {
                
                if (zone.type === 'WATER') onHazard = 'WATER';
                else if (zone.type === 'OIL') onHazard = 'OIL';
                else if (Friction[zone.type]) currentFriction = Friction[zone.type];
                break; // On prend la première zone trouvée (éviter les superpositions)
            }
        }
    }

    // 2. Gérer les Dangers (Eau/Pétrole)
    if (onHazard === 'WATER') {
        showMessage("PLOUF ! À l'eau !", true);
        resetBall(b.lastStablePos); // Retour dernière position sûre
        // Pénalité de 1 coup
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
        return; // On arrête la physique pour cette frame
    } else if (onHazard === 'OIL') {
        showMessage("GLISSADE ! Retour départ !", true);
        resetBall(level.start); // Retour case départ
        // Pénalité de 1 coup
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
        return;
    }

    // 3. Appliquer le mouvement et la friction de la surface
    b.vx *= currentFriction;
    b.vy *= currentFriction;
    b.x += b.vx;
    b.y += b.vy;

    // 4. Arrêt de la balle
    if (Math.abs(b.vx) < STOP_VELOCITY && Math.abs(b.vy) < STOP_VELOCITY) {
        b.vx = 0; b.vy = 0; b.moving = false;
        // La balle est arrêtée, c'est une nouvelle "position sûre"
        b.lastStablePos = { x: b.x, y: b.y };
        checkHoleOrNextTurn();
    }

    // 5. Collisions Murs (Bords du monde virtuel)
    if (b.x < b.radius) { b.x = b.radius; b.vx *= -1; }
    if (b.x > VIRTUAL_WIDTH - b.radius) { b.x = VIRTUAL_WIDTH - b.radius; b.vx *= -1; }
    if (b.y < b.radius) { b.y = b.radius; b.vy *= -1; }
    if (b.y > VIRTUAL_HEIGHT - b.radius) { b.y = VIRTUAL_HEIGHT - b.radius; b.vy *= -1; }

    // 6. Collisions Obstacles
    if (level && level.walls) {
        level.walls.forEach(w => {
            // Trouver le point le plus proche sur le rectangle du mur
            const cx = Math.max(w.x, Math.min(b.x, w.x + w.w));
            const cy = Math.max(w.y, Math.min(b.y, w.y + w.h));
            const dist = Math.hypot(b.x - cx, b.y - cy);

            if (dist < b.radius) {
                // Collision ! On inverse la vitesse selon l'axe principal du choc
                if (Math.abs(b.x - cx) > Math.abs(b.y - cy)) {
                    b.vx *= -1.1; // Petit rebond bonus pour le fun
                     // Repousser la balle pour éviter qu'elle ne colle au mur
                    b.x = cx + (b.x > cx ? b.radius : -b.radius);
                }
                else {
                    b.vy *= -1.1;
                    b.y = cy + (b.y > cy ? b.radius : -b.radius);
                }
            }
        });
    }
}

function checkHoleOrNextTurn() {
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    // Distance au centre du trou. Tolérance un peu plus grande que le rayon.
    const dist = Math.hypot(gameState.ball.x - level.hole.x, gameState.ball.y - level.hole.y);

    if (dist < 25) {
        // TROU RÉUSSI !
        showMessage("Trou réussi !");
        const p = gameState.players[gameState.currentPlayerIndex];
        p.totalScore += p.score;

        gameState.currentPlayerIndex++;
        if (gameState.currentPlayerIndex >= gameState.players.length) {
            // Niveau terminé pour tous
            gameState.currentPlayerIndex = 0;
            gameState.currentLevelIndex++;
            if (gameState.currentLevelIndex >= gameState.levelsQueue.length) {
                endGame();
            } else {
                setTimeout(startLevel, 1500);
            }
        } else {
            // Au joueur suivant sur le même trou
            setTimeout(startLevel, 1500);
        }
    } else {
        // PAS DANS LE TROU : Au joueur suivant depuis cette position
         gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
         updateHUD();
         showMessage(`À ${gameState.players[gameState.currentPlayerIndex].name}`);
    }
}

// --- DESSIN (RENDER) ---
function draw() {
    // On efface tout l'espace virtuel
    ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    
    const level = gameState.levelsQueue[gameState.currentLevelIndex];
    if (!level) return;

    drawBackground(level);
    drawHole(level.hole);
    drawWalls(level.walls);
    
    // Dessiner la flèche si on vise, sinon la balle
    if (gameState.isDragging && !gameState.ball.moving) {
        drawAimArrow();
    }
    // On dessine toujours la balle (par-dessus la base de la flèche)
    drawBall();
}

function drawBackground(level) {
    // 1. Fond Herbe de base (Damier subtil)
    const tileSize = 50;
    for (let i = 0; i < VIRTUAL_WIDTH / tileSize; i++) {
        for (let j = 0; j < VIRTUAL_HEIGHT / tileSize; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? SurfaceColors.GRASS : SurfaceColors.GRASS_DARK;
            ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
        }
    }

    // 2. Zones spéciales (Glace, Sable, Eau...)
    if (level.zones) {
        level.zones.forEach(zone => {
            ctx.fillStyle = SurfaceColors[zone.type] || 'rgba(0,0,0,0.2)';
            ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
            
            // Bordure pour l'eau et le pétrole
            if (zone.type === 'WATER' || zone.type === 'OIL') {
                ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                ctx.lineWidth = 4;
                ctx.strokeRect(zone.x+2, zone.y+2, zone.w-4, zone.h-4);
            }
        });
    }
}

function drawWalls(walls) {
    // Murs style "Bois cartoon"
    ctx.fillStyle = '#795548';
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 4;
    if (!walls) return;
    walls.forEach(w => {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
        // Petit effet de lumière sur le dessus
        ctx.fillStyle = '#a1887f';
        ctx.fillRect(w.x+4, w.y, w.w-8, 6);
        ctx.fillStyle = '#795548'; // Reset fill
    });
}

function drawHole(hole) {
    // Trou
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#212121';
    ctx.fill();
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Drapeau
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y);
    ctx.lineTo(hole.x, hole.y - 60);
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y - 60);
    ctx.lineTo(hole.x + 30, hole.y - 50);
    ctx.lineTo(hole.x, hole.y - 40);
    ctx.fillStyle = '#ff3d00';
    ctx.fill();
}

function drawBall() {
    const b = gameState.ball;
    const p = gameState.players[gameState.currentPlayerIndex];
    
    // Ombre de la balle
    ctx.beginPath();
    ctx.ellipse(b.x + 3, b.y + 3, b.radius, b.radius * 0.8, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Corps de la balle
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = p ? p.color : 'white';
    ctx.fill();
    
    // Effet de reflet style cartoon (petit cercle blanc en haut à gauche)
    ctx.beginPath();
    ctx.arc(b.x - b.radius*0.3, b.y - b.radius*0.3, b.radius*0.25, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// NOUVEAU : Dessin de la flèche de visée
function drawAimArrow() {
    const b = gameState.ball;
    const dx = gameState.dragVector.x;
    const dy = gameState.dragVector.y;
    const angle = Math.atan2(dy, dx);
    // Longueur basée sur la puissance, avec un minimum pour qu'elle se voie
    const length = Math.max(40, gameState.dragPower * 1.5) + b.radius + 10; 
    const arrowWidth = b.radius * 2; // Largeur de la balle comme demandé

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle); // On tourne tout le contexte dans la direction du tir

    // Couleur dynamique selon la puissance (Vert -> Jaune -> Rouge)
    const powerHue = 120 - (gameState.dragPower * 1.2); // 120(vert) à 0(rouge)
    const arrowColor = `hsl(${powerHue}, 100%, 50%)`;
    
    ctx.fillStyle = arrowColor;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;

    // Dessiner la flèche (corps + pointe)
    ctx.beginPath();
    // Corps (rectangle qui commence après la balle)
    ctx.rect(b.radius + 5, -arrowWidth/4, length - b.radius - 25, arrowWidth/2);
    ctx.fill();
    ctx.stroke();

    // Pointe
    ctx.beginPath();
    ctx.moveTo(length - 20, -arrowWidth/2); // Haut de la base de la pointe
    ctx.lineTo(length + 10, 0);             // Bout de la pointe
    ctx.lineTo(length - 20, arrowWidth/2);  // Bas de la base de la pointe
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Texte de pourcentage
    ctx.rotate(-angle); // On annule la rotation pour le texte
    ctx.fillStyle = arrowColor;
    ctx.font = '900 20px Nunito';
    ctx.textAlign = 'center';
    // Positionner le texte un peu au-dessus de la balle dans la direction opposée au tir
    ctx.fillText(`${Math.round(gameState.dragPower)}%`, -dx * 0.3, -dy * 0.3 - 30);

    ctx.restore();
}


// --- CONTRÔLES (Souris & Tactile unifiés) ---

// Convertit une position écran (pixels réels) en position monde virtuel
function getVirtualPos(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    // 1. Position relative dans le canvas affiché
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    // 2. Prendre en compte le centrage (translate) fait lors du resize
    // Il faut soustraire le décalage appliqué par ctx.translate
    // Comme on ne peut pas facilement récupérer ce décalage ici, on utilise une astuce :
    // On sait que le contenu est centré.
    const displayedCanvasWidth = VIRTUAL_WIDTH * scaleFactor;
    const displayedCanvasHeight = VIRTUAL_HEIGHT * scaleFactor;
    const offsetX = (rect.width - displayedCanvasWidth) / 2;
    const offsetY = (rect.height - displayedCanvasHeight) / 2;
    
    x -= offsetX;
    y -= offsetY;

    // 3. Convertir en coordonnées virtuelles en divisant par le scaleFactor
    return {
        x: x / scaleFactor,
        y: y / scaleFactor
    };
}

function handleStart(e) {
    if (gameState.ball.moving) return;
    // Important pour le mobile : empêche le scroll de la page pendant qu'on vise
    if(e.touches) e.preventDefault(); 
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getVirtualPos(clientX, clientY);

    // On peut commencer à tirer en cliquant n'importe où, pas juste sur la balle
    gameState.isDragging = true;
    gameState.dragStart = pos;
    gameState.dragVector = { x: 0, y: 0 };
    gameState.dragPower = 0;
}

function handleMove(e) {
    if (!gameState.isDragging) return;
    if(e.touches) e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const currentPos = getVirtualPos(clientX, clientY);

    // Le vecteur de tir est l'inverse du mouvement de la souris (tirer l'élastique)
    let dx = gameState.dragStart.x - currentPos.x;
    let dy = gameState.dragStart.y - currentPos.y;

    // Calculer la distance et limiter à la puissance max
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
    gameState.isDragging = false;

    // Appliquer la force si la puissance est suffisante
    if (gameState.dragPower > 5) {
        gameState.ball.vx = gameState.dragVector.x * POWER_MULTIPLIER;
        gameState.ball.vy = gameState.dragVector.y * POWER_MULTIPLIER;
        gameState.ball.moving = true;
        
        gameState.players[gameState.currentPlayerIndex].score++;
        updateHUD();
    }
    // Reset
    gameState.dragVector = { x: 0, y: 0 };
    gameState.dragPower = 0;
}

// Events Listeners
canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
// Options { passive: false } obligatoires pour que preventDefault fonctionne sur mobile
canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd);


// --- INTERFACE UTILISATEUR ---
function updateHUD() {
    const p = gameState.players[gameState.currentPlayerIndex];
    document.getElementById('player-name').innerText = p.name;
    document.getElementById('player-score').innerText = `Coups: ${p.score}`;
    document.getElementById('player-avatar').style.backgroundColor = p.color;
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
