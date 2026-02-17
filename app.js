require('dotenv').config();
const express = require('express');
const port = process.env.PORT || 3000;
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const initializePublicRoutes = (app) => {
  require('./app/routes/auth/auth.routes')(app);
}

// Authenticate routes
const initializePrivateRoutes = (app) => {
  require('./app/routes/customer.routes')(app);
  require('./app/routes/timeline.routes')(app);
  require('./app/routes/project.routes')(app);
  require('./app/routes/calendar.routes')(app);
  require('./app/routes/chat.routes')(app);
  require('./app/routes/manualjob.routes')(app);
  require('./app/routes/user.routes')(app);
  require('./app/routes/pipeline.routes')(app);
  require('./app/routes/inventory.routes')(app);
  require('./app/routes/analytics.routes')(app);
  require('./app/routes/calls.routes')(app);
}



initializePublicRoutes(app);
initializePrivateRoutes(app);

const server = http.createServer(app);

// 🔥 ATTACH SOCKET.IO
const io = new Server(server, {
  cors: {
    origin: '*', // later restrict this
    methods: ['GET', 'POST']
  }
});

// 🔥 SOCKET EVENTS
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log('Joined room:', roomId);
  });

  socket.on('send-message', (data) => {
    // send to everyone in room except sender
    socket.to(data.roomId).emit('new-message', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});



server.listen(port, () =>
  console.log('API Server running on port', port)
);
