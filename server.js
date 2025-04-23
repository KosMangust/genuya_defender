const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// Игровые объекты
let players = {};
let zombies = [];
let bullets = [];
let base = {
  x: 400,
  y: 300,
  width: 70,
  height: 50,
  health: 100,
  maxHealth: 100
};

// Состояние магазина (общее для всех игроков)
let shopState = {
  automatic: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
  shotgun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
  machinegun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 }
};

// Игровое состояние
let gameState = 'ready_for_first_wave';
let currentWave = 0;
let isWaveActive = false;
let totalZombiesToSpawn = 0;
let zombiesSpawned = 0;
let spawnTimer = 0;
let spawnInterval = 1000;
let totalPoints = 0;

const weapons = {
  pistol: {
    name: 'Пистолет',
    maxClipSize: 7,
    baseMaxReserveAmmo: 60,
    baseCooldown: 200,
    baseReloadTime: 1000,
    ammoPerShot: 1,
    angleOffsets: [0],
    baseDamage: 20
  },
  automatic: {
    name: 'Автомат',
    maxClipSize: 30,
    baseMaxReserveAmmo: 90,
    baseCooldown: 300,
    baseReloadTime: 2000,
    ammoPerShot: 3,
    angleOffsets: [0, 0, 0],
    baseDamage: 10
  },
  shotgun: {
    name: 'Дробовик',
    maxClipSize: 8,
    baseMaxReserveAmmo: 24,
    baseCooldown: 500,
    baseReloadTime: 3000,
    ammoPerShot: 1,
    angleOffsets: [-15, 0, 15],
    baseDamage: 15
  },
  machinegun: {
    name: 'Пулемёт',
    maxClipSize: 100,
    baseMaxReserveAmmo: 300,
    baseCooldown: 100,
    baseReloadTime: 4000,
    ammoPerShot: 1,
    angleOffsets: [0],
    baseDamage: 8
  }
};

// Обновление боезапаса
function updateMaxReserveAmmo(weaponKey, playerWeapon) {
  const weaponData = weapons[weaponKey];
  playerWeapon.maxReserveAmmo = Math.ceil(weaponData.baseMaxReserveAmmo * (1 + 0.1 * playerWeapon.ammoCapacityLevel));
  if (playerWeapon.reserveAmmo > playerWeapon.maxReserveAmmo) {
    playerWeapon.reserveAmmo = playerWeapon.maxReserveAmmo;
  }
}

// Проверка коллизии (AABB)
function checkCollision(obj1, obj2) {
  return obj1.x - obj1.width / 2 < obj2.x + obj2.width / 2 &&
         obj1.x + obj1.width / 2 > obj2.x - obj2.width / 2 &&
         obj1.y - obj1.height / 2 < obj2.y + obj2.height / 2 &&
         obj1.y + obj1.height / 2 > obj2.y - obj2.height / 2;
}

// Спавн зомби
function spawnZombie() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = 0; y = Math.random() * 600; }
  else if (side === 1) { x = 800; y = Math.random() * 600; }
  else if (side === 2) { x = Math.random() * 800; y = 0; }
  else { x = Math.random() * 800; y = 600; }

  const speed = 100 * Math.pow(1.05, currentWave - 1);
  const damageRate = 1 * Math.pow(1.05, currentWave - 1);
  const health = 20 * Math.pow(1.05, currentWave - 1);

  zombies.push({
    x: x,
    y: y,
    width: 30,
    height: 30,
    speed: speed,
    damageRate: damageRate,
    health: health,
    maxHealth: health,
    isAttacking: false,
    target: null
  });
}

// Начало волны
function startWave() {
  totalZombiesToSpawn = Math.ceil(10 * Math.pow(1.5, currentWave - 1));
  spawnInterval = 1000 / Math.pow(1.3, currentWave - 1);
  zombiesSpawned = 0;
  spawnTimer = 0;
  isWaveActive = true;
}

// Обработка подключений
io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  players[socket.id] = {
    x: 400,
    y: 500,
    width: 30,
    height: 30,
    speed: 200,
    health: 100,
    maxHealth: 100,
    currentWeapon: 'pistol',
    weapons: {
      pistol: { owned: true, clipAmmo: 7, reserveAmmo: 46, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0, maxReserveAmmo: 60 },
      automatic: { ...shopState.automatic },
      shotgun: { ...shopState.shotgun },
      machinegun: { ...shopState.machinegun }
    },
    isReloading: false,
    reloadTimer: 0,
    lastShootTime: 0
  };

  console.log('Отправка init для:', socket.id, { id: socket.id, players, zombies, bullets, base, gameState, currentWave, totalPoints, shopState });
  socket.emit('init', { id: socket.id, players, zombies, bullets, base, gameState, currentWave, totalPoints, shopState });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
    }
  });

  socket.on('shoot', (data) => {
    const player = players[socket.id];
    if (!player) return;

    const weaponData = weapons[player.currentWeapon];
    const playerWeapon = player.weapons[player.currentWeapon];
    const actualCooldown = weaponData.baseCooldown / (1 + 0.1 * playerWeapon.firingRateLevel);
    const actualDamage = weaponData.baseDamage * (1 + 0.1 * playerWeapon.damageLevel);

    if (!player.isReloading && Date.now() - player.lastShootTime > actualCooldown && playerWeapon.clipAmmo >= weaponData.ammoPerShot) {
      player.lastShootTime = Date.now();
      playerWeapon.clipAmmo -= weaponData.ammoPerShot;

      data.angleOffsets.forEach(offset => {
        const totalAngle = data.mainAngle + offset * Math.PI / 180;
        const speed = 400;
        bullets.push({
          x: player.x,
          y: player.y,
          width: 5,
          height: 5,
          vx: Math.cos(totalAngle) * speed,
          vy: Math.sin(totalAngle) * speed,
          damage: actualDamage,
          owner: socket.id
        });
      });
    }
  });

  socket.on('reload', () => {
    const player = players[socket.id];
    if (!player) return;

    const weaponData = weapons[player.currentWeapon];
    const playerWeapon = player.weapons[player.currentWeapon];
    if (playerWeapon.clipAmmo < weaponData.maxClipSize && playerWeapon.reserveAmmo > 0 && !player.isReloading) {
      player.isReloading = true;
      player.reloadTimer = 0;
    }
  });

  socket.on('buy', (item) => {
    const player = players[socket.id];
    if (!player) return;

    switch (item) {
      case 'automatic':
        if (totalPoints >= 50 && !shopState.automatic.owned) {
          totalPoints -= 50;
          shopState.automatic.owned = true;
          shopState.automatic.clipAmmo = weapons.automatic.maxClipSize;
          updateMaxReserveAmmo('automatic', shopState.automatic);
          shopState.automatic.reserveAmmo = shopState.automatic.maxReserveAmmo;
          for (let id in players) {
            players[id].weapons.automatic = { ...shopState.automatic };
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'shotgun':
        if (totalPoints >= 70 && !shopState.shotgun.owned) {
          totalPoints -= 70;
          shopState.shotgun.owned = true;
          shopState.shotgun.clipAmmo = weapons.shotgun.maxClipSize;
          updateMaxReserveAmmo('shotgun', shopState.shotgun);
          shopState.shotgun.reserveAmmo = shopState.shotgun.maxReserveAmmo;
          for (let id in players) {
            players[id].weapons.shotgun = { ...shopState.shotgun };
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'machinegun':
        if (totalPoints >= 500 && !shopState.machinegun.owned) {
          totalPoints -= 500;
          shopState.machinegun.owned = true;
          shopState.machinegun.clipAmmo = weapons.machinegun.maxClipSize;
          updateMaxReserveAmmo('machinegun', shopState.machinegun);
          shopState.machinegun.reserveAmmo = shopState.machinegun.maxReserveAmmo;
          for (let id in players) {
            players[id].weapons.machinegun = { ...shopState.machinegun };
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'playerHealth':
        if (totalPoints >= 10) {
          totalPoints -= 10;
          players[socket.id].health = Math.min(players[socket.id].maxHealth, players[socket.id].health + 20);
        }
        break;
      case 'baseHealth':
        if (totalPoints >= 10) {
          totalPoints -= 10;
          base.health = Math.min(base.maxHealth, base.health + 20);
        }
        break;
      case 'firingRate':
        if (totalPoints >= 20 && shopState[player.currentWeapon].firingRateLevel < 5) {
          totalPoints -= 20;
          shopState[player.currentWeapon].firingRateLevel++;
          for (let id in players) {
            players[id].weapons[player.currentWeapon].firingRateLevel = shopState[player.currentWeapon].firingRateLevel;
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'damage':
        if (totalPoints >= 20 && shopState[player.currentWeapon].damageLevel < 5) {
          totalPoints -= 20;
          shopState[player.currentWeapon].damageLevel++;
          for (let id in players) {
            players[id].weapons[player.currentWeapon].damageLevel = shopState[player.currentWeapon].damageLevel;
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'reload':
        if (totalPoints >= 20 && shopState[player.currentWeapon].reloadLevel < 5) {
          totalPoints -= 20;
          shopState[player.currentWeapon].reloadLevel++;
          for (let id in players) {
            players[id].weapons[player.currentWeapon].reloadLevel = shopState[player.currentWeapon].reloadLevel;
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'ammoCapacity':
        if (totalPoints >= 20 && shopState[player.currentWeapon].ammoCapacityLevel < 5) {
          totalPoints -= 20;
          shopState[player.currentWeapon].ammoCapacityLevel++;
          updateMaxReserveAmmo(player.currentWeapon, shopState[player.currentWeapon]);
          shopState[player.currentWeapon].reserveAmmo = shopState[player.currentWeapon].maxReserveAmmo;
          for (let id in players) {
            players[id].weapons[player.currentWeapon].ammoCapacityLevel = shopState[player.currentWeapon].ammoCapacityLevel;
            players[id].weapons[player.currentWeapon].reserveAmmo = shopState[player.currentWeapon].reserveAmmo;
          }
          io.emit('shopUpdate', shopState);
        }
        break;
      case 'ammo':
        if (totalPoints >= 50) {
          totalPoints -= 50;
          ['pistol', 'automatic', 'shotgun', 'machinegun'].forEach(weaponKey => {
            const playerWeapon = players[socket.id].weapons[weaponKey];
            playerWeapon.clipAmmo = weapons[weaponKey].maxClipSize;
            updateMaxReserveAmmo(weaponKey, playerWeapon);
            playerWeapon.reserveAmmo = playerWeapon.maxReserveAmmo;
          });
        }
        break;
    }
  });

  socket.on('startWave', () => {
    if (gameState === 'ready_for_first_wave') {
      currentWave = 1;
      startWave();
      gameState = 'playing';
      io.emit('gameStateUpdate', { gameState, currentWave });
    } else if (gameState === 'ready_for_next_wave') {
      currentWave++;
      startWave();
      gameState = 'playing';
      io.emit('gameStateUpdate', { gameState, currentWave });
    }
  });

  socket.on('openShop', () => {
    if (gameState === 'wave_ended') {
      gameState = 'shop';
      io.emit('gameStateUpdate', { gameState, currentWave });
    }
  });

  socket.on('exitShop', () => {
    if (gameState === 'shop') {
      gameState = 'ready_for_next_wave';
      io.emit('gameStateUpdate', { gameState, currentWave });
    }
  });

  socket.on('restart', () => {
    if (gameState === 'game_over') {
      base.health = 100;
      for (let id in players) {
        players[id].health = 100;
        players[id].x = 400;
        players[id].y = 500;
        players[id].weapons = {
          pistol: { owned: true, clipAmmo: 7, reserveAmmo: 46, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0, maxReserveAmmo: 60 },
          automatic: { ...shopState.automatic },
          shotgun: { ...shopState.shotgun },
          machinegun: { ...shopState.machinegun }
        };
        players[id].currentWeapon = 'pistol';
      }
      zombies.length = 0;
      bullets.length = 0;
      totalPoints = 0;
      currentWave = 0;
      isWaveActive = false;
      totalZombiesToSpawn = 0;
      zombiesSpawned = 0;
      spawnTimer = 0;
      spawnInterval = 1000;
      gameState = 'ready_for_first_wave';
      io.emit('gameStateUpdate', { gameState, currentWave, base, players, zombies, bullets, totalPoints });
    }
  });

  socket.on('switchWeapon', (weapon) => {
    if (players[socket.id] && players[socket.id].weapons[weapon].owned) {
      players[socket.id].currentWeapon = weapon;
    }
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

// Игровой цикл на сервере
setInterval(() => {
  const deltaTime = 1 / 60;

  if (gameState === 'playing') {
    // Обновление игроков
    for (let id in players) {
      const player = players[id];
      if (player.isReloading) {
        const weaponData = weapons[player.currentWeapon];
        const actualReloadTime = weaponData.baseReloadTime / (1 + 0.1 * player.weapons[player.currentWeapon].reloadLevel);
        player.reloadTimer += deltaTime * 1000;
        if (player.reloadTimer >= actualReloadTime) {
          const playerWeapon = player.weapons[player.currentWeapon];
          const bulletsToLoad = Math.min(weaponData.maxClipSize - playerWeapon.clipAmmo, playerWeapon.reserveAmmo);
          playerWeapon.clipAmmo += bulletsToLoad;
          playerWeapon.reserveAmmo -= bulletsToLoad;
          player.isReloading = false;
        }
      }
    }

    // Спавн зомби
    if (isWaveActive) {
      spawnTimer += deltaTime * 1000;
      if (spawnTimer > spawnInterval && zombiesSpawned < totalZombiesToSpawn) {
        spawnZombie();
        zombiesSpawned++;
        spawnTimer = 0;
      }
    }

    // Обновление зомби
    for (let i = zombies.length - 1; i >= 0; i--) {
      const zombie = zombies[i];

      let closestTarget = base;
      let minDistance = Infinity;
      for (let id in players) {
        const player = players[id];
        const dx = player.x - zombie.x;
        const dy = player.y - zombie.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance && distance < 200) {
          minDistance = distance;
          closestTarget = player;
        }
      }

      if (checkCollision(zombie, closestTarget)) {
        zombie.isAttacking = true;
        zombie.target = closestTarget === base ? 'base' : closestTarget.id;
        if (zombie.target === 'base') {
          base.health = Math.max(0, base.health - zombie.damageRate * deltaTime);
        } else {
          players[zombie.target].health = Math.max(0, players[zombie.target].health - zombie.damageRate * deltaTime);
        }
      } else if (zombie.target) {
        zombie.isAttacking = false;
        zombie.target = null;
      }

      if (!zombie.isAttacking) {
        const dx = closestTarget.x - zombie.x;
        const dy = closestTarget.y - zombie.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
          const moveDistance = zombie.speed * deltaTime;
          zombie.x += (dx / distance) * moveDistance;
          zombie.y += (dy / distance) * moveDistance;
          zombie.angle = Math.atan2(dy, dx);
        }
      }
    }

    // Обновление пуль
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      bullet.x += bullet.vx * deltaTime;
      bullet.y += bullet.vy * deltaTime;

      for (let j = zombies.length - 1; j >= 0; j--) {
        const zombie = zombies[j];
        if (checkCollision(bullet, zombie)) {
          zombie.health -= bullet.damage;
          bullets.splice(i, 1);
          if (zombie.health <= 0) {
            zombies.splice(j, 1);
            totalPoints += 10;
          }
          break;
        }
      }

      if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
        bullets.splice(i, 1);
      }
    }

    // Проверка конца волны
    if (isWaveActive && zombiesSpawned >= totalZombiesToSpawn && zombies.length === 0) {
      isWaveActive = false;
      gameState = 'wave_ended';
      io.emit('gameStateUpdate', { gameState, currentWave });
    }

    // Проверка конца игры
    if (base.health <= 0 || Object.keys(players).every(id => players[id].health <= 0)) {
      gameState = 'game_over';
      io.emit('gameStateUpdate', { gameState, currentWave });
    }
  }

  io.emit('gameState', { players, zombies, bullets, base, gameState, currentWave, totalPoints });
}, 1000 / 60);

http.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен');
});