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


// ---------- Saved 3D designs API ----------
// ใช้ access token ของผู้ใช้ เพื่อให้ Supabase RLS ตรวจสอบสิทธิ์เจ้าของข้อมูล
function getBearerToken(req) {
    return req.headers.authorization?.replace(/^Bearer\s+/i, "");
}

async function getAuthenticatedUser(token) {
    if (!token) return { user: null, error: new Error("Please log in first") };
    const userClient = getUserClient(token);
    const { data, error } = await userClient.auth.getUser();
    return { user: data?.user ?? null, error, userClient };
}

app.get("/designs", async (req, res) => {
    try {
        const { user, error, userClient } = await getAuthenticatedUser(getBearerToken(req));
        if (error || !user) {
            return res.status(401).json({ success: false, message: "Please log in again" });
        }

        const { data, error: dbError } = await userClient
            .from("saved_designs")
            .select("id, name, design, created_at, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false });

        if (dbError) {
            return res.status(400).json({ success: false, message: dbError.message });
        }
        res.json({ success: true, designs: data ?? [] });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while loading designs" });
    }
});

app.get("/designs/:id", async (req, res) => {
    try {
        const { user, error, userClient } = await getAuthenticatedUser(getBearerToken(req));
        if (error || !user) {
            return res.status(401).json({ success: false, message: "Please log in again" });
        }

        const { data, error: dbError } = await userClient
            .from("saved_designs")
            .select("id, name, design, created_at, updated_at")
            .eq("id", req.params.id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (dbError) {
            return res.status(400).json({ success: false, message: dbError.message });
        }
        if (!data) return res.status(404).json({ success: false, message: "Design not found" });
        res.json({ success: true, design: data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while loading design" });
    }
});

app.post("/designs", async (req, res) => {
    try {
        const { user, error, userClient } = await getAuthenticatedUser(getBearerToken(req));
        if (error || !user) {
            return res.status(401).json({ success: false, message: "Please log in again" });
        }

        const name = String(req.body?.name ?? "").trim();
        const design = req.body?.design;
        if (!name || !design || typeof design !== "object") {
            return res.status(400).json({ success: false, message: "Please provide a design name and design data" });
        }

        const { data, error: dbError } = await userClient
            .from("saved_designs")
            .insert({ user_id: user.id, name, design })
            .select("id, name, design, created_at, updated_at")
            .single();

        if (dbError) return res.status(400).json({ success: false, message: dbError.message });
        res.status(201).json({ success: true, message: "Design saved", design: data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while saving design" });
    }
});

app.put("/designs/:id", async (req, res) => {
    try {
        const { user, error, userClient } = await getAuthenticatedUser(getBearerToken(req));
        if (error || !user) {
            return res.status(401).json({ success: false, message: "Please log in again" });
        }

        const name = String(req.body?.name ?? "").trim();
        const design = req.body?.design;
        if (!name || !design || typeof design !== "object") {
            return res.status(400).json({ success: false, message: "Please provide a design name and design data" });
        }

        const { data, error: dbError } = await userClient
            .from("saved_designs")
            .update({ name, design, updated_at: new Date().toISOString() })
            .eq("id", req.params.id)
            .eq("user_id", user.id)
            .select("id, name, design, created_at, updated_at")
            .maybeSingle();

        if (dbError) return res.status(400).json({ success: false, message: dbError.message });
        if (!data) return res.status(404).json({ success: false, message: "Design not found" });
        res.json({ success: true, message: "Design updated", design: data });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while updating design" });
    }
});

app.delete("/designs/:id", async (req, res) => {
    try {
        const { user, error, userClient } = await getAuthenticatedUser(getBearerToken(req));
        if (error || !user) {
            return res.status(401).json({ success: false, message: "Please log in again" });
        }

        const { data, error: dbError } = await userClient
            .from("saved_designs")
            .delete()
            .eq("id", req.params.id)
            .eq("user_id", user.id)
            .select("id")
            .maybeSingle();

        if (dbError) return res.status(400).json({ success: false, message: dbError.message });
        if (!data) return res.status(404).json({ success: false, message: "Design not found" });
        res.json({ success: true, message: "Design deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while deleting design" });
    }
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
