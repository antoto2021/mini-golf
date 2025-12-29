// Définition des couleurs des surfaces pour le dessin
const SurfaceColors = {
    GRASS: '#00c853',      // Vert vif (base)
    GRASS_DARK: '#00a040', // Pour le damier
    ICE: '#b3e5fc',        // Bleu très clair
    SAND: '#ffd54f',       // Jaune sable
    PINK_SAND: '#f48fb1',  // Rose
    WATER: '#0288d1',      // Bleu eau
    OIL: '#424242'         // Gris foncé/Noir
};

// Définition des frictions (Combien de vitesse on garde par frame. 1.0 = aucune friction)
const Friction = {
    GRASS: 0.975,    // Standard (~15% ralentissement ressenti)
    ICE: 0.992,      // Glisse beaucoup (~5% ralentissement)
    SAND: 0.94,      // Ralentit bien (~30%)
    PINK_SAND: 0.88, // Colle énormément (~80%)
    // Water et Oil n'ont pas de friction, ce sont des zones d'événement
};

const levelsData = [
    // --- NIVEAU 1 : Introduction ---
    {
        id: 1,
        start: { x: 300, y: 800 }, // Coordonnées basées sur un canvas virtuel de 600x900 (ratio portrait)
        hole: { x: 300, y: 150 },
        walls: [
            { x: 100, y: 400, w: 400, h: 30 } // Mur central
        ],
        // Les zones spéciales (le reste est de l'herbe par défaut)
        zones: [] 
    },
    // --- NIVEAU 2 : Glace et Sable ---
    {
        id: 2,
        start: { x: 100, y: 800 },
        hole: { x: 500, y: 100 },
        walls: [ { x: 290, y: 300, w: 20, h: 300 } ],
        zones: [
            // Zone de glace au milieu qui accélère
            { x: 0, y: 300, w: 600, h: 300, type: 'ICE' },
            // Zone de sable jaune devant le trou
            { x: 400, y: 50, w: 200, h: 200, type: 'SAND' }
        ]
    },
    // --- NIVEAU 3 : Le piège de sable rose ---
    {
        id: 3,
        start: { x: 300, y: 850 },
        hole: { x: 300, y: 100 },
        walls: [],
        zones: [
            // Un grand bloc de sable rose très collant au milieu
            { x: 100, y: 300, w: 400, h: 300, type: 'PINK_SAND' }
        ]
    },
    // --- NIVEAU 4 : Danger Eau ---
    {
        id: 4,
        start: { x: 100, y: 800 },
        hole: { x: 500, y: 200 },
        walls: [{ x: 250, y: 400, w: 350, h: 30 }],
        zones: [
            // Lac sur la gauche. Si on tombe, retour avant le tir.
            { x: 0, y: 0, w: 200, h: 600, type: 'WATER' }
        ]
    },
     // --- NIVEAU 5 : Danger Pétrole ---
    {
        id: 5,
        start: { x: 300, y: 850 },
        hole: { x: 300, y: 100 },
        walls: [
            {x: 150, y: 600, w: 300, h: 30},
            {x: 150, y: 300, w: 300, h: 30}
        ],
        zones: [
            // Flaques de pétrole. Si on tombe, retour au DÉPART du niveau.
            { x: 0, y: 450, w: 600, h: 100, type: 'OIL' },
            { x: 0, y: 150, w: 600, h: 100, type: 'OIL' }
        ]
    }
];
