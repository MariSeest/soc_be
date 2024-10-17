const mysql = require('mysql2');

// Connessione al database MySQL
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'db_user',
    password: 'db_user_pass',
    database: 'soc_platform',
    port: 3306,
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

// Funzione per ottenere tutti i ticket dal database
function getAllTickets(callback) {
    const sql = `
        SELECT id, name, status, category, severity, content, created_at, closed_at, last_comment_at, reopened_at, closed_previously
        FROM tickets
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error retrieving tickets: ' + err.stack);
            return callback(err);
        }
        callback(null, results);
    });
}


// Funzione per ottenere tutti i ticket di phishing
function getAllPhishingTickets(callback) {
    const sql = 'SELECT * FROM phishing_tickets';
    connection.query(sql, (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results);
    });
}
// Funzione per creare un nuovo ticket di phishing
function createPhishingTicket(domain, severity, status, callback) {
    const sql = 'INSERT INTO phishing_tickets (domain, severity, status) VALUES (?, ?, ?)';
    const values = [domain, severity, status];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error creating phishing ticket: ' + err.stack);
            return callback(err);
        }
        callback(null, result.insertId);
    });
}

// Funzione per aggiungere un commento a un ticket di phishing
function addPhishingComment(ticket_id, comment_text, author, callback) {
    const sql = 'INSERT INTO phishing_comments (ticket_id, comment_text, author) VALUES (?, ?, ?)';
    connection.query(sql, [ticket_id, comment_text, author], (err, result) => {
        if (err) return callback(err);
        callback(null, result);
    });
}

// Funzione per aggiungere una risposta a un commento di phishing
function addPhishingReply(comment_id, reply_text, author, callback) {
    const sql = 'INSERT INTO phishing_replies (comment_id, reply_text, author) VALUES (?, ?, ?)';

    connection.query(sql, [comment_id, reply_text, author], (err, result) => {
        if (err) {
            console.error('Error adding reply: ', err.stack);
            return callback(err);
        }
        callback(null, result);
    });
}
// Funzione per ottenere i commenti di un ticket di phishing e le relative risposte
function getCommentsByPhishingTicketId(ticket_id, callback) {
    const sql = 'SELECT * FROM phishing_comments WHERE ticket_id = ? ORDER BY created_at ASC';

    connection.query(sql, [ticket_id], (err, comments) => {
        if (err) {
            console.error('Error retrieving phishing comments: ', err.stack);
            return callback(err);
        }

        const commentIds = comments.map(comment => comment.id);
        if (commentIds.length === 0) {
            return callback(null, []);  // Nessun commento
        }

        // Ottenere le risposte associate ai commenti
        const replySql = 'SELECT * FROM phishing_replies WHERE comment_id IN (?) ORDER BY created_at ASC';
        connection.query(replySql, [commentIds], (err, replies) => {
            if (err) {
                console.error('Error retrieving replies: ', err.stack);
                return callback(err);
            }

            // Aggiunge le risposte ai commenti
            const commentsWithReplies = comments.map(comment => ({
                ...comment,
                replies: replies.filter(reply => reply.comment_id === comment.id)
            }));

            callback(null, commentsWithReplies);
        });
    });
}

// Funzione per aggiornare lo stato di un ticket di phishing
function closePhishingTicket(ticket_id, callback) {
    const sql = 'UPDATE phishing_tickets SET status = ? WHERE id = ?';
    connection.query(sql, ['closed', ticket_id], (err, result) => {
        if (err) {
            return callback(err);
        }
        callback(null, result);
    });
}

// Funzione per aggiungere un commento a un ticket
function addCommentToTicket(ticket_id, comment_text, author, callback) {
    const sqlComment = 'INSERT INTO comments (ticket_id, comment_text, author) VALUES (?, ?, ?)';
    const sqlUpdateTicket = 'UPDATE tickets SET last_comment_at = CURRENT_TIMESTAMP WHERE id = ?';

    connection.query(sqlComment, [ticket_id, comment_text, author], (err, result) => {
        if (err) {
            console.error('Error adding comment: ' + err.stack);
            return callback(err);
        }

        // Aggiorna la data dell'ultimo commento
        connection.query(sqlUpdateTicket, [ticket_id], (updateErr) => {
            if (updateErr) {
                console.error('Error updating ticket last comment time: ' + updateErr.stack);
                return callback(updateErr);
            }
            callback(null, result);
        });
    });
}


// Funzione per aggiungere una risposta a un commento
function addReplyToComment(comment_id, reply_text, author, callback) {
    const sql = 'INSERT INTO comment_replies (comment_id, reply_text, author) VALUES (?, ?, ?)';
    connection.query(sql, [comment_id, reply_text, author], (err, result) => {
        if (err) {
            console.error('Error adding reply: ' + err.stack);  // Log dell'errore
            return callback(err);
        }
        console.log('Reply added with ID:', result.insertId);  // Log dell'ID della risposta
        callback(null, result);
    });
}

// Funzione per ottenere i commenti di un ticket e le relative risposte
function getCommentsByTicketId(ticket_id, callback) {
    const sql = 'SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC';

    connection.query(sql, [ticket_id], (err, comments) => {
        if (err) {
            console.error('Error retrieving comments: ' + err.stack);
            return callback(err);
        }

        const commentIds = comments.map(comment => comment.id);
        if (commentIds.length === 0) {
            return callback(null, []);  // Nessun commento
        }

        const replySql = 'SELECT * FROM comment_replies WHERE comment_id IN (?) ORDER BY created_at ASC';
        connection.query(replySql, [commentIds], (err, replies) => {
            if (err) {
                console.error('Error retrieving replies: ' + err.stack);
                return callback(err);
            }

            const commentsWithReplies = comments.map(comment => ({
                ...comment,
                replies: replies.filter(reply => reply.comment_id === comment.id)
            }));

            callback(null, commentsWithReplies);
        });
    });
}

// Funzione per eliminare un ticket
function deleteTicketById(id, callback) {
    const sql = 'DELETE FROM tickets WHERE id = ?';

    connection.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting ticket: ' + err.stack);
            return callback(err);
        }
        callback(null, result);
    });
}

// Funzione per ottenere tutte le risposte a un commento
function getRepliesByCommentId(comment_id, callback) {
    const sql = 'SELECT * FROM comment_replies WHERE comment_id = ? ORDER BY created_at ASC';

    connection.query(sql, [comment_id], (err, results) => {
        if (err) {
            console.error('Error retrieving replies: ' + err.stack);
            return callback(err);
        }
        callback(null, results);
    });
}

// Funzione per aggiornare lo stato di un ticket
function updateTicketStatus(id, status, callback) {
    const sql = 'UPDATE tickets SET status = ? WHERE id = ?';

    connection.query(sql, [status, id], (err, result) => {
        if (err) {
            console.error('Error updating ticket status: ' + err.stack);
            return callback(err);
        }
        callback(null, result);
    });
}

// Funzione per salvare i messaggi della chat
function saveChatMessage(sender, recipient, message, callback) {
    const sql = 'INSERT INTO chat_messages (sender, recipient, message) VALUES (?, ?, ?)';
    const values = [sender, recipient, message];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error saving chat message to MySQL:', err.stack); // Log dettagliato dell'errore
            return callback(err);
        }
        console.log('Chat message saved to database:', result);
        callback(null, result);
    });
}
// Funzione per eliminare un commento
function deleteCommentById(id, callback) {
    const sql = 'DELETE FROM comments WHERE id = ?';
    connection.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting comment: ' + err.stack);
            return callback(err);
        }
        callback(null, result);
    });
}

// Esporta le funzioni per essere utilizzate in altri file
module.exports = {
    createTicket,
    getTicketById,
    getAllTickets,
    deleteTicketById,
    addCommentToTicket,
    updateTicketStatus,
    getRepliesByCommentId,
    addReplyToComment,
    getAllPhishingTickets,
    getCommentsByTicketId,
    saveChatMessage,
    createPhishingTicket,
    addPhishingComment,
    addPhishingReply,
    getCommentsByPhishingTicketId,
    closePhishingTicket,
    deleteCommentById
};
