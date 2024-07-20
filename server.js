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

app.get('/api/data', (req, res) => {
    res.json({ message: 'Hello from the back end!' });
});

app.get('/tickets', (req, res) => {
    res.json(tickets);
});

app.post('/tickets', (req, res) => {
    const newTicket = { ...req.body, id: tickets.length + 1 };
    tickets.push(newTicket);
    res.status(201).json(newTicket);
});

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
    messages.push(message);
    io.emit('chat message', message); // Emissione del messaggio a tutti i client connessi
    res.status(201).json(message);
});

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});




