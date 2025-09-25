const mongoose = require("mongoose");
const taskSchema = new mongoose.Schema({
  taskName: {
    type: String,
    required: true,          
    trim: true
  },
  allocatedTime: {
    type: String,            
    required: true
  },
  remainingTime: {
    type: String,            
  },
  completedTime: {
    type: String,            
  },
  priority: {
    type: String,
    enum: ["High", "Medium", "Low"],
    required: true,
    default: "Medium"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  dateStr: { 
    type: String, 
    required: true 
  }
});

// Export model
module.exports = mongoose.model("Task", taskSchema);
