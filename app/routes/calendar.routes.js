const Controller = require("../controllers/calendar.controller");

module.exports = function(app) {
    
    app.get("/api/calendar/events/:id", Controller.list);
    app.post("/api/calendar/events", Controller.create);
    app.put("/api/calendar/events/:id", Controller.update);
    app.delete("/api/calendar/events/:id", Controller.remove);

};