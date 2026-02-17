const Controller = require("../controllers/timeline.controller");

module.exports = function(app) {

    app.get("/api/timeline/list", Controller.list);
    app.get("/api/timeline/unique", Controller.unique);

};