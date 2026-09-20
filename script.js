const board = document.getElementById('gameBoard');
const scoreText = document.getElementById('scoreText');
const startBtn = document.getElementById('startBtn');
const player = document.getElementById('player');
const touchLeft = document.getElementById('touchLeft');
const touchRight = document.getElementById('touchRight');
const touchFire = document.getElementById('touchFire');

let score = 0;
let lives = 3;
let level = 1;
let gameActive = false;
let playerX = 220;
let bullets = [];
let enemies = [];
let boss = null;
let bossBullets = [];
let animationId = null;
let enemySpawnId = null;
let keyState = {};
let touchState = { left: false, right: false };
let fireInterval = null;
let audioCtx = null;
let musicTimer = null;
let musicGain = null;

window.__bgMusic = { active: false };

function ensureAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }

    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(frequency, duration, type = 'square', volume = 0.04, sweep = 0) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const secondOsc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(40, frequency + sweep), now + duration);

    secondOsc.type = 'triangle';
    secondOsc.frequency.setValueAtTime(frequency * 1.7, now);
    secondOsc.frequency.linearRampToValueAtTime(Math.max(40, frequency * 1.7 + sweep * 0.8), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    secondOsc.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start(now);
    secondOsc.start(now);
    oscillator.stop(now + duration);
    secondOsc.stop(now + duration);
}

function playShootSound() {
    playTone(520, 0.08, 'square', 0.03, 110);
}

function playHitSound() {
    playTone(240, 0.12, 'triangle', 0.045, -120);
}

function playExplosionSound() {
    playTone(160, 0.26, 'sawtooth', 0.05, -90);
    playTone(90, 0.23, 'triangle', 0.04, -40);
}

function playBossSound() {
    playTone(180, 0.18, 'sawtooth', 0.07, 80);
    playTone(280, 0.14, 'square', 0.05, 140);
}

function startBackgroundMusic() {
    if (!audioCtx || !gameActive || musicTimer) return;

    const notes = [220, 277.18, 329.63, 392.0, 329.63, 277.18];
    let step = 0;

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.015;
    musicGain.connect(audioCtx.destination);
    window.__bgMusic.active = true;

    const playLoopStep = () => {
        if (!gameActive) return;

        const note = notes[step % notes.length];
        const oscA = audioCtx.createOscillator();
        const oscB = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const now = audioCtx.currentTime;

        oscA.type = 'triangle';
        oscA.frequency.setValueAtTime(note, now);
        oscB.type = 'sine';
        oscB.frequency.setValueAtTime(note / 2, now);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.018, now + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

        oscA.connect(gainNode);
        oscB.connect(gainNode);
        gainNode.connect(musicGain);

        oscA.start(now);
        oscB.start(now);
        oscA.stop(now + 0.52);
        oscB.stop(now + 0.52);

        step += 1;
    };

    playLoopStep();
    musicTimer = setInterval(playLoopStep, 380);
}

function stopBackgroundMusic() {
    if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
    }

    if (musicGain && audioCtx) {
        musicGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    }

    window.__bgMusic.active = false;
}

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

    ensureAudio();
    playShootSound();
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

function spawnBoss() {
    if (!gameActive || boss) return;

    const bossElement = document.createElement('div');
    bossElement.className = 'boss';

    const width = 84;
    const height = 60;
    const x = (board.clientWidth - width) / 2;
    const y = 10;

    bossElement.style.left = `${x}px`;
    bossElement.style.top = `${y}px`;
    board.appendChild(bossElement);

    boss = {
        element: bossElement,
        x,
        y,
        width,
        height,
        hp: 8,
        speed: 2.1,
        direction: 1,
        fireTimer: 0
    };

    score += 25;
    level = 1 + Math.floor(score / 100);
    updateHUD();
    playBossSound();
}

function createBossBullet() {
    if (!boss || !gameActive) return;

    const bullet = document.createElement('div');
    bullet.className = 'boss-bullet';

    const x = boss.x + boss.width / 2 - 5;
    const y = boss.y + boss.height;

    bullet.style.left = `${x}px`;
    bullet.style.top = `${y}px`;
    board.appendChild(bullet);

    bossBullets.push({
        element: bullet,
        x,
        y,
        speed: 4
    });
}

function makeExplosion(x, y) {
    const explosion = document.createElement('div');
    explosion.className = 'explosion';
    explosion.style.left = `${x}px`;
    explosion.style.top = `${y}px`;
    board.appendChild(explosion);

    setTimeout(() => explosion.remove(), 300);
    playExplosionSound();
}

function movePlayer() {
    if (!gameActive) return;

    const speed = 7;
    const movingLeft = keyState.ArrowLeft || keyState.a || touchState.left;
    const movingRight = keyState.ArrowRight || keyState.d || touchState.right;

    if (movingLeft) playerX -= speed;
    if (movingRight) playerX += speed;

    playerX = clamp(playerX, 20, board.clientWidth - 60);
    player.style.left = `${playerX}px`;
}

function setTouchMoveState(direction, isPressed) {
    if (direction === 'left') {
        touchState.left = isPressed;
        touchLeft.classList.toggle('active', isPressed);
    }

    if (direction === 'right') {
        touchState.right = isPressed;
        touchRight.classList.toggle('active', isPressed);
    }
}

function beginFireLoop() {
    if (!gameActive || fireInterval) return;

    createBullet();
    fireInterval = setInterval(() => {
        if (gameActive) createBullet();
    }, 180);
}

function stopFireLoop() {
    if (fireInterval) {
        clearInterval(fireInterval);
        fireInterval = null;
    }
    touchFire.classList.remove('active');
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

function updateBossBullets() {
    bossBullets = bossBullets.filter((bullet) => {
        bullet.y += bullet.speed;
        bullet.element.style.top = `${bullet.y}px`;

        if (bullet.y > board.clientHeight) {
            bullet.element.remove();
            return false;
        }

        const bulletBox = { x: bullet.x, y: bullet.y, w: 10, h: 18 };
        const playerBox = { x: playerX, y: board.clientHeight - 68, w: 40, h: 52 };

        if (
            bulletBox.x < playerBox.x + playerBox.w &&
            bulletBox.x + bulletBox.w > playerBox.x &&
            bulletBox.y < playerBox.y + playerBox.h &&
            bulletBox.y + bulletBox.h > playerBox.y
        ) {
            bullet.element.remove();
            lives -= 1;
            updateHUD();
            playHitSound();

            if (lives <= 0) {
                endGame();
            }
            return false;
        }

        return true;
    });
}

function updateBoss() {
    if (!boss || !gameActive) return;

    boss.x += boss.speed * boss.direction;
    boss.element.style.left = `${boss.x}px`;

    if (boss.x <= 0 || boss.x + boss.width >= board.clientWidth) {
        boss.direction *= -1;
    }

    boss.fireTimer += 1;
    if (boss.fireTimer >= 55) {
        createBossBullet();
        boss.fireTimer = 0;
    }

    for (const bullet of bullets) {
        const bulletBox = { x: bullet.x, y: bullet.y, w: 6, h: 18 };
        const bossBox = { x: boss.x, y: boss.y, w: boss.width, h: boss.height };

        if (
            bulletBox.x < bossBox.x + bossBox.w &&
            bulletBox.x + bulletBox.w > bossBox.x &&
            bulletBox.y < bossBox.y + bossBox.h &&
            bulletBox.y + bulletBox.h > bossBox.y
        ) {
            bullet.element.remove();
            boss.hp -= 1;
            playHitSound();

            if (boss.hp <= 0) {
                makeExplosion(boss.x, boss.y);
                boss.element.remove();
                boss = null;
                score += 75;
                level = 1 + Math.floor(score / 100);
                updateHUD();
                playBossSound();
            }
            return;
        }
    }
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

                if (score >= 80 && !boss) {
                    spawnBoss();
                }
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
    updateBoss();
    updateBossBullets();
    animationId = requestAnimationFrame(gameLoop);
}

function clearBoard() {
    bullets.forEach((bullet) => bullet.element.remove());
    enemies.forEach((enemy) => enemy.element.remove());
    bossBullets.forEach((bullet) => bullet.element.remove());
    if (boss) boss.element.remove();

    bullets = [];
    enemies = [];
    bossBullets = [];
    boss = null;
}

function endGame() {
    gameActive = false;
    clearTimeout(enemySpawnId);
    cancelAnimationFrame(animationId);
    stopFireLoop();
    stopBackgroundMusic();
    setTouchMoveState('left', false);
    setTouchMoveState('right', false);
    clearBoard();
    startBtn.textContent = 'Play Again';
    scoreText.textContent = `Game Over! Final Score: ${score}  Lives: ${lives}`;
}

function startGame() {
    ensureAudio();
    score = 0;
    lives = 3;
    level = 1;
    playerX = board.clientWidth / 2 - 20;
    player.style.left = `${playerX}px`;
    clearBoard();
    stopFireLoop();
    stopBackgroundMusic();
    setTouchMoveState('left', false);
    setTouchMoveState('right', false);
    gameActive = true;
    updateHUD();
    startBtn.textContent = 'Game Running...';
    startBackgroundMusic();
    spawnEnemies();
    gameLoop();
}

startBtn.addEventListener('click', () => {
    if (!gameActive) startGame();
});

if (touchLeft && touchRight && touchFire) {
    touchLeft.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setTouchMoveState('left', true);
    });
    touchLeft.addEventListener('pointerup', () => setTouchMoveState('left', false));
    touchLeft.addEventListener('pointerleave', () => setTouchMoveState('left', false));
    touchLeft.addEventListener('pointercancel', () => setTouchMoveState('left', false));

    touchRight.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setTouchMoveState('right', true);
    });
    touchRight.addEventListener('pointerup', () => setTouchMoveState('right', false));
    touchRight.addEventListener('pointerleave', () => setTouchMoveState('right', false));
    touchRight.addEventListener('pointercancel', () => setTouchMoveState('right', false));

    touchFire.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        touchFire.classList.add('active');
        beginFireLoop();
    });
    touchFire.addEventListener('pointerup', stopFireLoop);
    touchFire.addEventListener('pointerleave', stopFireLoop);
    touchFire.addEventListener('pointercancel', stopFireLoop);
}

board.addEventListener('pointerdown', (event) => {
    if (!gameActive) return;
    const rect = board.getBoundingClientRect();
    const x = event.clientX - rect.left;
    playerX = clamp(x - 20, 20, board.clientWidth - 60);
    player.style.left = `${playerX}px`;
});

board.addEventListener('pointermove', (event) => {
    if (!gameActive || event.pressure === 0) return;
    const rect = board.getBoundingClientRect();
    const x = event.clientX - rect.left;
    playerX = clamp(x - 20, 20, board.clientWidth - 60);
    player.style.left = `${playerX}px`;
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
