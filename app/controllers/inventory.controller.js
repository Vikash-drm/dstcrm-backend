const db = require("../config/db.config");
const bcrypt = require('bcrypt');
const table_inventory = 'project_inventory';
const table_timeline = 'timeline';
const table_user = 'users';
const jwt = require('jsonwebtoken'); 
const { addTimeline } = require("../services/timeline.service");
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
      tower,
      unitno,
      floor,
      price,
      area,
      status,
      bedrooms,
      bathrooms,
      garage,
      furnishing,
      remarks,
      backprojectid,
      userid
    } = req.body;
    
    const images = req.files
    ? req.files.map(file => file.filename)
    : [];
    const imagesJson = JSON.stringify(images);

    const insertQuery = `
      INSERT INTO ${table_inventory}
      (
        uniqueid,
        projectid,
        tower,
        unit_no,
        floor,
        area,
        bedrooms,
        bathrooms,
        status,
        price,
        garage,
        furnishing,
        remarks,
        images
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

     const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let uniqueid = "";

      for (let i = 0; i < 12; i++) {
        uniqueid += chars.charAt(Math.floor(Math.random() * chars.length));
      }


    const values = [
        uniqueid,
        backprojectid,
        tower,
        unitno,
        floor,
        area,
        bedrooms,
        bathrooms,
        status,
        price,
        garage,
        furnishing,
        remarks,
        imagesJson
    ];

    const [result] = await db.query(insertQuery, values);


    // timeline add
    
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
     var uniqueid2 = random;
     var userid2 = userid
     var title2 = 'Inventory Created';

     const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
      );
      // console.log(rows);
      const username = rows.length ? rows[0].name : 'Unknown';

     var description2 = `Inventory created by ${username}`;

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
      backprojectid,
      '',
      title2,
      description2
    ];

    const [result_2] = await db.query(insertQuery_2, values_2);
    // timeline add


    return res.json({
      success: true,
      message: 'Inventory added successfully'
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
    const id = req.query.id || null;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE draft = 0';
    let params = [];

    // console.log(id);
    if (id) {
      whereClause = 'WHERE projectid = ?';
      params.push(id);
    }

    const query = `
      SELECT *
      FROM ${table_inventory}
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${table_inventory}
      ${whereClause}
    `;

    params.push(limit, offset);
    

    const [rows] = await db.query(query, params);
    const [[count]] = await db.query(countQuery, id ? [id] : []);


    return res.json({
        success: true,
        data: rows,
        pagination: {
          total: count.total,
          page,
          limit,
          totalPages: Math.ceil(count.total / limit)
        }
      });

  } catch (error) {
    console.error('Project List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getById = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query(
    `SELECT * FROM ${table_inventory} WHERE uniqueid = ?`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Inventory not found" });
  }

   res.status(200).json({
      success: true,
      data: rows[0]
    });
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Inventory ID is required"
      });
    }

    const [result] = await db.query(
      `DELETE FROM ${table_inventory} WHERE uniqueid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Inventory deleted successfully"
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
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
        message: 'Inventory ID is required'
      });
    }

    const {
       tower,
      unitno,
      floor,
      price,
      area,
      status,
      bedrooms,
      bathrooms,
      garage,
      furnishing,
      remarks,
      backprojectid,
      userid
    } = req.body;

    if (!backprojectid) {
      return res.status(400).json({
        success: false,
        message: 'Backprojectid is required'
      });
    }

    // image handling

        // ✅ old images from DB
        const [oldProject] = await db.query(
          `SELECT images FROM ${table_inventory} WHERE uniqueid = ? LIMIT 1`,
          [id]
        );

        let oldImages = [];
        if (oldProject.length && oldProject[0].images) {
          oldImages = JSON.parse(oldProject[0].images);
        }

        // ✅ new uploaded images
        const newImages = req.files ? req.files.map(f => f.filename) : [];

        // ✅ removed images from frontend
        const removedImages = req.body.removedImages
          ? JSON.parse(req.body.removedImages)
          : [];

        // ✅ final images after remove + add
        let finalImages = oldImages.filter(img => !removedImages.includes(img));
        finalImages = [...finalImages, ...newImages];

        const imagesJson = JSON.stringify(finalImages);

         // ✅ OPTIONAL: delete removed image files from uploads folder
        const fs = require("fs");
        const path = require("path");

        removedImages.forEach(img => {
          const filePath = path.join(__dirname, "../../uploads/properties", img);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });

    // image handling

    

    const updateQuery = `
      UPDATE ${table_inventory}
      SET
        tower = ?,
        unit_no = ?,
        floor = ?,
        area = ?,
        bedrooms = ?,
        bathrooms = ?,
        status = ?,
        price = ?,
        garage = ?,
        furnishing = ?,
        remarks = ?,
        images = ?
      WHERE uniqueid = ?
    `;

    const values = [
      tower,
      unitno,
      floor,
      area,
      bedrooms,
      bathrooms,
      status,
      price,
      garage,
      furnishing,
      remarks,
      imagesJson,
      id
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventory not found'
      });
    }

    // Timeline
    const [rows] = await db.query(`SELECT name FROM ${table_user} WHERE uniqueid = ?`,[userid]);
    const username = rows.length ? rows[0].name : 'Unknown';
    var description2 = `Inventory updated by ${username}`;

    await addTimeline({
      userid: userid,
      propertyid:backprojectid,
      customerid: '',
      opportunityid:'',
      title: "Inventory Updated",
      description:description2
    });
    // Timeline

    return res.json({
      success: true,
      message: 'Inventory updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.duplicateinventory = async (req, res) => {
  try {
    const { id } = req.params; // existing uniqueid

    // 1. Fetch original inventory
    const [rows] = await db.query(
      `SELECT * FROM ${table_inventory} WHERE uniqueid = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Inventory not found" });
    }

    const inventory = rows[0];

    // 2. Generate new uniqueid
     const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let newUniqueId = "";

      for (let i = 0; i < 12; i++) {
        newUniqueId += chars.charAt(Math.floor(Math.random() * chars.length));
      }


    // 3. Insert duplicate record
    await db.query(
      `
      INSERT INTO ${table_inventory} (
        uniqueid,
        projectid,
        tower,
        unit_no,
        floor,
        area,
        bedrooms,
        bathrooms,
        status,
        price,
        garage,
        furnishing,
        remarks,
        images
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        newUniqueId,
        inventory.projectid,
        inventory.tower,
        inventory.unit_no,
        inventory.floor,
        inventory.area,
        inventory.bedrooms,
        inventory.bathrooms,
        inventory.status,
        inventory.price,
        inventory.garage,
        inventory.furnishing,
        inventory.remarks,
        '[]'
      ]
    );

    res.status(200).json({
      success: true,
      message: "Inventory duplicated successfully",
      new_uniqueid: newUniqueId
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate inventory"
    });
  }
};

exports.inventorydash = async (req, res) => {

   try {
    const { id } = req.params;


    const [rows] = await db.query(
      `
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(expectedvalue), 0) AS total_amount,

        SUM(CASE WHEN status = 'Won'  THEN 1 ELSE 0 END) AS won_count,
        COALESCE(SUM(CASE WHEN status = 'Won'  THEN expectedvalue ELSE 0 END), 0) AS won_amount,

        SUM(CASE WHEN status = 'Lost' THEN 1 ELSE 0 END) AS lost_count,
        COALESCE(SUM(CASE WHEN status = 'Lost' THEN expectedvalue ELSE 0 END), 0) AS lost_amount

      FROM opportunity
      WHERE projectid = ?
      `,
      [id]
    );





     res.status(200).json({
      success: true,
      message: "Inventory data successfully",
      row:rows
    });

   }catch (error) {
    // console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed inventory dashboard"
    });
  }

};


exports.importInventory = async (req, res) => {
  const { uniqueid, opportunityid } = req.body;
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  const rows = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  try {

    /* =========================
       CSV FILE HANDLING
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
       XLSX FILE HANDLING
    ========================= */
    else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet, {
        defval: '', // prevent null
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
       UNSUPPORTED FILE
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
      // console.log(r);

      // Example insert (enable when ready)
      
      let internalid = '';
      for (let i = 0; i < 12; i++) {
        internalid += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await db.query(
        `INSERT INTO ${table_inventory} (
          uniqueid,
          projectid,
          tower,
          unit_no,
          floor,
          area,
          bedrooms,
          bathrooms,
          status,
          price,
          garage,
          furnishing,
          remarks
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          internalid,
          opportunityid,
          r.tower || '',
          r.unit_no || '',
          r.floor || '',
          r.area || '',
          r.bedrooms || '',
          r.bathrooms || '',
          r.status || '',
          r.price || '',
          r.garage || '',
          r.furnishing || '',
          r.remarks || ''
        ]
      );
      
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