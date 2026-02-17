const db = require("../config/db.config");
const table_opportunity = "opportunity";
const table_customers = "customers";

exports.salesanalytics = async (req, res) => {
  try {

    const [
      grossSales,
      netSales,
      dealsClosed,
      conversionRate,
      pipelineValue,
      avgSalesCycle,
      winLoss,
      lostReasons,
      forecastAccuracy,
      dealsByPropertyType
    ] = await Promise.all([

      /* 1️⃣ Gross Sales Value (KPI + Line) */
      db.query(`
        SELECT DATE(created_at) AS date,
               SUM(expectedvalue) AS total
        FROM ${table_opportunity}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `),

      /* 2️⃣ Net Sales Value (Won only) */
      db.query(`
        SELECT IFNULL(SUM(expectedvalue),0) AS total
        FROM ${table_opportunity}
        WHERE status = 'Won'
      `),

      /* 3️⃣ Deals Closed Over Time (Bar) */
      db.query(`
        SELECT DATE(updated_at) AS date,
               COUNT(*) AS total
        FROM ${table_opportunity}
        WHERE status = 'Won'
        GROUP BY DATE(updated_at)
        ORDER BY DATE(updated_at)
      `),

      /* 4️⃣ Sales Conversion Rate (KPI + Donut) */
      db.query(`
        SELECT 
          (COUNT(CASE WHEN status='Won' THEN 1 END) / COUNT(*)) * 100 AS rate
        FROM ${table_opportunity}
      `),

      /* 5️⃣ Sales Pipeline Value (Funnel) */
      db.query(`
         SELECT 
            p.uniqueid   AS pipelineid,
            p.name       AS pipelinename,
            SUM(o.expectedvalue) AS total
        FROM ${table_opportunity} o
        LEFT JOIN pipelines p 
            ON p.uniqueid = o.pipelineid
        WHERE o.status = 'Open'
        GROUP BY p.uniqueid, p.name
      `),

      /* 6️⃣ Average Sales Cycle (KPI + Line) */
      db.query(`
        SELECT 
          AVG(DATEDIFF(updated_at, created_at)) AS avg_days
        FROM ${table_opportunity}
        WHERE status = 'Won'
      `),

      /* 7️⃣ Win vs Loss Trend (Stacked Bar) */
      db.query(`
        SELECT status,
               COUNT(*) AS total
        FROM ${table_opportunity}
        GROUP BY status
      `),

      /* 8️⃣ Lost Deal Reasons (Bar) */
      db.query(`
        SELECT statusreason,
               COUNT(*) AS total
        FROM ${table_opportunity}
        WHERE status = 'Lost'
        GROUP BY statusreason
      `),

      /* 9️⃣ Sales Forecast Accuracy (Line) */
      db.query(`
        SELECT DATE(expectedclosedate) AS date,
               SUM(expectedvalue) AS forecast,
               SUM(
                 CASE WHEN status='Won'
                 THEN expectedvalue ELSE 0 END
               ) AS actual
        FROM ${table_opportunity}
        GROUP BY DATE(expectedclosedate)
        ORDER BY DATE(expectedclosedate)
      `),
      
      /* 🔟 Deals by Property Type (NEW) */
       db.query(`
        SELECT 
          propertytype,
          COUNT(*) AS total
        FROM ${table_customers}
        WHERE propertytype IS NOT NULL
        AND TRIM(propertytype) != ''
        AND LOWER(propertytype) != 'null'
        GROUP BY propertytype
      `)
    ]);

    res.json({
      grossSales: grossSales[0],
      netSales: netSales[0][0]?.total || 0,
      dealsClosed: dealsClosed[0],
      conversionRate: conversionRate[0][0]?.rate || 0,
      pipelineValue: pipelineValue[0],
      avgSalesCycle: avgSalesCycle[0][0]?.avg_days || 0,
      winLoss: winLoss[0],
      lostReasons: lostReasons[0],
      forecastAccuracy: forecastAccuracy[0],
      dealsByPropertyType: dealsByPropertyType[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Sales analytics failed" });
  }
};

exports.leadanalytics = async (req, res) => {
  try {

    const [
      totalLeads,
      leadsOverTime,
      leadsBySource,
      qualificationRate,
      leadToOpportunityRate,
      duplicateLeads,
      timeToFirstContact,
      campaignPerformance,
      leadDropOff,
      newVsReturning,
      opppile
    ] = await Promise.all([

      /* 1️⃣ Total Leads */
      db.query(`
        SELECT COUNT(*) AS total
        FROM ${table_customers}
      `),

      /* 2️⃣ Leads Over Time */
      db.query(`
        SELECT DATE(created_at) AS date,
               COUNT(*) AS total
        FROM ${table_customers}
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `),

      /* 3️⃣ Leads by Source */
      db.query(`
        SELECT source,
               COUNT(*) AS total
        FROM ${table_customers}
        WHERE source IS NOT NULL
          AND TRIM(source) != ''
        GROUP BY source
      `),

      /* 4️⃣ Lead Qualification Rate */
      db.query(`
       SELECT
        COUNT(DISTINCT c.id) AS total_customers,
        COUNT(DISTINCT CASE WHEN o.status = 'Open' THEN c.id END) AS qualified_customers
        FROM customers c
        LEFT JOIN opportunity o
        ON c.id = o.customerid;

      `),

      /* 5️⃣ Lead to Opportunity Rate */
      db.query(`
        SELECT
        (COUNT(CASE WHEN o.customerid IS NOT NULL THEN 1 END) / COUNT(*)) * 100 AS rate
        FROM ${table_customers} c
        LEFT JOIN ${table_opportunity} o
        ON c.id = o.customerid;
      `),

      /* 6️⃣ Duplicate / Junk Leads */
      db.query(`
        SELECT
        COUNT(*) AS duplicates,
        (SELECT COUNT(*) FROM ${table_customers}) AS total
        FROM ${table_customers}
        WHERE duplicate IS NOT NULL
        AND TRIM(duplicate) != ''
        AND TRIM(duplicate) != '[]';
      `),

      /* 7️⃣ Time to First Contact */
      db.query(`
        SELECT
        AVG(TIMESTAMPDIFF(MINUTE, created_at, updated_at)) / 60 AS avg_hours
        FROM ${table_customers}
        WHERE updated_at > created_at;

      `),

      /* 8️⃣ Campaign Performance */
      db.query(`
        SELECT
          source AS campaign,
          COUNT(*) AS total
        FROM ${table_customers}
        GROUP BY source
      `),

      /* 9️⃣ Lead Drop-off Stages */
      db.query(`
       SELECT
        o.status AS customer_status,
        COUNT(DISTINCT c.internalid) AS total_customers,
        COUNT(DISTINCT CASE WHEN o.status = 'Lost' THEN c.internalid END) AS lost_customers
        FROM ${table_customers} c
        LEFT JOIN ${table_opportunity} o
        ON c.internalid = o.customerid
        GROUP BY o.status;

      `),

      /* 🔟 New vs Returning Leads */
      db.query(`
        SELECT
          IF(cnt > 1, 'Returning', 'New') AS type,
          COUNT(*) AS total
        FROM (
          SELECT email, COUNT(*) AS cnt
          FROM ${table_customers}
          GROUP BY email
        ) t
        GROUP BY type
      `),
       db.query(`
       SELECT
    p.name AS pipeline_name,
    COUNT(DISTINCT o.customerid) AS customers_count
FROM opportunity o
JOIN pipelines p
    ON o.pipelineid = p.uniqueid
GROUP BY p.name
ORDER BY customers_count DESC;

      `)
    ]);

    res.json({
      totalLeads: totalLeads[0][0]?.total || 0,
      leadsOverTime: leadsOverTime[0],
      leadsBySource: leadsBySource[0],
      qualificationRate: qualificationRate[0][0],
      leadToOpportunityRate: leadToOpportunityRate[0][0]?.rate || 0,
      duplicateLeads: duplicateLeads[0][0],
      timeToFirstContact: timeToFirstContact[0][0]?.avg_hours || 0,
      campaignPerformance: campaignPerformance[0],
      leadDropOff: leadDropOff[0],
      newVsReturning: newVsReturning[0],
      opppile:opppile[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lead analytics failed' });
  }
};

exports.teamAnalytics = async (req, res) => {
  try {
    const [
      totalActiveMembers,
      lowActivityUsersCount,
      workloadDistribution,
      activityScore,
      conversionRate,
      revenueContribution,
      responseTimeRanking,
      followupCompliance,
      lowActivityUsers,
      topPerformers,
      trainingRequirementIndex
    ] = await Promise.all([

      // 1️⃣ Total Active Team Members
      db.query(`SELECT COUNT(*) AS total FROM users WHERE role != 'DST' AND online=1 `),

      // low activity
      db.query(`SELECT COUNT(*) AS total FROM users WHERE role != 'DST' AND online=0 `),

      // 2️⃣ Workload Distribution (tasks assigned)
      db.query(`
        SELECT u.name AS user, COUNT(t.id) AS count
        FROM users u
        LEFT JOIN tasks t ON u.uniqueid = t.userid AND completed = 0
        GROUP BY u.name
      `),

      // 3️⃣ Activity Score by User
      db.query(`
        SELECT u.name AS user, COUNT(t.id) AS count
        FROM users u
        LEFT JOIN tasks t ON u.uniqueid = t.userid AND completed = 1
        GROUP BY u.name
      `),

      // 4️⃣ Conversion Rate by User
      db.query(`
      SELECT 
          u.name AS user,
          (COUNT(CASE WHEN o.status='Won' THEN 1 END) * 100.0 / COUNT(o.userid)) AS conversion_rate
      FROM users u
      LEFT JOIN opportunity o ON u.uniqueid = o.userid
      GROUP BY u.name
      `),

      // 5️⃣ Revenue Contribution by User
      db.query(`
        SELECT 
            u.name AS user, 
            SUM(o.expectedvalue) AS amount
        FROM users u
        LEFT JOIN opportunity o ON u.uniqueid = o.userid AND o.status = 'Won'
        GROUP BY u.name
      `),

      // 6️⃣ opporunity close in days
      db.query(`
       SELECT 
          u.name AS user,
          ROUND(AVG(DATEDIFF(o.updated_at, o.created_at)), 2) AS avg_days_to_close
      FROM users u
      LEFT JOIN opportunity o 
          ON u.uniqueid = o.userid
          AND o.status = 'Won'       -- only consider won opportunities
      GROUP BY u.name;
      `),

      // 7️⃣ Follow-up Compliance Rate
      db.query(`
        SELECT 
          u.name AS user,
          ROUND(
            100 * SUM(CASE WHEN p.name IN ('Communication Stage', 'Meeting Stage', 'Offer Stage') 
                            THEN 1 ELSE 0 END)
            / COUNT(o.uniqueid),
            2
          ) AS middle_stage_percent
      FROM users u
      LEFT JOIN opportunity o ON u.uniqueid = o.userid
      LEFT JOIN pipelines p ON o.pipelineid = p.uniqueid
      GROUP BY u.name;
      `),

      // 8️⃣ Low Activity Users
      db.query(`
        SELECT u.name AS user, COUNT(a.userid) AS tasksCompleted
        FROM users u
        LEFT JOIN tasks a ON u.uniqueid = a.userid
        WHERE a.completed = 0
        GROUP BY u.name
      `),

      // 9️⃣ Top Performing Users
      db.query(`
        SELECT u.name AS user, SUM(o.expectedvalue) AS metric
        FROM users u
        LEFT JOIN opportunity o ON u.uniqueid = o.userid
        GROUP BY u.name
        ORDER BY metric DESC
        LIMIT 5
      `),

     
    ]);

    res.json({
      totalActiveMembers: totalActiveMembers[0][0]?.total || 0,
      lowActivityUsersCount: lowActivityUsersCount[0][0]?.total || 0,
      workloadDistribution: workloadDistribution[0],
      activityScore: activityScore[0],
      conversionRate: conversionRate[0],
      revenueContribution: revenueContribution[0],
      responseTimeRanking: responseTimeRanking[0],
      followupCompliance: followupCompliance[0],
      lowActivityUsers: lowActivityUsers[0],
      topPerformers: topPerformers[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Team analytics failed' });
  }
};

exports.clientAnalytics = async (req, res) => {
  try {

    const [
      totalClients,
      activeInactive,
      topRevenueClients,
      outstandingPayments,
      receivedPayments,
      lostPayments,
      paymentRate,
      avgDelay,
      followupKpi,
      followupTable,
      repeatRate,
      satisfaction
    ] = await Promise.all([

      db.query(`
        SELECT COUNT(DISTINCT c.internalid) AS total
        FROM customers c
        JOIN opportunity o ON c.internalid = o.customerid
        WHERE o.status = 'Won'
      `),

      db.query(`
        SELECT
          SUM(CASE WHEN o.status = 'Open' THEN 1 ELSE 0 END) AS active,
          SUM(CASE WHEN o.status = 'Lost' THEN 1 ELSE 0 END) AS inactive
        FROM customers c
        JOIN opportunity o ON c.internalid = o.customerid;

      `),

      db.query(`
        SELECT c.fullname AS client, SUM(o.expectedvalue) AS revenue
        FROM customers c
        JOIN opportunity o ON c.internalid = o.customerid
        WHERE o.status = 'Won'
        GROUP BY c.internalid
        ORDER BY revenue DESC
        LIMIT 10
      `),

      db.query(`
        SELECT 
          SUM(o.expectedvalue) AS outstanding
        FROM opportunity o
        WHERE o.status = 'Open';
      `),

      db.query(`
        SELECT 
          SUM(o.expectedvalue) AS received
        FROM opportunity o
        WHERE o.status = 'Won';
      `),

      
      db.query(`
        SELECT 
          SUM(o.expectedvalue) AS notreceived
        FROM opportunity o
        WHERE o.status = 'Lost';
      `),

      db.query(`
        SELECT
          SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) AS paid,
          SUM(CASE WHEN status != 'Won' THEN 1 ELSE 0 END) AS pending
        FROM opportunity;
      `),

      db.query(`
       SELECT 
          ROUND(AVG(DATEDIFF(updated_at, created_at)), 2) AS avg_delay
        FROM opportunity
        WHERE status = 'Won';

      `),

      db.query(`
       SELECT COUNT(*) AS total
FROM opportunity o
JOIN pipelines p ON o.pipelineid = p.uniqueid
WHERE p.name = 'Lead In Queue';

      `),

      db.query(`
        SELECT 
    c.fullname AS client,
    COUNT(o.uniqueid) AS pending
  FROM customers c
  JOIN opportunity o ON c.internalid = o.customerid
  JOIN pipelines p ON o.pipelineid = p.uniqueid
  WHERE p.name = 'Lead In Queue'
  GROUP BY c.internalid
      `),

      db.query(`
        SELECT ROUND(
          100 * COUNT(*) / (
            SELECT COUNT(DISTINCT customerid)
            FROM opportunity
            WHERE status='Won'
          ), 2
        ) AS rate
        FROM opportunity
        WHERE status='Won'
        GROUP BY customerid
        HAVING COUNT(*) > 1
      `),

      // db.query(`
      //   SELECT ROUND(AVG(rating),2) AS score
      //   FROM client_feedback
      // `)

    ]);

    res.json({
      totalClients: totalClients[0][0]?.total || 0,

      activeInactive: activeInactive[0][0] || { active: 0, inactive: 0 },

      topRevenueClients: topRevenueClients[0],

      outstandingPayments: outstandingPayments[0][0]?.outstanding || 0,
      
      receivedPayments: receivedPayments[0][0]?.received || 0,

      lostPayments: receivedPayments[0][0]?.notreceived || 0,
      

      paymentRate: paymentRate[0][0] || { paid: 0, pending: 0 },

      avgPaymentDelay: avgDelay[0][0]?.avg_delay || 0,

      followups: {
        total: followupKpi[0][0]?.total || 0,
        list: followupTable[0]
      },

      repeatPurchaseRate: repeatRate[0][0]?.rate || 0,

      // satisfactionScore: satisfaction[0][0]?.score || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Client analytics failed' });
  }
};

// telesaler
exports.executiveAnalytics = async (req, res) => {
  try {
    const { userid } = req.query;
    if (!userid) {
      return res.status(400).json({ message: 'userid required' });
    }

    const [
      revenue,
      winRate,
      avgDeal,
      forecast,
      pipeline,
      topProjects,
      lostReasons,
      cashFlow
    ] = await Promise.all([

      /* 1. Revenue MTD / YTD */
      db.query(`
        SELECT
          SUM(CASE
            WHEN MONTH(updated_at)=MONTH(CURDATE())
            AND YEAR(updated_at)=YEAR(CURDATE())
            THEN expectedvalue ELSE 0 END) AS mtd,
          SUM(CASE
            WHEN YEAR(updated_at)=YEAR(CURDATE())
            THEN expectedvalue ELSE 0 END) AS ytd
        FROM opportunity
        WHERE status='Won' AND userid='${userid}'
      `),

      /* 2. Win Rate */
      db.query(`
        SELECT ROUND(
          100 * SUM(CASE WHEN status='Won' THEN 1 ELSE 0 END) / COUNT(*),
          2
        ) AS rate
        FROM opportunity
        WHERE userid='${userid}'
      `),

      /* 3. Avg Deal Size */
      db.query(`
        SELECT ROUND(AVG(expectedvalue),2) AS avgDeal
        FROM opportunity
        WHERE status='Won' AND userid='${userid}'
      `),

      /* 4. Sales Forecast (30–90 days) */
      db.query(`
        SELECT
          CASE
            WHEN DATEDIFF(updated_at,CURDATE()) <= 30 THEN '0-30'
            WHEN DATEDIFF(updated_at,CURDATE()) <= 60 THEN '31-60'
            ELSE '61-90'
          END AS bucket,
          SUM(expectedvalue) AS value
        FROM opportunity
        WHERE status='Open'
          AND userid='${userid}'
          AND updated_at <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)
        GROUP BY bucket
      `),

      /* 5. Pipeline Funnel */
      db.query(`
        SELECT p.name AS stage, SUM(o.expectedvalue) AS value
        FROM opportunity o
        JOIN pipelines p ON o.pipelineid=p.uniqueid
        WHERE o.status='Open' AND o.userid='${userid}'
        GROUP BY p.name
      `),

      /* 6. Top Projects */
      db.query(`
        SELECT p.projectname, SUM(o.expectedvalue) AS revenue
        FROM opportunity o
        JOIN projects p ON o.projectid=p.uniqueid
        WHERE o.status='Won' AND o.userid='${userid}'
        GROUP BY projectname
        ORDER BY revenue DESC
        LIMIT 10
      `),

      /* 7. Lost Deal Reasons */
      db.query(`
        SELECT statusreason AS reason, COUNT(*) AS total
        FROM opportunity
        WHERE status='Lost' AND userid='${userid}'
        GROUP BY statusreason
      `),

      /* 8. Cash Inflow vs Outflow */
      db.query(`
        SELECT DATE(updated_at) AS date,
          SUM(CASE WHEN status='Won' THEN expectedvalue ELSE 0 END) AS inflow,
          SUM(CASE WHEN status='Lost' THEN expectedvalue ELSE 0 END) AS outflow
        FROM opportunity
        WHERE userid='${userid}'
        GROUP BY DATE(updated_at)
        ORDER BY date
      `)

    ]);

    res.json({
      revenue: revenue[0][0] || { mtd: 0, ytd: 0 },
      winRate: winRate[0][0]?.rate || 0,
      avgDealSize: avgDeal[0][0]?.avgDeal || 0,
      forecast: forecast[0],
      pipeline: pipeline[0],
      topProjects: topProjects[0],
      lostReasons: lostReasons[0],
      cashFlow: cashFlow[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Executive analytics failed' });
  }
};

// sales manager
exports.salesManagerAnalytics = async (req, res) => {
  try {

    const [
      openLeads,
      followUpsToday,
      callsToday,
      avgResponse,
      activeOpp,
      conversion,
      dealsMonth,
      pipeline,
      staleLeads,
      commission
    ] = await Promise.all([

      /* 1. Team Open Leads */
      db.query(`
        SELECT COUNT(*) AS total
        FROM opportunity
        WHERE status='Open'
      `),

      /* 2. Follow-ups Due Today */
      db.query(`
      SELECT COUNT(*) AS total
      FROM tasks t
      JOIN opportunity o ON t.opportunityid = o.uniqueid
      JOIN pipelines p ON o.pipelineid = p.uniqueid
      WHERE DATE(t.duedate) = CURDATE()
        AND t.completed = 0
        AND p.name = 'Communication Stage';

      `),

      /* 3. Calls / Meetings Today */
      db.query(`
        SELECT COUNT(*) AS total
        FROM tasks
        WHERE DATE(duedate) = CURDATE()
          AND completed = 0;
      `),

      /* 4. Avg Lead Response Time */
      db.query(`
        SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)),2) AS avgTime
        FROM opportunity
      `),

      /* 5. Active Opportunities Funnel */
      db.query(`
        SELECT p.name AS stage, COUNT(*) AS total
        FROM opportunity o
        JOIN pipelines p ON o.pipelineid=p.uniqueid
        WHERE o.status='Open'
        GROUP BY p.name
      `),

      /* 6. Conversion Rate */
      db.query(`
        SELECT
          SUM(CASE WHEN status='Won' THEN 1 ELSE 0 END) AS converted,
          SUM(CASE WHEN status='Lost' THEN 1 ELSE 0 END) AS lost
        FROM opportunity
      `),

      /* 7. Deals Closed This Month */
      db.query(`
        SELECT u.name AS user, COUNT(*) AS total
        FROM opportunity o
        JOIN users u ON o.userid=u.uniqueid
        WHERE o.status='Won'
        AND MONTH(o.updated_at)=MONTH(CURDATE())
        GROUP BY u.name
      `),

      /* 8. Pipeline Value */
      db.query(`
        SELECT p.name AS stage, SUM(o.expectedvalue) AS value
        FROM opportunity o
        JOIN pipelines p ON o.pipelineid=p.uniqueid
        WHERE o.status='Open'
        GROUP BY p.name
      `),

      /* 9. Stale Leads */
      db.query(`
        SELECT c.fullname, DATEDIFF(CURDATE(), o.created_at) AS days
        FROM opportunity o
        JOIN customers c ON o.customerid=c.internalid
        WHERE o.status='Open'
        LIMIT 10
      `),

      /* 10. Commission & Revenue */
      db.query(`
        SELECT
          DATE_FORMAT(updated_at,'%b') AS month,
          SUM(expectedvalue) AS revenue,
          SUM(expectedvalue*0.05) AS commission
        FROM opportunity
        WHERE status='Won'
        GROUP BY month
      `)

    ]);

    res.json({
      openLeads: openLeads[0][0].total,
      followUpsToday: followUpsToday[0][0].total,
      callsToday: callsToday[0][0].total,
      avgResponseTime: avgResponse[0][0].avgTime || 0,
      activeOpp: activeOpp[0],
      conversion: conversion[0][0],
      dealsMonth: dealsMonth[0],
      pipeline: pipeline[0],
      staleLeads: staleLeads[0],
      commission: commission[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Sales manager analytics failed' });
  }
};

// crm manager
exports.managerDashboardAnalytics = async (req, res) => {
  try {

    const [
      teamRevenue,
      revenueByAgent,
      dealsStatus,
      pipelineHealth,
      followupCompliance,
      responseSLA,
      conversionRates,
      agingOpp,
      inactiveAgents,
      forecast
    ] = await Promise.all([

      /* 1. Team Revenue */
      db.query(`
        SELECT DATE_FORMAT(updated_at,'%b') AS month,
               SUM(expectedvalue) AS total
        FROM opportunity
        WHERE status='Won'
        GROUP BY month
      `),

      /* 2. Revenue by Agent */
      db.query(`
        SELECT u.name AS agent, SUM(o.expectedvalue) AS total
        FROM opportunity o
        JOIN users u ON o.userid=u.uniqueid
        WHERE o.status='Won'
        GROUP BY u.name
      `),

      /* 3. Deals Won vs Lost */
      db.query(`
        SELECT u.name AS agent,
          SUM(CASE WHEN o.status='Won' THEN 1 ELSE 0 END) AS won,
          SUM(CASE WHEN o.status='Lost' THEN 1 ELSE 0 END) AS lost
        FROM opportunity o
        JOIN users u ON o.userid=u.uniqueid
        GROUP BY u.name
      `),

      /* 4. Pipeline Health */
      db.query(`
        SELECT ROUND(
          100 * SUM(CASE WHEN status='Won' THEN 1 ELSE 0 END) / COUNT(*), 2
        ) AS score
        FROM opportunity
      `),

      /* 5. Follow-up Compliance */
      db.query(`
        SELECT u.name AS agent,
          ROUND(100 * SUM(CASE WHEN t.completed=1 THEN 1 ELSE 0 END)/COUNT(*),2) AS rate
        FROM tasks t
        JOIN users u ON t.userid=u.uniqueid
        GROUP BY u.name
      `),

      /* 6. Lead Response SLA */
      db.query(`
        SELECT ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)),2) AS avgSLA
        FROM opportunity
        WHERE updated_at IS NOT NULL
      `),

      /* 7. Agent Conversion Rate */
      db.query(`
        SELECT u.name AS agent,
          ROUND(100 * SUM(CASE WHEN status='Won' THEN 1 ELSE 0 END)/COUNT(*),2) AS rate
        FROM opportunity o
        JOIN users u ON o.userid=u.uniqueid
        GROUP BY u.name
      `),

      /* 8. Aging Opportunities */
      db.query(`
        SELECT c.fullname AS customer,
               DATEDIFF(CURDATE(), o.created_at) AS days
        FROM opportunity o
        JOIN customers c ON o.customerid=c.internalid
        WHERE o.status='Open'
        LIMIT 10
      `),

      /* 9. Inactive Agents */
      db.query(`
       SELECT 
      u.name AS name, 
      DATEDIFF(CURDATE(), MAX(o.updated_at)) AS days
    FROM users u
    LEFT JOIN opportunity o 
      ON o.userid = u.uniqueid
    WHERE u.role NOT IN ('DST', 'CrmManager', 'COO')
    GROUP BY u.name;

        `),
        // HAVING days > 10

      /* 10. Forecast Accuracy */
      db.query(`
        SELECT DATE_FORMAT(updated_at,'%b') AS month,
          SUM(expectedvalue) AS actual,
          SUM(expectedvalue*0.9) AS forecast
        FROM opportunity
        WHERE status='Won'
        GROUP BY month
      `)

    ]);

    res.json({
      teamRevenue: {
        total: teamRevenue[0].reduce((a,b)=>a+b.total,0),
        trend: teamRevenue[0].map(x=>x.total),
        labels: teamRevenue[0].map(x=>x.month)
      },
      revenueByAgent: revenueByAgent[0],
      dealsStatus: dealsStatus[0],
      pipelineHealth: pipelineHealth[0][0].score || 0,
      followupCompliance: followupCompliance[0],
      avgResponseSLA: responseSLA[0][0].avgSLA || 0,
      conversionRates: conversionRates[0],
      agingOpportunities: agingOpp[0],
      inactiveAgents: inactiveAgents[0],
      forecast: forecast[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Manager dashboard failed' });
  }
};

// superadmin
exports.superDashboardAnalytics = async (req, res) => {
  try {

    const [
      revenue,
      revenueByCity,
      activity,
      leadROI,
      clv,
      payments,
      invoiceAging,
      growth,
      errors,
      audit
    ] = await Promise.all([

      /* 1. Total Revenue */
      db.query(`
        SELECT DATE_FORMAT(updated_at,'%b') AS month,
               SUM(expectedvalue) AS total
        FROM opportunity
        WHERE status='Won'
        GROUP BY month
      `),

      /* 2. Revenue by City / Project */
      db.query(`
        SELECT 
        COALESCE(p.city, p.projectname) AS label,
        SUM(o.expectedvalue) AS total
      FROM opportunity o
      LEFT JOIN projects p 
      ON p.uniqueid = o.projectid
      WHERE o.status='Won'
      GROUP BY COALESCE(p.city, p.projectname)
      ORDER BY total DESC;
      `),

      /* 3. User Activity */
      db.query(`
       SELECT 
          u.name AS user,
          MAX(t.created_at) AS last_activity_date,
          DATEDIFF(CURDATE(), MAX(t.created_at)) AS inactive_days
        FROM users u
        LEFT JOIN timeline t 
          ON t.userid = u.uniqueid
        GROUP BY u.uniqueid, u.name
        ORDER BY last_activity_date DESC;

      `),

      /* 4. Lead Source ROI */
      db.query(`
      SELECT 
        c.source,
        SUM(o.expectedvalue) AS revenue
      FROM opportunity o
      JOIN customers c 
        ON o.customerid = c.internalid
      WHERE o.status = 'Won'
        AND c.source IS NOT NULL
        AND c.source != ''
      GROUP BY c.source
      ORDER BY revenue DESC;


      `),

      /* 5. CLV */
      db.query(`
        SELECT ROUND(AVG(total),2) AS clv
        FROM (
          SELECT customerid, SUM(expectedvalue) AS total
          FROM opportunity
          WHERE status='Won'
          GROUP BY customerid
        ) t
      `),

      /* 6. Payment Status */
      db.query(`
        SELECT status, COUNT(*) AS total
        FROM opportunity
        GROUP BY status
      `),

      /* 7. Invoice Aging */
      db.query(`
        SELECT
          SUM(CASE WHEN DATEDIFF(CURDATE(), created_at)<=30 THEN 1 ELSE 0 END) AS a,
          SUM(CASE WHEN DATEDIFF(CURDATE(), created_at) BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS b,
          SUM(CASE WHEN DATEDIFF(CURDATE(), created_at)>60 THEN 1 ELSE 0 END) AS c
        FROM opportunity
        WHERE status='Open'
      `),

      /* 8. Data Growth */
      db.query(`
        SELECT DATE_FORMAT(created_at,'%b') AS month,
          COUNT(*) AS leads,
          SUM(CASE WHEN status='Won' THEN 1 ELSE 0 END) AS deals
        FROM opportunity
        GROUP BY month
      `),

      /* 9. System Errors */
      db.query(`
        SELECT category, description, DATE(duedate) AS date
        FROM tasks
        ORDER BY duedate DESC
        LIMIT 10
      `),

      /* 10. Audit Logs */
      db.query(`
        SELECT u.name AS user, a.note, DATE(a.created_at) AS date
        FROM logs a
        JOIN users u ON a.userid=u.uniqueid
        ORDER BY a.created_at DESC
        LIMIT 10
      `)

    ]);

    res.json({
      totalRevenue: {
        total: revenue[0].reduce((a,b)=>a+b.total,0),
        trend: revenue[0].map(x=>x.total),
        labels: revenue[0].map(x=>x.month)
      },
      revenueByCity: revenueByCity[0],
      userActivity: activity[0],
      leadROI: leadROI[0],
      clv: clv[0][0].clv || 0,
      paymentStatus: payments[0],
      invoiceAging: [
        invoiceAging[0][0].a,
        invoiceAging[0][0].b,
        invoiceAging[0][0].c
      ],
      dataGrowth: {
        labels: growth[0].map(x=>x.month),
        leads: growth[0].map(x=>x.leads),
        deals: growth[0].map(x=>x.deals)
      },
      systemErrors: errors[0].length,
      errorLogs: errors[0],
      auditLogs: audit[0],
      activeUsers: activity[0].length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Super dashboard failed' });
  }
};

// alldashboard
exports.alldashboard = async (req, res) => {
  try {
    const { userid } = req.query;

    let isTelesaler = false;
    let userCondition = '';
    let assignCondition = '';

    /* =========================
       CHECK ROLE (ONLY IF userid)
    ========================= */
    if (userid) {
      const [[user]] = await db.query(
        `SELECT role FROM users WHERE uniqueid = ?`,
        [userid]
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      isTelesaler = user.role === 'Telesaler';
    }

    /* =========================
       TELESALES RULE
    ========================= */
    if (isTelesaler && !userid) {
      return res.status(400).json({ message: 'userid required for telesaler' });
    }

    /* =========================
       BUILD CONDITIONS
    ========================= */
    if (isTelesaler) {
      userCondition = ` AND userid='${userid}'`;
      assignCondition = ` AND (userid='${userid}' OR assignuser='${userid}')`;
    }

    const [
      totalproperty,
      totalnewcustomer,
      totalopportunity,
      totaltaskpending,
      commstage,
      meetingstage,
      totalcustomers,
      newleadthismonth,
      thismonthsales,
      customeraddedpermonth
    ] = await Promise.all([

      /* 1. Total Properties */
      db.query(`
        SELECT COUNT(*) AS total
        FROM projects
        WHERE draft=0
      `),

      /* 2. New Customers Today */
      db.query(`
        SELECT COUNT(*) AS total
        FROM customers
        WHERE DATE(created_at)=CURDATE()
        ${userCondition}
      `),

      /* 3. Total Opportunities */
      db.query(`
        SELECT COUNT(*) AS total
        FROM opportunity
        WHERE 1=1
        ${userCondition}
      `),

      /* 4. Pending Tasks */
      db.query(`
        SELECT COUNT(*) AS total
        FROM tasks
        WHERE completed=0
        ${userCondition}
      `),

      /* 5. Communication Stage */
      db.query(`
        SELECT COUNT(*) AS total
        FROM opportunity
        WHERE pipelineid='sqZAWzRQPo8I'
        ${userCondition}
      `),

      /* 6. Meeting Stage */
      db.query(`
        SELECT COUNT(*) AS total
        FROM opportunity
        WHERE pipelineid='WlAq07X4nA4T'
        ${userCondition}
      `),

      /* 7. Total Customers */
      db.query(`
        SELECT COUNT(*) AS total
        FROM customers
        WHERE 1=1
        ${assignCondition}
      `),

      /* 8. New Leads This Month (Donut) */
      db.query(`
        SELECT source, COUNT(*) AS total
        FROM customers
        WHERE MONTH(created_at)=MONTH(CURDATE())
          AND YEAR(created_at)=YEAR(CURDATE())
          ${userCondition}
        GROUP BY source
      `),

      /* 9. This Month Sales (Line) */
      db.query(`
        SELECT DATE(updated_at) AS day, SUM(expectedvalue) AS total
        FROM opportunity
        WHERE status='Won'
          AND MONTH(updated_at)=MONTH(CURDATE())
          AND YEAR(updated_at)=YEAR(CURDATE())
          ${userCondition}
        GROUP BY DATE(updated_at)
        ORDER BY DATE(updated_at)
      `),

      /* 10. Customers Added Per Month (Bar) */
      db.query(`
        SELECT
          MONTH(created_at) AS monthnum,
          DATE_FORMAT(created_at,'%b') AS month,
          COUNT(*) AS total
        FROM customers
        WHERE YEAR(created_at)=YEAR(CURDATE())
          ${userCondition}
        GROUP BY MONTH(created_at)
        ORDER BY monthnum
      `)
    ]);

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      totalproperty: totalproperty[0][0].total,
      totalnewcustomer: totalnewcustomer[0][0].total,
      totalopportunity: totalopportunity[0][0].total,
      totaltaskpending: totaltaskpending[0][0].total,
      commstage: commstage[0][0].total,
      meetingstage: meetingstage[0][0].total,
      totalcustomers: totalcustomers[0][0].total,
      newleadthismonth: newleadthismonth[0],
      thismonthsales: thismonthsales[0],
      customeraddedpermonth: customeraddedpermonth[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Dashboard analytics failed' });
  }
};

