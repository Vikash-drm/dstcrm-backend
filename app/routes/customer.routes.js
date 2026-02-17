const Controller = require("../controllers/customer.controller");
const upload = require('../middlewares/upload');

const multer = require("multer");
const uploadcsv = multer({ dest: "uploads/csv/" });


module.exports = function(app) {

    app.post("/api/customer/add", upload.single('avatar'), Controller.add);
    app.put("/api/customer/:id", upload.single('avatar'), Controller.update);
    app.delete("/api/customer/:id", Controller.delete);

    app.get("/api/customer/list", Controller.list);
    app.get("/api/customer/:id", Controller.getById);

    app.post("/api/customer/import",uploadcsv.single("file"),Controller.importCustomers);

    app.get("/api/customer/fetchcustomer/:userid", Controller.fetchcustomer);

    app.post("/api/customer/locksource", Controller.addlocksource);
    app.get("/api/customer/lock/source", Controller.getlocksource);


};