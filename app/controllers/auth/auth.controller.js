const db = require("../../config/db.config");
const bcrypt = require('bcrypt');
const table_user = 'users';
const jwt = require('jsonwebtoken'); 

const fetchUser = async (email) => {
  const userQuery = `
      SELECT *
      FROM ${table_user}
      WHERE email = ?
      LIMIT 1;
  `;
  const [userResult] = await db.query(userQuery, [email]); 

  const userData = userResult[0];
  if(userData) {
    return userData;
  }
  return null;
}

exports.signin = async (req, res) => {

    try{
        
        const { email, password } = req.body;
        const user = await fetchUser(email);

        if (!user) {
            return res.status(404).json({
                status: "error",
                success: false,
                message: "User not found. Please check your credentials and try again."
            });
        }

        const match = await bcrypt.compare(password, user.password);

         if(!match) {
            return res.status(401).send({
                status: "error",
                success: false,
                message: "Username or Password is invalid. Please check your credentials and try again."
            });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );
       
         return res.status(200).send({
            status: 'success',
            success: true,
            message: 'Successful!',
            token,
            user: {
                uniqueid: user.uniqueid,
                name: user.name,
                role: user.role
            }
        });
       

    } catch (error) {
        return res.status(500).json({
        status: "error",
        success: false,
        message: error.message || "An unexpected error occurred while login."
        });
    }

}

exports.list = async (req, res) => {
  try {

    const query = `
      SELECT id,uniqueid,name,email,role,avatar,created_at FROM ${table_user}
      ORDER BY id DESC
    `;
    
    const [rows] = await db.query(query);


    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};