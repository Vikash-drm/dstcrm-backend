const db = require("../config/db.config");
const table_calendar = 'calendar';


exports.list = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "userid is required"
      });
    }

    const [rows] = await db.query(
      `SELECT * FROM ${table_calendar}
       WHERE userid=?
       ORDER BY startDate ASC, time ASC`,
      [id]
    );

    return res.json({
      status: true,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};

exports.create = async (req, res) => {
  try {
    const { userid, title, address, startDate, endDate, time, type } = req.body;

    if (!userid || !title || !startDate || !endDate || !type) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields"
      });
    }

    const [result] = await db.query(
      `INSERT INTO ${table_calendar}
        (userid, title, address, startDate, endDate, time, type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userid, title, address || "", startDate, endDate, time || "", type]
    );

    return res.json({
      status: true,
      message: "Event created",
      id: result.insertId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, address, startDate, endDate, time, type } = req.body;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Event ID required"
      });
    }

    await db.query(
      `UPDATE ${table_calendar}
       SET title=?, address=?, startDate=?, endDate=?, time=?, type=?
       WHERE id=?`,
      [title, address || "", startDate, endDate, time || "", type, id]
    );

    return res.json({
      status: true,
      message: "Event updated"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: false,
        message: "Event ID required"
      });
    }

    await db.query(
      `DELETE FROM ${table_calendar} WHERE id=?`,
      [id]
    );

    return res.json({
      status: true,
      message: "Event deleted"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};