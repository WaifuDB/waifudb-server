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

    let actualCharacters = [];
    //get them individually to get the relationships etc
    for await(const character of characters){
        const characterWithRelationships = await getCharacterById(character.id, true);
        actualCharacters.push(characterWithRelationships);
    }

    return actualCharacters;
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
        'SELECT * FROM relationships WHERE from_id = ? OR to_id = ?',
        [characterId, characterId]
    );

    if (relationships.length === 0) {
        return null;
    }

    const mappedRelationships = relationships.map((relationship) => {
        if(relationship.to_id == characterId){
            return {
                ...relationship,
                from_id: relationship.to_id,
                to_id: relationship.from_id,
                relationship_type: relationship.reciprocal_relationship_type,
                reciprocal_relationship_type: relationship.relationship_type,
            }
        }
        return relationship;
    })

    let characterCache = {};

    for await(const relationship of mappedRelationships){
        if(!characterCache[relationship.from_id]){
            if(relationship.from_id != characterId){
                const character = await getCharacterById(relationship.from_id, false);
                characterCache[relationship.from_id] = character;
            }
        }
        if(!characterCache[relationship.to_id]){
            if(relationship.to_id != characterId){
                const character = await getCharacterById(relationship.to_id, false);
                characterCache[relationship.to_id] = character;
            }
        }
    }

    //add character data to relationships
    for await(const relationship of mappedRelationships){
        let id = null;
        if(relationship.from_id == characterId){
            id = relationship.to_id;
        }else{
            id = relationship.from_id;
        }

        if(characterCache[id]){
            relationship.character = characterCache[id];
        }
    }

    return mappedRelationships;
}

module.exports.getCharactersRelationships = getCharactersRelationships;
async function getCharactersRelationships(from_id, to_id){
    const relationships = await query(
        'SELECT * FROM relationships WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
        [from_id, to_id, to_id, from_id]
    );

    if (relationships.length === 0) {
        return null;
    }

    return relationships;
}

module.exports.createOrUpdateCharacterRelationship = createOrUpdateCharacterRelationship;
async function createOrUpdateCharacterRelationship(id, from_id, to_id, relationshipType, reciprocalRelationshipType, visualize){
    //check if relationship already exists
    const existingRelationship = await query(
        'SELECT * FROM relationships WHERE (id = ?)',
        [id]
    );

    visualize = visualize ? 1 : 0; //convert to int

    let correctedData = {
        from_id: from_id,
        to_id: to_id,
        relationship_type: relationshipType,
        reciprocal_relationship_type: reciprocalRelationshipType,
        visualize: visualize,
    }

    //check if characterId1 is lower than characterId2 and swap if necessary
    if(from_id > to_id){
        correctedData.from_id = to_id;
        correctedData.to_id = from_id;
        correctedData.relationship_type = reciprocalRelationshipType;
        correctedData.reciprocal_relationship_type = relationshipType;
        correctedData.visualize = visualize;
    }

    if(existingRelationship.length > 0){
        //check if relationship already exists and is the same
        if(existingRelationship[0].relationship_type === relationshipType && existingRelationship[0].reciprocal_relationship_type === reciprocalRelationshipType && existingRelationship[0].visualize === visualize){
            return null; //relationship already exists and is the same
        }

        //update existing relationship
        const updatedRelationship = await query(
            'UPDATE relationships SET from_id = ?, to_id = ?, relationship_type = ?, reciprocal_relationship_type = ?, visualize = ? WHERE id = ?',
            [from_id, to_id, relationshipType, reciprocalRelationshipType, visualize, existingRelationship[0].id]
        );
        return updatedRelationship[0];
    }else{
        //create new relationship
        const newRelationship = await query(
            'INSERT INTO relationships (from_id, to_id, relationship_type, reciprocal_relationship_type, visualize) VALUES (?, ?, ?, ?, ?) RETURNING *',
            [from_id, to_id, relationshipType, reciprocalRelationshipType, visualize]
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