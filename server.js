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

// Endpoint per ottenere tutti i ticket
app.get('/tickets', (req, res) => {
    getAllTickets((err, tickets) => {
        if (err) {
            return res.status(500).send('Error retrieving tickets');
        }
        res.json(tickets);
    });
});
//TEST request
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
// Endpoint per recuperare un ticket tramite ID
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

// Endpoint per ottenere i commenti di un ticket con le risposte
app.get('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;

    getCommentsByTicketId(id, (err, commentsWithReplies) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving comments and replies' });
        }
        res.json(commentsWithReplies);
    });
});

// Endpoint per aggiungere un commento a un ticket
app.post('/tickets/:id/comment', (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    addCommentToTicket(id, comment, (err, result) => {
        if (err) {
            return res.status(500).send('Error adding comment');
        }

        // Query per ottenere il commento appena inserito
        const sql = 'SELECT * FROM comments WHERE id = ?';
        connection.query(sql, [result.insertId], (err, newComment) => {
            if (err) {
                return res.status(500).json({ error: 'Error retrieving the new comment' });
            }

            res.status(200).json(newComment[0]);  // Restituisce il nuovo commento
        });
    });
});

// Endpoint per aggiungere una risposta a un commento
app.post('/comments/:commentId/reply', (req, res) => {
    const { commentId } = req.params;
    const { reply } = req.body;

    addReplyToComment(commentId, reply, (err, result) => {
        if (err) {
            return res.status(500).send('Error adding reply');
        }

        // Query per ottenere la risposta appena inserita
        const sql = 'SELECT * FROM comment_replies WHERE id = ?';
        connection.query(sql, [result.insertId], (err, newReply) => {
            if (err) {
                return res.status(500).json({ error: 'Error retrieving the new reply' });
            }
            res.status(201).json(newReply[0]);  // Restituisce la nuova risposta
        });
    });
});

// Endpoint per eliminare un ticket
app.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;

    deleteTicketById(id, (err, result) => {
        if (err) {
            return res.status(500).send('Error deleting ticket');
        }
        res.status(200).json({ message: `Ticket with id ${id} deleted` });
    });
});

// Endpoint per eliminare un commento
app.delete('/comments/:commentId', (req, res) => {
    const { commentId } = req.params;

    const sql = 'DELETE FROM comments WHERE id = ?';

    connection.query(sql, [commentId], (err, result) => {
        if (err) {
            console.error('Error deleting comment: ' + err.stack);
            return res.status(500).json({ error: 'Error deleting comment' });
        }

        res.status(200).json({ message: `Comment with id ${commentId} deleted` });
    });
});

// Endpoint per recuperare i messaggi della chat per il frontend
app.get('/messages', (req, res) => {
    const sql = 'SELECT * FROM chat_messages ORDER BY timestamp ASC';

    connection.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving messages' });
        }
        res.json(results);
    });
});
// Endpoint per ottenere la lista degli utenti
app.get('/users', (req, res) => {
    // Esempio statico: modifica questo codice per recuperare gli utenti da un database
    const users = ['user1', 'user2', 'user3']; // Sostituisci con query al DB se necessario

    res.json(users);
});
//TEST
connection.query('SELECT 1', (err, results) => {
    if (err) {
        console.error('Connection test failed:', err.stack);
    } else {
        console.log('Database connection is working.');
    }
});

// Gestione delle connessioni Socket.io
const userSockets = {}; // Mappa per tenere traccia degli utenti e dei loro socket.id

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('register', (username) => {
        userSockets[username] = socket.id;
        console.log(`${username} registered with socket id ${socket.id}`);
    });

    // Invia il messaggio tramite Socket.io
    socket.on('chat message', (msg) => {
        const { sender, recipient, text } = msg;

        console.log('Received chat message:', msg);

        // Salva il messaggio su MySQL
        saveChatMessage(sender, recipient, text, (err, result) => {
            if (err) {
                console.error('Error saving message:', err);
                socket.emit('error', 'Message could not be saved');
                return;
            }
            console.log('Message saved to database');

            // Emetti il messaggio al destinatario se connesso
            const recipientSocketId = userSockets[recipient];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat message', msg);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        for (let username in userSockets) {
            if (userSockets[username] === socket.id) {
                delete userSockets[username];
                console.log(`${username} disconnected and removed from userSockets`);
                break;
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
