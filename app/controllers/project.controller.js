const db = require("../config/db.config");
const bcrypt = require('bcrypt');
const table_project = 'projects';
const table_timeline = 'timeline';
const table_user = 'users';
const jwt = require('jsonwebtoken'); 
const { addTimeline } = require("../services/timeline.service");



exports.add = async (req, res) => {

    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty. Multer not configured.'
      });
    }

    const {
      projectname,
      propertydescr,
      type,
      status,
      ownership,
      city,
      state,
      zip,
      address,
      notes,
      facilities,
      draft,
      rating,
      yearbuilt,
      floors,
      userid
    } = req.body;
    
    const images = req.files
    ? req.files.map(file => file.filename)
    : [];
    const imagesJson = JSON.stringify(images);


    if (!projectname) {
      return res.status(400).json({
        success: false,
        message: 'project name are required'
      });
    }

    const insertQuery = `
      INSERT INTO ${table_project}
      (
        uniqueid,
        userid,
        draft,
        projectname,
        propertydescr,
        city,
        state,
        zip,
        address,
        notes,
        facilities,
        images,
        rating,
        yearbuilt,
        propertytype,
        status,
        ownership,
        floors
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const uniqueid = Math.random().toString(20).substring(2, 8).toUpperCase();

    const values = [
        uniqueid,
        userid,
        draft,
        projectname,
        propertydescr,
        city,
        state,
        zip,
        address,
        notes,
        facilities,
        imagesJson,
        rating,
        yearbuilt,
        type,
        status,
        ownership,
        floors
    ];

    const [result] = await db.query(insertQuery, values);


    // timeline add
    
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
     var uniqueid2 = random;
     var userid2 = userid
     var propertyid2 = result.insertId;
     var customerid2 = '';
     var title2 = 'Project Created';

     const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
      );
      // console.log(rows);
      const username = rows.length ? rows[0].name : 'Unknown';

     var description2 = `Project created by ${username}`;

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
      uniqueid,
      customerid2,
      title2,
      description2
    ];

    const [result_2] = await db.query(insertQuery_2, values_2);
    // timeline add


    return res.json({
      success: true,
      message: 'project added successfully'
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

    const { type, date, search, yearbuilt, ownership, status } = req.query;


    let whereClauses = [];
    let params = [];

    if (id) {
      whereClauses.push('(draft = 0 OR (draft = 1 AND userid = ?))');
      params.push(id);
    }

    if (type) {
      whereClauses.push('propertytype = ?');
      params.push(type);
    }

    if (yearbuilt) {
      whereClauses.push('yearbuilt = ?');
      params.push( yearbuilt);
    }

    if (ownership) {
      whereClauses.push('ownership = ?');
      params.push( ownership );
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push( status );
    }

    if(search){
        whereClauses.push(`
          (
            projectname LIKE ?
          )
        `);

        params.push(
          `%${search}%`
        );
    }

    if (date) {
      whereClauses.push(`DATE(created_at) = ?`);
      params.push(date);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT *
      FROM ${table_project}
      ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;
    
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${table_project}
      ${where}
    `;

    // params.push(limit, offset);
    
    const [rows] = await db.query(query, [...params, limit, offset]);

    // const [rows] = await db.query(query, params);
    const [[count]] = await db.query(countQuery, params);


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
    `SELECT * FROM ${table_project} WHERE uniqueid = ?`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Project not found" });
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
        message: "Project ID is required"
      });
    }

      // image handling

        // ✅ old images from DB
        const [oldProject] = await db.query(
          `SELECT images FROM ${table_project} WHERE uniqueid = ?`,
          [id]
        );

        // ✅ removed images from frontend
        const removedImages =  oldProject.length && oldProject[0].images
        ? JSON.parse(oldProject[0].images)
        : [];

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

    const [result] = await db.query(
      `DELETE FROM ${table_project} WHERE uniqueid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "project not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully"
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
        message: 'Project ID is required'
      });
    }

    const {
      projectname,
      propertydescr,
      city,
      state,
      zip,
      address,
      notes,
      facilities,
      draft,
      rating,
      yearbuilt,
      userid,
      type,
      status,
      ownership,
      floors
    } = req.body;

    if (!projectname) {
      return res.status(400).json({
        success: false,
        message: 'projectname is required'
      });
    }

    // image handling

        // ✅ old images from DB
        const [oldProject] = await db.query(
          `SELECT images FROM ${table_project} WHERE uniqueid = ? LIMIT 1`,
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
      UPDATE ${table_project}
      SET
        draft = ?,
        projectname = ?,
        propertydescr = ?,
        city = ?,
        state = ?,
        zip = ?,
        address = ?,
        notes = ?,
        facilities = ?,
        images = ?,
        rating = ?,
        yearbuilt = ?,
        propertytype = ?,
        status = ?,
        ownership = ?,
        floors = ?
      WHERE uniqueid = ?
    `;

    const values = [
      draft,
      projectname,
      propertydescr,
      city,
      state,
      zip,
      address,
      notes,
      facilities,
      imagesJson,
      rating,
      yearbuilt,
      type,
      status,
      ownership,
      floors,
      id
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Timeline
    const [rows] = await db.query(`SELECT name FROM ${table_user} WHERE uniqueid = ?`,[userid]);
    const username = rows.length ? rows[0].name : 'Unknown';
    var description2 = `Project updated by ${username} (Internal source)`;

    await addTimeline({
      userid: userid,
      propertyid:id,
      customerid: '',
      opportunityid:'',
      title: "Project Updated",
      description:description2
    });
    // Timeline

    return res.json({
      success: true,
      message: 'Project updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.getByColumn = async (req, res) => {
  try {
    const allowedColumns = ['uniqueid', 'projectname','draft'];

    const requested = (req.query.data || '')
      .split(',')
      .map(c => c.trim());

    const safeColumns = requested.filter(c =>
      allowedColumns.includes(c)
    );

    if (!safeColumns.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid columns'
      });
    }

    const sql = `
      SELECT ${safeColumns.join(',')}
      FROM ${table_project} ORDER BY id DESC
    `;

    const [rows] = await db.query(sql);

    return res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('getByColumn error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

