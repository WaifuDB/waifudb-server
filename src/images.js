const { default: axios } = require("axios");
const { query } = require("./db");
require('dotenv').config();

module.exports.addCharactersToImage = addCharactersToImage
async function addCharactersToImage(imageId, characterIds) {
    try {
        // Check if the image exists
        const image = await query('SELECT * FROM images WHERE id = ?', [imageId]);
        if (image.length === 0) {
            return { error: 'Image not found' };
        }

        // Check if the characters exist
        const characters = await query('SELECT * FROM characters WHERE id IN (?)', [characterIds]);
        if (characters.length !== characterIds.length) {
            return { error: 'Some characters not found' };
        }

        // Add characters to the image
        for (const characterId of characterIds) {
            await query('INSERT INTO image_characters (image_id, character_id) VALUES (?, ?)', [imageId, characterId]);
        }

        return { message: 'Characters added to image successfully' };
    } catch (err) {
        throw err;
    }
}

module.exports.removeCharactersFromImage = removeCharactersFromImage
async function removeCharactersFromImage(imageId, characterIds) {
    try {
        //No need to check anything, just remove the image_characters entry. If that doesn't exist, we throw anyways.
        for (const characterId of characterIds) {
            await query('DELETE FROM image_characters WHERE image_id = ? AND character_id = ?', [imageId, characterId]);
        }

        return { message: 'Characters removed from image successfully' };
    } catch (err) {
        throw err;
    }
}

module.exports.getCharacterImages = getCharacterImages
async function getCharacterImages(characterId) {
    try {
        const images = await query('SELECT * FROM images WHERE id IN (SELECT image_id FROM image_characters WHERE character_id = ?)', [characterId]);
        return images;
    } catch (err) {
        throw err;
    }
}

module.exports.getSourceImages = getSourceImages;
async function getSourceImages(sourceId) {
    try {
        //gotta check with characters first (images aren't directly related to sources)
        const characters = await query('SELECT * FROM characters WHERE id IN (SELECT character_id FROM character_sources WHERE source_id = ?)', [sourceId]);
        if (characters.length === 0) {
            return [];
        }
        //then get the images
        const images = await query('SELECT * FROM images WHERE id IN (SELECT image_id FROM image_characters WHERE character_id IN (?))', [characters.map(c => c.id)]);
        if (images.length === 0) {
            return [];
        }

        return images;
    } catch (err) {
        throw err;
    }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

module.exports.uploadImageToPicsur = uploadImageToPicsur;
async function uploadImageToPicsur(file, blob) {
    // Validate the image type
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        throw new Error('Invalid image type');
    }

    const url = `${process.env.PICSUR_API_URL}/api/image/upload`;
    const formData = new FormData();
    formData.append('image', blob, file.originalname);

    const headers = {
        'Authorization': `Api-Key ${process.env.PICSUR_API_KEY}`,
    };

    try {
        const response = await axios.post(url, formData, {
            headers: {
                ...headers,
            },
        });

        //log headers
        console.log('Response Headers:', response.headers);

        return response.data;
    } catch (error) {
        console.error('Error uploading image to Picsur:', error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports.removeImageFromPicsur = removeImageFromPicsur;
async function removeImageFromPicsur(imageId) {
    const url = `${process.env.PICSUR_API_URL}/api/image/delete`;
    const body = {
        ids: [imageId],
    }
    const headers = {
        'Authorization': `Api-Key ${process.env.PICSUR_API_KEY}`,
    };
    try {
        const response = await axios.post(url, body, {
            headers: {
                ...headers,
            },
        });

        return response.data;
    } catch (error) {
        console.error('Error removing image from Picsur:', error.response ? error.response.data : error.message);
        throw error;
    }
}