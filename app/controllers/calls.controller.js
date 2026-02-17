const db = require("../config/db.config");
const table_calls = 'calllists';
const table_customers = 'customers';


exports.addcalls = async (req, res) => {
    try {

        if (!req.body) {
        return res.status(400).json({
            success: false,
            message: 'Request body is empty. Multer not configured.'
        });
        }

        const {
        contactid,
        userid,
        status
        } = req.body;

        
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let internalid = "";

        for (let i = 0; i < 12; i++) {
        internalid += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const insertQuery = `
        INSERT INTO ${table_calls}
        (
            uniqueid,
            userid,
            contactid,
            status,
            call_id,
            recording_sid,
            recording_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
        internalid,
            userid,
        contactid,
        status,
        '',
        '',
        ''
        ];

        const [result] = await db.query(insertQuery, values);

        
        return res.json({
        success: true,
        message: 'call added successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
        success: false,
        error: err.message
        });
    }


}

exports.listcalls = async (req, res) => {
  try {
    const customerid  = req.query.customerid; // this is uniqueid
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      ` SELECT 
            c.*, 
            cust.fullname,
            cust.phone,
            cust.email,
            cust.profileimg
        FROM ${table_calls} AS c
        LEFT JOIN ${table_customers} AS cust
            ON c.contactid = cust.internalid
        WHERE c.contactid = ?
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        `,
        [customerid, limit, offset]
    );


    const [[count]] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM ${table_calls}
      WHERE contactid = ?
      `,
      [customerid]
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        total: count.total,
        page,
        limit,
        totalPages: Math.ceil(count.total / limit),
      },
    });


  } catch (err) {
    return res.status(500).json({ status: false, message: "Server error" });
  }
};