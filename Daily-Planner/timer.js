// Timer elements (DOM ready since script at end of body)
const timerPanel = document.getElementById("timerPanel");
const timerTaskName = timerPanel.querySelector(".timer-taskname");
const timerClock = timerPanel.querySelector("#clock");
const timerMeta = timerPanel.querySelector(".timer-meta");
const timerPriority = timerPanel.querySelector(".timer-priority");
const toggleBtn = document.getElementById("toggleBtn");
const completeBtn = document.getElementById("completeBtn");
const exitBtn = document.getElementById("exitBtn");

let timerInterval = null; // Local reference to interval

// Utility functions (for time parsing/formatting)
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 3600 + parts[1] * 60;
  }
  return 0;
}

function formatSeconds(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// New: Play beep sound (Web Audio API - only for auto-complete)
function playBeep() {
  try {
    // Create AudioContext (modern browsers support it)
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Generate a simple beep: 800Hz sine wave for 0.5 seconds
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency (Hz) - adjust for tone (e.g., 600 for lower)
    oscillator.type = 'sine'; // Wave type: sine for clean beep
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Volume (0-1)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5); // Fade out
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5); // Duration: 0.5 seconds - adjust if needed
    
    console.log("Beep played for auto-complete");
  } catch (err) {
    console.warn("Beep failed (Web Audio not supported):", err);
    // Graceful fallback - no alert, just continue
  }
}

// Helper: Update server and refresh tables (now with mode: 'partial' or 'forceComplete')
async function updateTaskOnServer(mode) {
  if (!window.currentTaskId) {
    console.error("No task ID available for update");
    return;
  }

  try {
    console.log(`Updating task ${window.currentTaskId} in mode: ${mode}`);

    // Fetch existing task to preserve all fields (taskName, priority, allocatedTime)
    const existingResponse = await fetch(`http://localhost:5000/tasks/${window.currentTaskId}`);
    if (!existingResponse.ok) throw new Error(`Failed to fetch existing task: ${existingResponse.status}`);
    const existingTask = await existingResponse.json();

    const prevCompletedSec = parseTimeToSeconds(existingTask.completedTime);
    const totalCompletedSec = prevCompletedSec + window.elapsedSeconds;

    let completedTimeStr, remainingTimeStr;

    if (mode === 'forceComplete') {
      // Manual Complete or Auto: Force remaining=0, completed=actual total elapsed (capped at allocated)
      const allocatedSec = parseTimeToSeconds(existingTask.allocatedTime);
      completedTimeStr = formatSeconds(Math.min(totalCompletedSec, allocatedSec)); // Cap at allocated
      remainingTimeStr = "00:00:00"; // Force done
      console.log(`Force complete: completed=${completedTimeStr}, remaining=00:00:00 (allocated was ${existingTask.allocatedTime})`);
    } else if (mode === 'partial') {
      // Exit: Normal partial update
      const allocatedSec = parseTimeToSeconds(existingTask.allocatedTime);
      let newRemainingSec = allocatedSec - totalCompletedSec;
      if (newRemainingSec < 0) newRemainingSec = 0;

      completedTimeStr = formatSeconds(totalCompletedSec);
      remainingTimeStr = formatSeconds(newRemainingSec);
      console.log(`Partial update: completed=${completedTimeStr}, remaining=${remainingTimeStr}`);
    } else {
      throw new Error("Invalid update mode");
    }

    // Prepare full update data (preserve everything)
    const updateData = {
      taskName: existingTask.taskName,
      allocatedTime: existingTask.allocatedTime, // Always preserve original allocated
      remainingTime: remainingTimeStr,
      completedTime: completedTimeStr,
      priority: existingTask.priority
    };

    console.log("Sending update data:", updateData);

    const response = await fetch(`http://localhost:5000/tasks/${window.currentTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });

    console.log("Update response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update task: HTTP ${response.status} - ${errorText}`);
    }

    const updatedTask = await response.json();
    console.log("Task updated successfully:", updatedTask);

    // Refresh tables to move/remove task
    if (window.loadTasks) {
      window.loadTasks();
      console.log("Tables refreshed via loadTasks()");
    } else {
      console.error("window.loadTasks not available - manual refresh needed");
      alert("Task updated, but please refresh the page to see changes.");
    }

  } catch (err) {
    console.error("Server update error:", err);
    alert(`Failed to update task: ${err.message}. Check console for details.`);
  }
}

//--------------------------Toggle Button (Start/Pause/Resume)
toggleBtn.addEventListener("click", () => {
  if (!window.currentTaskId) {
    alert("No task selected. Click the stopwatch icon on a pending task first.");
    return;
  }

  if (!window.isRunning) {
    // Start or resume timer
    window.isRunning = true;
    toggleBtn.textContent = "Pause";
    toggleBtn.classList.remove("start");
    toggleBtn.classList.add("pause");

    console.log("Timer started - Initial remaining seconds:", window.remainingSeconds);

    timerInterval = setInterval(() => {
      if (window.remainingSeconds > 0) {
        window.remainingSeconds--;
        window.elapsedSeconds++;
        timerClock.textContent = formatSeconds(window.remainingSeconds);
      } else {
        // Timer expired: Auto-complete the task (force complete with full time)
        console.log("Timer expired - Auto-completing task ID:", window.currentTaskId);
        clearInterval(timerInterval);
        timerInterval = null;
        window.isRunning = false;
        toggleBtn.textContent = "Start";
        toggleBtn.classList.remove("pause");
        toggleBtn.classList.add("start");
        
        // New: Play beep only for auto-complete
        playBeep();
        
        alert("Time's up! Task completed.");
        
        // Update server (force complete - elapsed should == allocated)
        updateTaskOnServer('forceComplete');
        
        // Reset UI after update
        setTimeout(() => resetTimerUI(), 500); // Small delay for UX
      }
    }, 1000);
  } else {
    // Pause timer
    window.isRunning = false;
    toggleBtn.textContent = "Resume";
    toggleBtn.classList.remove("pause");
    toggleBtn.classList.add("start");
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    console.log("Timer paused - Elapsed so far:", window.elapsedSeconds);
  }
});

//-----------------------------Complete button (Manual full completion with actual elapsed time)
completeBtn.addEventListener("click", async () => {
  if (!window.currentTaskId) {
    alert("No task selected.");
    return;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  window.isRunning = false;

  console.log("Manual Complete clicked for task:", window.currentTaskId, "- Elapsed this session:", window.elapsedSeconds);
  
  // No beep for manual complete
  
  // Update server (force complete with actual total elapsed, remaining=0)
  await updateTaskOnServer('forceComplete');
  resetTimerUI();
});

//--------------------Exit button (Save partial progress)
exitBtn.addEventListener("click", async () => {
  if (!window.currentTaskId) {
    alert("No task selected.");
    return;
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  window.isRunning = false;

  console.log("Exit clicked - Saving partial progress for task:", window.currentTaskId);
  
  // No beep for exit
  
  // Update server (partial - no force complete)
  await updateTaskOnServer('partial');
  resetTimerUI();
});

//------------------Reset UI and clear globals
function resetTimerUI() {
  // Clear globals
  window.currentTaskId = null;
  window.remainingSeconds = 0;
  window.allocatedSeconds = 0;
  window.elapsedSeconds = 0;
  window.isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Reset UI elements
  timerTaskName.textContent = "---";
  timerClock.textContent = "00:00:00";
  timerMeta.textContent = "Allocated: 00:00:00";
  timerPriority.textContent = "Priority";
  timerPriority.setAttribute("data-priority", "Low");

  // Disable buttons
  toggleBtn.disabled = true;
  completeBtn.disabled = true;
  exitBtn.disabled = true;

  // Reset toggle button
  toggleBtn.textContent = "Start";
  toggleBtn.classList.remove("pause");
  toggleBtn.classList.add("start");

  console.log("Timer UI reset");
}

// Initial reset on load (clears any stale state)
document.addEventListener("DOMContentLoaded", resetTimerUI);
