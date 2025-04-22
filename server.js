const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public')); // Обслуживание файлов из папки public

io.on('connection', (socket) => {
  console.log('Игрок подключился:', socket.id);

  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
  });
});

http.listen(process.env.PORT || 3000, () => {
  console.log('Сервер запущен');
});