var express = require('express');
const { query } = require('../src/db');
const { getSourceByName, getCharacterById } = require('../src/character');
const { validateToken, getUser } = require('../src/auth');
var router = express.Router();

const characterColumns = [
    'name', 'jp_name',
    'age', 'image_url',
    'birth_place', 'birth_date',
    'height', 'weight', 'cup_size', 'blood_type',
    'bust', 'waist', 'hip',
    'description'
];

const characterColumnsWithId = [
    'id', ...characterColumns
];

const minMaxLength = [3, 50];

router.post('/create', async function (req, res, next) {
    // const { name} = req.body;
    const { user_id, token } = req.body;

    try {
        if (!await validateToken(user_id, token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        //get user roles
        const user = await getUser(user_id);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        //check if user has permission to create characters
        const hasPermission = user.roles.some(role => role.can_create);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.message });
    }

    try {
        if (!req.body.name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        if (req.body.name.length < minMaxLength[0] || req.body.name.length > minMaxLength[1]) {
            return res.status(400).json({ error: `Name must be between ${minMaxLength[0]} and ${minMaxLength[1]} characters` });
        }

        //The rest is optional
        const characterData = characterColumns.reduce((acc, column) => {
            if (req.body[column] !== undefined) {
                acc[column] = req.body[column];
                //if string and length 0, nullify it
                if (typeof acc[column] === 'string' && acc[column].length === 0) {
                    acc[column] = null;
                }
            }
            return acc;
        }, {});

        let source = await getSourceByName(req.body.source);
        let sourceId = null;
        if (!source) {
            //create source if it doesn't exist
            source = await query(
                'INSERT INTO sources (name) VALUES (?) RETURNING id',
                [req.body.source]
            );
            sourceId = source[0].id;
        }else{
            sourceId = source.id;
        }


        const character = await query(
            'INSERT INTO characters (' + characterColumns.join(', ') + ') VALUES (' + characterColumns.map(() => '?').join(', ') + ') RETURNING ' + characterColumnsWithId.join(', '),
            [...characterColumns.map(column => characterData[column])]
        );

        // Check for source

        await query(
            'INSERT INTO character_sources (character_id, source_id) VALUES (?, ?)',
            [character[0].id, sourceId]
        );

        //Pull the character again (extra call, but reusable function that returns everything)
        const completedCharacter = await getCharacterById(character[0].id);

        res.status(201).json(completedCharacter);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/edit', async function (req, res, next) {
    const { user_id, token } = req.body;
    try {
        if (!await validateToken(user_id, token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        //get user roles
        const user = await getUser(user_id);

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        //check if user has permission to edit characters
        const hasPermission = user.roles.some(role => role.can_create);
        if (!hasPermission) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.message });
    }

    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'ID is required' });
        }

        const characterData = characterColumns.reduce((acc, column) => {
            if (req.body[column] !== undefined) {
                acc[column] = req.body[column];
                //if string and length 0, nullify it
                if (typeof acc[column] === 'string' && acc[column].length === 0) {
                    acc[column] = null;
                }
            }
            return acc;
        }, {});

        await query(
            'UPDATE characters SET ' + characterColumns.map(column => `${column} = ?`).join(', ') + ' WHERE id = ?',
            [...characterColumns.map(column => characterData[column]), id]
        );

        //Check for source
        let sourceId = null;
        if (req.body.source) {
            let source = await getSourceByName(req.body.source);
            if (!source) {
                //create source if it doesn't exist
                source = await query(
                    'INSERT INTO sources (name) VALUES (?) RETURNING id',
                    [req.body.source]
                );
                sourceId = source[0].id;
            } else {
                sourceId = source.id;
            }

            await query(
                //mariadb
                'INSERT INTO character_sources (character_id, source_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE source_id = ?',
                [id, sourceId, sourceId]
            );
        }

        //Pull the character again (extra call, but reusable function that returns everything)
        const completedCharacter = await getCharacterById(id);

        res.status(200).json(completedCharacter);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/get/:id', async function (req, res, next) {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    try {
        const character = await getCharacterById(id);
        if (!character) {
            return res.status(404).json({ error: 'Character not found' });
        }
        res.json(character);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
