const { query } = require("./db");

module.exports.getCategoryList = getCategoryList;
async function getCategoryList(){
    const categories = await query(
        'SELECT * FROM tag_categories'
    );

    if (categories.length === 0) {
        return null;
    }

    return categories;
}

module.exports.getTagByID = getTagByID;
async function getTagByID(tagId){
    const tag = await query(
        'SELECT * FROM tags INNER JOIN categories ON tags.category_id = categories.id WHERE tags.id = ?',
        [tagId]
    );

    if (tag.length === 0) {
        return null;
    }

    return tag[0];
}

module.exports.createTag = createTag;
async function createTag(title, description, color, categoryId){
    const tag = await query(
        'INSERT INTO tags (title, description, color, category_id) VALUES (?, ?, ?, ?) RETURNING *',
        [title, description, color, categoryId]
    );

    return tag[0];
}

module.exports.getCategoryByID = getCategoryByID;
async function getCategoryByID(categoryId){
    const category = await query(
        'SELECT * FROM categories WHERE id = ?',
        [categoryId]
    );

    if (category.length === 0) {
        return null;
    }

    return category[0];
}

module.exports.createCategory = createCategory;
async function createCategory(title, description){
    const category = await query(
        'INSERT INTO categories (title, description) VALUES (?, ?) RETURNING *',
        [title, description]
    );

    return category[0];
}