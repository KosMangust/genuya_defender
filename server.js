const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};
let zombies = [];
let bullets = [];
let shopState = {
  automatic: { owned: false },
  shotgun: { owned: false },
  machinegun: { owned: false },
};

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  players[socket.id] = {
    x: 400,
    y: 500,
    health: 100,
    currentWeapon: 'pistol',
    weapons: {
      pistol: { owned: true, clipAmmo: 7, reserveAmmo: 46 },
      automatic: shopState.automatic,
      shotgun: shopState.shotgun,
      machinegun: shopState.machinegun,
    },
  };

  socket.emit('init', { players, zombies, bullets, shopState });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
    }
  });

  socket.on('shoot', (data) => {
    bullets.push({
      x: data.x,
      y: data.y,
      vx: data.vx,
      vy: data.vy,
      damage: data.damage,
      owner: socket.id,
    });
  });

  socket.on('buy', (item) => {
    if (item === 'automatic' && !shopState.automatic.owned) {
      shopState.automatic.owned = true;
      for (let id in players) {
        players[id].weapons.automatic = shopState.automatic;
      }
      io.emit('shopUpdate', shopState);
    } else if (item === 'shotgun' && !shopState.shotgun.owned) {
      shopState.shotgun.owned = true;
      for (let id in players) {
        players[id].weapons.shotgun = shopState.shotgun;
      }
      io.emit('shopUpdate', shopState);
    } else if (item === 'machinegun' && !shopState.machinegun.owned) {
      shopState.machinegun.owned = true;
      for (let id in players) {
        players[id].weapons.machinegun = shopState.machinegun;
      }
      io.emit('shopUpdate', shopState);
    }
  });

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

setInterval(() => {
  io.emit('gameState', { players, zombies, bullets });
}, 1000 / 60);

http.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен');
});