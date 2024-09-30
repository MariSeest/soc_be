const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2');
const { saveChatMessage } = require('./db'); // Assicurati che esista nel file db.js

const app = express();
const port = 3001;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
}));

// Connessione al database MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'db_user',
    password: 'db_user_pass',
    database: 'soc_platform',
    port: 3306,
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as ID ' + connection.threadId);
});

// Gestione degli utenti online
let onlineUsers = {};

// Quando un utente si connette
io.on('connection', (socket) => {
    console.log('A user connected');

    // Registra l'utente online quando si connette
    socket.on('register', (username) => {
        onlineUsers[username] = socket.id;
        console.log(`${username} registered with socket id ${socket.id}`);

        // Invia la lista aggiornata degli utenti online a tutti
        io.emit('onlineUsers', Object.keys(onlineUsers));
    });

    // Invia il messaggio tramite Socket.io
    socket.on('chat message', (msg) => {
        const { sender, recipient, text } = msg;

        // Salva il messaggio su MySQL
        saveChatMessage(sender, recipient, text, (err, result) => {
            if (err) {
                console.error('Error saving message:', err);
                socket.emit('error', 'Message could not be saved');
                return;
            }
            console.log('Message saved to database');

            // Emetti il messaggio al destinatario se è online
            const recipientSocketId = onlineUsers[recipient];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat message', msg);
            }
        });
    });

    // Quando l'utente si disconnette
    socket.on('disconnect', () => {
        let disconnectedUser;
        for (let [username, socketId] of Object.entries(onlineUsers)) {
            if (socketId === socket.id) {
                disconnectedUser = username;
                delete onlineUsers[username];
                break;
            }
        }
        console.log(`${disconnectedUser} disconnected`);

        // Invia la lista aggiornata degli utenti online a tutti
        io.emit('onlineUsers', Object.keys(onlineUsers));
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
