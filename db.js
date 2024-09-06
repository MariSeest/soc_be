const mysql = require('mysql2');

// Connessione al database MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'db_user',
    password: 'db_user_pass',
    database: 'soc_platform',
    port: 3306
});

// Gestione della connessione
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
    console.log('Connected to MySQL as ID ' + connection.threadId);
});

// Funzione per creare un nuovo ticket
function createTicket(name, status, category, severity, content, actions, callback) {
    const sql = 'INSERT INTO tickets (name, status, category, severity, content, actions) VALUES (?, ?, ?, ?, ?, ?)';
    const values = [name, status, category, severity, content, actions];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting ticket: ' + err.stack);
            return callback(err);
        }
        console.log('Ticket inserito con ID: ' + result.insertId);
        callback(null, result.insertId);
    });
}

// Funzione per recuperare un ticket tramite ID
function getTicketById(id, callback) {
    const sql = 'SELECT * FROM tickets WHERE id = ?';

    connection.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error retrieving ticket: ' + err.stack);
            return callback(err);
        }
        if (result.length === 0) {
            return callback(new Error('No ticket found with this ID'));
        }
        console.log('Ticket retrieved: ', result[0]);
        callback(null, result[0]);
    });
}

// Esporta le funzioni per essere utilizzate in altri file
module.exports = { createTicket, getTicketById };



