require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ตรวจสอบ token ของผู้ใช้จาก Supabase
function getUserClient(token) {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    });
}

// Home API
app.get("/", (req, res) => {
    res.json({
        message: "Circular Smart MoBel API Running"
    });
});

// Register API
app.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter email and password"
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: data.session
                ? "Register successful"
                : "Registration received. Check your email to confirm your account.",
            email: data.user?.email,
            token: data.session?.access_token ?? null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error during registration"
        });
    }
});

// Login API
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter email and password"
            });
        }

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        res.json({
            success: true,
            message: "Login successful",
            email: data.user.email,
            token: data.session.access_token
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error during login"
        });
    }
});

// Logout API
app.post("/logout", async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(
            /^Bearer\s+/i,
            ""
        );

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Missing access token"
            });
        }

        const userClient = getUserClient(token);
        const { error } = await userClient.auth.signOut();

        if (error) {
            return res.status(401).json({
                success: false,
                message: "Logout failed"
            });
        }

        res.json({
            success: true,
            message: "Logout successful"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error during logout"
        });
    }
});

// Change Password API
app.post("/change-password", async (req, res) => {
    try {
        const token = req.headers.authorization?.replace(
            /^Bearer\s+/i,
            ""
        );
        const { newPassword } = req.body;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please log in first"
            });
        }

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        const userClient = getUserClient(token);

        const { data: userData, error: userError } =
            await userClient.auth.getUser();

        if (userError || !userData.user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session"
            });
        }

        const { error } = await userClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.json({
            success: true,
            message: "Password changed successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error while changing password"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
