const Controller = require("../controllers/user.controller");
const upload = require('../middlewares/upload');

module.exports = function(app) {

    app.post("/api/user/add", upload.single('avatar'), Controller.add);
    app.put("/api/user/:id", upload.single('avatar'), Controller.update);
    app.delete("/api/user/:id", Controller.delete);
    app.get("/api/user/:id", Controller.getById);


};