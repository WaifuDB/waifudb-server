const { query } = require("./db");

module.exports.validateToken = async function (user_id, token) {
    try{
        //check if token is valid
        const token_res = await query(
            'SELECT user_id, token FROM sessions WHERE user_id = ? AND token = ?',
            [user_id, token]
        );

        if (token_res.length === 0) {
            return null;
        }

        //update last_used
        await query(
            'UPDATE sessions SET last_used = NOW() WHERE user_id = ? AND token = ?',
            [user_id, token]
        );

        return token_res[0];
    }catch(err){
        console.log(err);
        throw err;
    }
}

module.exports.getUser = async function (id) {
    try{
        //select user, inner join with user role mapping
        const user = await query(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );
    
        if (user.length === 0) {
            return null;
        }
    
        const user_roles = await query(
            'SELECT * FROM user_roles INNER JOIN roles ON roles.id = user_roles.role_id WHERE user_id = ?',
            [id]
        );

        const _user = user[0];
        delete _user.password; //remove password from user object

        _user.roles = user_roles.map(role => role); //map roles to user object
    
        return _user;
    }catch(err){
        console.log(err);
        throw err;
    }
}