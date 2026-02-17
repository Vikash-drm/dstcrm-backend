const Controller = require("../controllers/project.controller");
const upload = require('../middlewares/projectsupload');


module.exports = function(app) {

    app.post("/api/project/add", upload.array('images[]', 30), Controller.add);
    app.put("/api/project/:id", upload.array('images[]', 30), Controller.update);
    app.delete("/api/project/:id", Controller.delete);

    app.get("/api/project/list", Controller.list);
    
    app.get("/api/project/column", Controller.getByColumn);
    
    app.get("/api/project/:id", Controller.getById);

};