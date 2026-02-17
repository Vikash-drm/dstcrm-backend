const Controller = require("../controllers/inventory.controller");
const upload = require('../middlewares/projectsupload');


const multer = require("multer");
const uploadcsv = multer({ dest: "uploads/csv/" });

module.exports = function(app) {

    app.post("/api/inventory/add", upload.array('images[]', 30), Controller.add);
    app.put("/api/inventory/:id", upload.array('images[]', 30), Controller.update);
    app.delete("/api/inventory/:id", Controller.delete);

    app.get("/api/inventory/list", Controller.list);
    
    app.get("/api/inventory/:id", Controller.getById);
    app.get("/api/inventory/duplicate/:id", Controller.duplicateinventory);

    app.get("/api/inventory/inventorydash/:id", Controller.inventorydash);

    app.post("/api/inventory/import",uploadcsv.single("file"),Controller.importInventory);


};