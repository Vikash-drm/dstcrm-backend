const db = require("../config/db.config");
const table_customer = 'customers';
const table_user = 'users';
const { addTimeline } = require("../services/timeline.service");


exports.bulkassign = async (req, res) => {
    try {
        const { customerIds, assignUser, assignBy } = req.body;

        if (!Array.isArray(customerIds) || customerIds.length === 0 || !assignUser || !assignBy) {
        return res.status(400).json({ message: 'Invalid data' });
        }

        await db.query(
        `UPDATE ${table_customer}
        SET assignuser = ?
        , assignbyuser = ?
        WHERE internalid IN (?)`,
        [assignUser,assignBy, customerIds]
        );

        // Timeline
            for (const customerId of customerIds) {
                const [rows] = await db.query(
                    `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
                    [assignBy]
                );

                const username = rows.length ? rows[0].name : 'Unknown';

                await addTimeline({
                    userid: assignBy,
                    propertyid: '',
                    customerid: customerId,
                    opportunityid:'',
                    title: 'Job Assigned',
                    description: `Customer assigned by ${username}`
                });
            }
        // Timeline

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }

};

exports.unassign = async (req, res) => {
  try {
    const { id,changeby } = req.params;

    if (!id || !changeby) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    const [result] = await db.query(
        `UPDATE ${table_customer}
        SET assignuser = ''
        , assignbyuser = ''
        WHERE internalid = ?`,
        [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    // Timeline
    const [rows] = await db.query(
        `SELECT name FROM ${table_user} WHERE uniqueid = ?`,
        [changeby]
    );

    const username = rows.length ? rows[0].name : 'Unknown';

    await addTimeline({
        userid: changeby,
        propertyid: '',
        customerid: id,
        opportunityid:'',
        title: 'Job UnAssigned',
        description: `Customer Unassigned by ${username}`
    });
    // Timeline

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