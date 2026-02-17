const authController = require("../../controllers/auth/auth.controller");

module.exports = function(app) {

    app.post("/api/auth/login", authController.signin);
    app.get("/api/auth/list", authController.list);

//   app.post("/auth/signin", authController.signin);
//   app.post("/auth/signup", authController.signup);
//   app.post("/auth/googlesignin", authController.signin);
//   app.post("/auth/two-factor-verification", authController.twoFctorVerification);
//   app.post("/auth/update-password", authController.updatePassword);
//   app.post("/auth/send-verification-code", authController.sendVarificationCode);
//   app.post("/auth/send-reset-password-link", authController.sendResetPasswordLink);
};