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
        methods: ['GET', 'POST', 'PUT', 'DELETE'], // Aggiunto PUT e DELETE
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
const { createTicket, getTicketById, getAllTickets, deleteTicketById, addCommentToTicket, updateTicketStatus, getRepliesByCommentId, addReplyToComment, getCommentsByTicketId } = require('./db');

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

// Endpoint per ottenere tutti i ticket di phishing
app.get('/phishing-tickets', (req, res) => {
    const sql = 'SELECT * FROM phishing_tickets';
    connection.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving phishing tickets' });
        }
        res.json(results);
    });
});

// Endpoint per creare un ticket di phishing
app.post('/phishing-tickets', (req, res) => {
    const { domain, severity, status } = req.body;
    const sql = 'INSERT INTO phishing_tickets (domain, severity, status) VALUES (?, ?, ?)';

    connection.query(sql, [domain, severity, status], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error creating phishing ticket' });
        }
        res.json({ id: result.insertId });
    });
});

// Endpoint per ottenere i commenti di un ticket di phishing
app.get('/phishing-tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM phishing_comments WHERE ticket_id = ?';

    connection.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving comments' });
        }
        res.json(results);
    });
});

// Endpoint per aggiungere un commento a un ticket di phishing
app.post('/phishing-tickets/:id/comment', (req, res) => {
    const { id } = req.params;
    const { comment_text } = req.body;
    const sql = 'INSERT INTO phishing_comments (ticket_id, comment_text) VALUES (?, ?)';

    connection.query(sql, [id, comment_text], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding comment' });
        }
        res.json({ id: result.insertId });
    });
});

// Endpoint per aggiungere una risposta a un commento di phishing
app.post('/phishing-comments/:commentId/reply', (req, res) => {
    const { commentId } = req.params;
    const { reply_text } = req.body;
    const sql = 'INSERT INTO phishing_replies (comment_id, reply_text) VALUES (?, ?)';

    connection.query(sql, [commentId, reply_text], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding reply' });
        }
        res.json({ id: result.insertId });
    });
});

// Endpoint per chiudere un ticket
app.put('/tickets/:id/close', (req, res) => {
    const { id } = req.params;

    updateTicketStatus(id, 'closed', (err, result) => {
        if (err) {
            return res.status(500).send('Error closing ticket');
        }
        res.status(200).json({ message: `Ticket with id ${id} closed` });
    });
});

// Endpoint per eliminare un ticket di phishing
app.delete('/phishing-tickets/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM phishing_tickets WHERE id = ?';

    connection.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting ticket' });
        }
        res.status(200).json({ message: `Ticket with id ${id} deleted` });
    });
});

// Endpoint per eliminare un commento di phishing
app.delete('/phishing-comments/:commentId', (req, res) => {
    const { commentId } = req.params;
    const sql = 'DELETE FROM phishing_comments WHERE id = ?';

    connection.query(sql, [commentId], (err, result) => {
        if (err) {
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
