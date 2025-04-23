const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let localPlayer = null;
let otherPlayers = {};
let zombies = [];
let bullets = [];
let shopState = {};

socket.on('init', (data) => {
  localPlayer = data.players[socket.id];
  otherPlayers = data.players;
  delete otherPlayers[socket.id];
  zombies = data.zombies;
  bullets = data.bullets;
  shopState = data.shopState;
});

socket.on('gameState', (data) => {
  otherPlayers = data.players;
  delete otherPlayers[socket.id];
  zombies = data.zombies;
  bullets = data.bullets;
});

socket.on('shopUpdate', (newShopState) => {
  shopState = newShopState;
  localPlayer.weapons = { ...localPlayer.weapons, ...shopState };
});

socket.on('playerDisconnected', (id) => {
  delete otherPlayers[id];
});

function sendMove() {
  socket.emit('move', { x: localPlayer.x, y: localPlayer.y });
}

function sendShoot(data) {
  socket.emit('shoot', data);
}

function sendBuy(item) {
  socket.emit('buy', item);
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPlayer(localPlayer);
  for (let id in otherPlayers) {
    drawPlayer(otherPlayers[id]);
  }
  for (let zombie of zombies) {
    drawZombie(zombie);
  }
  for (let bullet of bullets) {
    drawBullet(bullet);
  }
  requestAnimationFrame(gameLoop);
}

function drawPlayer(player) {
  ctx.fillStyle = 'blue';
  ctx.fillRect(player.x - 15, player.y - 15, 30, 30);
}

function drawZombie(zombie) {
  ctx.fillStyle = 'green';
  ctx.fillRect(zombie.x - 15, zombie.y - 15, 30, 30);
}

function drawBullet(bullet) {
  ctx.fillStyle = 'red';
  ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
}

gameLoop();