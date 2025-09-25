const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Task = require("./models/Task");

const app = express();
app.use(express.json());

// Enable CORS for all origins
app.use(cors());

// Connect to MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/Tasktracker")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error(err));

/* ------------------- ROUTES ------------------- */

// POST route - add task
app.post("/tasks", async (req, res) => {
  try {
    const todayDateStr = new Date().toISOString().split("T")[0]; // e.g. "2025-09-23"

    const newTask = new Task({
      ...req.body,
      createdAt: new Date(),
      dateStr: todayDateStr   // <-- plain date string for easy filtering
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET route - get all tasks or filter by date
app.get("/tasks", async (req, res) => {
  try {
    const { date } = req.query; // e.g., '2025-09-23'
    console.log(`API: Fetching tasks for date: ${date || "all"}`);

    let filter = {};
    if (date) {
      filter.dateStr = date;
    }

    const tasks = await Task.find(filter).sort({ _id: -1 }); // Newest first
    console.log(`API: Found ${tasks.length} tasks`);
    res.json(tasks);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET route - get single task by ID
app.get("/tasks/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(200).json(task);
  } catch (err) {
    console.error("Error fetching task:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE route - delete task
app.delete("/tasks/:id", async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT route - update task (preserve createdAt and dateStr)
app.put("/tasks/:id", async (req, res) => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updateData = {
      ...req.body,
      createdAt: existingTask.createdAt,  // preserve original creation time
      dateStr: existingTask.dateStr       // preserve original day
    };

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    console.log(`Task updated: ${updatedTask.title || updatedTask.taskName}`);
    res.status(200).json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------- SERVER ------------------- */

app.listen(5000, () => {
  console.log("🚀 Server running on http://localhost:5000");
});
