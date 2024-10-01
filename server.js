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
    getCommentsByPhishingTicketId,
    createPhishingTicket,
    closePhishingTicket
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

    if (!status) {
        return res.status(400).json({ error: 'Missing status in request body' });
    }

    const sql = 'UPDATE tickets SET status = ? WHERE id = ?';
    connection.query(sql, [status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Errore durante l\'aggiornamento dello stato del ticket' });
        }

        res.status(200).json({ message: `Stato del ticket con ID ${id} aggiornato a ${status}` });
    });
});

// Endpoint per ottenere i commenti di un ticket (GET)
app.get('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;

    // Modifica la query per prendere direttamente l'autore dalla tabella comments
    const sql = `
        SELECT id, comment_text, created_at, author
        FROM comments
        WHERE ticket_id = ?
        ORDER BY created_at ASC
    `;

    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error retrieving comments:', err);
            return res.status(500).json({ error: 'Error retrieving comments' });
        }

        res.status(200).json(results);  // Risponde con i commenti inclusi gli autori
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
    const { comment_text, author } = req.body;

    if (!comment_text || !author) {
        return res.status(400).json({ error: 'Missing comment text or author' });
    }
    console.log("id: ", id)
    console.log("comment_text: ", comment_text);
    console.log("author: ", author);
    addPhishingComment(id, comment_text, author, (err, result) => {
        console.log("err: ",err)
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

    createPhishingTicket(domain, severity, status, (err, ticketId) => {
        if (err) {
            return res.status(500).json({ error: 'Error creating phishing ticket' });
        }
        res.status(201).json({ message: 'Phishing ticket created', ticketId });
    });
});

// Endpoint per riaprire un ticket di phishing
app.put('/phishing_tickets/:id/reopen', (req, res) => {
    const { id } = req.params;

    // Aggiorna il campo 'status', 'reopened_at' e 'closed_previously'
    const sql = 'UPDATE phishing_tickets SET status = ?, reopened_at = ?, closed_previously = ? WHERE id = ?';
    connection.query(sql, ['open', new Date(), true, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error reopening phishing ticket' });
        }
        res.status(200).json({ message: `Phishing ticket with ID ${id} reopened` });
    });
});

// Endpoint per chiudere un ticket
app.put('/tickets/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status === 'closed') {
        const sql = 'UPDATE tickets SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?';
        connection.query(sql, [status, id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante la chiusura del ticket' });
            }
            res.status(200).json({ message: `Ticket con ID ${id} chiuso` });
        });
    } else {
        // Logica per gli altri stati
        const sql = 'UPDATE tickets SET status = ? WHERE id = ?';
        connection.query(sql, [status, id], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Errore durante l\'aggiornamento dello stato del ticket' });
            }
            res.status(200).json({ message: `Stato del ticket con ID ${id} aggiornato a ${status}` });
        });
    }
});



// Riaprire un ticket chiuso
app.put('/tickets/:id/reopen', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE tickets SET status = ? WHERE id = ?';
    connection.query(sql, ['open', id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Errore durante la riapertura del ticket' });
        }
        res.status(200).json({ message: `Ticket con ID ${id} riaperto` });
    });
});

// Ottenere i commenti di un ticket
app.get('/tickets/:id/comments', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM comments WHERE ticket_id = ?';
    connection.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Errore durante il recupero dei commenti' });
        }
        res.status(200).json(results);
    });
});


// Endpoint per aggiungere una risposta a un commento di phishing (POST)
app.post('/phishing_comments/:commentId/replies', (req, res) => {
    const { commentId } = req.params;
    const { reply_text, author } = req.body;

    // Validazione
    if (!reply_text || !author) {
        return res.status(400).json({ error: 'Missing reply text or author' });
    }

    // Aggiungi la risposta al commento
    addPhishingReply(commentId, reply_text, author, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error adding reply to phishing comment' });
        }

        // Risposta di successo
        res.status(201).json({ message: 'Reply added to phishing comment', replyId: result.insertId });
    });
});

// Endpoint per ottenere i commenti di un ticket di phishing con le risposte (GET)
app.get('/phishing_tickets/:id/comments', (req, res) => {
    const { id } = req.params;

    getCommentsByPhishingTicketId(id, (err, comments) => {
        if (err) {
            return res.status(500).json({ error: 'Error retrieving phishing comments', err });
        }

        const commentsWithReplies = comments.map(comment => ({
            ...comment,
            replies: comment.replies || []  // Imposta replies come array vuoto se non esiste
        }));

        res.status(200).json(commentsWithReplies);
    });
});

// Endpoint per chiudere un ticket di phishing
app.put('/phishing_tickets/:id/close', (req, res) => {
    const { id } = req.params;

    closePhishingTicket(id, (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error closing phishing ticket' });
        }
        res.status(200).json({ message: `Phishing ticket with ID ${id} closed` });
    });
});

// Endpoint per ottenere i messaggi della chat (GET)
app.get('/messages', (req, res) => {
    const sql = 'SELECT * FROM chat_messages ORDER BY timestamp ASC'; // Supponendo che hai una tabella chat_messages

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving chat messages:', err);
            return res.status(500).json({ error: 'Error retrieving chat messages' });
        }
        res.status(200).json(results);
    });
});

// Avvio del server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
