require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database unavailable for API request:", err.message);
    res.status(503).json({
      message: "Database unavailable. Check the deployment database configuration and network access.",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);

// Serve the plain HTML/CSS/JS frontend
app.use(express.static(path.join(__dirname, "public")));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Attendance portal running on http://localhost:${PORT}`));

// Local / normal server: listen. On Vercel the app is exported instead.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`Attendance portal running on http://localhost:${PORT}`),
      );
    })
    .catch((err) => {
      console.error("Could not start server without MongoDB:", err.message);
      process.exitCode = 1;
    });
}

module.exports = app;