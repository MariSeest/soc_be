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
        methods: ['GET', 'POST']
    }
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
}));

let tickets = [
    { id: 1, name: 'Ticket 1', status: 'open', category: 'bug', text: 'Description of Ticket 1' },
    { id: 2, name: 'Ticket 2', status: 'closed', category: 'feature', text: 'Description of Ticket 2' },
];

let messages = []; // Array per memorizzare i messaggi
const userSockets = {}; // Mappa per tenere traccia degli utenti e dei loro socket.id

// Endpoint per ottenere un messaggio di prova
app.get('/api/data', (req, res) => {
    res.json({ message: 'Hello from the back end!' });
});

// Endpoint per ottenere tutti i ticket
app.get('/tickets', (req, res) => {
    res.json(tickets);
});

// Endpoint per creare un nuovo ticket
app.post('/tickets', (req, res) => {
    const newTicket = { ...req.body, id: tickets.length + 1 };
    tickets.push(newTicket);
    res.status(201).json(newTicket);
});

// Endpoint per eliminare un ticket
app.delete('/tickets/:id', (req, res) => {
    const { id } = req.params;
    tickets = tickets.filter(ticket => ticket.id !== parseInt(id));
    res.status(200).json({ message: `Ticket with id ${id} deleted` });
});

// Endpoint per ottenere tutti i messaggi
app.get('/messages', (req, res) => {
    res.json(messages);
});

// Endpoint per inviare un nuovo messaggio
app.post('/messages', (req, res) => {
    const message = req.body;
    // Aggiungere validazione per verificare che il destinatario esista
    if (!message.recipient) {
        return res.status(400).json({ error: 'Recipient is required' });
    }

    messages.push(message);
    // Verifica se il destinatario è online
    const recipientSocketId = userSockets[message.recipient];
    if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat message', message); // Emissione solo al destinatario specificato
    }
    res.status(201).json(message);
});

// Endpoint per ottenere la lista di utenti
app.get('/users', (req, res) => {
    res.json(Object.keys(userSockets)); // Restituisce tutti gli username registrati
});

// Gestione delle connessioni socket
io.on('connection', (socket) => {
    console.log('a user connected');

    // Registrazione dell'utente
    socket.on('register', (username) => {
        userSockets[username] = socket.id;
        console.log(`${username} registered with socket id ${socket.id}`);
    });

    // Disconnessione dell'utente
    socket.on('disconnect', () => {
        console.log('user disconnected');
        // Rimuovi l'associazione utente-socket.id
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
