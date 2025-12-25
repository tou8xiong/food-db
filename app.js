const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

app.use(cors({
    origin: '*', // allow all origins (OK for dev)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const db = new sqlite3.Database('./database.db');
db.run("PRAGMA journal_mode = WAL;");

db.run(`
CREATE TABLE IF NOT EXISTS foodmenu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price INTEGER,
  datetime TEXT
)
`);
// Simple migration to add 'price' and 'datetime' columns if they don't exist
db.all("PRAGMA table_info(foodmenu)", (err, columns) => {
    if (err) {
        console.error("Could not get table info:", err.message);
        return;
    }
    const columnNames = columns.map(c => c.name);
    if (!columnNames.includes("price")) {
        db.run("ALTER TABLE foodmenu ADD COLUMN price INTEGER");
    }
    if (!columnNames.includes("datetime")) {
        db.run("ALTER TABLE foodmenu ADD COLUMN datetime TEXT");
    }
});

app.post("/foodmenu", (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    db.serialize(() => {
        const stmt = db.prepare(
            "INSERT INTO foodmenu (name, quantity, price, datetime) VALUES (?, ?, ?, ?)"
        );
        const now = new Date();
        const datetime = now.toLocaleString();


        items.forEach(item => {
            if (item.name && typeof item.quantity === 'number') {
                stmt.run(item.name, item.quantity, item.price ?? 0, item.datetime ?? datetime);
            }
        });

        stmt.finalize((err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Orders saved successfully" });
        });
    });
});

app.get('/foodmenu', (req, res) => {
    db.all(`SELECT * FROM foodmenu`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Change res.json(rows) to this:
        res.json(rows);
    });
});

app.put('/foodmenu/:id', (req, res) => {
    const { name, quantity, price, datetime } = req.body;
    const { id } = req.params;

    db.run(
        `UPDATE foodmenu SET name = ?, quantity = ?, price = ? WHERE id = ?`,
        [name, quantity, price, id, datetime],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Order not found' });
            res.json({ message: 'Order updated' });
        }
    );
});

app.delete('/foodmenu/:id', (req, res) => {
    const { id } = req.params;

    db.run(
        `DELETE FROM foodmenu WHERE id = ?`,
        [id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ message: 'Order not found' });
            res.json({ message: 'Order deleted' });
        }
    );
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port}`);
});

