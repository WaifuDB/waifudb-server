var express = require('express');
const { getSourceById } = require('../src/character');
const { query } = require('../src/db');
var router = express.Router();

router.get('/get/all', async function (req, res, next) {
    try {
        const sources = await query('SELECT * FROM sources');
        if (!sources) {
            return res.status(404).json({ error: 'Sources not found' });
        }

        // Map the sources to include the characters
        const sourcesWithCharacters = await Promise.all(sources.map(async (source) => {
            const characters = await query(
                'SELECT characters.* FROM characters INNER JOIN character_sources ON characters.id = character_sources.character_id WHERE character_sources.source_id = ?',
                [source.id]
            );
            return { ...source, characters };
        }));

        res.json(sourcesWithCharacters);
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
        const source = await getSourceById(id);
        if (!source) {
            return res.status(404).json({ error: 'Source not found' });
        }
        res.json(source);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
