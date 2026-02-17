const db = require("../config/db.config");
const table_message = 'messages';


exports.getAllUsers = async (req, res) => {
  try {
    const { myUserId } = req.params; // this is uniqueid

    const [users] = await db.query(
      `SELECT uniqueid, name, avatar, online
       FROM users
       WHERE uniqueid != ?
       ORDER BY name`,
      [myUserId]
    );

    return res.json({ status: true, data: users });
  } catch (err) {
    console.log("getAllUsers error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};



// ✅ My chat list only
exports.getMyChatList = async (req, res) => {
  try {
    const { myUserId } = req.params; // uniqueid

    const [rows] = await db.query(
      `
      SELECT 
        cr.id AS roomId,
        u.uniqueid AS userId,
        u.name,
        u.avatar,
        u.online,
        (
          SELECT m.message
          FROM messages m
          WHERE m.room_id = cr.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS lastMessage
      FROM chat_rooms cr
      JOIN chat_participants cp1 ON cp1.room_id = cr.id
      JOIN chat_participants cp2 
           ON cp2.room_id = cr.id 
          AND cp2.user_id != cp1.user_id
      JOIN users u ON u.uniqueid = cp2.user_id
      WHERE cp1.user_id = ?
      ORDER BY cr.id DESC
      `,
      [myUserId]
    );

    return res.json({ status: true, data: rows });
  } catch (err) {
    console.log("getMyChatList error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};



// ✅ Create room between 2 users or return existing room
exports.createOrGetRoom = async (req, res) => {
  try {
    const { myUserId, otherUserId } = req.body; // both uniqueid

    if (!myUserId || !otherUserId) {
      return res.json({ status: false, message: "myUserId & otherUserId required" });
    }

    const [exists] = await db.query(
      `
      SELECT cp1.room_id AS roomId
      FROM chat_participants cp1
      JOIN chat_participants cp2 
        ON cp1.room_id = cp2.room_id
      WHERE cp1.user_id = ? 
        AND cp2.user_id = ?
      LIMIT 1
      `,
      [myUserId, otherUserId]
    );

    if (exists.length > 0) {
      return res.json({ status: true, roomId: exists[0].roomId });
    }

    const [room] = await db.query(`INSERT INTO chat_rooms () VALUES ()`);

    await db.query(
      `INSERT INTO chat_participants (room_id, user_id)
       VALUES (?, ?), (?, ?)`,
      [room.insertId, myUserId, room.insertId, otherUserId]
    );

    return res.json({ status: true, roomId: room.insertId });
  } catch (err) {
    console.log("createOrGetRoom error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};


// ✅ Messages by roomId
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const [msgs] = await db.query(
      `SELECT id, room_id, sender_id, message, created_at
       FROM messages
       WHERE room_id = ?
       ORDER BY created_at ASC`,
      [roomId]
    );

    return res.json({ status: true, data: msgs });
  } catch (err) {
    console.log("getMessages error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

// ✅ Messages by roomId
exports.sendMessage = async (req, res) => {
  try {
    const { roomId, senderId, message } = req.body; // senderId = uniqueid

    if (!roomId || !senderId || !message) {
      return res.json({
        status: false,
        message: "roomId, senderId, message required",
      });
    }

    const [insert] = await db.query(
      `INSERT INTO messages (room_id, sender_id, message)
       VALUES (?, ?, ?)`,
      [roomId, senderId, message]
    );

    return res.json({
      status: true,
      message: "Message sent",
      data: { id: insert.insertId },
    });
  } catch (err) {
    console.log("sendMessage error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};


