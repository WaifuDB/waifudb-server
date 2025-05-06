var express = require('express');
const { getCategoryList } = require('../src/tags');
var router = express.Router();

router.get('/categories', async function(req, res, next) {
    try {
        const categories = await getCategoryList();
        if (!categories) {
            return res.status(404).json({ error: 'Categories not found' });
        }
        res.json(categories);
    }catch(err){
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
