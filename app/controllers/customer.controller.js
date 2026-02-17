const db = require("../config/db.config");
const bcrypt = require('bcrypt');
const table_customer = 'customers';
const table_timeline = 'timeline';
const table_opportunity = 'opportunity';
const table_pipelines = 'pipelines';
const table_user = 'users';
const jwt = require('jsonwebtoken'); 
const fs = require("fs");
const csv = require("csv-parser");
const XLSX = require('xlsx');
const path = require('path');

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
      property,
      phone,
      budget,
      about,
      address,
      notes,
      userid
    } = req.body;

    const avatar = req.file ? req.file.filename : '';

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'phone are required'
      });
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const insertQuery = `
      INSERT INTO ${table_customer}
      (
        internalid,
        userid,
        fullname,
        propertytype,
        email,
        phone,
        budget,
        profileimg,
        source,
        about,
        address,
        notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      internalid,
        userid,
      name,
      property,
      email,
      phone,
      budget,
      avatar,
     'internal',
     about,
     address,
     notes
    ];

    const [result] = await db.query(insertQuery, values);

    // const customerCode = `CUS-${1000 + result.insertId}`;


     const [[user]] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [userid]
    );
    const isTelesaler = user?.role === 'Telesaler';

    if(isTelesaler){
      await db.query(
        `UPDATE ${table_customer} SET assignuser = ? WHERE id = ?`,
        [userid, result.insertId]
      );
    }


    // timeline add
    
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
     var uniqueid2 = random;
     var userid2 = userid
     var propertyid2 = '';
     var customerid2 = result.insertId;
     var title2 = 'Customer Created';

     const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
      );
      // console.log(rows);
      const username = rows.length ? rows[0].name : 'Unknown';

     var description2 = `Customer created by ${username} (Internal source)`;

    const insertQuery_2 = `
      INSERT INTO ${table_timeline}
      (
        uniqueid,
        userid,
        propertyid,
        customerid,
        title,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values_2 = [
      uniqueid2,
      userid2,
      propertyid2,
      internalid,
      title2,
      description2
    ];

    const [result_2] = await db.query(insertQuery_2, values_2);
    // timeline add


    return res.json({
      success: true,
      message: 'Customer added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const uniqueid = req.query.uniqueid;
    const offset = (page - 1) * limit;

    // Optional filters from query
    const { type, stage, budget, date, search, assign,customertype } = req.query;

    // Get user role
    const [[user]] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [uniqueid]
    );
    const isTelesaler = user?.role === 'Telesaler';

    // Build WHERE dynamically
    let whereClauses = [];
    let params = [];

    if (isTelesaler) {
      whereClauses.push(`(c.userid = ? OR c.assignuser = ?)`);
      params.push(uniqueid, uniqueid);
    }

    if (type && customertype != 'source') {
      whereClauses.push(`c.propertytype = ?`);
      params.push(type);
    }

    // if (stage) {
    //   whereClauses.push(`status = ?`);
    //   params.push(stage);
    // }

    if (budget) {
      whereClauses.push(`c.budget <= ?`);
      params.push(Number(budget));
    }

    if (date) {
      whereClauses.push(`DATE(c.created_at) = ?`);
      params.push(date);
    }

    if(assign) {
      if (assign === 'assigned') {
        whereClauses.push(`c.assignuser IS NOT NULL AND c.assignuser != ''`);
      }

      if (assign === 'unassigned') {
        whereClauses.push(`(c.assignuser IS NULL OR c.assignuser = '')`);
      }
    }

    if (search) {
      if(customertype === 'prospects'){
         whereClauses.push(`
          (
            c.phone LIKE ?
            OR c.email LIKE ?
            OR c.fullname LIKE ?
          )
        `);

        params.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`
        );
      }else{

        whereClauses.push(`
          (
            c.phone LIKE ?
            OR c.email LIKE ?
            OR c.fullname LIKE ?
          )
        `);

        params.push(
          `%${search}%`,
          `%${search}%`,
          `%${search}%`
        );
      }

    }

    if (customertype === 'lost') {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM ${table_opportunity} o
          WHERE o.customerid = c.internalid
          AND o.status = 'Lost'
        )
      `);
    }

    if (customertype === 'clients') {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM ${table_opportunity} o
          WHERE o.customerid = c.internalid
          AND o.status = 'Won'
        )
      `);
    }

    if (customertype === 'queue') {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM ${table_opportunity} o
          WHERE o.customerid = c.internalid
          AND o.pipelineid = 'crMvd9QNJ4WI'
          AND o.status != 'Lost'
          AND o.status != 'Won'
        )
      `);
    }

    if (customertype === 'capture') {
      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM ${table_opportunity} o
          WHERE o.customerid = c.internalid
          AND o.pipelineid = 'nmb2FIq0HqoA'
          AND o.status != 'Lost'
          AND o.status != 'Won'
        )
      `);
    }

    if (customertype === 'fresh') {
      whereClauses.push(`
        NOT EXISTS (
          SELECT 1
          FROM ${table_opportunity} o
          WHERE o.customerid = c.internalid
        )
      `);
    }

    if (customertype === 'source') {
      if(type){
         whereClauses.push(`c.source = ?`);
        params.push(type);
      }
    }


   

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Data query
    
    let query = `
      SELECT
      c.*,
      o.status AS opportunity_status,
      pl.name AS pipeline_name,
      usr.name AS assignusername
      FROM ${table_customer} c
      LEFT JOIN ${table_opportunity} o
        ON o.customerid = c.internalid
      AND o.id = (
        SELECT MAX(id)
        FROM ${table_opportunity} o2
        WHERE o2.customerid = c.internalid

         ${customertype === 'queue' ? `
            AND o2.pipelineid = 'crMvd9QNJ4WI'
            AND o2.status NOT IN ('Lost','Won')
          ` : ''}
          
         ${customertype === 'capture' ? `
          AND o2.pipelineid = 'nmb2FIq0HqoA'
          AND o2.status NOT IN ('Lost','Won')
        ` : ''}

      )
      LEFT JOIN ${table_pipelines} pl
        ON pl.uniqueid = o.pipelineid
      LEFT JOIN ${table_user} usr
        ON usr.uniqueid = c.assignuser
      ${where}
      ORDER BY 
      CASE 
        WHEN c.assignuser = '' OR c.assignuser IS NULL THEN 0
        ELSE 1
      END,
      c.id DESC
      LIMIT ? OFFSET ?`
    ;

    // Count query for pagination
    let countQuery = `
     SELECT COUNT(*) AS total
    FROM ${table_customer} c
    LEFT JOIN ${table_opportunity} o
      ON o.customerid = c.internalid
      AND o.id = (
        SELECT MAX(id)
        FROM ${table_opportunity}
        WHERE customerid = c.internalid
      )
    ${where}
    `;

    if (customertype === 'prospects') {

      whereClauses.push(`
        EXISTS (
          SELECT 1
          FROM ${table_opportunity} o2
          WHERE o2.customerid = c.internalid
            AND o2.pipelineid NOT IN ('nmb2FIq0HqoA','crMvd9QNJ4WI','t2g5DFK0oev0')
            AND o2.status NOT IN ('Lost','Won')
        )
      `);

      query = `
        SELECT
          c.*,
          o.status AS opportunity_status,
          pl.name AS pipeline_name,
          usr.name AS assignusername
        FROM ${table_customer} c
        LEFT JOIN ${table_opportunity} o
          ON o.customerid = c.internalid
          AND o.pipelineid NOT IN ('nmb2FIq0HqoA','crMvd9QNJ4WI','t2g5DFK0oev0')
          AND o.status NOT IN ('Lost','Won')
          AND o.id = (
            SELECT MAX(id)
            FROM ${table_opportunity}
            WHERE customerid = c.internalid
              AND pipelineid NOT IN ('nmb2FIq0HqoA','crMvd9QNJ4WI','t2g5DFK0oev0')
              AND status NOT IN ('Lost','Won')
          )
        LEFT JOIN ${table_user} usr
        ON usr.uniqueid = c.assignuser
        LEFT JOIN ${table_pipelines} pl
          ON pl.uniqueid = o.pipelineid
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY 
        CASE 
          WHEN c.assignuser = '' OR c.assignuser IS NULL THEN 0
          ELSE 1
        END,
        c.id DESC
        LIMIT ? OFFSET ?
      `;

        var newwher = '';
      if (search) {
        newwher = `
          AND (
            c.phone LIKE '%mona%'
            OR c.email LIKE '%mona%'
            OR c.fullname LIKE '%mona%'
          )
        `;
      }
      countQuery = `
        SELECT COUNT(DISTINCT c.internalid) AS total
        FROM ${table_customer} c
        WHERE EXISTS (
          SELECT 1
          FROM ${table_opportunity} o2
          WHERE o2.customerid = c.internalid
            AND o2.pipelineid NOT IN ('nmb2FIq0HqoA','crMvd9QNJ4WI','t2g5DFK0oev0')
            AND o2.status NOT IN ('Lost','Won')
        )
        ${newwher}
      `;


    }



    

    // Add pagination params to query
    const [rows] = await db.query(query, [...params, limit, offset]);
    const [[count]] = await db.query(countQuery, params);

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
  } catch (error) {
    console.error('Customer List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};


exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    const [result] = await db.query(
      `DELETE FROM ${table_customer} WHERE internalid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Customer deleted successfully"
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
    `SELECT * FROM ${table_customer} WHERE internalid = ?`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Customer not found" });
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
        message: 'Customer ID is required'
      });
    }

    const {
      name,
      email,
      property,
      status,
      phone,
      budget,
      about,
      address,
      notes,
      userid
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'phone is required'
      });
    }

    // If new avatar uploaded, use it. Else keep old one
    const avatar = req.file ? req.file.filename : null;

    const updateQuery = `
      UPDATE ${table_customer}
      SET
        fullname = ?,
        propertytype = ?,
        status = ?,
        email = ?,
        phone = ?,
        budget = ?,
        profileimg = COALESCE(?, profileimg),
        about = ?,
        address = ?,
        notes = ?
      WHERE internalid = ?
    `;

    const values = [
      name,
      property,
      status,
      email,
      phone,
      budget,
      avatar,        // null keeps old image
      about,
      address,
      notes,
      id
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }


    // timeline add
    
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
     var uniqueid2 = random;
     var userid2 = userid
     var propertyid2 = '';
     var customerid2 = result.insertId;
     var title2 = 'Customer Updated';

     const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
      );
      const username = rows.length ? rows[0].name : 'Unknown';

     var description2 = `Customer updated by ${username} (Internal source)`;

    const insertQuery_2 = `
      INSERT INTO ${table_timeline}
      (
        uniqueid,
        userid,
        propertyid,
        customerid,
        title,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values_2 = [
      uniqueid2,
      userid2,
      propertyid2,
      id,
      title2,
      description2
    ];

    const [result_2] = await db.query(insertQuery_2, values_2);
    // timeline add



    return res.json({
      success: true,
      message: 'Customer updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.importCustomers = async (req, res) => {
  const { uniqueid, importType } = req.body;
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  const rows = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  try {

    /* =========================
       CSV FILE
    ========================= */
    if (ext === '.csv') {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(
            csv({
              skipEmptyLines: true,
              mapHeaders: ({ header }) => header.trim(),
              mapValues: ({ value }) =>
                typeof value === 'string' ? value.trim() : value
            })
          )
          .on('data', row => {
            delete row[''];
            const hasData = Object.values(row).some(v => v !== '');
            if (hasData) rows.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });
    }

    /* =========================
       EXCEL FILE
    ========================= */
    else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false
      });

      for (const row of data) {
        const cleanRow = {};
        for (const key in row) {
          cleanRow[key.trim()] =
            typeof row[key] === 'string' ? row[key].trim() : row[key];
        }

        const hasData = Object.values(cleanRow).some(v => v !== '');
        if (hasData) rows.push(cleanRow);
      }
    }

    /* =========================
       INVALID FILE
    ========================= */
    else {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        message: 'Only CSV or Excel (.xlsx) files are supported'
      });
    }

    /* =========================
       PROCESS ROWS
    ========================= */
    for (const r of rows) {
      if (!r.phone) continue;

      const [existing] = await db.query(
        `SELECT id, duplicate FROM ${table_customer} WHERE phone = ? LIMIT 1`,
        [r.phone]
      );

      if (existing.length > 0) {
        // 👉 DUPLICATE FOUND
        let duplicateArr = [];

        if (existing[0].duplicate) {
          duplicateArr = JSON.parse(existing[0].duplicate);
        }

        const idx = duplicateArr.findIndex(d => d.type === importType);

        if (idx > -1) {
          duplicateArr[idx].count += 1;
        } else {
          duplicateArr.push({ type: importType, count: 1 });
        }

        await db.query(
          `UPDATE ${table_customer} SET duplicate = ? WHERE id = ?`,
          [JSON.stringify(duplicateArr), existing[0].id]
        );

      } else {
        // 👉 NEW CUSTOMER
        let internalid = '';
        for (let i = 0; i < 12; i++) {
          internalid += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        await db.query(
          `INSERT INTO ${table_customer} (
            internalid,
            userid,
            fullname,
            email,
            phone,
            propertytype,
            budget,
            source,
            address,
            notes,
            duplicate
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [
            internalid,
            uniqueid,
            r.fullname || '',
            r.email || '',
            r.phone,
            r.propertytype || '',
            r.budget || '',
            importType || 'import',
            r.address || '',
            r.notes || '',
            ''
          ]
        );
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported: rows.length
    });

  } catch (err) {
    console.error(err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: 'Import failed' });
  }
};

exports.fetchcustomer = async (req, res) => {
  try {
    const { userid } = req.params; // or req.query.userid
    const DAILY_LIMIT = 50;
    const today = new Date().toISOString().slice(0, 10);

    if (!userid) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // 1️⃣ Get user from DB
    const [users] = await db.query(
      `SELECT id, fetch_count_today, fetch_date FROM ${table_user} WHERE uniqueid = ?`,
      [userid]
    );

    if (!users.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // 2️⃣ Reset daily count if date changed
      const dbDate = user.fetch_date
      ? new Date(user.fetch_date).toISOString().slice(0, 10)
      : null;

    if (!dbDate || dbDate !== today) {
      await db.query(
        `UPDATE ${table_user}
        SET fetch_count_today = 0, fetch_date = ?
        WHERE uniqueid = ?`,
        [today, userid]
      );
      user.fetch_count_today = 0;
    }


    // 3️⃣ Check remaining limit
    const remaining = DAILY_LIMIT - user.fetch_count_today;
    if (remaining <= 0) {
      return res.status(429).json({
        message: 'Daily fetch limit (50) reached'
      });
    }

    // 4️⃣ Assign ONLY unassigned customers
    // const [result] = await db.query(
    //   `UPDATE ${table_customer}
    //    SET assignuser = ?
    //    WHERE (assignuser IS NULL OR assignuser = '')
    //    ORDER BY created_at ASC
    //    LIMIT ?`,
    //   [userid, remaining]
    // );
    const [result] = await db.query(
      `
      UPDATE ${table_customer} c
      SET c.assignuser = ?
      WHERE (c.assignuser IS NULL OR c.assignuser = '')
      
      -- 🚫 EXCLUDE locked sources for this user
      AND NOT EXISTS (
        SELECT 1
        FROM lead_source_lock l
        WHERE l.source = c.source
        AND JSON_CONTAINS(l.users, JSON_QUOTE(?)) = 0
      )

      ORDER BY c.created_at ASC
      LIMIT ?
      `,
      [userid, userid, remaining]
    );

    const assignedCount = result.affectedRows;

    if (assignedCount === 0) {
      return res.status(200).json({
        message: 'No unassigned customers available',
        assigned: 0
      });
    }

    // 5️⃣ Update user fetch count
    await db.query(
      `UPDATE ${table_user}
       SET fetch_count_today = fetch_count_today + ?
       WHERE uniqueid = ?`,
      [assignedCount, userid]
    );

    return res.status(200).json({
      message: `${assignedCount} customers assigned successfully`,
      assigned: assignedCount,
      remaining: DAILY_LIMIT - (user.fetch_count_today + assignedCount)
    });

  } catch (error) {
    console.error('fetchcustomer error:', error);
    return res.status(500).json({
      message: 'Something went wrong while fetching customers'
    });
  }
};


// type lock

exports.addlocksource = async (req, res) => {
  try {
    const payload = req.body;

    if (!Array.isArray(payload)) {
      return res.status(400).json({
        success: false,
        message: 'Payload must be an array'
      });
    }

    for (const item of payload) {
      const { source, users, unlock } = item;

      if (!source) continue;

      // 🔓 UNLOCK → remove row
      if (unlock === true) {
        await db.query(
          `DELETE FROM lead_source_lock WHERE source = ?`,
          [source]
        );
        continue;
      }

      // 🔒 LOCK / UPDATE
      await db.query(
        `
        INSERT INTO lead_source_lock (source, users)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE users = VALUES(users)
        `,
        [source, JSON.stringify(users || [])]
      );
    }

    res.json({
      success: true,
      message: 'Source locks updated'
    });

  } catch (err) {
    console.error('Lock source error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update source locks'
    });
  }
};



exports.getlocksource = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT source, users FROM lead_source_lock`
    );

    const data = rows.map(row => ({
      source: row.source,
      users: JSON.parse(row.users)
    }));

    res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error('getlocksource error:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch source locks'
    });
  }
};

// type lock


