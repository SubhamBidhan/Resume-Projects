// progress.js

const progressDateInput = document.getElementById("progressDate");
const progressChartContainer = document.getElementById("progressChartContainer");
const noDataMessage = document.getElementById("noDataMessage");

let progressChart = null;

// Utility: format seconds to HH:MM:SS (reuse if needed)
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

// Fetch tasks filtered by date (adjust API accordingly)
// For demo, assuming your backend supports query param ?date=YYYY-MM-DD
async function fetchTasksByDate(dateStr) {
  try {
    const response = await fetch(`http://localhost:5000/tasks?date=${dateStr}`);
    if (!response.ok) throw new Error("Failed to fetch tasks");
    const tasks = await response.json();
    return tasks;
  } catch (err) {
    console.error("Error fetching tasks by date:", err);
    return [];
  }
}

// Calculate total completed seconds per task
function getCompletedSeconds(task) {
  if (!task.completedTime) return 0;
  const parts = task.completedTime.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// Render pie chart using Chart.js
function renderPieChart(tasks) {
  if (progressChart) {
    progressChart.destroy();
    progressChart = null;
  }

  if (!tasks.length) {
    progressChartContainer.style.display = "none";
    noDataMessage.style.display = "block";
    return;
  }

  noDataMessage.style.display = "none";
  progressChartContainer.style.display = "flex"; // Use flex for centering
  // Prepare data for chart
  const labels = [];
  const data = [];

  tasks.forEach((task) => {
    const completedSec = getCompletedSeconds(task);
    if (completedSec > 0) {
      labels.push(task.taskName);
      data.push(completedSec);
    }
  });

  if (data.length === 0) {
    // No completed tasks
    progressChartContainer.style.display = "none";
    noDataMessage.style.display = "block";
    return;
  }

  const ctx = document.createElement("canvas");
  progressChartContainer.innerHTML = ""; // Clear previous chart
  progressChartContainer.appendChild(ctx);
  progressChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: generateColors(data.length),
          borderColor: "#fff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true, // NEW: Prevents distortion and flickering on resize
      aspectRatio: 1, // NEW: Enforces square shape to match CSS
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const label = context.label || "";
              const seconds = context.parsed || 0;
              return `${label}: ${formatSeconds(seconds)}`;
            },
          },
        },
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 20,
            padding: 15,
          },
        },
      },
    },
  });
}

// Generate array of distinct colors for chart slices
function generateColors(count) {
  const colors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9F40",
    "#C9CBCF",
    "#8DD17E",
    "#FF6F91",
    "#845EC2",
  ];
  // Repeat colors if count > colors.length
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }
  return result;
}

// On date change, fetch and render chart
async function onDateChange() {
  const selectedDate = progressDateInput.value;
  if (!selectedDate) {
    progressChartContainer.style.display = "none";
    noDataMessage.style.display = "block";
    noDataMessage.textContent = "Please select a date.";
    return;
  }

  const tasks = await fetchTasksByDate(selectedDate);
  renderPieChart(tasks);
}

// Initialize: set date to today and load chart
function initProgress() {
  const today = new Date().toISOString().split("T")[0];
  progressDateInput.value = today;
  onDateChange();
}

// Event listener
progressDateInput.addEventListener("change", onDateChange);

// Initialize on page load
window.addEventListener("DOMContentLoaded", initProgress);
