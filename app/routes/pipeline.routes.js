const Controller = require("../controllers/pipeline.controller");
const multer = require('multer');
const path = require('path');

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads/logs/',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname); // .jpg, .png, etc

      // long numeric value (timestamp + random)
      const uniqueName =
        Date.now().toString() +
        Math.floor(Math.random() * 1e6).toString();

      cb(null, uniqueName + ext);
    }
  })
});


module.exports = function(app) {

    app.get("/api/pipeline/list", Controller.list);
    app.post("/api/pipeline/addopportunity", Controller.addopportunity);
    app.put("/api/pipeline/rename", Controller.renamepipeline);
    
    app.delete("/api/opportunity/task/:id", Controller.deletetask);
    
    app.get("/api/opportunity/list/:id", Controller.opportunitylist);
    app.get("/api/opportunity/list2/:id", Controller.opportunitylist2);

    app.put("/api/opportunity/pipeline", Controller.updatepipeline);
    app.put("/api/opportunity/multipipeline", Controller.updatemultipipeline);
    app.put("/api/opportunity/assginmultiuseropp", Controller.assginmultiuseropp);
    app.put("/api/opportunity/multiAddtag", Controller.multiAddtag);
    app.put("/api/opportunity/multideletetag", Controller.multideletetag);

    app.get("/api/opportunity/:id", Controller.opportunitygetById);
    app.put("/api/opportunity/update", Controller.updateopportunity);
    app.delete("/api/opportunity/:id", Controller.deleteopportunity);
    app.put("/api/opportunity/updatestatus", Controller.updatestatus);
    app.post("/api/opportunity/addtask", Controller.addtask);
    app.get("/api/opportunity/tasklist/:id/:grouped/:customerId", Controller.tasklist);

    app.get("/api/opportunity/alltasklist/:id", Controller.alltasklist);
    
    app.post("/api/opportunity/addlog", upload.array('files'), Controller.addlog);
    app.post("/api/opportunity/updatelog",upload.array('files'),Controller.updatelog);


    app.get("/api/opportunity/loglist/:id/:grouped/:customerId", Controller.loglist);
    app.put("/api/opportunity/completetask", Controller.completetask);
    app.get("/api/opportunity/openproject/:id", Controller.openproject);
    app.put("/api/opportunity/updatetags", Controller.updatetags);
    app.put("/api/opportunity/updatecustomertags", Controller.updatecustomertags);
    
    app.post("/api/opportunity/addcomment", Controller.addcomment);
    app.get("/api/opportunity/commentlist/:id/:opportunityid/:customerId", Controller.commentlist);
    
    app.delete("/api/opportunity/log/:id", Controller.deletelog);
    app.put("/api/opportunity/updatetask", Controller.updatetask);
    


    app.get("/api/pipeline/getpipelinedashboard/:id", Controller.getpipelinedashboard);



};