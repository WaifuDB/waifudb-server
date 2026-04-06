var express = require('express');
const { getSourceById } = require('../src/character');
const { query } = require('../src/db');
var router = express.Router();

router.get('/get/all/compact', async function (req, res, next) {
    try {
        const sources = await query(
            `SELECT s.*, COUNT(cs.character_id) AS character_count
             FROM sources s
             LEFT JOIN character_sources cs ON cs.source_id = s.id
             GROUP BY s.id`
        );

        if (!sources) {
            return res.status(404).json({ error: 'Sources not found' });
        }

        res.json(sources.map((source) => ({
            ...source,
            character_count: Number(source.character_count || 0),
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/get/all', async function (req, res, next) {
    try {
        const [sources, sourceCharacterRows] = await Promise.all([
            query('SELECT * FROM sources'),
            query('SELECT cs.source_id, c.* FROM character_sources cs INNER JOIN characters c ON c.id = cs.character_id')
        ]);

        if (!sources) {
            return res.status(404).json({ error: 'Sources not found' });
        }

        const charactersBySourceId = {};
        for (const row of sourceCharacterRows) {
            if (!charactersBySourceId[row.source_id]) {
                charactersBySourceId[row.source_id] = [];
            }

            const { source_id, ...character } = row;
            charactersBySourceId[source_id].push(character);
        }

        const sourcesWithCharacters = sources.map((source) => {
            return {
                ...source,
                characters: charactersBySourceId[source.id] || [],
            };
        });

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
