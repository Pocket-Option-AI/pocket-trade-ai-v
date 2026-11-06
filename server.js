const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

async function initDB() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      real_balance NUMERIC DEFAULT 110.00,
      demo_balance NUMERIC DEFAULT 50000.00
    );
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) REFERENCES users(email),
      account_type VARCHAR(10),
      pair VARCHAR(50),
      direction VARCHAR(10),
      amount NUMERIC,
      profit NUMERIC,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await pool.query(query);
    console.log('✅ Connected to Database & Tables Ready');
  } catch (err) {
    console.error('❌ Database error:', err);
  }
}
initDB();

app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) return res.status(400).json({ error: 'Account already exists' });

    await pool.query(
      'INSERT INTO users (email, password, real_balance, demo_balance) VALUES ($1, $2, 110.00, 50000.00)',
      [email, password]
    );
    res.json({ message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const trades = await pool.query('SELECT * FROM trades WHERE user_email = $1 ORDER BY created_at DESC LIMIT 20', [email]);
    
    const realHistory = trades.rows.filter(t => t.account_type === 'real');
    const demoHistory = trades.rows.filter(t => t.account_type === 'demo');

    res.json({
      email: user.email,
      realBalance: parseFloat(user.real_balance),
      demoBalance: parseFloat(user.demo_balance),
      realHistory,
      demoHistory
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/trade', async (req, res) => {
  const { email, accountType, amount, profit, pair, direction } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const currentBalance = accountType === 'real' ? parseFloat(user.real_balance) : parseFloat(user.demo_balance);

    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = currentBalance + profit;
    const balanceColumn = accountType === 'real' ? 'real_balance' : 'demo_balance';

    await pool.query(`UPDATE users SET ${balanceColumn} = $1 WHERE email = $2`, [newBalance, email]);
    await pool.query(
      'INSERT INTO trades (user_email, account_type, pair, direction, amount, profit) VALUES ($1, $2, $3, $4, $5, $6)',
      [email, accountType, pair, direction, amount, profit]
    );

    const trades = await pool.query('SELECT * FROM trades WHERE user_email = $1 AND account_type = $2 ORDER BY created_at DESC LIMIT 20', [email, accountType]);

    res.json({ message: 'Trade successful', newBalance: newBalance, history: trades.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
