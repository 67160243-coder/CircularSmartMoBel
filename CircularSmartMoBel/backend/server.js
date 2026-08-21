const express = require("express");

const app = express();

app.use(express.json());

// Home API
app.get("/", (req, res) => {
    res.json({
        message: "Circular Smart MoBel API Running"
    });
});

// Register API
app.post("/register", (req, res) => {

    const { email, password } = req.body;

    res.json({
        success: true,
        message: "Register successful",
        email: email
    });

});

// Login API
app.post("/login", (req, res) => {

    const { email, password } = req.body;

    res.json({
        success: true,
        message: "Login successful",
        email: email
    });

});

// Logout API
app.post("/logout", (req, res) => {

    res.json({
        success: true,
        message: "Logout successful"
    });

});

// Change Password API
app.post("/change-password", (req, res) => {

    const { oldPassword, newPassword } = req.body;

    res.json({
        success: true,
        message: "Password changed successfully"
    });

});



app.listen(3000, () => {
    console.log("Server running on port 3000");
});

