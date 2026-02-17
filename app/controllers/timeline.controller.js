const db = require("../config/db.config");
const table_timeline = 'timeline';


exports.list = async (req, res) => {

  try {
    const id = req.query.id;
    const limit = parseInt(req.query.limit);

    const query = `
      SELECT title,description,created_at FROM ${table_timeline}
      WHERE customerid = ?
      ORDER BY id DESC
      LIMIT ?
    `;
    
    const [rows] = await db.query(query, [id, limit]);


    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    console.error('Customer List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};

exports.unique = async (req, res) => {

  try {
    const id = req.query.id;
    const limit = parseInt(req.query.limit);
    

    const query = `
      SELECT title,description,created_at FROM ${table_timeline}
      WHERE userid = ?
      ORDER BY id DESC
      LIMIT ?
    `;
    
    const [rows] = await db.query(query, [id, limit]);


    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    console.error('Customer List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};