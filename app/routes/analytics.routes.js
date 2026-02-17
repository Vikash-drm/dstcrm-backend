const Controller = require("../controllers/analytics.controller");

module.exports = function(app) {
    
    app.get("/api/analytics/salesanalytics/:id", Controller.salesanalytics);
    app.get("/api/analytics/leadanalytics", Controller.leadanalytics);
    app.get("/api/analytics/teamanalytics", Controller.teamAnalytics);
    app.get("/api/analytics/clientanalytics", Controller.clientAnalytics);


    app.get("/api/analytics/executive", Controller.executiveAnalytics);
    app.get("/api/analytics/salesmanager", Controller.salesManagerAnalytics);
    app.get("/api/analytics/crmmanager", Controller.managerDashboardAnalytics);
    app.get("/api/analytics/superadmin", Controller.superDashboardAnalytics);
    
    app.get("/api/analytics/alldashboard", Controller.alldashboard);



};