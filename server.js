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
  console.log('New client connected:', socket.id);

  // Create a new room
  socket.on('create-room', () => {
    const roomId = generateRoomId();
    console.log('Room created:', roomId);
    socket.emit('room-created', roomId);
  });

  // Join room
  socket.on('join-room', (roomId, userData) => {
    console.log('Attempting to join room:', roomId);
    console.log('User data:', userData);

    // Validate room ID
    if (!roomId) {
      console.log('Invalid room ID');
      socket.emit('room-join-error', 'Invalid room ID');
      return;
    }

    // Join the socket room
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }
    
    // Add or update user in room
    const existingUserIndex = rooms[roomId].findIndex(
      user => user.userId === userData.userId
    );
    
    if (existingUserIndex > -1) {
      rooms[roomId][existingUserIndex] = userData;
    } else {
      rooms[roomId].push(userData);
    }
    
    // Broadcast room update to all users in the room
    console.log('Room users after join:', rooms[roomId]);
    io.to(roomId).emit('room-update', rooms[roomId]);
    
    // Confirm successful join to the client
    socket.emit('room-joined', roomId);
  });

  // Update location
  socket.on('update-location', (roomId, locationData) => {
    console.log('Location update for room:', roomId);
    console.log('Location data:', locationData);

    if (rooms[roomId]) {
      const userIndex = rooms[roomId].findIndex(
        user => user.userId === locationData.userId
      );
      
      if (userIndex > -1) {
        rooms[roomId][userIndex] = {
          ...rooms[roomId][userIndex],
          ...locationData
        };
        
        // Broadcast to other users in the room
        socket.to(roomId).emit('location-updated', locationData);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
