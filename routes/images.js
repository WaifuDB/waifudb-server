var express = require('express');
const { getCategoryList } = require('../src/tags');
const { addCharactersToImage, uploadImageToPicsur } = require('../src/images');
const { validateToken, getUser } = require('../src/auth');
const { query } = require('../src/db');
const multer = require('multer');
const { Blob } = require('buffer');
var router = express.Router();
var storage = multer.memoryStorage();
var upload = multer({ storage: storage });

//expects a file upload
router.post('/new', upload.single('image'), async function (req, res, next) {
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

    const image = req.file;
    try {
        let { characters } = req.body;
        // Parse the characters array from the request body
        if (typeof characters === 'string') {
            characters = JSON.parse(characters);
        }

        //Validate the image
        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        // Validate the image type
        const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!validImageTypes.includes(image.mimetype)) {
            return res.status(400).json({ error: 'Invalid image type' });
        }

        
        // // Validate the characters array
        if (!Array.isArray(characters) || characters.length === 0) {
            return res.status(400).json({ error: 'Invalid characters array' });
        }
        
        // // Check if the characters exist in the database
        const existingCharacters = await query('SELECT * FROM characters WHERE id IN (?)', [characters]);
        if (existingCharacters.length !== characters.length) {
            return res.status(404).json({ error: 'Some characters not found' });
        }
        
        // This is admin-uploaded, so image size can be infinite
        //Upload
        //set image name to charadb-{current timestamp}
        const image_blob = new Blob([image.buffer], { type: image.mimetype });
        const uploadResponse = await uploadImageToPicsur(image, image_blob);

        if(!uploadResponse || !uploadResponse.success || !uploadResponse.data || !uploadResponse.data.id) {
            throw new Error('Failed to upload image');
        }

        const image_id = uploadResponse.data.id;

        // // Insert the new image into the database
        const newImage = await query('INSERT INTO images (remote_id) VALUES (?) RETURNING *', [image_id]);

        // //validate the new image
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
