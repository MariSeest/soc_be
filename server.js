const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2');
const {
    createTicket,
    getTicketById,
    getAllTickets,
    deleteTicketById,
    addCommentToTicket,
    updateTicketStatus,
    getRepliesByCommentId,
    addReplyToComment,
    getCommentsByTicketId,
    saveChatMessage
} = require('./db'); // Assicurati che esista nel file db.js

const app = express();
const port = 3001;

// Configura CORS per il backend Express
app.use(cors({
    origin: 'http://localhost:3000', // L'origine del tuo frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // I metodi HTTP permessi
    allowedHeaders: ['Content-Type', 'Authorization'], // Aggiungi altri header se necessari
    credentials: true, // Se stai utilizzando cookie o autenticazione
    optionsSuccessStatus: 200,
}));

app.use(express.json()); // Middleware per il parsing del body delle richieste JSON

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

// Configura Socket.IO con CORS
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    },
});

// Gestione degli utenti online
let onlineUsers = {};

// Quando un utente si connette
io.on('connection', (socket) => {
    console.log('a user connected');

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

// Endpoint per salvare i messaggi della chat
app.post('/messages', (req, res) => {
    const { sender, recipient, text } = req.body;

    if (!sender || !recipient || !text) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    saveChatMessage(sender, recipient, text, (err, result) => {
        if (err) {
            console.error('Error saving message:', err);
            return res.status(500).json({ error: 'Error saving message to database' });
        }
        res.status(200).json({ message: 'Message saved' });
    });
});

// Endpoint per ottenere tutti i messaggi della chat
app.get('/messages', (req, res) => {
    console.log('Fetching messages from the database...');
    const sql = 'SELECT * FROM chat_messages ORDER BY timestamp ASC';

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving messages:', err.stack);
            return res.status(500).json({ error: 'Error retrieving messages from database' });
        }
        console.log('Messages retrieved successfully');
        res.json(results);
    });
});

// Endpoint per ottenere la lista degli utenti online
app.get('/users', (req, res) => {
    // Invia la lista degli utenti online al frontend
    res.json(Object.keys(onlineUsers));
});

// Altri endpoint per i ticket
app.get('/tickets', (req, res) => {
    getAllTickets((err, tickets) => {
        if (err) {
            return res.status(500).send('Error retrieving tickets');
        }
        res.json(tickets);
    });
});

app.get('/ticket/:id', (req, res) => {
    const ticketId = req.params.id;

    getTicketById(ticketId, (err, ticket) => {
        if (err) {
            if (err.message === 'No ticket found with this ID') {
                return res.status(404).send(err.message);
            }
            return res.status(500).send('Error retrieving ticket');
        }
        res.json(ticket);
    });
});

// TEST connessione DB
connection.query('SELECT 1', (err, results) => {
    if (err) {
        console.error('Connection test failed:', err.stack);
    } else {
        console.log('Database connection is working.');
    }
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
