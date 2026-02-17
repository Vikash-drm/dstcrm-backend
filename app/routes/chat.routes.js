const Controller = require("../controllers/chat.controller");

module.exports = function(app) {

    app.get("/api/chat/users/:myUserId", Controller.getAllUsers);

  // ✅ 2) My chat list (only my chats)
  app.get("/api/chat/list/:myUserId", Controller.getMyChatList);

  // ✅ 3) Create or Get room between 2 users
  app.post("/api/chat/create-room", Controller.createOrGetRoom);

  // ✅ 4) Messages of a room
  app.get("/api/chat/messages/:roomId", Controller.getMessages);

  // ✅ 5) Send message
  app.post("/api/chat/send", Controller.sendMessage);

};