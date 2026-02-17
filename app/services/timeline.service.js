const db = require("../config/db.config"); 
const table_timeline = 'timeline';

exports.addTimeline = async ({
  userid,
  propertyid = "",
  customerid = "",
  opportunityid = "",
  title = "",
  description = ""
}) => {
  const uniqueid = Math.random().toString(36).substring(2, 8).toUpperCase();

  const insertQuery = `
    INSERT INTO ${table_timeline}
    (uniqueid, userid, propertyid, customerid, opportunityid, title, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [uniqueid, userid, propertyid, customerid, opportunityid, title, description];

  const [result] = await db.query(insertQuery, values);
  return result;
};
