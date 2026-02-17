const Controller = require("../controllers/manualjob.controller");

module.exports = function(app) {

    app.post("/api/manualjob/bulkassign", Controller.bulkassign);
    app.delete("/api/manualjob/:id/:changeby", Controller.unassign);


};