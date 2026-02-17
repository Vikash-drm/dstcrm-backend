const Controller = require("../controllers/calls.controller");

module.exports = function(app) {

  app.post("/api/call/add", Controller.addcalls);
  app.get("/api/call/list", Controller.listcalls);

};