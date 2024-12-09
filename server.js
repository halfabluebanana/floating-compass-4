const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static('public'));

const rooms = {};

// Simple room ID generation function
function generateRoomId() {
  return Math.random().toString(36).substring(2, 10);
}

io.on('connection', (socket) => {
  // Create a new room
  socket.on('create-room', () => {
    const roomId = generateRoomId();
    socket.emit('room-created', roomId);
  });

  // Rest of your existing socket logic remains the same
  // ... (keep the rest of the socket event handlers)
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});