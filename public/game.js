const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const shopDiv = document.getElementById('shop');
const uiDiv = document.getElementById('ui');

let playerImage = new Image();
let baseImage = new Image();
let zombieImage = new Image();
let backgroundImage = new Image();

function loadImages(sources, callback) {
  let loadedImages = 0;
  const numImages = sources.length;
  const images = {};

  sources.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      console.log(`Изображение загружено: ${src}`);
      images[src] = img;
      loadedImages++;
      if (loadedImages === numImages) {
        callback(images);
      }
    };
    img.onerror = () => {
      console.error(`Ошибка загрузки изображения: ${src}`);
    };
  });
}

const imageSources = [
  'assets/hero.png',
  'assets/chasha.png',
  'assets/zombie.png',
  'assets/background.jpg'
];

let localPlayer = null;
let otherPlayers = {};
let zombies = [];
let bullets = [];
let base = {};
let gameState = 'ready_for_first_wave';
let currentWave = 0;
let totalPoints = 0;
let shopState = {};
let mouseX = 400;
let mouseY = 300;
let mouseDown = false;
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  '1': false,
  '2': false,
  '3': false,
  '4': false,
  r: false,
  s: false,
  ' ': false
};
let lastWeaponSwitchTime = 0;
const weaponSwitchCooldown = 200;
let isInitialized = false;

socket.on('init', (data) => {
  localPlayer = data.players[data.id];
  otherPlayers = data.players;
  delete otherPlayers[data.id];
  zombies = data.zombies;
  bullets = data.bullets;
  base = data.base;
  gameState = data.gameState;
  currentWave = data.currentWave;
  totalPoints = data.totalPoints;
  shopState = data.shopState;
  isInitialized = true;
  console.log('Инициализация клиента завершена:', data.id);
});

socket.on('gameState', (data) => {
  otherPlayers = data.players;
  if (localPlayer && data.players[socket.id]) {
    localPlayer.health = data.players[socket.id].health;
    localPlayer.weapons = data.players[socket.id].weapons;
    localPlayer.currentWeapon = data.players[socket.id].currentWeapon;
  }
  delete otherPlayers[socket.id];
  zombies = data.zombies;
  bullets = data.bullets;
  base = data.base;
  gameState = data.gameState;
  currentWave = data.currentWave;
  totalPoints = data.totalPoints;
});

socket.on('gameStateUpdate', (data) => {
  gameState = data.gameState;
  currentWave = data.currentWave;
  if (data.base) base = data.base;
  if (data.players) {
    otherPlayers = data.players;
    delete otherPlayers[socket.id];
    if (data.players[socket.id]) {
      localPlayer.health = data.players[socket.id].health;
      localPlayer.weapons = data.players[socket.id].weapons;
      localPlayer.currentWeapon = data.players[socket.id].currentWeapon;
    }
  }
  if (data.zombies) zombies = data.zombies;
  if (data.bullets) bullets = data.bullets;
  if (data.totalPoints !== undefined) totalPoints = data.totalPoints;
});

socket.on('shopUpdate', (newShopState) => {
  shopState = newShopState;
  if (localPlayer) {
    localPlayer.weapons.automatic = { ...shopState.automatic };
    localPlayer.weapons.shotgun = { ...shopState.shotgun };
    localPlayer.weapons.machinegun = { ...shopState.machinegun };
  }
});

socket.on('playerDisconnected', (id) => {
  delete otherPlayers[id];
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = event.clientX - rect.left;
  mouseY = event.clientY - rect.top;
});

canvas.addEventListener('mousedown', (event) => {
  if (event.button === 0) mouseDown = true;
});

canvas.addEventListener('mouseup', (event) => {
  if (event.button === 0) mouseDown = false;
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) keys[key] = true;
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key in keys) keys[key] = false;
});

shopDiv.addEventListener('click', (event) => {
  if (gameState === 'shop') {
    const target = event.target;
    if (target.classList.contains('shop-button')) {
      const action = target.getAttribute('data-action');
      if (action === 'exit') {
        socket.emit('exitShop');
      } else {
        socket.emit('buy', action);
      }
    }
  }
});

const weapons = {
  pistol: { name: 'Пистолет', angleOffsets: [0] },
  automatic: { name: 'Автомат', angleOffsets: [0, 0, 0] },
  shotgun: { name: 'Дробовик', angleOffsets: [-15, 0, 15] },
  machinegun: { name: 'Пулемёт', angleOffsets: [0] }
};

function update(deltaTime) {
  if (!localPlayer || !isInitialized) return;

  const currentTime = Date.now();
  if (currentTime - lastWeaponSwitchTime > weaponSwitchCooldown) {
    if (keys['1']) {
      socket.emit('switchWeapon', 'pistol');
      lastWeaponSwitchTime = currentTime;
    }
    if (keys['2'] && localPlayer.weapons.automatic.owned) {
      socket.emit('switchWeapon', 'automatic');
      lastWeaponSwitchTime = currentTime;
    }
    if (keys['3'] && localPlayer.weapons.shotgun.owned) {
      socket.emit('switchWeapon', 'shotgun');
      lastWeaponSwitchTime = currentTime;
    }
    if (keys['4'] && localPlayer.weapons.machinegun.owned) {
      socket.emit('switchWeapon', 'machinegun');
      lastWeaponSwitchTime = currentTime;
    }
  }

  if (gameState === 'playing') {
    let vx = 0;
    let vy = 0;
    if (keys.w) vy -= 1;
    if (keys.s) vy += 1;
    if (keys.a) vx -= 1;
    if (keys.d) vx += 1;

    const magnitude = Math.sqrt(vx * vx + vy * vy);
    let newX = localPlayer.x;
    let newY = localPlayer.y;
    if (magnitude > 0) {
      vx = (vx / magnitude) * localPlayer.speed;
      vy = (vy / magnitude) * localPlayer.speed;
      newX += vx * deltaTime;
      newY += vy * deltaTime;
    }

    newX = Math.max(localPlayer.width / 2, Math.min(canvas.width - localPlayer.width / 2, newX));
    newY = Math.max(localPlayer.height / 2, Math.min(canvas.height - localPlayer.height / 2, newY));
    localPlayer.x = newX;
    localPlayer.y = newY;
    socket.emit('move', { x: newX, y: newY });

    if (mouseDown) {
      const mainAngle = Math.atan2(mouseY - localPlayer.y, mouseX - localPlayer.x);
      socket.emit('shoot', { mainAngle, angleOffsets: weapons[localPlayer.currentWeapon].angleOffsets });
    }

    if (keys.r) socket.emit('reload');
  } else if (gameState === 'ready_for_first_wave' && keys[' ']) {
    socket.emit('startWave');
  } else if (gameState === 'wave_ended' && keys.s) {
    socket.emit('openShop');
  } else if (gameState === 'ready_for_next_wave' && keys[' ']) {
    socket.emit('startWave');
  } else if (gameState === 'game_over' && keys.r) {
    socket.emit('restart');
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  if (base && base.x && base.width) {
    ctx.drawImage(baseImage, base.x - base.width / 2, base.y - base.height / 2, base.width, base.height);
  }

  if (localPlayer && localPlayer.x && localPlayer.y) {
    ctx.save();
    ctx.translate(localPlayer.x, localPlayer.y);
    const playerAngle = Math.atan2(mouseY - localPlayer.y, mouseX - localPlayer.x) + Math.PI / 2;
    ctx.rotate(playerAngle);
    ctx.drawImage(playerImage, -localPlayer.width * 3 / 2, -localPlayer.height * 3 / 2, localPlayer.width * 3, localPlayer.height * 3);
    ctx.restore();
  }

  for (let id in otherPlayers) {
    const player = otherPlayers[id];
    if (player && player.x && player.y) {
      ctx.save();
      ctx.translate(player.x, player.y);
      const playerAngle = Math.atan2(mouseY - player.y, mouseX - player.x) + Math.PI / 2;
      ctx.rotate(playerAngle);
      ctx.drawImage(playerImage, -player.width * 3 / 2, -player.height * 3 / 2, player.width * 3, player.height * 3);
      ctx.restore();
    }
  }

  zombies.forEach(zombie => {
    if (zombie && zombie.x && zombie.y && zombie.angle !== undefined) {
      ctx.save();
      ctx.translate(zombie.x, zombie.y);
      const zombieAngle = zombie.angle + Math.PI / 2;
      ctx.rotate(zombieAngle);
      ctx.drawImage(zombieImage, -zombie.width * 1.5 / 2, -zombie.height * 1.5 / 2, zombie.width * 1.5, zombie.height * 1.5);
      ctx.restore();
    }
  });

  bullets.forEach(bullet => {
    if (bullet && bullet.x && bullet.y) {
      ctx.fillStyle = 'yellow';
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
  });

  if (base && base.health !== undefined) {
    ctx.fillStyle = 'red';
    ctx.fillRect(10, 10, 200, 20);
    ctx.fillStyle = 'lime';
    ctx.fillRect(10, 10, (base.health / base.maxHealth) * 200, 20);
  }

  if (localPlayer && localPlayer.health !== undefined) {
    ctx.fillStyle = 'red';
    ctx.fillRect(10, 40, 200, 20);
    ctx.fillStyle = 'lime';
    ctx.fillRect(10, 40, (localPlayer.health / localPlayer.maxHealth) * 200, 20);
  }

  if (uiDiv) {
    uiDiv.querySelector('#base-health').textContent = base && base.health !== undefined ? `База: ${Math.round(base.health)}/100` : 'База: -/-';
    uiDiv.querySelector('#player-health').textContent = localPlayer && localPlayer.health !== undefined ? `Игрок: ${Math.round(localPlayer.health)}/100` : 'Игрок: -/-';
    uiDiv.querySelector('#wave').textContent = `Волна: ${currentWave}`;
    uiDiv.querySelector('#points').textContent = `Очки: ${totalPoints}`;
    uiDiv.querySelector('#weapon').textContent = localPlayer ? `Оружие: ${weapons[localPlayer.currentWeapon].name}` : 'Оружие: -';
    uiDiv.querySelector('#ammo').textContent = localPlayer && localPlayer.weapons ? `Патроны: ${localPlayer.weapons[localPlayer.currentWeapon].clipAmmo}/${localPlayer.weapons[localPlayer.currentWeapon].reserveAmmo}` : 'Патроны: -/-';
    uiDiv.querySelector('#zombies').textContent = gameState === 'playing' ? `Зомби: ${totalZombiesToSpawn - zombiesSpawned + zombies.length}` : 'Зомби: 0';
  }

  shopDiv.style.display = gameState === 'shop' ? 'block' : 'none';
  if (gameState === 'shop' && shopDiv) {
    shopDiv.querySelector('#shop-points').textContent = `Очки: ${totalPoints}`;
    shopDiv.querySelectorAll('.shop-button').forEach(button => {
      const action = button.getAttribute('data-action');
      if (action === 'automatic' && shopState.automatic.owned) button.style.display = 'none';
      else if (action === 'shotgun' && shopState.shotgun.owned) button.style.display = 'none';
      else if (action === 'machinegun' && shopState.machinegun.owned) button.style.display = 'none';
      else if (action === 'firingRate' && shopState[localPlayer.currentWeapon].firingRateLevel >= 5) button.style.display = 'none';
      else if (action === 'damage' && shopState[localPlayer.currentWeapon].damageLevel >= 5) button.style.display = 'none';
      else if (action === 'reload' && shopState[localPlayer.currentWeapon].reloadLevel >= 5) button.style.display = 'none';
      else if (action === 'ammoCapacity' && shopState[localPlayer.currentWeapon].ammoCapacityLevel >= 5) button.style.display = 'none';
      else button.style.display = 'block';
    });
  }
}

function gameLoop(timestamp) {
  if (!isInitialized) {
    requestAnimationFrame(gameLoop);
    return;
  }

  const deltaTime = (timestamp - (gameLoop.lastTimestamp || timestamp)) / 1000;
  gameLoop.lastTimestamp = timestamp;

  update(deltaTime);
  render();

  requestAnimationFrame(gameLoop);
}
gameLoop.lastTimestamp = 0;

loadImages(imageSources, (loadedImages) => {
  playerImage = loadedImages['assets/hero.png'];
  baseImage = loadedImages['assets/chasha.png'];
  zombieImage = loadedImages['assets/zombie.png'];
  backgroundImage = loadedImages['assets/background.jpg'];
  console.log('Все текстуры загружены');
});

socket.on('connect', () => {
  console.log('Подключение к серверу установлено');
});