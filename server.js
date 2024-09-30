const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql2');
const { saveChatMessage } = require('./db');
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
    getAllPhishingTickets,
    addPhishingComment,
    addPhishingReply,
    getCommentsByPhishingTicketId
} = require('./db');

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

// Gestione degli utenti online per la chat
let onlineUsers = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    // Registra l'utente online quando si connette
    socket.on('register', (username) => {
        onlineUsers[username] = socket.id;
        console.log(`${username} registered with socket id ${socket.id}`);

        // Invia la lista aggiornata degli utenti online a tutti
        io.emit('onlineUsers', Object.keys(onlineUsers));
    });

    // Invia il messaggio tramite Socket.IO
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

        // Invia il messaggio anche al mittente
        socket.emit('chat message', msg);
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

// Gestione dei ticket

// Endpoint per creare un nuovo ticket (POST)
app.post('/tickets', (req, res) => {
    const { name, status, category, severity, content, actions } = req.body;
    createTicket(name, status, category, severity, content, actions, (err, ticketId) => {
        if (err) {
            return res.status(500).json({ error: 'Error creating ticket' });
        }
        res.status(201).json({ message: 'Ticket created', ticketId });
    });
});

// Endpoint per ottenere un ticket tramite ID (GET)
app.get('/tickets/:id', (req, res) => {
    const { id } = req.params;
    getTicketById(id, (err, ticket) => {
        if (err) {
            if (err.message === 'No ticket found with this ID') {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            return res.status(500).json({ error: 'Error retrieving ticket' });
        }
        res.status(200).json(ticket);
    });
});

// Endpoint per ottenere tutti i ticket (GET)
app.get('/tickets', (req, res) => {
    getAllTickets((err, tickets) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving tickets' });
        }
        res.status(200).json(tickets);
    });
});

// Endpoint per eliminare un ticket (DELETE)
app.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;
    deleteTicketById(id, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting ticket' });
        }
        res.status(200).json({ message: `Ticket with id ${id} deleted` });
    });
});

// Endpoint per aggiornare lo stato
app.put('/tickets/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    updateTicketStatus(id, status, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Error updating ticket status' });
        }
        res.status(200).json({ message: 'Ticket status updated' });
    });
});

// Endpoint per ottenere i commenti di un ticket (GET)
app.get('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    getCommentsByTicketId(id, (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving comments' });
        }
        res.status(200).json(comments);  // Assicurati che i commenti includano l'autore
    });
});

// Endpoint per aggiungere un commento a un ticket (POST)
app.post('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    const { comment, author } = req.body;  // Aggiungi il campo author

    addCommentToTicket(id, comment, author, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding comment' });
        }
        res.status(201).json({ message: 'Comment added', commentId: result.insertId });
    });
});

// Endpoint per aggiungere una risposta a un commento (POST)
app.post('/comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;
    const { reply, author } = req.body;  // Aggiungi il campo author

    addReplyToComment(commentId, reply, author, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding reply' });
        }
        res.status(201).json({ message: 'Reply added', replyId: result.insertId });
    });
});

// Endpoint per ottenere le risposte a un commento (GET)
app.get('/comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;
    getRepliesByCommentId(commentId, (err, replies) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving replies' });
        }
        res.status(200).json(replies);
    });
});

// Gestione dei ticket di phishing

// Endpoint per ottenere tutti i ticket di phishing (GET)
app.get('/phishing_tickets', (req, res) => {
    getAllPhishingTickets((err, tickets) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving phishing tickets' });
        }
        res.status(200).json(tickets);
    });
});

// Endpoint per aggiungere un commento a un ticket di phishing (POST)
app.post('/phishing_tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    const { comment_text } = req.body;
    const sql = 'INSERT INTO phishing_comments (ticket_id, comment_text) VALUES (?, ?)';
    connection.query(sql, [id, comment_text], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding comment to phishing ticket' });
        }
        res.status(201).json({ message: 'Comment added to phishing ticket', commentId: result.insertId });
    });
});
// Endpoint per creare un nuovo ticket di phishing (POST)
app.post('/phishing_tickets', (req, res) => {
    const { domain, severity, status } = req.body;

    if (!domain || !severity || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = 'INSERT INTO phishing_tickets (domain, severity, status) VALUES (?, ?, ?)';
    connection.query(sql, [domain, severity, status], (err, result) => {
        if (err) {
            console.error('Error creating phishing ticket:', err);
            return res.status(500).json({ error: 'Error creating phishing ticket' });
        }
        res.status(201).json({ message: 'Phishing ticket created', ticketId: result.insertId });
    });
});


// Endpoint per aggiungere una risposta a un commento di phishing (POST)
app.post('/phishing_comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;
    const { reply_text } = req.body;
    const sql = 'INSERT INTO phishing_replies (comment_id, reply_text) VALUES (?, ?)';
    connection.query(sql, [commentId, reply_text], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding reply to phishing comment' });
        }
        res.status(201).json({ message: 'Reply added to phishing comment', replyId: result.insertId });
    });
});

// Endpoint per ottenere i commenti di un ticket di phishing con le risposte (GET)
app.get('/phishing_tickets/:id/comments', (req, res) => {
    const { id } = req.params;

    const sql = 'SELECT * FROM phishing_comments WHERE ticket_id = ?';
    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error retrieving comments:', err);
            return res.status(500).json({ error: 'Error retrieving comments' });
        }
        res.status(200).json(results);
    });
});
// Endpoint per chiudere un ticket di phishing
app.put('/phishing_tickets/:id/close', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE phishing_tickets SET status = ? WHERE id = ?';
    connection.query(sql, ['closed', id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error closing phishing ticket' });
        }
        res.status(200).json({ message: `Phishing ticket with ID ${id} closed` });
    });
});
// Endpoint per ottenere tutti i commenti di un ticket di phishing
app.get('/phishing_tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM phishing_comments WHERE ticket_id = ? ORDER BY created_at ASC';
    connection.query(sql, [id], (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving phishing comments' });
        }
        res.status(200).json(comments);
    });
});

// Endpoint per la chat
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

app.get('/messages', (req, res) => {
    const sql = 'SELECT * FROM chat_messages ORDER BY timestamp ASC';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving messages:', err);
            return res.status(500).json({ error: 'Error retrieving messages' });
        }
        res.json(results);
    });
});

// Endpoint per ottenere la lista degli utenti online (GET)
app.get('/users', (req, res) => {
    res.json(Object.keys(onlineUsers)); // Invia la lista degli utenti online
});

// Avvio del server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
