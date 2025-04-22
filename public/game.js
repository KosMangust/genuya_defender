const socket = io(); // Подключение к серверу (пока не используется, но готово для мультиплеера)

// Получение канваса и контекста
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Загрузка текстур
const playerImage = new Image();
playerImage.src = 'assets/hero.png';
const baseImage = new Image();
baseImage.src = 'assets/chasha.png';
const zombieImage = new Image();
zombieImage.src = 'assets/zombie.png';
const backgroundImage = new Image();
backgroundImage.src = 'assets/background.jpg';

// Вставьте сюда остальной код из вашего <script> до requestAnimationFrame(gameLoop);
    // Получение канваса и контекста
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Загрузка текстур
    const playerImage = new Image();
    playerImage.src = 'assets/hero.png';
    const baseImage = new Image();
    baseImage.src = 'assets/chasha.png';
    const zombieImage = new Image();
    zombieImage.src = 'assets/zombie.png';
    const backgroundImage = new Image();
    backgroundImage.src = 'assets/background.jpg';

    // Игровые объекты
    const base = {
      x: 400,
      y: 300,
      width: 70,
      height: 50,
      health: 100,
      maxHealth: 100
    };

    const player = {
      x: 400,
      y: 500,
      width: 30,
      height: 30,
      speed: 200,
      health: 100,
      maxHealth: 100,
      weapons: {
        pistol: { owned: true, clipAmmo: 7, reserveAmmo: 46, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        automatic: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        shotgun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        machinegun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 }
      },
      currentWeapon: 'pistol'
    };

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

    // Установка начального maxReserveAmmo
    function updateMaxReserveAmmo(weaponKey) {
      const weaponData = weapons[weaponKey];
      const playerWeapon = player.weapons[weaponKey];
      weaponData.maxReserveAmmo = Math.ceil(weaponData.baseMaxReserveAmmo * (1 + 0.1 * playerWeapon.ammoCapacityLevel));
      if (playerWeapon.reserveAmmo > weaponData.maxReserveAmmo) {
        playerWeapon.reserveAmmo = weaponData.maxReserveAmmo;
      }
    }

    // Инициализация maxReserveAmmo для всех оружий
    ['pistol', 'automatic', 'shotgun', 'machinegun'].forEach(updateMaxReserveAmmo);

    const zombies = [];
    const bullets = [];

    // Кнопки магазина
    const shopButtons = [
      { text: 'Купить автомат (50 очков)', x: 300, y: 150, width: 200, height: 30, action: 'automatic', visible: () => !player.weapons.automatic.owned },
      { text: 'Купить дробовик (70 очков)', x: 300, y: 190, width: 200, height: 30, action: 'shotgun', visible: () => !player.weapons.shotgun.owned },
      { text: 'Купить пулемёт (500 очков)', x: 300, y: 230, width: 200, height: 30, action: 'machinegun', visible: () => !player.weapons.machinegun.owned },
      { text: 'Аптечка для игрока (10 очков, +20 здоровья)', x: 300, y: 270, width: 200, height: 30, action: 'playerHealth', visible: () => true },
      { text: 'Ремонт базы (10 очков, +20 здоровья)', x: 300, y: 310, width: 200, height: 30, action: 'baseHealth', visible: () => true },
      { text: 'Улучшить скорострельность (20 очков, +10%)', x: 300, y: 350, width: 200, height: 30, action: 'firingRate', visible: () => player.weapons[player.currentWeapon].firingRateLevel < 5 },
      { text: 'Улучшить урон (20 очков, +10%)', x: 300, y: 390, width: 200, height: 30, action: 'damage', visible: () => player.weapons[player.currentWeapon].damageLevel < 5 },
      { text: 'Улучшить перезарядку (20 очков, +10%)', x: 300, y: 430, width: 200, height: 30, action: 'reload', visible: () => player.weapons[player.currentWeapon].reloadLevel < 5 },
      { text: 'Улучшить боезапас (20 очков, +10%)', x: 300, y: 470, width: 200, height: 30, action: 'ammoCapacity', visible: () => {
        return player.weapons.pistol.ammoCapacityLevel < 5 ||
               player.weapons.automatic.ammoCapacityLevel < 5 ||
               player.weapons.shotgun.ammoCapacityLevel < 5 ||
               player.weapons.machinegun.ammoCapacityLevel < 5;
      }},
      { text: 'Пополнить все патроны (50 очков)', x: 300, y: 510, width: 200, height: 30, action: 'ammo', visible: () => {
        return player.weapons.pistol.reserveAmmo < weapons.pistol.maxReserveAmmo ||
               player.weapons.pistol.clipAmmo < weapons.pistol.maxClipSize ||
               player.weapons.automatic.reserveAmmo < weapons.automatic.maxReserveAmmo ||
               player.weapons.automatic.clipAmmo < weapons.automatic.maxClipSize ||
               player.weapons.shotgun.reserveAmmo < weapons.shotgun.maxReserveAmmo ||
               player.weapons.shotgun.clipAmmo < weapons.shotgun.maxClipSize ||
               player.weapons.machinegun.reserveAmmo < weapons.machinegun.maxReserveAmmo ||
               player.weapons.machinegun.clipAmmo < weapons.machinegun.maxClipSize;
      }},
      { text: 'Выйти', x: 300, y: 550, width: 200, height: 30, action: 'exit', visible: () => true }
    ];

    // Игровое состояние
    let gameState = 'ready_for_first_wave';
    let currentWave = 0;
    let isWaveActive = false;
    let totalZombiesToSpawn = 0;
    let zombiesSpawned = 0;
    let spawnTimer = 0;
    let spawnInterval = 1000; // Начальное значение, будет меняться
    let totalPoints = 0;
    let lastShootTime = 0;
    let isReloading = false;
    let reloadTimer = 0;
    let lastShopInputTime = 0;
    let lastWeaponSwitchTime = 0;
    const shopInputCooldown = 200; // 200 мс для дебounce
    const weaponSwitchCooldown = 200; // 200 мс для дебounce переключения оружия

    // Состояние клавиш
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
      e: false,
      ' ': false
    };

    // Координаты мыши
    let mouseX = 400;
    let mouseY = 300;
    let mouseDown = false;

    // Обработчики событий
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

    // Проверка коллизии (AABB)
    function checkCollision(obj1, obj2) {
      return obj1.x - obj1.width / 2 < obj2.x + obj2.width / 2 &&
             obj1.x + obj1.width / 2 > obj2.x - obj2.width / 2 &&
             obj1.y - obj1.height / 2 < obj2.y + obj2.height / 2 &&
             obj1.y + obj1.height / 2 > obj2.y - obj2.height / 2;
    }

    // Начало волны
    function startWave() {
      totalZombiesToSpawn = Math.ceil(10 * Math.pow(1.5, currentWave - 1));
      spawnInterval = 1000 / Math.pow(1.3, currentWave - 1);
      zombiesSpawned = 0;
      spawnTimer = 0;
      isWaveActive = true;
    }

    // Перезапуск игры
    function restartGame() {
      base.health = 100;
      player.health = 100;
      player.x = 400;
      player.y = 500;
      player.weapons = {
        pistol: { owned: true, clipAmmo: 7, reserveAmmo: 46, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        automatic: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        shotgun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 },
        machinegun: { owned: false, clipAmmo: 0, reserveAmmo: 0, firingRateLevel: 0, damageLevel: 0, reloadLevel: 0, ammoCapacityLevel: 0 }
      };
      player.currentWeapon = 'pistol';
      ['pistol', 'automatic', 'shotgun', 'machinegun'].forEach(updateMaxReserveAmmo);
      zombies.length = 0;
      bullets.length = 0;
      totalPoints = 0;
      currentWave = 0;
      isWaveActive = false;
      totalZombiesToSpawn = 0;
      zombiesSpawned = 0;
      spawnTimer = 0;
      spawnInterval = 1000;
      lastShootTime = 0;
      isReloading = false;
      reloadTimer = 0;
      lastShopInputTime = 0;
      lastWeaponSwitchTime = 0;
      gameState = 'ready_for_first_wave';
    }

    // Спавн зомби
    function spawnZombie() {
      const side = Math.floor(Math.random() * 4);
      let x, y;
      if (side === 0) { x = 0; y = Math.random() * canvas.height; }
      else if (side === 1) { x = canvas.width; y = Math.random() * canvas.height; }
      else if (side === 2) { x = Math.random() * canvas.width; y = 0; }
      else { x = Math.random() * canvas.width; y = canvas.height; }

      const speed = 100 * Math.pow(1.05, currentWave - 1);
      const damageRate = 1 * Math.pow(1.05, currentWave - 1);
      const health = 20 * Math.pow(1.05, currentWave - 1); // Прирост здоровья 5%

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

    // Задержка для стрельбы очередью
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Стрельба
    async function shoot() {
      const weaponData = weapons[player.currentWeapon];
      const playerWeapon = player.weapons[player.currentWeapon];
      const actualCooldown = weaponData.baseCooldown / (1 + 0.1 * playerWeapon.firingRateLevel);
      const actualDamage = weaponData.baseDamage * (1 + 0.1 * playerWeapon.damageLevel);

      if (!isReloading && Date.now() - lastShootTime > actualCooldown && playerWeapon.clipAmmo >= weaponData.ammoPerShot) {
        lastShootTime = Date.now();
        playerWeapon.clipAmmo -= weaponData.ammoPerShot;

        const mainAngle = Math.atan2(mouseY - player.y, mouseX - player.x);
        if (player.currentWeapon === 'automatic') {
          // Стрельба очередью для автомата
          for (let i = 0; i < weaponData.angleOffsets.length; i++) {
            const offset = weaponData.angleOffsets[i];
            const totalAngle = mainAngle + offset * Math.PI / 180;
            const speed = 400;
            bullets.push({
              x: player.x,
              y: player.y,
              width: 5,
              height: 5,
              vx: Math.cos(totalAngle) * speed,
              vy: Math.sin(totalAngle) * speed,
              damage: actualDamage
            });
            await sleep(50); // Задержка 50 мс между пулями
          }
        } else {
          // Обычная стрельба для других оружий
          weaponData.angleOffsets.forEach(offset => {
            const totalAngle = mainAngle + offset * Math.PI / 180;
            const speed = 400;
            bullets.push({
              x: player.x,
              y: player.y,
              width: 5,
              height: 5,
              vx: Math.cos(totalAngle) * speed,
              vy: Math.sin(totalAngle) * speed,
              damage: actualDamage
            });
          });
        }
      }
    }

    // Перезарядка
    function reload() {
      const weaponData = weapons[player.currentWeapon];
      const playerWeapon = player.weapons[player.currentWeapon];
      if (playerWeapon.clipAmmo < weaponData.maxClipSize && playerWeapon.reserveAmmo > 0 && !isReloading) {
        isReloading = true;
        reloadTimer = 0;
      }
    }

    // Покупка в магазине
    function buyItem(item) {
      const playerWeapon = player.weapons[player.currentWeapon];
      console.log(`Попытка купить ${item}, очки: ${totalPoints}, оружие: ${player.currentWeapon}, firingRateLevel: ${playerWeapon.firingRateLevel}, damageLevel: ${playerWeapon.damageLevel}, reloadLevel: ${playerWeapon.reloadLevel}, ammoCapacityLevel: ${playerWeapon.ammoCapacityLevel}`);

      switch (item) {
        case 'automatic':
          if (totalPoints >= 50 && !player.weapons.automatic.owned) {
            totalPoints -= 50;
            player.weapons.automatic.owned = true;
            player.weapons.automatic.clipAmmo = weapons.automatic.maxClipSize;
            updateMaxReserveAmmo('automatic');
            player.weapons.automatic.reserveAmmo = weapons.automatic.maxReserveAmmo;
            console.log('Куплен автомат');
          }
          break;
        case 'shotgun':
          if (totalPoints >= 70 && !player.weapons.shotgun.owned) {
            totalPoints -= 70;
            player.weapons.shotgun.owned = true;
            player.weapons.shotgun.clipAmmo = weapons.shotgun.maxClipSize;
            updateMaxReserveAmmo('shotgun');
            player.weapons.shotgun.reserveAmmo = weapons.shotgun.maxReserveAmmo;
            console.log('Куплен дробовик');
          }
          break;
        case 'machinegun':
          if (totalPoints >= 500 && !player.weapons.machinegun.owned) {
            totalPoints -= 500;
            player.weapons.machinegun.owned = true;
            player.weapons.machinegun.clipAmmo = weapons.machinegun.maxClipSize;
            updateMaxReserveAmmo('machinegun');
            player.weapons.machinegun.reserveAmmo = weapons.machinegun.maxReserveAmmo;
            console.log('Куплен пулемёт');
          }
          break;
        case 'playerHealth':
          if (totalPoints >= 10) {
            totalPoints -= 10;
            player.health = Math.min(player.maxHealth, player.health + 20);
            console.log('Куплено здоровье игрока');
          }
          break;
        case 'baseHealth':
          if (totalPoints >= 10) {
            totalPoints -= 10;
            base.health = Math.min(base.maxHealth, base.health + 20);
            console.log('Куплено здоровье базы');
          }
          break;
        case 'firingRate':
          if (totalPoints >= 20 && playerWeapon.firingRateLevel < 5) {
            totalPoints -= 20;
            playerWeapon.firingRateLevel++;
            console.log(`Улучшена скорострельность для ${player.currentWeapon}`);
          }
          break;
        case 'damage':
          if (totalPoints >= 20 && playerWeapon.damageLevel < 5) {
            totalPoints -= 20;
            playerWeapon.damageLevel++;
            console.log(`Улучшен урон для ${player.currentWeapon}`);
          }
          break;
        case 'reload':
          if (totalPoints >= 20 && playerWeapon.reloadLevel < 5) {
            totalPoints -= 20;
            playerWeapon.reloadLevel++;
            console.log(`Улучшена перезарядка для ${player.currentWeapon}`);
          }
          break;
        case 'ammoCapacity':
          if (totalPoints >= 20 && (player.weapons.pistol.ammoCapacityLevel < 5 ||
                                   player.weapons.automatic.ammoCapacityLevel < 5 ||
                                   player.weapons.shotgun.ammoCapacityLevel < 5 ||
                                   player.weapons.machinegun.ammoCapacityLevel < 5)) {
            totalPoints -= 20;
            ['pistol', 'automatic', 'shotgun', 'machinegun'].forEach(weaponKey => {
              const playerWeapon = player.weapons[weaponKey];
              if (playerWeapon.ammoCapacityLevel < 5) {
                playerWeapon.ammoCapacityLevel++;
                updateMaxReserveAmmo(weaponKey);
                if (playerWeapon.reserveAmmo < weapons[weaponKey].maxReserveAmmo) {
                  playerWeapon.reserveAmmo = weapons[weaponKey].maxReserveAmmo;
                }
              }
            });
            console.log('Улучшен боезапас для всех оружий');
          }
          break;
        case 'ammo':
          if (totalPoints >= 50) {
            totalPoints -= 50;
            ['pistol', 'automatic', 'shotgun', 'machinegun'].forEach(weaponKey => {
              player.weapons[weaponKey].clipAmmo = weapons[weaponKey].maxClipSize;
              updateMaxReserveAmmo(weaponKey);
              player.weapons[weaponKey].reserveAmmo = weapons[weaponKey].maxReserveAmmo;
            });
            console.log('Пополнены все патроны');
          }
          break;
      }
    }

    // Основная игровая петля
    function update(deltaTime) {
      const currentTime = Date.now();

      // Переключение оружия
      if (currentTime - lastWeaponSwitchTime > weaponSwitchCooldown) {
        if (keys['1']) {
          player.currentWeapon = 'pistol';
          lastWeaponSwitchTime = currentTime;
          console.log('Переключено на пистолет');
        }
        if (keys['2'] && player.weapons.automatic.owned) {
          player.currentWeapon = 'automatic';
          lastWeaponSwitchTime = currentTime;
          console.log('Переключено на автомат');
        }
        if (keys['3'] && player.weapons.shotgun.owned) {
          player.currentWeapon = 'shotgun';
          lastWeaponSwitchTime = currentTime;
          console.log('Переключено на дробовик');
        }
        if (keys['4'] && player.weapons.machinegun.owned) {
          player.currentWeapon = 'machinegun';
          lastWeaponSwitchTime = currentTime;
          console.log('Переключено на пулемёт');
        }
      }

      if (gameState === 'playing') {
        // Движение игрока
        let vx = 0;
        let vy = 0;
        if (keys.w) vy -= 1;
        if (keys.s) vy += 1;
        if (keys.a) vx -= 1;
        if (keys.d) vx += 1;

        const magnitude = Math.sqrt(vx * vx + vy * vy);
        let newX = player.x;
        let newY = player.y;
        if (magnitude > 0) {
          vx = (vx / magnitude) * player.speed;
          vy = (vy / magnitude) * player.speed;
          newX += vx * deltaTime;
          newY += vy * deltaTime;
        }

        const tempPlayer = { x: newX, y: newY, width: player.width, height: player.height };
        let canMove = true;
        for (const zombie of zombies) {
          if (checkCollision(tempPlayer, zombie)) {
            canMove = false;
            break;
          }
        }
        if (checkCollision(tempPlayer, base)) {
          canMove = false;
        }
        if (canMove) {
          player.x = newX;
          player.y = newY;
        }

        player.x = Math.max(player.width / 2, Math.min(canvas.width - player.width / 2, player.x));
        player.y = Math.max(player.height / 2, Math.min(canvas.height - player.height / 2, player.y));

        // Стрельба
        if (mouseDown) shoot();

        // Перезарядка
        if (keys.r) reload();
        if (isReloading) {
          const weaponData = weapons[player.currentWeapon];
          const actualReloadTime = weaponData.baseReloadTime / (1 + 0.1 * player.weapons[player.currentWeapon].reloadLevel);
          reloadTimer += deltaTime * 1000;
          if (reloadTimer >= actualReloadTime) {
            const playerWeapon = player.weapons[player.currentWeapon];
            const bulletsToLoad = Math.min(weaponData.maxClipSize - playerWeapon.clipAmmo, playerWeapon.reserveAmmo);
            playerWeapon.clipAmmo += bulletsToLoad;
            playerWeapon.reserveAmmo -= bulletsToLoad;
            isReloading = false;
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

          if (checkCollision(zombie, player)) {
            zombie.isAttacking = true;
            zombie.target = 'player';
            player.health = Math.max(0, player.health - zombie.damageRate * deltaTime);
          } else if (zombie.target === 'player') {
            zombie.isAttacking = false;
            zombie.target = null;
          }

          if (zombie.isAttacking && zombie.target === 'base') {
            base.health = Math.max(0, base.health - zombie.damageRate * deltaTime);
            continue;
          }

          const dxPlayer = player.x - zombie.x;
          const dyPlayer = player.y - zombie.y;
          const distanceToPlayer = Math.sqrt(dxPlayer * dxPlayer + dyPlayer * dyPlayer);
          let target = distanceToPlayer < 200 ? player : base;

          if (!zombie.isAttacking && checkCollision(zombie, base)) {
            zombie.isAttacking = true;
            zombie.target = 'base';
            continue;
          }

          if (!zombie.isAttacking) {
            const dx = target.x - zombie.x;
            const dy = target.y - zombie.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 5) {
              const moveDistance = zombie.speed * deltaTime;
              zombie.x += (dx / distance) * moveDistance;
              zombie.y += (dy / distance) * moveDistance;
              zombie.angle = Math.atan2(dy, dx); // Сохраняем угол движения для отрисовки
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

          if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
          }
        }

        // Проверка конца волны
        if (isWaveActive && zombiesSpawned >= totalZombiesToSpawn && zombies.length === 0) {
          isWaveActive = false;
          gameState = 'wave_ended';
        }

        // Проверка конца игры
        if (player.health <= 0 || base.health <= 0) {
          gameState = 'game_over';
        }
      } else if (gameState === 'ready_for_first_wave' && keys[' ']) {
        currentWave = 1;
        startWave();
        gameState = 'playing';
      } else if (gameState === 'wave_ended' && keys.s) {
        gameState = 'shop';
        lastShopInputTime = currentTime;
      } else if (gameState === 'shop') {
        if (currentTime - lastShopInputTime > shopInputCooldown && mouseDown) {
          shopButtons.forEach(button => {
            if (button.visible() && mouseX >= button.x && mouseX <= button.x + button.width && mouseY >= button.y && mouseY <= button.y + button.height) {
              if (button.action === 'exit') {
                gameState = 'ready_for_next_wave';
              } else {
                buyItem(button.action);
              }
              lastShopInputTime = currentTime;
            }
          });
          mouseDown = false;
        }
      } else if (gameState === 'ready_for_next_wave' && keys[' ']) {
        currentWave++;
        startWave();
        gameState = 'playing';
      } else if (gameState === 'game_over' && keys.r) {
        restartGame();
      }
    }

    // Отрисовка
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Отрисовка фона
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

      // Отрисовка базы с текстурой
      ctx.drawImage(baseImage, base.x - base.width / 2, base.y - base.height / 2, base.width, base.height);

      // Отрисовка игрока с текстурой
      ctx.save();
      ctx.translate(player.x, player.y);
      const playerAngle = Math.atan2(mouseY - player.y, mouseX - player.x) + Math.PI / 2;
      ctx.rotate(playerAngle);
      ctx.drawImage(playerImage, -player.width * 3 / 2, -player.height * 3 / 2, player.width * 3, player.height * 3);
      ctx.restore();

      // Отрисовка зомби с текстурой (уменьшена в 2 раза)
      zombies.forEach(zombie => {
        ctx.save();
        ctx.translate(zombie.x, zombie.y);
        const zombieAngle = zombie.angle + Math.PI / 2;
        ctx.rotate(zombieAngle);
        ctx.drawImage(zombieImage, -zombie.width * 1.5 / 2, -zombie.height * 1.5 / 2, zombie.width * 1.5, zombie.height * 1.5);
        ctx.restore();
      });

      bullets.forEach(bullet => {
        ctx.fillStyle = 'yellow';
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
      });

      ctx.fillStyle = 'red';
      ctx.fillRect(10, 10, 200, 20);
      ctx.fillStyle = 'lime';
      ctx.fillRect(10, 10, (base.health / base.maxHealth) * 200, 20);

      ctx.fillStyle = 'red';
      ctx.fillRect(10, 40, 200, 20);
      ctx.fillStyle = 'lime';
      ctx.fillRect(10, 40, (player.health / player.maxHealth) * 200, 20);

      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Волна: ${currentWave}`, 10, 75);
      ctx.fillText(`Очки: ${totalPoints}`, 10, 95);
      ctx.fillText(`Оружие: ${weapons[player.currentWeapon].name}`, 10, 115);
      ctx.fillText(`Патроны: ${player.weapons[player.currentWeapon].clipAmmo}/${player.weapons[player.currentWeapon].reserveAmmo}`, 10, 135);
      if (gameState === 'playing') {
        const zombiesRemaining = totalZombiesToSpawn - zombiesSpawned + zombies.length;
        ctx.fillText(`Зомби осталось: ${zombiesRemaining}`, 10, 155);
      }

      if (gameState === 'shop') {
        // Отрисовка магазина (без фона, прозрачный)
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Магазин', 400, 130);
        ctx.fillText(`Очки: ${totalPoints}`, 400, 160);
        ctx.font = '16px Arial';

        shopButtons.forEach(button => {
          if (button.visible()) {
            ctx.fillStyle = 'gray';
            ctx.fillRect(button.x, button.y, button.width, button.height);
            ctx.fillStyle = 'white';
            let text = button.text;
            if (button.action === 'firingRate') {
              const level = player.weapons[player.currentWeapon].firingRateLevel;
              text += ` (текущее: ${level}/5)`;
            } else if (button.action === 'damage') {
              const level = player.weapons[player.currentWeapon].damageLevel;
              text += ` (текущее: ${level}/5)`;
            } else if (button.action === 'reload') {
              const level = player.weapons[player.currentWeapon].reloadLevel;
              text += ` (текущее: ${level}/5)`;
            } else if (button.action === 'ammoCapacity') {
              const level = player.weapons[player.currentWeapon].ammoCapacityLevel;
              text += ` (текущее: ${level}/5)`;
            }
            ctx.fillText(text, button.x + button.width / 2, button.y + 20);
          }
        });
        ctx.fillText(`Текущее оружие: ${weapons[player.currentWeapon].name}`, 400, 590);
      } else {
        ctx.textAlign = 'center';
        if (gameState === 'ready_for_first_wave') {
          ctx.fillText('Нажмите Пробел для начала первой волны', 400, 300);
        } else if (gameState === 'wave_ended') {
          ctx.fillText(`Волна ${currentWave} завершена. Нажмите S для открытия магазина`, 400, 300);
        } else if (gameState === 'ready_for_next_wave') {
          ctx.fillText('Нажмите Пробел для начала следующей волны', 400, 300);
        } else if (gameState === 'game_over') {
          ctx.fillText('Игра окончена', 400, 300);
          ctx.fillText(`Волны пройдено: ${currentWave - 1}`, 400, 320);
          ctx.fillText(`Очки: ${totalPoints}`, 400, 340);
          ctx.fillText('Нажмите R для рестарта', 400, 360);
        }
      }
    }

    // Основной цикл
    function gameLoop(timestamp) {
      const deltaTime = (timestamp - (gameLoop.lastTimestamp || timestamp)) / 1000;
      gameLoop.lastTimestamp = timestamp;

      update(deltaTime);
      render();

      requestAnimationFrame(gameLoop);
    }
    gameLoop.lastTimestamp = 0;