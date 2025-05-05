const { query } = require("./db");

module.exports.getSourceByName = getSourceByName;
async function getSourceByName(name){
    const source = await query(
        'SELECT * FROM sources WHERE name = ?',
        [name]
    );
    return source[0];
}

module.exports.getSourceById = getSourceById;
async function getSourceById(id){
    const source = await query(
        'SELECT * FROM sources WHERE id = ?',
        [id]
    );
    return source[0];
}

module.exports.getCharacterSources = getCharacterSources;
async function getCharacterSources(characterId){
    const sources = await query(
        'SELECT sources.* FROM sources INNER JOIN character_sources ON sources.id = character_sources.source_id WHERE character_sources.character_id = ?',
        [characterId]
    );
    return sources;
}

module.exports.getCharacterById = getCharacterById;
async function getCharacterById(id){
    const character = await query(
        'SELECT * FROM characters WHERE id = ?',
        [id]
    );

    if (character.length === 0) {
        return null;
    }

    const characterSources = await getCharacterSources(id);
    const characterWithSources = character[0];
    characterWithSources.sources = characterSources; //map sources to character object

    return character[0];
}