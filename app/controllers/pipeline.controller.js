const db = require("../config/db.config");
const table_pipeline = 'pipelines';
const table_opportunity = 'opportunity';
const table_customers = 'customers';
const table_projects = 'projects';
const table_task = 'tasks';
const { addTimeline } = require("../services/timeline.service");
const table_user = 'users';
const table_log = 'logs';
const table_comment = 'logcomments';
const fs = require('fs');
const path = require('path');


// pipeline
exports.list = async (req, res) => {

  try {

    const query = `
      SELECT uniqueid,name,created_at FROM ${table_pipeline}
      ORDER BY id ASC
    `;
    
    const [rows] = await db.query(query);


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

exports.renamepipeline = async (req, res) => {
  try {

    const {
      userid,
      title,
      id
    } = req.body;

    if (!title && !id) {
      return res.status(400).json({
        success: false,
        message: 'title and id is required'
      });
    }

    if(title==''){
      title = 'Untitled'
    }

    const updateQuery = `
      UPDATE ${table_pipeline}
      SET
        name = ?
      WHERE uniqueid = ?
    `;

    const values = [
      title,
      id
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Pipeline',
        description: `Pipeline updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'Pipeline updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// opportunity

exports.addopportunity = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      userid,
      projectid,
      customerid,
      description,
      tags,
      pipelineid,
      expectedclosedate,
      expectedvalue,
      paymentterm,
      track
    } = req.body;


    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    var strtags = tags.toString();

    const insertQuery = `
      INSERT INTO ${table_opportunity}
      (
        uniqueid,
        userid,
        projectid,
        customerid,
        description,
        tags,
        pipelineid,
        expectedclosedate,
        expectedvalue,
        paymentterm,
        track
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      internalid,
      userid,
      projectid,
      customerid,
      description,
      strtags,
      pipelineid,
      expectedclosedate,
      expectedvalue,
      paymentterm,
      track
    ];

    const [result] = await db.query(insertQuery, values);


   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: projectid,
        customerid: customerid,
        opportunityid:'',
        title: 'New Opportunity',
        description: `New Opportunity added by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'opportunity added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.opportunitylist = async (req, res) => {

    const { id } = req.params;
    const {
      sort = 'created_at',
      dir = 'asc',
      tag = 'Open',
      milestoneid = '',
      filtertag = '',
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (pageNum - 1) * pageSize;


    const allowedSort = {
      customername: 'c.fullname',
      expectedvalue: 'o.expectedvalue',
      owner: 'u.name',
      expectedclosedate: 'o.expectedclosedate',
      created_at: 'o.created_at',
      lastcontacton: 'o.updated_at'
    };

    let orderBy = '';
    const sortDir = dir === 'desc' ? 'DESC' : 'ASC';

    if (sort === 'milestone' && milestoneid) {
      // 🔥 Priority ordering
      orderBy = `
        ORDER BY (o.pipelineid = '${milestoneid}') DESC, o.created_at ${sortDir}
      `;
      // orderParams.push(milestoneid);
    } else {
      const sortColumn = allowedSort[sort] || 'o.created_at';
      orderBy = `ORDER BY ${sortColumn} ${sortDir}`;
    }

    // const sortColumn = allowedSort[sort] || 'o.created_at';


    try{

    const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [tag];


    if (!allowedRoles.includes(role)) {
      userCondition = 'AND o.userid = ?';
      params.push(id);
    }

    let userCondition2 = '';

    if (filtertag) {
      const cleanTag = filtertag.trim(); 
      userCondition2 = 'AND o.tags LIKE ?';
      params.push(`%${cleanTag}%`);
    }

    let userCondition3 = '';

    if (sort != 'milestone' && milestoneid) {
      userCondition3 = 'AND o.pipelineid = ?';
      params.push(milestoneid);
    }

    
 
    
    const query = `
      SELECT 
        o.uniqueid,
        o.userid,
        o.projectid,
        p.projectname AS projectname,
        o.customerid,
        c.fullname AS fullname,
        c.internalid AS customerinternalid,
        o.description,
        o.tags,
        o.pipelineid,
        o.expectedclosedate,
        o.expectedvalue,
        o.paymentterm,
        o.track,
        o.created_at,
        o.updated_at,
        o.statusreason,
        u.name AS owner
      FROM ${table_opportunity} o
      LEFT JOIN customers c ON c.internalid = o.customerid
      LEFT JOIN projects p ON p.uniqueid = o.projectid
      LEFT JOIN users u ON u.uniqueid = o.userid
      WHERE o.status = ?
      ${userCondition}
      ${userCondition2}
      ${userCondition3}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);


    const [rows] = await db.query(query, params);


    // count
    const query2 = `
    SELECT COUNT(*) AS closed_last_30_days
    FROM ${table_opportunity}
    WHERE status = 'Won'
    AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
    `;
    const [rows2] = await db.query(query2);
    // count

    // tag
    var tagcondition = '';
    if (!allowedRoles.includes(role)) {
      tagcondition = `WHERE o.userid = '${id}'`;
    }
    const querytag = `
      SELECT DISTINCT
        o.tags
      FROM ${table_opportunity} o
      ${tagcondition}
    `;

    const [rowstag] = await db.query(querytag);
    var mergedTags ='';
    if(rowstag){
      var mergedTags = [
        ...new Set(
          rowstag
            .map(r => r.tags)               // get tags string
            .filter(t => t && t.trim())     // remove empty/null
            .flatMap(t => t.split(','))     // split comma
            .map(t => t.trim())             // trim spaces
        )
      ].join(', ');
    }
    // tag


    // count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${table_opportunity} o
      WHERE o.status = ?
      ${userCondition}
      ${userCondition2}
      ${userCondition3}
    `;

    const countParams = params.slice(0, params.length - 2);
    const [[{ total }]] = await db.query(countQuery, countParams);

    // count

    return res.json({
        success: true,
        data: rows,
        data2: rows2,
        alltags: mergedTags,
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize)
        },
      });

  } catch (error) {
    console.error('opportunity List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};

exports.opportunitylist2 = async (req, res) => {

    const { id } = req.params;
    const {
      sort = 'created_at',
      dir = 'asc',
      tag = 'Open',
      milestoneid = '',
      filtertag = '',
      page = 1,
      limit = 10
    } = req.query;

    const pageNum = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);
    const offset = (pageNum - 1) * pageSize;


    const allowedSort = {
      customername: 'c.fullname',
      expectedvalue: 'o.expectedvalue',
      owner: 'u.name',
      expectedclosedate: 'o.expectedclosedate',
      created_at: 'o.created_at',
      lastcontacton: 'o.updated_at'
    };

    let orderBy = '';
    const sortDir = dir === 'desc' ? 'DESC' : 'ASC';

    if (sort === 'milestone' && milestoneid) {
      // 🔥 Priority ordering
      orderBy = `
        ORDER BY (o.pipelineid = '${milestoneid}') DESC, o.created_at ${sortDir}
      `;
      // orderParams.push(milestoneid);
    } else {
      const sortColumn = allowedSort[sort] || 'o.created_at';
      orderBy = `ORDER BY ${sortColumn} ${sortDir}`;
    }

    // const sortColumn = allowedSort[sort] || 'o.created_at';


    try{

    const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [tag];


    if (!allowedRoles.includes(role)) {
      userCondition = 'AND o.userid = ?';
      params.push(id);
    }

    let userCondition2 = '';

    if (filtertag) {
      const cleanTag = filtertag.trim(); 
      userCondition2 = 'AND o.tags LIKE ?';
      params.push(`%${cleanTag}%`);
    }

    let userCondition3 = '';

    if (sort != 'milestone' && milestoneid) {
      userCondition3 = 'AND o.pipelineid = ?';
      params.push(milestoneid);
    }

    
 
    
    const query = `
      SELECT 
        o.uniqueid,
        o.userid,
        o.projectid,
        p.projectname AS projectname,
        o.customerid,
        c.fullname AS fullname,
        c.internalid AS customerinternalid,
        o.description,
        o.tags,
        o.pipelineid,
        o.expectedclosedate,
        o.expectedvalue,
        o.paymentterm,
        o.track,
        o.created_at,
        o.updated_at,
        o.statusreason,
        u.name AS owner
      FROM ${table_opportunity} o
      LEFT JOIN customers c ON c.internalid = o.customerid
      LEFT JOIN projects p ON p.uniqueid = o.projectid
      LEFT JOIN users u ON u.uniqueid = o.userid
      WHERE o.status = ?
      ${userCondition}
      ${userCondition2}
      ${userCondition3}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);


    const [rows] = await db.query(query, params);


    const query2 = `
    SELECT COUNT(*) AS closed_last_30_days
    FROM ${table_opportunity}
    WHERE status = 'Won'
    AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY);
    `;
    const [rows2] = await db.query(query2);


    
    // totalvalue
    var tagcondition1 = '';
    if (!allowedRoles.includes(role)) {
      tagcondition1 = `AND userid = '${id}'`;
    }

      const query3 = `
    SELECT SUM(expectedvalue) AS totalvalue
    FROM ${table_opportunity}
      WHERE status NOT IN ('Won', 'Lost')
      ${tagcondition1}
    `;
    const [rows3] = await db.query(query3);
    // totalvalue


    // tag
    var tagcondition = '';
    if (!allowedRoles.includes(role)) {
      tagcondition = `WHERE o.userid = '${id}'`;
    }
    const querytag = `
      SELECT DISTINCT
        o.tags
      FROM ${table_opportunity} o
      ${tagcondition}
    `;

    const [rowstag] = await db.query(querytag);
    var mergedTags ='';
    if(rowstag){
      var mergedTags = [
        ...new Set(
          rowstag
            .map(r => r.tags)               // get tags string
            .filter(t => t && t.trim())     // remove empty/null
            .flatMap(t => t.split(','))     // split comma
            .map(t => t.trim())             // trim spaces
        )
      ].join(', ');
    }
    // tag


    // count
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM ${table_opportunity} o
      WHERE o.status = ?
      ${userCondition}
      ${userCondition2}
      ${userCondition3}
    `;

    const countParams = params.slice(0, params.length - 2);
    const [[{ total }]] = await db.query(countQuery, countParams);

    // count

    return res.json({
        success: true,
        data: rows,
        data2: rows2,
        data3: rows3,
        alltags: mergedTags,
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          totalPages: Math.ceil(total / pageSize)
        },
      });

  } catch (error) {
    console.error('opportunity List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};


exports.updatepipeline = async (req, res) => {
  try {

    const {
      opportunityId,
      pipelineId,
      userid
    } = req.body;

    if (!opportunityId && !pipelineId) {
      return res.status(400).json({
        success: false,
        message: 'opportunityId and pipelineId is required'
      });
    }

    const updateQuery = `
      UPDATE ${table_opportunity}
      SET
        pipelineid = ?
      WHERE uniqueid = ?
    `;

    const values = [
      pipelineId,
      opportunityId
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Opportunity',
        description: `Opportunity updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.updatemultipipeline = async (req, res) => {
  try {

    const {
      opportunityIds,
      pipelineId,
      userid
    } = req.body;

    if (!opportunityIds && !pipelineId) {
      return res.status(400).json({
        success: false,
        message: 'opportunityIds and pipelineId is required'
      });
    }

    const updateQuery = `
      UPDATE ${table_opportunity}
      SET
        pipelineid = ?
      WHERE uniqueid IN (?)
    `;

    const values = [
      pipelineId,
      opportunityIds
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Opportunity',
        description: `Opportunity updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.assginmultiuseropp = async (req, res) => {
  try {

    const {
      customerIds,
      assignUser,
      assignBy
    } = req.body;


    const updateQuery = `
      UPDATE ${table_opportunity}
      SET
        userid = ?
      WHERE uniqueid IN (?)
    `;

    const values = [
      assignUser,
      customerIds
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'opportunity not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [assignBy]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: assignBy,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Opportunity',
        description: `Opportunity updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.multiAddtag = async (req, res) => {
  try {

    const {
      tags,
      opportunityIds,
      assignBy
    } = req.body;

    const [rows1] = await db.query(
      `SELECT uniqueid, tags FROM ${table_opportunity} WHERE uniqueid IN (?)`,
      [opportunityIds]
    );

    const normalizeTags = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(t => t.trim());
      if (typeof val === 'string')
        return val.split(',').map(t => t.trim()).filter(Boolean);
      return [];
    };


    const updates = rows1.map(row => {
      const existingTags = normalizeTags(row.tags);
      const newTags = normalizeTags(tags);

      const mergedTags = [...new Set([...existingTags, ...newTags])].join(', ');

      return [mergedTags, row.uniqueid];
    });




   const updateQuery = `
      UPDATE ${table_opportunity}
      SET tags = ?
      WHERE uniqueid = ?
    `;

    await Promise.all(
      updates.map(([mergedTags, id]) =>
        db.query(updateQuery, [mergedTags, id])
      )
    );



    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [assignBy]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: assignBy,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Tags',
        description: `Tags updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'tags updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.multideletetag = async (req, res) => {
  try {

    const {
      opportunityIds,
      assignBy
    } = req.body;


    // delete logs
    await db.query(
      `DELETE FROM ${table_log} WHERE opportunityid IN (?)`,
      [opportunityIds]
    );

    // delete log comments (if same table, otherwise change table name)
    await db.query(
      `DELETE FROM ${table_log} WHERE opportunityid IN (?)`,
      [opportunityIds]
    );

    // delete opportunities
    await db.query(
      `DELETE FROM ${table_opportunity} WHERE uniqueid IN (?)`,
      [opportunityIds]
    );


    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};




exports.opportunitygetById = async (req, res) => {
  const { id } = req.params;

  const [rows] = await db.query(
    `SELECT * FROM ${table_opportunity} WHERE uniqueid = ?`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ message: "Opportunity not found" });
  }

  const [rows2] = await db.query(
    `SELECT fullname,phone,internalid FROM ${table_customers} WHERE internalid = ?`,
    [rows[0].customerid]
  );

  const [rows3] = await db.query(
    `SELECT uniqueid,projectname FROM ${table_projects} WHERE uniqueid = ?`,
    [rows[0].projectid]
  );

   res.status(200).json({
      success: true,
      data: rows[0],
      customer:rows2[0],
      project: rows3[0]
    });
};

exports.updateopportunity = async (req, res) => {
  try {

    const {
      userid,
      projectid,
      customerid,
      description,
      tags,
      pipelineid,
      expectedclosedate,
      expectedvalue,
      paymentterm,
      track,
      opportunityid
    } = req.body;

    if(tags){
      var strtags = tags.toString();
    }

    const updateQuery = `
      UPDATE ${table_opportunity}
      SET
        projectid = ?,
        customerid = ?,
        description = ?,
        tags = ?,
        pipelineid = ?,
        expectedclosedate = ?,
        expectedvalue = ?,
        paymentterm = ?,
        track = ?
      WHERE uniqueid = ?
    `;

    const values = [
      projectid,
      customerid,
      description,
      strtags,
      pipelineid,
      expectedclosedate,
      expectedvalue,
      paymentterm,
      track,
      opportunityid
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'opportunity not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Opportunity',
        description: `Opportunity updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.deleteopportunity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "opportunity ID is required"
      });
    }

    const [logimg] = await db.query(
      `SELECT attachfiles FROM ${table_log} WHERE opportunityid = ?`,
      [id]
    );

    /* ---- Delete images ONLY if they exist ---- */
    let images = [];
    if (logimg[0]?.attachfiles) {
      try {
        images = JSON.parse(logimg[0].attachfiles);
      } catch (e) {
        images = [];
      }
    }

    images.forEach(img => {
      if (img?.filename) {
        const filePath = path.join('uploads/logs', img.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // silently delete
        }
      }
    });
    /* ---- Delete images ONLY if they exist ---- */



    const [logs] = await db.query(
      `DELETE FROM ${table_log} WHERE opportunityid = ?`,
      [id]
    );

    const [logcomments] = await db.query(
      `DELETE FROM ${table_log} WHERE opportunityid = ?`,
      [id]
    );

    const [result] = await db.query(
      `DELETE FROM ${table_opportunity} WHERE uniqueid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "opportunity not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "opportunity deleted successfully"
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

exports.updatestatus = async (req, res) => {
  try {

    const {
      opportunityId,
      type,
      reason,
      userid,
      opportunityIds
    } = req.body;


    if(opportunityIds){
      var updateQuery = `
        UPDATE ${table_opportunity}
        SET
          status = ?,
          statusreason = ?
        WHERE uniqueid IN (?)
      `;
      var values = [
        type,
        reason,
        opportunityIds
      ];
    }

    if(opportunityId){
      var updateQuery = `
        UPDATE ${table_opportunity}
        SET
          status = ?,
          statusreason = ?
        WHERE uniqueid = ?
      `;
      var values = [
        type,
        reason,
        opportunityId
      ];
    }


    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Opportunity Status',
        description: `Opportunity Status updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// task

exports.addtask = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      userid,
      opportunityid,
      taskdescription,
      taskadditional,
      duetype,
      selectedDate,
      tasktime,
      taskcategory,
      contactid
    } = req.body;


    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const insertQuery = `
      INSERT INTO ${table_task}
      (
        uniqueid,
        userid,
        opportunityid,
        contactid,
        description,
        additional,
        due,
        duedate,
        tasktime,
        category      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      internalid,
      userid,
      opportunityid,
      contactid,
      taskdescription,
      taskadditional,
      duetype,
      selectedDate,
      tasktime,
      taskcategory
    ];

    const [result] = await db.query(insertQuery, values);


   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: contactid,
        opportunityid:opportunityid,
        title: 'New Task',
        description: `New Task added by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'task added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.tasklist = async (req, res) => {

    const { id,grouped,customerId } = req.params;

    try{

    const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [];


    
    let query = '';

  if(customerId=='no'){

        const getGrouped = grouped;

        if (getGrouped=='1') {
          
        if (!allowedRoles.includes(role)) {
          userCondition = 'AND t.userid = ?';
          params.push(id);
        }
          query = `
            SELECT 
              t.*
            FROM ${table_task} t
            INNER JOIN (
              SELECT 
                opportunityid,
                MIN(duedate) AS first_duedate
              FROM ${table_task} t
                WHERE completed = 0
              ${userCondition}
              GROUP BY opportunityid
            ) first_tasks
              ON first_tasks.opportunityid = t.opportunityid
            AND first_tasks.first_duedate = t.duedate
              WHERE t.completed = 0
            ORDER BY t.duedate ASC
          `;
        } else {
          params.push(getGrouped);
          
        if (!allowedRoles.includes(role)) {
          userCondition = 'AND o.userid = ?';
          params.push(id);
        }
          query = `
            SELECT *
            FROM ${table_task} o
            WHERE opportunityid = ?
            ${userCondition}
            ORDER BY o.duedate ASC
          `;
        }

  }else{

    // if customerId present
        
     params.push(customerId);

      if (!allowedRoles.includes(role)) {
        userCondition = 'AND o.userid = ?';
        params.push(id);
      }

        query = `
          SELECT *
          FROM ${table_task} o
          WHERE contactid = ?
          ${userCondition}
          ORDER BY o.duedate ASC
        `;
        
        
      }
      
      let [rows] = await db.query(query, params);



    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    console.error('opportunity List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};

exports.alltasklist = async (req, res) => {

    const { id } = req.params;

    try{

    const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [];
    
    let query = '';

    if (!allowedRoles.includes(role)) {
      userCondition = 'AND t.userid = ?';
      params.push(id);
    }
    query = `
      SELECT 
        t.*
      FROM ${table_task} t
      WHERE t.completed = 0
        ${userCondition}
      ORDER BY t.duedate ASC
    `;


      
      let [rows] = await db.query(query, params);

    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    console.error('task Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};

exports.completetask = async (req, res) => {
  try {

    const {
      opportunityId,
      taskid,
      userid,
      completed
    } = req.body;

    if (!opportunityId && !taskid) {
      return res.status(400).json({
        success: false,
        message: 'opportunityId and taskid is required'
      });
    }

    const updateQuery = `
      UPDATE ${table_task}
      SET
      completed = ${completed}
      WHERE uniqueid = ?
    `;

    const values = [
      taskid
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'tasks not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:'',
        title: 'Update Task',
        description: `Task updated by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'task updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.updatetask = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      taskid,
      userid,
      opportunityid,
      taskdescription,
      taskadditional,
      duetype,
      selectedDate,
      tasktime,
      taskcategory,
    } = req.body;


    const updateQuery = `
      UPDATE ${table_task}
      SET
        description = ?,
        additional = ?,
        due = ?,
        duedate = ?,
        tasktime = ?,
        category = ?
      WHERE uniqueid = ?
    `;

    const values = [
      taskdescription,
      taskadditional,
      duetype,
      selectedDate,
      tasktime,
      taskcategory,
      taskid
    ];

    const [result] = await db.query(updateQuery, values);


   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:opportunityid,
        title: 'Update Task',
        description: `Task updated by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'task updated successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.deletetask = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "log ID is required"
      });
    }
    

    const [result] = await db.query(
      `DELETE FROM ${table_task} WHERE uniqueid = ?`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: "task deleted successfully"
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// logs

exports.addlog = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      userid,
      opportunityid,
      customerId,
      activitytype,
      logdate,
      lognote
    } = req.body;


    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    var imagefiles = "";
    if (req.files && req.files.length) {
      imagefiles = JSON.stringify(
        req.files.map(file => ({
          original: file.originalname,
          filename: file.filename,
          size: file.size
        }))
      );
    }

    const insertQuery = `
      INSERT INTO ${table_log}
      (
        uniqueid,
        userid,
        opportunityid,
        contactid,
        type,
        date,
        note,
        attachfiles)
      VALUES (?, ?, ?, ?, ?, ?, ?,?)
    `;

    const values = [
      internalid,
      userid,
      opportunityid,
      customerId,
      activitytype,
      logdate,
      lognote,
      imagefiles
    ];

    const [result] = await db.query(insertQuery, values);


   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:opportunityid,
        title: 'New Log',
        description: `New Log added by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'log added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.loglist = async (req, res) => {

    const { id,grouped,customerId } = req.params;

    try{

    const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [];



    

    const getGrouped = grouped;
    let query = '';

    if(customerId=='no'){

        if (getGrouped=='1') {

          if (!allowedRoles.includes(role)) {
            userCondition = 'AND t.userid = ?';
            params.push(id);
          }

          query = `
            SELECT 
              t.*
            FROM ${table_log} t
            INNER JOIN (
              SELECT 
                opportunityid,
                MIN(date) AS first_duedate
              FROM ${table_log} t
                WHERE completed = 0
              ${userCondition}
              GROUP BY opportunityid
            ) first_tasks
              ON first_tasks.opportunityid = t.opportunityid
            AND first_tasks.first_duedate = t.date
              WHERE t.completed = 0
            ORDER BY t.date ASC
          `;
        } else {
          params.push(getGrouped);
          if (!allowedRoles.includes(role)) {
            userCondition = 'AND o.userid = ?';
            params.push(id);
          }
          query = `
            SELECT 
              o.*,
              COUNT(lc.id) AS comment_count,
              MAX(lc.created_at) AS last_comment_at
            FROM ${table_log} o
            LEFT JOIN logcomments lc
              ON lc.logid = o.uniqueid
            WHERE o.opportunityid = ?
            ${userCondition}
            GROUP BY o.uniqueid
            ORDER BY o.date DESC
          `;

        }

    }else{
     
        params.push(customerId);
        if (!allowedRoles.includes(role)) {
          userCondition = 'AND o.userid = ?';
          params.push(id);
        }
        query = `
          SELECT 
            o.*,
            COUNT(lc.id) AS comment_count,
            MAX(lc.created_at) AS last_comment_at
          FROM ${table_log} o
          LEFT JOIN logcomments lc
            ON lc.logid = o.uniqueid
          WHERE o.contactid = ?
          ${userCondition}
          GROUP BY o.uniqueid
          ORDER BY o.date DESC
        `;
        
    }

    const [rows] = await db.query(query, params);

    return res.json({
        success: true,
        data: rows,
      });

  } catch (error) {
    console.error('opportunity List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};

exports.openproject = async (req, res) => {

  try{
    const { id } = req.params;
      
    const [rows] = await db.query(
      `SELECT
        o.uniqueid            AS opportunity_id,
        o.status              AS opportunity_status,
        o.expectedclosedate   AS close_date,
        o.pipelineid          AS pipelineid,
        o.expectedvalue       AS expectedvalue,
        o.updated_at          AS updated_at,
        c.fullname            AS customer_name,
        p.projectname         AS project_name,
        p.propertydescr       AS propertydescr
      FROM ${table_opportunity} o
      LEFT JOIN ${table_customers} c ON c.internalid = o.customerid
      LEFT JOIN ${table_projects}  p ON p.uniqueid = o.projectid
      WHERE o.customerid = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(200).json({
        success: false,
        data:[],
        message: "Opportunity not found"
      });
    }

    const [rows2] = await db.query(
      `SELECT
        status,
        SUM(expectedvalue) AS total_value
      FROM ${table_opportunity}
      WHERE customerid = ?
      GROUP BY status
      `,
      [id]
    );

    res.status(200).json({
        success: true,
        data: rows,
        woncount:rows2
      });

    } catch (err) {
        res.status(500).json({
          success:false,
          data: [],
          error: err.message
        });
    }

};

exports.updatetags = async (req, res) => {
  try {

    const {
      opportunityId,
      tags,
      userid
    } = req.body;

    if (!opportunityId && !tags) {
      return res.status(400).json({
        success: false,
        message: 'opportunityId and taskid is required'
      });
    }

    var strtags = tags.toString();

    const updateQuery = `
      UPDATE ${table_opportunity}
      SET
      tags = ?
      WHERE uniqueid = ?
    `;

    const values = [
     strtags, opportunityId
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'opportunity not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:opportunityId,
        title: 'Update opportunity tags',
        description: `Tags updated in opportunity by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

exports.updatecustomertags = async (req, res) => {
  try {

    const {
      customerid,
      tags,
      userid
    } = req.body;

    if (!customerid && !tags) {
      return res.status(400).json({
        success: false,
        message: 'customerid and tags is required'
      });
    }

    var strtags = tags.toString();

    const updateQuery = `
      UPDATE ${table_customers}
      SET
      tags = ?
      WHERE internalid = ?
    `;

    const values = [
     strtags, customerid
    ];

    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'customer not found'
      });
    }


    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: customerid,
        opportunityid:'',
        title: 'Update customer tags',
        description: `Tags updated in customer by ${username}`
    });
    // Timeline



    return res.json({
      success: true,
      message: 'opportunity updated successfully'
    });

  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


exports.updatelog = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      userid,
      opportunityid,
      activitytype,
      logdate,
      lognote,
      existingImages,
      logid
    } = req.body;

    if (!logid) {
      return res.status(400).json({
        success: false,
        message: 'Log ID is required for update'
      });
    }

    // images user chose to keep
    const keepImages = existingImages
      ? JSON.parse(existingImages)
      : [];

    // fetch old images from DB
    const [oldRows] = await db.query(
      `SELECT attachfiles FROM ${table_log} WHERE uniqueid = ?`,
      [logid]
    );

    const oldImages = oldRows[0]?.attachfiles
      ? JSON.parse(oldRows[0].attachfiles)
      : [];

    // delete removed images from disk
    oldImages.forEach(img => {
      if (!keepImages.some(k => k.filename === img.filename)) {
        const filePath = `uploads/logs/${img.filename}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    // new uploaded images
    const newImages = req.files && req.files.length
      ? req.files.map(file => ({
          original: file.originalname,
          filename: file.filename,
          size: file.size
        }))
      : [];

    // final images array
    const finalImages = [
      ...oldImages.filter(img =>
        keepImages.some(k => k.filename === img.filename)
      ),
      ...newImages
    ];


    const updateQuery = `
      UPDATE ${table_log}
      SET
        type = ?,
        date = ?,
        note = ?,
        attachfiles = ?
      WHERE uniqueid = ?
    `;

    await db.query(updateQuery, [
      activitytype,
      logdate,
      lognote,
      JSON.stringify(finalImages),
      logid
    ]);



   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:opportunityid,
        title: 'Log Updated',
        description: `Log Updated by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'log added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.deletelog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "log ID is required"
      });
    }
    
    /* ---- Fetch log (only to get images) ---- */
    const [rows] = await db.query(
      `SELECT attachfiles FROM ${table_log} WHERE uniqueid = ?`,
      [id]
    );

     /* ---- Delete images ONLY if they exist ---- */
    let images = [];
    if (rows[0].attachfiles) {
      try {
        images = JSON.parse(rows[0].attachfiles);
      } catch (e) {
        images = [];
      }
    }

    images.forEach(img => {
      if (img?.filename) {
        const filePath = path.join('uploads/logs', img.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // silently delete
        }
      }
    });

    const [resultlogcomment] = await db.query(
      `DELETE FROM ${table_comment} WHERE logid = ?`,
      [id]
    );

    const [result] = await db.query(
      `DELETE FROM ${table_log} WHERE uniqueid = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "log not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "log deleted successfully"
    });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// comment

exports.addcomment = async (req, res) => {


    try {

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: 'Request body is empty.'
      });
    }

    const {
      userid,
      opportunityid,
      contactid,
      logid,
      comment
    } = req.body;


    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let internalid = "";

    for (let i = 0; i < 12; i++) {
      internalid += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const insertQuery = `
      INSERT INTO ${table_comment}
      (
        uniqueid,
        userid,
        opportunityid,
        contactid,
        logid,
        comment)
      VALUES (?, ?, ?, ?, ?,?)
    `;

    const values = [
      internalid,
      userid,
      opportunityid,
      contactid,
      logid,
      comment
    ];

    const [result] = await db.query(insertQuery, values);


   // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [userid]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: userid,
        propertyid: '',
        customerid: '',
        opportunityid:opportunityid,
        title: 'New Comment',
        description: `New Comment added by ${username}`
    });
    // Timeline


    return res.json({
      success: true,
      message: 'comment added successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }


}

exports.commentlist = async (req, res) => {

    const { id,opportunityid,customerId } = req.params;

    try{

    const [rows1] = await db.query(
      `SELECT name,role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';

    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';

    let params = [];

    if (!allowedRoles.includes(role)) {
      userCondition = 'AND userid = ?';
      params.push(id);
    }
    
    let query = '';

    if(customerId=='no'){
      params.push(opportunityid);
      query = `
        SELECT 
          o.*,
          u.name AS user_name
        FROM ${table_comment} o
        INNER JOIN ${table_user} u
          ON u.uniqueid = o.userid
        WHERE o.opportunityid = ?
        ${userCondition}
        ORDER BY o.created_at DESC
      `;
    }else{
      params.push(customerId);
      query = `
        SELECT 
          o.*,
          u.name AS user_name
        FROM ${table_comment} o
        INNER JOIN ${table_user} u
          ON u.uniqueid = o.userid
        WHERE o.contactid = ?
        ${userCondition}
        ORDER BY o.created_at DESC
      `;

    }




    const [rows] = await db.query(query, params);
    return res.json({
        success: true,
        data: rows
      });

  } catch (error) {
    console.error('comment List Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }

};


// dashboard
exports.getpipelinedashboard = async (req, res) => {
  try {

    const { id } = req.params;

     const [rows1] = await db.query(
      `SELECT role FROM ${table_user} WHERE uniqueid = ?`,
      [id]
    );

    const role = rows1.length ? rows1[0].role : '';
    const allowedRoles = ['DST', 'COO', 'CrmManager'];

    let userCondition = '';
    let params = [];

    if (!allowedRoles.includes(role)) {
        userCondition = `AND o.userid = '${id}'`;
        params.push(id);
    }


    const query = `
      SELECT
        p.uniqueid,
        p.name AS pipeline_name,
        COUNT(o.id) AS opportunity_count,
        COALESCE(SUM(o.expectedvalue), 0) AS total_expected_value
      FROM ${table_pipeline} p
      LEFT JOIN ${table_opportunity} o
        ON o.pipelineid = p.uniqueid
        WHERE o.status !='Lost' AND o.status != 'Won'
        ${userCondition}
      GROUP BY p.uniqueid, p.name
      ORDER BY p.id ASC
    `;

    const [rows] = await db.query(query);

    // Prepare chart data
    const labels = [];
    const counts = [];
    const values = [];

    rows.forEach(row => {
      labels.push(row.pipeline_name);
      counts.push(row.opportunity_count);
      values.push(Number(row.total_expected_value));
    });

    return res.json({
      success: true,
      data: rows,
      chart: {
        labels,
        counts,
        values
      }
    });

  } catch (error) {
    console.error('Pipeline Dashboard Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

