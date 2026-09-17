const board = document.getElementById('gameBoard');
const scoreText = document.getElementById('scoreText');
const startBtn = document.getElementById('startBtn');
const player = document.getElementById('player');

let score = 0;
let lives = 3;
let level = 1;
let gameActive = false;
let playerX = 220;
let bullets = [];
let enemies = [];
let animationId = null;
let enemySpawnId = null;
let keyState = {};

function updateHUD() {
    scoreText.textContent = `Score: ${score}  Lives: ${lives}  Level: ${level}`;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function createBullet() {
    if (!gameActive) return;

    const bullet = document.createElement('div');
    bullet.className = 'bullet';

    const x = playerX + 18;
    const y = board.clientHeight - 60;

    bullet.style.left = `${x}px`;
    bullet.style.top = `${y}px`;
    board.appendChild(bullet);

    bullets.push({
        element: bullet,
        x,
        y: y - 5,
        speed: 7
    });
}

function createEnemy() {
    const enemy = document.createElement('div');
    enemy.className = 'enemy';

    const size = 30;
    const x = Math.random() * (board.clientWidth - size);
    const y = -20;

    enemy.style.left = `${x}px`;
    enemy.style.top = `${y}px`;
    board.appendChild(enemy);

    enemies.push({
        element: enemy,
        x,
        y,
        speed: 1.5 + level * 0.35,
        size
    });
}

function spawnEnemies() {
    if (!gameActive) return;
    createEnemy();
    enemySpawnId = setTimeout(spawnEnemies, Math.max(800, 1200 - level * 80));
}

function makeExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    board.appendChild(explosion);

    setTimeout(() => explosion.remove(), 300);
}

function movePlayer() {
    if (!gameActive) return;

    const speed = 7;
    if (keyState.ArrowLeft || keyState.a) playerX -= speed;
    if (keyState.ArrowRight || keyState.d) playerX += speed;

    playerX = clamp(playerX, 20, board.clientWidth - 60);
    player.style.left = `${playerX}px`;
}

function updateBullets() {
    bullets = bullets.filter((bullet) => {
        bullet.y -= bullet.speed;
        bullet.element.style.top = `${bullet.y}px`;

        if (bullet.y < -20) {
            bullet.element.remove();
            return false;
        }

        return true;
    });
}

function updateEnemies() {
    enemies = enemies.filter((enemy) => {
        enemy.y += enemy.speed;
        enemy.element.style.top = `${enemy.y}px`;

        if (enemy.y > board.clientHeight) {
            enemy.element.remove();
            lives -= 1;
            updateHUD();

            if (lives <= 0) {
                endGame();
            }
            return false;
        }

        const enemyBox = {
            x: enemy.x,
            y: enemy.y,
            w: enemy.size,
            h: enemy.size
        };

        const playerBox = {
            x: playerX,
            y: board.clientHeight - 68,
            w: 40,
            h: 52
        };

        if (
            enemyBox.x < playerBox.x + playerBox.w &&
            enemyBox.x + enemyBox.w > playerBox.x &&
            enemyBox.y < playerBox.y + playerBox.h &&
            enemyBox.y + enemyBox.h > playerBox.y
        ) {
            enemy.element.remove();
            makeExplosion(enemy.x, enemy.y);
            lives -= 1;
            updateHUD();

            if (lives <= 0) {
                endGame();
            }
            return false;
        }

        for (const bullet of bullets) {
            const bulletBox = {
                x: bullet.x,
                y: bullet.y,
                w: 6,
                h: 18
            };

            if (
                bulletBox.x < enemyBox.x + enemyBox.w &&
                bulletBox.x + bulletBox.w > enemyBox.x &&
                bulletBox.y < enemyBox.y + enemyBox.h &&
                bulletBox.y + bulletBox.h > enemyBox.y
            ) {
                bullet.element.remove();
                enemy.element.remove();
                makeExplosion(enemy.x, enemy.y);
                score += 10;
                level = 1 + Math.floor(score / 100);
                updateHUD();
                return false;
            }
        }

        return true;
    });
}

function gameLoop() {
    if (!gameActive) return;

    movePlayer();
    updateBullets();
    updateEnemies();
    animationId = requestAnimationFrame(gameLoop);
}

function clearBoard() {
    bullets.forEach((bullet) => bullet.element.remove());
    enemies.forEach((enemy) => enemy.element.remove());
    bullets = [];
    enemies = [];
}

function endGame() {
    gameActive = false;
    clearTimeout(enemySpawnId);
    cancelAnimationFrame(animationId);
    clearBoard();
    startBtn.textContent = 'Play Again';
    scoreText.textContent = `Game Over! Final Score: ${score}  Lives: ${lives}`;
}

function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    playerX = board.clientWidth / 2 - 20;
    player.style.left = `${playerX}px`;
    clearBoard();
    gameActive = true;
    updateHUD();
    startBtn.textContent = 'Game Running...';
    spawnEnemies();
    gameLoop();
}

startBtn.addEventListener('click', () => {
    if (!gameActive) startGame();
});

document.addEventListener('keydown', (event) => {
    keyState[event.key] = true;
    keyState[event.key.toLowerCase()] = true;

    if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        createBullet();
    }

    if (!gameActive && event.key === 'Enter') {
        startGame();
    }
});

document.addEventListener('keyup', (event) => {
    keyState[event.key] = false;
    keyState[event.key.toLowerCase()] = false;
});

updateHUD();
player.style.left = `${playerX}px`;
