const { query } = require("./db");

module.exports.getSourceByName = getSourceByName;
async function getSourceByName(name){
    const source = await query(
        'SELECT * FROM sources WHERE name = ?',
        [name]
    );
    return source[0];
}

async function getSourceCharacters(id){
    const characters = await query(
        'SELECT characters.* FROM characters INNER JOIN character_sources ON characters.id = character_sources.character_id WHERE character_sources.source_id = ?',
        [id]
    );
    return characters;
}

module.exports.getSourceById = getSourceById;
async function getSourceById(id){
    const source = await query(
        'SELECT * FROM sources WHERE id = ?',
        [id]
    );

    if (source.length === 0) {
        return null;
    }

    const sourceCharacters = await getSourceCharacters(id);
    const sourceWithCharacters = source[0];
    sourceWithCharacters.characters = sourceCharacters; //map characters to source object

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
async function getCharacterById(id, map_relationships = true){
    const character = await query(
        'SELECT * FROM characters WHERE id = ?',
        [id]
    );

    if (character.length === 0) {
        return null;
    }

    let _character = character[0];

    // const characterSources = await getCharacterSources(id);
    // const characterWithSources = character[0];
    // characterWithSources.sources = characterSources; //map sources to character object
    _character.sources = (await getCharacterSources(id)) || [];
    if(map_relationships){
        _character.relationships = (await getCharacterRelationships(id)) || [];
    }

    return character[0];
}

module.exports.getCharacterRelationships = getCharacterRelationships;
async function getCharacterRelationships(characterId){
    const relationships = await query(
        'SELECT * FROM relationships WHERE character_id1 = ? OR character_id2 = ?',
        [characterId, characterId]
    );

    if (relationships.length === 0) {
        return null;
    }

    //update result so that character_id1 is always a lower ID than character_id2 (and swap relationship_types accordingly)
    const mappedRelationships = relationships.map((relationship) => {
        if(relationship.character_id1 > relationship.character_id2){
            return {
                ...relationship,
                character_id1: relationship.character_id2,
                character_id2: relationship.character_id1,
                relationship_type: relationship.reciprocal_relationship_type,
                reciprocal_relationship_type: relationship.relationship_type,
            };
        }else{
            return relationship;
        }
    })

    let characterCache = {};

    for await(const relationship of mappedRelationships){
        if(!characterCache[relationship.character_id1]){
            if(relationship.character_id1 != characterId){
                const character = await getCharacterById(relationship.character_id1, false);
                characterCache[relationship.character_id1] = character;
            }
        }
        if(!characterCache[relationship.character_id2]){
            if(relationship.character_id2 != characterId){
                const character = await getCharacterById(relationship.character_id2, false);
                characterCache[relationship.character_id2] = character;
            }
        }
    }

    //add character data to relationships
    for await(const relationship of mappedRelationships){
        let id = null;
        if(relationship.character_id1 == characterId){
            id = relationship.character_id2;
        }else{
            id = relationship.character_id1;
        }

        if(characterCache[id]){
            relationship.character = characterCache[id];
        }
    }

    return mappedRelationships;
}

module.exports.getCharactersRelationships = getCharactersRelationships;
async function getCharactersRelationships(character_id1, character_id2){
    const relationships = await query(
        'SELECT * FROM relationships WHERE (character_id1 = ? AND character_id2 = ?) OR (character_id1 = ? AND character_id2 = ?)',
        [character_id1, character_id2, character_id2, character_id1]
    );

    if (relationships.length === 0) {
        return null;
    }

    return relationships;
}

module.exports.createOrUpdateCharacterRelationship = createOrUpdateCharacterRelationship;
async function createOrUpdateCharacterRelationship(id, characterId1, characterId2, relationshipType, reciprocalRelationshipType){
    //check if relationship already exists
    const existingRelationship = await query(
        'SELECT * FROM relationships WHERE (id = ?)',
        [id]
    );

    let correctedData = {
        character_id1: characterId1,
        character_id2: characterId2,
        relationship_type: relationshipType,
        reciprocal_relationship_type: reciprocalRelationshipType,
    }

    //check if characterId1 is lower than characterId2 and swap if necessary
    if(characterId1 > characterId2){
        correctedData.character_id1 = characterId2;
        correctedData.character_id2 = characterId1;
        correctedData.relationship_type = reciprocalRelationshipType;
        correctedData.reciprocal_relationship_type = relationshipType;
    }

    if(existingRelationship.length > 0){
        //check if relationship already exists and is the same
        if(existingRelationship[0].relationship_type === relationshipType && existingRelationship[0].reciprocal_relationship_type === reciprocalRelationshipType){
            return null; //relationship already exists and is the same
        }

        //update existing relationship
        const updatedRelationship = await query(
            'UPDATE relationships SET relationship_type = ?, reciprocal_relationship_type = ? WHERE id = ?',
            [relationshipType, reciprocalRelationshipType, existingRelationship[0].id]
        );
        return updatedRelationship[0];
    }else{
        //create new relationship
        const newRelationship = await query(
            'INSERT INTO relationships (character_id1, character_id2, relationship_type, reciprocal_relationship_type) VALUES (?, ?, ?, ?) RETURNING *',
            [characterId1, characterId2, relationshipType, reciprocalRelationshipType]
        );
        return newRelationship[0];
    }
}

module.exports.addCharacterTag = addCharacterTag
async function addCharacterTag(characterId, tagId){
    //only add tag if it doesn't exist
    let tag = await query(
        'SELECT * FROM character_tags WHERE character_id = ? AND tag_id = ?',
        [characterId, tagId]
    );

    if(tag.length > 0){
        return null;
    }

    tag = await query(
        'INSERT INTO character_tags (character_id, tag_id) VALUES (?, ?) RETURNING *',
        [characterId, tagId]
    );

    return tag[0];
}

module.exports.removeCharacterTag = removeCharacterTag
async function removeCharacterTag(characterId, tagId){
    //only remove tag if it exists
    let tag = await query(
        'SELECT * FROM character_tags WHERE character_id = ? AND tag_id = ?',
        [characterId, tagId]
    );

    if(tag.length === 0){
        return null;
    }

    tag = await query(
        'DELETE FROM character_tags WHERE character_id = ? AND tag_id = ? RETURNING *',
        [characterId, tagId]
    );

    return tag[0];
}