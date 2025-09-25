// index.js

const addbutton = document.getElementById("addTaskBtn");
const form = document.getElementById("field");
const closebtn = document.getElementById("closeBtn");
let selectedPriority = "Medium"; // UPDATED: Match model default
let editingTaskId = null;
let revertTaskId = null; // For revert mode (reopening completed tasks)

//--------------------------- Priority buttons
const priorityButtons = document.querySelectorAll(".priority-btn-group .priority");
priorityButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    priorityButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedPriority = btn.getAttribute("data-priority");
  });
});

//------------------------------Open form
addbutton.addEventListener("click", () => {
  form.classList.add("show");
  addbutton.style.display = "none"; // hide add button
});

//-----------------------------------Close form
closebtn.addEventListener("click", () => {
  form.classList.remove("show");
  addbutton.style.display = "block"; // show add button again
  form.reset();
  selectedPriority = "Medium"; // UPDATED: Match model
  priorityButtons.forEach((b) => b.classList.remove("selected"));
  editingTaskId = null;
  revertTaskId = null; // Clear revert mode
});

//---------------------------------switch between the tabs
const pendingTab = document.getElementById("pendingTab");
const completedTab = document.getElementById("completedTab");
const pendingTasksDiv = document.querySelector(".pending-tasks");
const completedTasksDiv = document.getElementById("completedTasks");
pendingTab.addEventListener("click", () => {
  pendingTab.classList.add("active");
  completedTab.classList.remove("active");
  pendingTasksDiv.style.display = "block";
  completedTasksDiv.style.display = "none";
});
completedTab.addEventListener("click", () => {
  completedTab.classList.add("active");
  pendingTab.classList.remove("active");
  completedTasksDiv.style.display = "block";
  pendingTasksDiv.style.display = "none";
});

//------------------------------------------ Utility: Convert time string to seconds
function timeStrToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
}

//------------------------------------------ Utility: Format seconds to HH:MM:SS
function formatSeconds(seconds) {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

//------------------------------------------ Utility: Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // e.g., "2024-10-15"
}

//------------------------------------------showing the data in frontend table
const taskTableBody = document.getElementById("taskTableBody");
const completedTableBody = document.getElementById("completedTableBody");

// Fetch and display tasks (UPDATED: Add more debug logs, stricter completed check)
async function loadTasks() {
  try {
    const today = getTodayDate();
    console.log(`Frontend: Loading tasks for today (${today})`);  // NEW: Debug
    const response = await fetch(`http://localhost:5000/tasks?date=${today}`);
    if (!response.ok) throw new Error("Failed to fetch tasks");
    const tasks = await response.json();
    console.log(`Frontend: Loaded ${tasks.length} tasks for today:`, tasks.map(t => ({ name: t.taskName, createdAt: t.createdAt })));  // NEW: Debug (task names + dates)

    // Clear previous rows
    taskTableBody.innerHTML = "";
    completedTableBody.innerHTML = "";

    let pendingCount = 0;
    let completedCount = 0;

    tasks.forEach((task) => {
      const remainingSec = timeStrToSeconds(task.remainingTime);
      const completedSec = timeStrToSeconds(task.completedTime);
      // Show in pending tab if remaining time > 0 (includes partial)
      if (remainingSec > 0) {
        pendingCount++;
        const row = `
          <tr data-id="${task._id}">
            <td>${pendingCount}</td>
            <td>${task.taskName}</td>
            <td>${task.remainingTime}</td>
            <td>${task.priority}</td>
            <td>
              <i class="bi bi-pencil-square edit-icon" style="cursor:pointer; color:blue;"></i>
              <i class="bi bi-trash delete-icon" style="cursor:pointer; color:red;"></i>
              <i class="bi bi-stopwatch trackBtn" style="cursor:pointer;"></i>
            </td>
          </tr>`;
        taskTableBody.insertAdjacentHTML("beforeend", row);
      }

      // Show in completed tab ONLY if fully completed (remainingTime === "00:00:00" and completedTime > "00:00:00")
      if (completedSec > 0) {  // UPDATED: Stricter check for fully completed
        completedCount++;
        const movebackIconHTML = remainingSec>0 ?"": `
          <i class="bi bi-arrow-counterclockwise moveback-icon" style="cursor:pointer; color:green; margin-right:8px;"></i>`;

        const row = `
          <tr data-id="${task._id}">
            <td>${completedCount}</td>
            <td>${task.taskName}</td>
            <td>${task.completedTime || "N/A"}</td>
            <td>${task.priority}</td>
            <td>
              ${movebackIconHTML}
              <i class="bi bi-trash delete-icon" style="cursor:pointer; color:red;"></i>
            </td>
          </tr>`;
        completedTableBody.insertAdjacentHTML("beforeend", row);
      }
    });

    console.log(`Frontend: Rendered ${pendingCount} pending, ${completedCount} completed`);  // NEW: Debug
  } catch (err) {
    console.error("Error loading tasks:", err);
    alert("Failed to load tasks. Check server.");
  }
}

// Expose loadTasks globally for timer.js
window.loadTasks = loadTasks;

// Load tasks on page load
window.addEventListener("DOMContentLoaded", loadTasks);

//-----------------------------------------Submit form (UPDATED: Include createdAt in new task data)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const taskName = document.getElementById("task_name").value.trim();
  let allocatedTime = document.getElementById("task_time").value;

  // Validate task name
  if (!taskName) {
    alert("Task name is required.");
    return;
  }

  // Validate time format (HH:MM:SS)
  const timePattern = /^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/;
  if (!timePattern.test(allocatedTime)) {
    alert("Please enter time in HH:MM:SS format.");
    return;
  }

  try {
    let data;

    if (revertTaskId) {
      // Revert mode - Reopen completed task with additional time
      const existingResponse = await fetch(
        `http://localhost:5000/tasks/${revertTaskId}`
      );
      if (!existingResponse.ok) throw new Error("Failed to fetch existing task");
      const existingTask = await existingResponse.json();

      // Convert times to seconds
      const newAdditionalSec = timeStrToSeconds(allocatedTime);
      const oldCompletedSec = timeStrToSeconds(existingTask.completedTime);

      if (newAdditionalSec <= 0) {
        alert("Additional time must be greater than 00:00:00 to reopen.");
        return;
      }

      // Calculate new values
      const newAllocatedSec = oldCompletedSec + newAdditionalSec;
      const remainingTime = allocatedTime; // New remaining = additional time input

      data = {
        taskName,
        allocatedTime: formatSeconds(newAllocatedSec), // Total: old completed + new additional (e.g., 3hrs)
        remainingTime, // e.g., "01:00:00"
        completedTime: existingTask.completedTime, // Preserve old completed (e.g., "02:00:00")
        priority: selectedPriority,
        // createdAt is preserved by server PUT (no need to set here)
      };

      // Update existing task
      const response = await fetch(`http://localhost:5000/tasks/${revertTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update task");

      alert("Task reopened with additional time!");

      // Reset form and UI
      form.reset();
      form.classList.remove("show");
      addbutton.style.display = "block";
      selectedPriority = "Medium";
      priorityButtons.forEach((b) => b.classList.remove("selected"));
      revertTaskId = null; // Clear revert mode

      loadTasks(); // Refresh - task moves to pending (still filtered to today)
      return; // Exit early - don't run edit/add logic

    } else if (editingTaskId) {
      // Edit mode
      const existingResponse = await fetch(
        `http://localhost:5000/tasks/${editingTaskId}`
      );
      if (!existingResponse.ok) throw new Error("Failed to fetch existing task");
      const existingTask = await existingResponse.json();

      // Convert times to seconds
      const allocatedSec = timeStrToSeconds(allocatedTime);
      const completedSec = timeStrToSeconds(existingTask.completedTime);

      // Calculate new remaining time in seconds
      let remainingSec = allocatedSec - completedSec;
      if (remainingSec < 0) remainingSec = 0; // Prevent negative remaining time

      // Convert remainingSec back to HH:MM:SS
      const remainingTime = formatSeconds(remainingSec);

      data = {
        taskName,
        allocatedTime,  // Updated to new value (this is what user edits)
        remainingTime,
        completedTime: existingTask.completedTime, // preserve completed time
        priority: selectedPriority,
        // createdAt is preserved by server PUT (no need to set here)
      };

      // Update existing task
      const response = await fetch(`http://localhost:5000/tasks/${editingTaskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update task");

      alert("Task updated!");

      // Reset form and UI
      form.reset();
      form.classList.remove("show");
      addbutton.style.display = "block";
      selectedPriority = "Medium";
      priorityButtons.forEach((b) => b.classList.remove("selected"));
      editingTaskId = null;

      loadTasks(); // Refresh (filtered to today)
      return;
    } else {
      // New task (UPDATED: Include createdAt explicitly)
      data = {
        taskName,
        allocatedTime,
        remainingTime: allocatedTime,
        completedTime: "00:00:00",
        priority: selectedPriority,
        createdAt: new Date()  // NEW: Explicitly set for consistency (server will use this or default)
      };

      const response = await fetch("http://localhost:5000/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save task");

      alert("Task added!");

      // Reset form and UI
      form.reset();
      form.classList.remove("show");
      addbutton.style.display = "block";
      selectedPriority = "Medium";
      priorityButtons.forEach((b) => b.classList.remove("selected"));

      loadTasks(); // Refresh (new task will appear as it's created today)
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while saving the task.");
  }
});

//--------------------------------- Combined event listener for pending tasks table (delete, edit, trackBtn)
taskTableBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const taskId = row.getAttribute("data-id");

  // Delete from pending
  if (e.target.classList.contains("delete-icon")) {
    if (confirm("Are you sure you want to delete this task?")) {
      try {
        const response = await fetch(`http://localhost:5000/tasks/${taskId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete task");
        console.log(`Frontend: Deleted task ${taskId}`);  // NEW: Debug
        loadTasks(); // Refresh (filtered to today)
      } catch (err) {
        console.error(err);
        alert("Failed to delete task.");
      }
    }
  }

  // Edit from pending
  if (e.target.classList.contains("edit-icon")) {
    editingTaskId = taskId;
    revertTaskId = null; // Clear revert mode

    try {
      // Fetch full task data from server to get allocatedTime
      const response = await fetch(`http://localhost:5000/tasks/${editingTaskId}`);
      if (!response.ok) throw new Error("Failed to fetch task");
      const task = await response.json();
      console.log(`Frontend: Editing task ${task.taskName}`);  // NEW: Debug

      // Populate form fields with full task data
      document.getElementById("task_name").value = task.taskName;
      document.getElementById("task_time").value = task.allocatedTime; // Show allocated time for editing

      // Set priority button selected
      priorityButtons.forEach((b) => b.classList.remove("selected"));
      const selectedBtn = Array.from(priorityButtons).find(
        (b) => b.getAttribute("data-priority") === task.priority
      );
      if (selectedBtn) {
        selectedBtn.classList.add("selected");
        selectedPriority = task.priority;
      }

      // Show form and hide add button
      form.classList.add("show");
      addbutton.style.display = "none";
    } catch (err) {
      console.error("Error fetching task for edit:", err);
      alert("Failed to load task for editing.");
      editingTaskId = null;
    }
  }

  // Stopwatch (trackBtn) - Start timer session
  if (e.target.classList.contains("trackBtn")) {
    const currentTaskId = taskId;
    const taskName = row.children[1].textContent;
    const remainingTime = row.children[2].textContent; // format "HH:MM" or "HH:MM:SS"
    const priority = row.children[3].textContent;

    // Parse remainingTime to seconds (use as allocated for this session)
    const allocatedSeconds = timeStrToSeconds(remainingTime);
    const remainingSeconds = allocatedSeconds;
    const elapsedSeconds = 0;
    const isRunning = false;

    // Update timer panel UI (access timer elements directly)
    const timerPanel = document.getElementById("timerPanel");
    const timerTaskName = timerPanel.querySelector(".timer-taskname");
    const timerClock = timerPanel.querySelector("#clock");
    const timerMeta = timerPanel.querySelector(".timer-meta");
    const timerPriority = timerPanel.querySelector(".timer-priority");
    const toggleBtn = document.getElementById("toggleBtn");
    const completeBtn = document.getElementById("completeBtn");
    const exitBtn = document.getElementById("exitBtn");

    timerTaskName.textContent = taskName;
    timerClock.textContent = formatSeconds(remainingSeconds);
    timerMeta.textContent = `Allocated: ${formatSeconds(allocatedSeconds)}`;
    timerPriority.textContent = priority;
    timerPriority.setAttribute("data-priority", priority);

    // Enable buttons
    toggleBtn.disabled = false;
    completeBtn.disabled = false;
    exitBtn.disabled = false;

    // Reset toggle button text and classes
    toggleBtn.textContent = "Start";
    toggleBtn.classList.remove("pause");
    toggleBtn.classList.add("start");

    // Show timer panel
    timerPanel.style.display = "block";

    // Set global state for timer.js to use (task ID, times, etc.)
    window.currentTaskId = currentTaskId;
    window.allocatedSeconds = allocatedSeconds;
    window.remainingSeconds = remainingSeconds;
    window.elapsedSeconds = elapsedSeconds;
    window.isRunning = isRunning;
    window.timerInterval = null; // For clearInterval in timer.js

    console.log(`Frontend: Started timer for ${taskName}`);  // NEW: Debug
  }
});

//--------------------------------- Delete and move back from completed tasks table
completedTableBody.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const taskId = row.getAttribute("data-id");

  // Delete from completed
  if (e.target.classList.contains("delete-icon")) {
    if (confirm("Are you sure you want to delete this task?")) {
      try {
        const response = await fetch(`http://localhost:5000/tasks/${taskId}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete task");
        console.log(`Frontend: Deleted completed task ${taskId}`);  // NEW: Debug
        loadTasks(); // Refresh (filtered to today)
      } catch (err) {
        console.error(err);
        alert("Failed to delete task.");
      }
    }
  }

  // Move back (reopen) completed task
  if (e.target.classList.contains("moveback-icon")) {
    revertTaskId = taskId;
    editingTaskId = null; // Clear edit mode

    try {
      const response = await fetch(`http://localhost:5000/tasks/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch task");
      const task = await response.json();
      console.log(`Frontend: Reopening task ${task.taskName}`);  // NEW: Debug

      // Prefill form fields with completed task data
      document.getElementById("task_name").value = task.taskName;
      document.getElementById("task_time").value = task.completedTime; // Prefill with completed time as base for additional time

      // Set priority button selected
      priorityButtons.forEach((b) => b.classList.remove("selected"));
      const selectedBtn = Array.from(priorityButtons).find(
        (b) => b.getAttribute("data-priority") === task.priority
      );
      if (selectedBtn) {
        selectedBtn.classList.add("selected");
        selectedPriority = task.priority;
      }

      // Show form and hide add button
      form.classList.add("show");
      addbutton.style.display = "none";
    } catch (err) {
      console.error("Error fetching task for revert:", err);
      alert("Failed to load task for reopening.");
      revertTaskId = null;
    }
  }
});
