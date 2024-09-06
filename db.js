const mysql = require('mysql');

const connection = mysql.createConnection({
    host: '127.0.0.1', // o l'IP del server MySQL
    user: 'db_user',      // il tuo nome utente MySQL
    password: 'db_user_pass',  // la tua password MySQL
    database: 'soc_platform'
});

connection.connect((err) => {
    if (err) {
        console.error('Errore di connessione: ' + err.stack);
        return;
    }
    console.log('Connesso come ID ' + connection.threadId);
});
