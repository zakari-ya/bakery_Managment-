const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");

// Optional Auth Middleware for GET (to check ownership/status)
const optionalAuth = (req, res, next) => {
  const authHeader = req.header("Authorization");
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Invalid token, just ignore
    }
  }
  next();
};

// GET /api/items
// Query: search, status, page, limit
router.get("/", optionalAuth, async (req, res) => {
  const { supabase } = req;
  const { search, status, page = 1, limit = 6 } = req.query;

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    let query = supabase.from("bakeries").select("*", { count: "exact" });

    // Search - only by name (prefix matching from first letter)
    if (search) {
      query = query.ilike("name", `${search}%`);
    }

    // Filter
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: bakeries, count, error } = await query;

    if (error) throw error;

    // If user is logged in, check favorites logic (optional optimization: fetch favorites ids)
    // For now, simple response

    res.json({
      success: true,
      data: bakeries,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/items/:id
router.get("/:id", async (req, res) => {
  const { supabase } = req;
  try {
    const { data, error } = await supabase
      .from("bakeries")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, message: "Bakery not found" });
  }
});

// POST /api/items (Protected)
router.post("/", authMiddleware, async (req, res) => {
  const { supabase } = req;
  const {
    name,
    specialties,
    city,
    average_price,
    opening_hours,
    status,
    image_url,
  } = req.body;

  if (!name || !city) {
    return res
      .status(400)
      .json({ success: false, message: "Name and City are required" });
  }

  try {
    const { data, error } = await supabase
      .from("bakeries")
      .insert([
        {
          name,
          specialties,
          city,
          average_price,
          opening_hours,
          status: status || "open",
          image_url,
          created_by: req.user.id,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/items/:id (Protected)
router.put("/:id", authMiddleware, async (req, res) => {
  const { supabase } = req;
  const { id } = req.params;

  try {
    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from("bakeries")
      .select("created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existing)
      return res.status(404).json({ success: false, message: "Not found" });

    if (existing.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this item",
      });
    }

    const { data, error } = await supabase
      .from("bakeries")
      .update(req.body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE /api/items/:id (Protected)
router.delete("/:id", authMiddleware, async (req, res) => {
  const { supabase } = req;
  const { id } = req.params;

  try {
    // Check ownership
    const { data: existing, error: fetchError } = await supabase
      .from("bakeries")
      .select("created_by")
      .eq("id", id)
      .single();

    if (fetchError || !existing)
      return res.status(404).json({ success: false, message: "Not found" });

    if (existing.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this item",
      });
    }

    const { error } = await supabase.from("bakeries").delete().eq("id", id);

    if (error) throw error;
    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
