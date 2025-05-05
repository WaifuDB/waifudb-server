var express = require('express');
const { query } = require('../src/db');
var router = express.Router();
const bcrypt = require('bcrypt');
const { getUser, validateToken } = require('../src/auth');
const crypto = require('crypto');

const saltRounds = 10;

router.post('/register', async function (req, res, next) {
    const { username, password } = req.body;

    try {
        const userExists = await query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (userExists.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await query(
            'INSERT INTO users (username, password) VALUES (?, ?) RETURNING id, username',
            [username, hashedPassword]
        );

        res.status(201).json(newUser[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async function (req, res, next) {
    const { username, password } = req.body;

    try {
        const user = await query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (user.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = crypto.randomBytes(64).toString('hex');

        const _user = await getUser(user[0].id);

        if (!_user) {
            return res.status(404).json({ error: 'User not found' });
        }

        //store the session token in the database
        await query(
            'INSERT INTO sessions (user_id, token) VALUES (?, ?)',
            [user[0].id, token]
        );

        res.json({
            message: 'Logged in successfully',
            //full user object except password
            user: _user,
            token: token
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/logout', async (req, res) => {
    const { user_id, token } = req.body;
    if (!user_id || !token) {
        return res.status(400).json({ error: 'User ID and token are required' });
    }
    
    try {
        const token_res = await query(
            'SELECT user_id, token FROM sessions WHERE user_id = ? AND token = ?',
            [user_id, token]
        );

        if (token_res.length === 0) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        //delete the session token from the database
        await query(
            'DELETE FROM sessions WHERE user_id = ? AND token = ?',
            [user_id, token]
        );

        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/profile', async (req, res) => {
    const { user_id, token } = req.body;
    if (!user_id || !token) {
        return res.status(400).json({ error: 'User ID and token are required' });
    }
    try {
        if(!(await validateToken(user_id, token))){
            return res.status(401).json({ error: 'Invalid token' });
        }

        //get user profile
        const user = await getUser(user_id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const _user = user;

        res.json({
            message: 'Token is valid',
            user: _user,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
