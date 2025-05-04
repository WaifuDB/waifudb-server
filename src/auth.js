const { query } = require("./db");

module.exports.authenticate = function (req, res, next) {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Not authenticated' });
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