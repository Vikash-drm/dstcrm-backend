const db = require("../config/db.config");
const bcrypt = require('bcrypt');
const table_customer = 'customers';
const table_timeline = 'timeline';
const table_user = 'users';
const jwt = require('jsonwebtoken'); 


exports.add = async (req, res) => {

    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Multer not configured.'
      });
    }

    const {
      name,
      email,
      role,
      password,
      userid
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const avatar = req.file ? req.file.filename : '';

     // 🔐 HASH PASSWORD
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);


    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const insertQuery = `
      INSERT INTO ${table_user}
      (
        uniqueid,
        name,
        email,
        password,
        role,
        avatar
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      internalid,
      name,
      email,
      hashedPassword,
      role,
      avatar,
    ];

    const [result] = await db.query(insertQuery, values);

    return res.json({
      success: true,
      message: 'user added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "user ID is required"
      });
    }

    const [result] = await db.query(
      `DELETE FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "user not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "user deleted successfully"
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.getById = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query(
    `SELECT uniqueid,name,email,role,avatar,created_at FROM ${table_user} WHERE uniqueid = ?`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "user not found" });
  }

   res.status(200).json({
      success: true,
      data: rows[0]
    });
};

exports.update = async (req, res) => {
  try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Multer not configured.'
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const {
      name,
      email,
      role,
      password
    } = req.body;

    // avatar handling
    const avatar = req.file ? req.file.filename : null;

    const fields = [];
    const values = [];

    fields.push('name = ?');
    values.push(name);

    fields.push('email = ?');
    values.push(email);

    if(role && role.trim()!==''){
      fields.push('role = ?');
      values.push(role);
    }

    // 🔐 ONLY UPDATE PASSWORD IF PROVIDED
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      fields.push('password = ?');
      values.push(hashedPassword);
    }

    // avatar (null keeps old)
    if (avatar) {
      fields.push('avatar = ?');
      values.push(avatar);
    }

    const updateQuery = `
      UPDATE ${table_user}
      SET ${fields.join(', ')}
      WHERE uniqueid = ?
    `;

    values.push(id);

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

