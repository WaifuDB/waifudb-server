var express = require('express');
const { getCategoryList } = require('../src/tags');
const { addCharactersToImage } = require('../src/images');
const { validateToken, getUser } = require('../src/auth');
const { query } = require('../src/db');
var router = express.Router();

router.post('/new', async function (req, res, next) {
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

    const { image_url, characters } = req.body;
    try {
        // Validate the image URL
        if (!image_url || !image_url.startsWith('http')) {
            return res.status(400).json({ error: 'Invalid image URL' });
        }
        
        // Validate the characters array
        if (!Array.isArray(characters) || characters.length === 0) {
            return res.status(400).json({ error: 'Invalid characters array' });
        }

        // Check if the characters exist in the database
        const existingCharacters = await query('SELECT * FROM characters WHERE id IN (?)', [characters]);
        if (existingCharacters.length !== characters.length) {
            return res.status(404).json({ error: 'Some characters not found' });
        }

        // Insert the new image into the database
        const newImage = await query('INSERT INTO images (image_url) VALUES (?) RETURNING *', [image_url]);

        //validate the new image
        if (!newImage || newImage.length === 0) {
            return res.status(500).json({ error: 'Failed to add new image' });
        }

        await addCharactersToImage(newImage[0].id, characters);

        res.status(201).json({
            message: 'Image added successfully',
            image: newImage[0],
            characters: existingCharacters
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
