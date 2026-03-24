// Configuration
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

let grid = [];
let minesCount = 3;
let revealedCells = [];
let gameActive = true;
let currentPrediction = null;
let totalSafeCells = TOTAL_CELLS - minesCount;
let correctSelections = 0;
let totalSelections = 0;

// Éléments DOM
const minesGrid = document.getElementById('minesGrid');
const minesCountSpan = document.getElementById('minesCount');
const safeCellsLeftSpan = document.getElementById('safeCellsLeft');
const revealedCountSpan = document.getElementById('revealedCount');
const accuracyRateSpan = document.getElementById('accuracyRate');
const minesValueSpan = document.getElementById('minesValue');
const predictedCoordSpan = document.getElementById('predictedCoord');
const confidenceFill = document.getElementById('confidenceFill');
const confidenceValueSpan = document.getElementById('confidenceValue');
const securityScoreSpan = document.getElementById('securityScore');
const adjMinesInfoSpan = document.getElementById('adjMinesInfo');
const riskLevelSpan = document.getElementById('riskLevel');
const rankInfoSpan = document.getElementById('rankInfo');
const candidatesListSpan = document.getElementById('candidatesList');
const statusMessageDiv = document.getElementById('statusMessage');
const historyList = document.getElementById('historyList');
const predictBtn = document.getElementById('predictBtn');
const resetGameBtn = document.getElementById('resetGameBtn');
const decreaseMines = document.getElementById('decreaseMines');
const increaseMines = document.getElementById('increaseMines');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Initialiser la grille
function initGrid() {
    const newGrid = [];
    let minePositions = new Array(TOTAL_CELLS).fill(false);
    let minesPlaced = 0;
    
    while (minesPlaced < minesCount) {
        const rand = Math.floor(Math.random() * TOTAL_CELLS);
        if (!minePositions[rand]) {
            minePositions[rand] = true;
            minesPlaced++;
        }
    }
    
    for (let i = 0; i < TOTAL_CELLS; i++) {
        newGrid.push({
            isMine: minePositions[i],
            revealed: false,
            index: i
        });
    }
    
    grid = newGrid;
    revealedCells = [];
    gameActive = true;
    currentPrediction = null;
    totalSafeCells = TOTAL_CELLS - minesCount;
    
    updateStats();
    renderGrid();
    clearPredictionDisplay();
    updateStatus('info', 'Nouvelle partie ! Cliquez sur "IA Prédire" pour analyser la grille');
}

// Rendre la grille
function renderGrid() {
    minesGrid.innerHTML = '';
    for (let i = 0; i < grid.length; i++) {
        const cell = grid[i];
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('cell');
        
        if (cell.revealed) {
            cellDiv.classList.add('revealed');
            if (cell.isMine) {
                cellDiv.classList.add('mine-hit');
                cellDiv.innerHTML = '<i class="fas fa-skull"></i>';
            } else {
                cellDiv.innerHTML = '<i class="fas fa-gem"></i>';
            }
        } else {
            cellDiv.innerHTML = '?';
        }
        
        if (currentPrediction !== null && currentPrediction.index === i && !cell.revealed) {
            cellDiv.classList.add('prediction-highlight');
        }
        
        cellDiv.addEventListener('click', (function(idx) {
            return function() { onCellSelect(idx); };
        })(i));
        
        minesGrid.appendChild(cellDiv);
    }
}

// Obtenir le nombre de mines adjacentes
function getAdjacentMinesCount(index) {
    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let count = 0;
    
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    
    for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
            const neighborIndex = newRow * GRID_SIZE + newCol;
            if (grid[neighborIndex].isMine) {
                count++;
            }
        }
    }
    return count;
}

// Calculer le score de sécurité (0-100)
function calculateSafetyScore(index) {
    if (grid[index].isMine) return 0;
    if (grid[index].revealed) return 100;
    
    const adjMines = getAdjacentMinesCount(index);
    const remainingUnknown = TOTAL_CELLS - revealedCells.length;
    const remainingMines = minesCount - grid.filter(c => c.revealed && c.isMine).length;
    
    if (remainingMines >= remainingUnknown) return 0;
    
    let safety = 100 - (adjMines * 12);
    
    if (adjMines === 0) safety += 25;
    if (adjMines === 1) safety += 10;
    
    const globalSafety = (1 - (remainingMines / remainingUnknown)) * 100;
    safety = (safety * 0.6 + globalSafety * 0.4);
    
    return Math.min(100, Math.max(0, Math.floor(safety)));
}

// Trouver la meilleure prédiction
function findBestPrediction() {
    const availableCells = [];
    for (let i = 0; i < grid.length; i++) {
        if (!grid[i].revealed && !grid[i].isMine) {
            const score = calculateSafetyScore(i);
            availableCells.push({ index: i, score: score, adjMines: getAdjacentMinesCount(i) });
        }
    }
    
    if (availableCells.length === 0) return null;
    
    availableCells.sort((a, b) => b.score - a.score);
    
    const top3 = availableCells.slice(0, 3);
    const best = top3[0];
    
    // Calcul du classement
    let rank = 1;
    for (let i = 0; i < availableCells.length; i++) {
        if (availableCells[i].score > best.score) rank++;
    }
    
    return {
        best: best,
        topCandidates: top3,
        rank: rank,
        totalCandidates: availableCells.length
    };
}

// Exécuter la prédiction IA
function runPrediction() {
    if (!gameActive) {
        updateStatus('warning', 'Partie terminée ! Cliquez sur "Nouvelle partie"');
        return;
    }
    
    const prediction = findBestPrediction();
    
    if (!prediction || !prediction.best) {
        predictedCoordSpan.textContent = '--';
        confidenceFill.style.width = '0%';
        confidenceValueSpan.textContent = '0%';
        securityScoreSpan.textContent = '0%';
        adjMinesInfoSpan.textContent = '-';
        riskLevelSpan.textContent = '-';
        rankInfoSpan.textContent = '-';
        candidatesListSpan.textContent = '-';
        currentPrediction = null;
        renderGrid();
        updateStatus('warning', 'Aucune case disponible !');
        return;
    }
    
    const best = prediction.best;
    const row = Math.floor(best.index / GRID_SIZE) + 1;
    const col = (best.index % GRID_SIZE) + 1;
    const coordText = `${row}, ${col}`;
    
    predictedCoordSpan.textContent = coordText;
    const confidence = best.score;
    confidenceFill.style.width = `${confidence}%`;
    confidenceValueSpan.textContent = `${confidence}%`;
    securityScoreSpan.textContent = `${confidence}%`;
    adjMinesInfoSpan.textContent = best.adjMines;
    
    // Niveau de risque
    let riskText = 'Faible';
    if (confidence < 40) riskText = 'Élevé';
    else if (confidence < 70) riskText = 'Moyen';
    riskLevelSpan.textContent = riskText;
    
    rankInfoSpan.textContent = `#${prediction.rank}/${prediction.totalCandidates}`;
    
    const candidatesText = prediction.topCandidates.map(c => {
        const r = Math.floor(c.index / GRID_SIZE) + 1;
        const cPos = (c.index % GRID_SIZE) + 1;
        return `${r},${cPos} (${c.score}%)`;
    }).join(' · ');
    candidatesListSpan.textContent = candidatesText;
    
    currentPrediction = { index: best.index, coord: coordText, confidence: confidence };
    renderGrid();
    updateStatus('success', `IA recommande la case ${coordText} avec ${confidence}% de confiance`);
}

// Sélectionner une case
function onCellSelect(index) {
    if (!gameActive) {
        updateStatus('warning', 'Partie terminée ! Nouvelle partie nécessaire');
        return;
    }
    
    const cell = grid[index];
    
    if (cell.revealed) {
        updateStatus('info', 'Cette case a déjà été sélectionnée');
        return;
    }
    
    totalSelections++;
    
    if (cell.isMine) {
        // Mine explosée
        cell.revealed = true;
        gameActive = false;
        renderGrid();
        addToHistory(getCoordFromIndex(index), false, currentPrediction?.coord);
        updateStatus('error', `💥 BOOM ! Mine à la case ${getCoordFromIndex(index)}. Partie terminée.`);
        updateStats();
        currentPrediction = null;
    } else {
        // Case sûre
        cell.revealed = true;
        revealedCells.push(index);
        correctSelections++;
        
        // Vérifier si la sélection correspond à la prédiction
        let isCorrectPrediction = false;
        if (currentPrediction && currentPrediction.index === index) {
            isCorrectPrediction = true;
            updateStatus('success', `✅ Parfait ! La case ${getCoordFromIndex(index)} correspond à la prédiction IA !`);
        } else {
            updateStatus('info', `✓ Case ${getCoordFromIndex(index)} sélectionnée avec succès`);
        }
        
        addToHistory(getCoordFromIndex(index), true, currentPrediction?.coord, isCorrectPrediction);
        
        renderGrid();
        updateStats();
        
        // Vérifier victoire
        if (revealedCells.length === totalSafeCells) {
            gameActive = false;
            updateStatus('victory', `🏆 VICTOIRE ! Toutes les cases sûres ont été découvertes !`);
            addToHistory('VICTOIRE', true, null, true);
        } else {
            // Optionnel : après sélection, on peut relancer automatiquement la prédiction
            runPrediction();
        }
    }
}

// Obtenir les coordonnées formatées
function getCoordFromIndex(index) {
    const row = Math.floor(index / GRID_SIZE) + 1;
    const col = (index % GRID_SIZE) + 1;
    return `${row},${col}`;
}

// Mettre à jour les statistiques
function updateStats() {
    minesCountSpan.textContent = minesCount;
    const safeRemaining = totalSafeCells - revealedCells.length;
    safeCellsLeftSpan.textContent = safeRemaining;
    revealedCountSpan.textContent = revealedCells.length;
    
    let accuracy = 0;
    if (totalSelections > 0) {
        accuracy = (correctSelections / totalSelections) * 100;
    }
    accuracyRateSpan.textContent = `${Math.floor(accuracy)}%`;
    minesValueSpan.textContent = minesCount;
}

// Ajouter à l'historique
function addToHistory(coord, isSafe, predictedCoord = null, matchedPrediction = false) {
    const emptyMsg = historyList.querySelector('.history-empty');
    if (emptyMsg) emptyMsg.remove();
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    
    let coordClass = isSafe ? 'coord-success' : 'coord-fail';
    let icon = isSafe ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-skull"></i>';
    let badge = '';
    
    if (predictedCoord && isSafe) {
        if (coord === predictedCoord) {
            badge = '<span class="badge" style="background:#ffb347;">✓ Prédiction juste</span>';
        } else {
            badge = '<span class="badge" style="background:#4a6a7a;">⚠️ Autre case</span>';
        }
    }
    
    entry.innerHTML = `
        <span class="${coordClass}">${icon} ${coord}</span>
        <span>${badge}</span>
        <span class="time">${timeStr}</span>
    `;
    
    historyList.insertBefore(entry, historyList.firstChild);
    
    while (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Effacer l'historique
function clearHistory() {
    historyList.innerHTML = `
        <div class="history-empty">
            <i class="fas fa-chart-line"></i>
            <span>Aucune sélection pour le moment</span>
        </div>
    `;
}

// Mettre à jour le message de statut
function updateStatus(type, message) {
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-skull',
        victory: 'fa-trophy'
    };
    statusMessageDiv.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${message}</span>`;
    
    if (type === 'victory') {
        statusMessageDiv.style.background = 'rgba(100, 200, 100, 0.2)';
        statusMessageDiv.style.borderLeftColor = '#7bc97b';
    } else {
        statusMessageDiv.style.background = 'rgba(255, 180, 71, 0.15)';
        statusMessageDiv.style.borderLeftColor = '#ffb347';
    }
}

// Réinitialiser l'affichage de prédiction
function clearPredictionDisplay() {
    predictedCoordSpan.textContent = '--';
    confidenceFill.style.width = '0%';
    confidenceValueSpan.textContent = '0%';
    securityScoreSpan.textContent = '0%';
    adjMinesInfoSpan.textContent = '-';
    riskLevelSpan.textContent = '-';
    rankInfoSpan.textContent = '-';
    candidatesListSpan.textContent = '-';
}

// Réinitialiser la partie
function resetGame() {
    initGrid();
    correctSelections = 0;
    totalSelections = 0;
    currentPrediction = null;
    clearPredictionDisplay();
    updateStatus('info', 'Nouvelle partie ! Cliquez sur "IA Prédire" pour analyser la grille');
}

// Changer le nombre de mines
function changeMines(delta) {
    let newMines = minesCount + delta;
    if (newMines < 1) newMines = 1;
    if (newMines > TOTAL_CELLS - 1) newMines = TOTAL_CELLS - 1;
    if (newMines === minesCount) return;
    
    minesCount = newMines;
    totalSafeCells = TOTAL_CELLS - minesCount;
    resetGame();
}

// Événements
predictBtn.addEventListener('click', runPrediction);
resetGameBtn.addEventListener('click', resetGame);
decreaseMines.addEventListener('click', () => changeMines(-1));
increaseMines.addEventListener('click', () => changeMines(1));
clearHistoryBtn.addEventListener('click', clearHistory);

// Initialisation
initGrid();
updateStatus('info', 'Bienvenue ! Cliquez sur "IA Prédire" pour obtenir la case la plus sûre, puis sélectionnez-la');