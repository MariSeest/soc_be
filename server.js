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

// Importa le funzioni per creare e recuperare i ticket dal database
const { createTicket, getTicketById } = require('./db'); // Assicurati che il file db.js esista e contenga le funzioni
const { getAllTickets } = require('./db'); // Importa la funzione per ottenere i ticket

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

// Endpoint per ottenere un messaggio di prova
app.get('/api/data', (req, res) => {
    res.json({ message: 'Hello from the back end!' });
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

// Endpoint per eliminare un ticket
app.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;
    tickets = tickets.filter(ticket => ticket.id !== parseInt(id));
    res.status(200).json({ message: `Ticket with id ${id} deleted` });
});

// Endpoint per aggiungere un commento a un ticket
app.post('/tickets/:id/comment', (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    const ticket = tickets.find(ticket => ticket.id === parseInt(id));

    if (!ticket) {
        return res.status(404).json({ message: `Ticket with id ${id} not found` });
    }

    if (!ticket.comments) {
        ticket.comments = [];
    }

    ticket.comments.push(comment);

    res.status(200).json(ticket);
});

// Endpoint per aggiornare lo stato di un ticket
app.put('/tickets/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const ticket = tickets.find(ticket => ticket.id === parseInt(id));

    if (!ticket) {
        return res.status(404).json({ message: `Ticket with id ${id} not found` });
    }

    ticket.status = status;

    res.status(200).json(ticket);
});

// Endpoint per ottenere solo i ticket di phishing
app.get('/tickets/phishing', (req, res) => {
    const phishingTickets = tickets.filter(ticket => ticket.category === 'phishing');
    res.json(phishingTickets);
});

// Endpoint per chiudere un ticket di phishing
app.put('/tickets/phishing/:id/close', (req, res) => {
    const { id } = req.params;
    const ticket = tickets.find(ticket => ticket.id === parseInt(id) && ticket.category === 'phishing');

    if (!ticket) {
        return res.status(404).json({ message: `Phishing ticket with id ${id} not found` });
    }

    ticket.status = 'closed';
    res.status(200).json(ticket);
});

// Endpoint per ottenere tutti i messaggi
app.get('/messages', (req, res) => {
    res.json(messages);
});

// Endpoint per inviare un nuovo messaggio
app.post('/messages', (req, res) => {
    const message = req.body;
    if (!message.recipient) {
        return res.status(400).json({ error: 'Recipient is required' });
    }

    messages.push(message);
    const recipientSocketId = userSockets[message.recipient];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat message', message);
    }
    res.status(201).json(message);
});

// Endpoint per ottenere la lista di utenti
app.get('/users', (req, res) => {
    res.json(Object.keys(userSockets));
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










