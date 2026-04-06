const { query } = require("./db");
const { getCharacterImages, getSourceImages } = require("./images");

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

    if (!characters || characters.length === 0) {
        return [];
    }

    const characterIds = characters.map((character) => character.id);

    const [characterSourcesRows, characterImagesRows, relationships] = await Promise.all([
        query(
            'SELECT cs.character_id, s.* FROM character_sources cs INNER JOIN sources s ON s.id = cs.source_id WHERE cs.character_id IN (?)',
            [characterIds]
        ),
        query(
            'SELECT ic.character_id, i.* FROM image_characters ic INNER JOIN images i ON i.id = ic.image_id WHERE ic.character_id IN (?)',
            [characterIds]
        ),
        query(
            'SELECT * FROM relationships WHERE from_id IN (?) OR to_id IN (?)',
            [characterIds, characterIds]
        ),
    ]);

    const sourcesByCharacterId = {};
    for (const row of characterSourcesRows) {
        if (!sourcesByCharacterId[row.character_id]) {
            sourcesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...source } = row;
        sourcesByCharacterId[character_id].push(source);
    }

    const imagesByCharacterId = {};
    for (const row of characterImagesRows) {
        if (!imagesByCharacterId[row.character_id]) {
            imagesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...image } = row;
        imagesByCharacterId[character_id].push(image);
    }

    const relationshipsByCharacterId = {};
    const relatedCharacterIds = new Set();
    for (const characterId of characterIds) {
        relationshipsByCharacterId[characterId] = [];
    }

    for (const relationship of relationships || []) {
        if (relationshipsByCharacterId[relationship.from_id]) {
            relationshipsByCharacterId[relationship.from_id].push(relationship);
            if (relationship.to_id !== relationship.from_id) {
                relatedCharacterIds.add(relationship.to_id);
            }
        }

        if (relationshipsByCharacterId[relationship.to_id] && relationship.to_id !== relationship.from_id) {
            relationshipsByCharacterId[relationship.to_id].push(relationship);
            relatedCharacterIds.add(relationship.from_id);
        }
    }

    const relatedCharacterIdsList = [...relatedCharacterIds];
    const relatedCharacters = relatedCharacterIdsList.length > 0
        ? await query('SELECT * FROM characters WHERE id IN (?)', [relatedCharacterIdsList])
        : [];

    let relatedSourcesRows = [];
    let relatedImagesRows = [];
    if (relatedCharacterIdsList.length > 0) {
        [relatedSourcesRows, relatedImagesRows] = await Promise.all([
            query(
                'SELECT cs.character_id, s.* FROM character_sources cs INNER JOIN sources s ON s.id = cs.source_id WHERE cs.character_id IN (?)',
                [relatedCharacterIdsList]
            ),
            query(
                'SELECT ic.character_id, i.* FROM image_characters ic INNER JOIN images i ON i.id = ic.image_id WHERE ic.character_id IN (?)',
                [relatedCharacterIdsList]
            ),
        ]);
    }

    const relatedSourcesByCharacterId = {};
    for (const row of relatedSourcesRows) {
        if (!relatedSourcesByCharacterId[row.character_id]) {
            relatedSourcesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...source } = row;
        relatedSourcesByCharacterId[character_id].push(source);
    }

    const relatedImagesByCharacterId = {};
    for (const row of relatedImagesRows) {
        if (!relatedImagesByCharacterId[row.character_id]) {
            relatedImagesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...image } = row;
        relatedImagesByCharacterId[character_id].push(image);
    }

    const relatedCharacterCache = {};
    for (const relatedCharacter of relatedCharacters) {
        relatedCharacterCache[relatedCharacter.id] = {
            ...relatedCharacter,
            sources: relatedSourcesByCharacterId[relatedCharacter.id] || [],
            images: relatedImagesByCharacterId[relatedCharacter.id] || [],
        };
    }

    return characters.map((character) => {
        const mappedRelationships = (relationshipsByCharacterId[character.id] || []).map((relationship) => {
            let mappedRelationship = relationship;

            if (relationship.to_id == character.id) {
                mappedRelationship = {
                    ...relationship,
                    from_id: relationship.to_id,
                    to_id: relationship.from_id,
                    relationship_type: relationship.reciprocal_relationship_type,
                    reciprocal_relationship_type: relationship.relationship_type,
                };
            }

            const otherCharacterId = mappedRelationship.to_id;
            if (relatedCharacterCache[otherCharacterId]) {
                mappedRelationship = {
                    ...mappedRelationship,
                    character: relatedCharacterCache[otherCharacterId],
                };
            }

            return mappedRelationship;
        });

        return {
            ...character,
            sources: sourcesByCharacterId[character.id] || [],
            relationships: mappedRelationships,
            images: imagesByCharacterId[character.id] || [],
        };
    });
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

    //get images for the source
    const sourceImages = await getSourceImages(id);
    sourceWithCharacters.images = sourceImages;


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

module.exports.getCharacters = getCharacters;
async function getCharacters(options = {}){
    const {
        limit = null,
        offset = 0,
    } = options;

    let sql = 'SELECT * FROM characters';
    const params = [];

    if (Number.isInteger(limit) && limit > 0) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, Math.max(0, offset));
    }

    const characters = await query(sql, params);

    if (characters.length === 0) {
        return null;
    }

    return characters;
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

    const pendingQueries = [
        getCharacterSources(id),
        getCharacterImages(id),
    ];

    if (map_relationships) {
        pendingQueries.push(getCharacterRelationships(id));
    }

    const [sources, images, relationships] = await Promise.all(pendingQueries);

    _character.sources = sources || [];
    _character.images = images || [];
    if (map_relationships) {
        _character.relationships = relationships || [];
    }

    return character[0];
}

module.exports.getCharacterRelationships = getCharacterRelationships;
async function getCharacterRelationships(characterId){
    const relationships = await query(
        `SELECT * FROM relationships WHERE from_id = ? OR to_id = ?`,
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

    const relatedCharacterIds = [...new Set(
        mappedRelationships
            .flatMap((relationship) => [relationship.from_id, relationship.to_id])
            .filter((id) => id != characterId)
    )];

    const relatedCharacters = relatedCharacterIds.length > 0
        ? await query('SELECT * FROM characters WHERE id IN (?)', [relatedCharacterIds])
        : [];

    let relatedSourcesRows = [];
    let relatedImagesRows = [];
    if (relatedCharacterIds.length > 0) {
        [relatedSourcesRows, relatedImagesRows] = await Promise.all([
            query(
                'SELECT cs.character_id, s.* FROM character_sources cs INNER JOIN sources s ON s.id = cs.source_id WHERE cs.character_id IN (?)',
                [relatedCharacterIds]
            ),
            query(
                'SELECT ic.character_id, i.* FROM image_characters ic INNER JOIN images i ON i.id = ic.image_id WHERE ic.character_id IN (?)',
                [relatedCharacterIds]
            ),
        ]);
    }

    const relatedSourcesByCharacterId = {};
    for (const row of relatedSourcesRows) {
        if (!relatedSourcesByCharacterId[row.character_id]) {
            relatedSourcesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...source } = row;
        relatedSourcesByCharacterId[character_id].push(source);
    }

    const relatedImagesByCharacterId = {};
    for (const row of relatedImagesRows) {
        if (!relatedImagesByCharacterId[row.character_id]) {
            relatedImagesByCharacterId[row.character_id] = [];
        }

        const { character_id, ...image } = row;
        relatedImagesByCharacterId[character_id].push(image);
    }

    const characterCache = {};
    for (const relatedCharacter of relatedCharacters) {
        characterCache[relatedCharacter.id] = {
            ...relatedCharacter,
            sources: relatedSourcesByCharacterId[relatedCharacter.id] || [],
            images: relatedImagesByCharacterId[relatedCharacter.id] || [],
        };
    }

    //add character data to relationships
    for (const relationship of mappedRelationships){
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
