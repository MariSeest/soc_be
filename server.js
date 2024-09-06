const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const port = 3001;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Aggiunto PUT e DELETE
    }
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
}));

let messages = []; // Array per memorizzare i messaggi
const userSockets = {}; // Mappa per tenere traccia degli utenti e dei loro socket.id

// Importa le funzioni per creare, recuperare, eliminare, aggiornare ed aggiungere commenti e risposte
const { createTicket, getTicketById, getAllTickets, deleteTicketById, addCommentToTicket, updateTicketStatus, getRepliesByCommentId, addReplyToComment } = require('./db');

// Connessione al database MySQL
const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'db_user',
    password: 'db_user_pass',
    database: 'soc_platform',
    port: 3306
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as ID ' + connection.threadId);
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

// Endpoint per recuperare un ticket tramite ID
app.get('/ticket/:id', (req, res) => {
    const ticketId = req.params.id;

    // Chiama la funzione per ottenere il ticket tramite ID
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

// Endpoint per ottenere i commenti di un ticket tramite ID (aggiornato per includere le risposte)
app.get('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;

    const sql = 'SELECT * FROM comments WHERE ticket_id = ?';

    connection.query(sql, [id], (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving comments' });
        }

        const commentIds = comments.map(comment => comment.id);
        if (commentIds.length === 0) {
            return res.json([]);  // Nessun commento
        }

        // Recupera anche le risposte per ogni commento
        const replySql = 'SELECT * FROM comment_replies WHERE comment_id IN (?)';
        connection.query(replySql, [commentIds], (err, replies) => {
            if (err) {
                return res.status(500).json({ error: 'Error retrieving replies' });
            }

            // Mappa le risposte ai commenti corrispondenti
            const commentsWithReplies = comments.map(comment => ({
                ...comment,
                replies: replies.filter(reply => reply.comment_id === comment.id)
            }));

            res.json(commentsWithReplies);
        });
    });
});

// Endpoint per creare un nuovo ticket e salvarlo nel database
app.post('/tickets', (req, res) => {
    const { name, status, category, severity, content, actions } = req.body;

    // Usa la funzione createTicket per salvare il ticket nel database
    createTicket(name, status, category, severity, content, actions, (err, ticketId) => {
        if (err) {
            return res.status(500).send('Error creating ticket');
        }
        res.status(201).json({ id: ticketId, message: 'Ticket created successfully' });
    });
});

// Endpoint per eliminare un ticket utilizzando deleteTicketById
app.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;

    deleteTicketById(id, (err, result) => {
        if (err) {
            return res.status(500).send('Error deleting ticket');
        }
        res.status(200).json({ message: `Ticket with id ${id} deleted` });
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
        res.status(200).json({ message: `Comment added to ticket with id ${id}` });
    });
});

// Endpoint per ottenere le risposte di un commento
app.get('/comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;

    getRepliesByCommentId(commentId, (err, replies) => {
        if (err) {
            return res.status(500).send('Error retrieving replies');
        }
        res.json(replies);
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
        res.status(201).json({ message: `Reply added to comment with id ${commentId}` });
    });
});

// Endpoint per aggiornare lo stato di un ticket utilizzando updateTicketStatus
app.put('/tickets/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    updateTicketStatus(id, status, (err, result) => {
        if (err) {
            return res.status(500).send('Error updating ticket status');
        }
        res.status(200).json({ message: `Ticket with id ${id} updated` });
    });
});

// ENDPOINT PER ELIMINARE UN COMMENTO
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

// Gestione delle connessioni socket
io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('register', (username) => {
        userSockets[username] = socket.id;
        console.log(`${username} registered with socket id ${socket.id}`);
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

















