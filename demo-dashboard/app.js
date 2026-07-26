document.addEventListener('DOMContentLoaded', () => {
  const TOTAL_STUDENTS = 32;
  const gridContainer = document.getElementById('classroom-grid');
  const lostCountEl = document.getElementById('lost-count');
  const gotitCountEl = document.getElementById('gotit-count');
  const interventionsList = document.getElementById('interventions-list');
  
  let students = [];
  
  // Initialize classroom grid
  function initClassroom() {
    for (let i = 0; i < TOTAL_STUDENTS; i++) {
      const desk = document.createElement('div');
      desk.className = 'desk';
      // Center icon optionally
      // desk.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      
      gridContainer.appendChild(desk);
      students.push({
        element: desk,
        status: 'neutral' // neutral, gotit, lost
      });
    }
  }

  // Generate random mock alerts
  const alertMessages = [
    "Cluster of confusion detected in Sector 3 (Backpropagation).",
    "Student 12 signaled 'Got It' after analogy.",
    "Rapid drop in confidence. Suggest pacing down.",
    "Muffliato ping: 'I don't understand the chain rule part.'",
    "High engagement on current slide."
  ];

  function addAlert(isCritical = false) {
    const msg = alertMessages[Math.floor(Math.random() * alertMessages.length)];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const alertEl = document.createElement('div');
    alertEl.className = `alert-card ${isCritical ? 'critical' : ''}`;
    alertEl.innerHTML = `
      <span class="alert-time">${time}</span>
      <p class="alert-msg">${isCritical ? '⚠️ ' : ''}${msg}</p>
    `;
    
    interventionsList.prepend(alertEl);
    
    // Keep list manageable
    if (interventionsList.children.length > 5) {
      interventionsList.removeChild(interventionsList.lastChild);
    }
  }

  // Simulate real-time data changes
  function simulateActivity() {
    let lostCount = 0;
    let gotitCount = 0;
    
    // Randomly update 1-3 students
    const numUpdates = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numUpdates; i++) {
      const targetIdx = Math.floor(Math.random() * TOTAL_STUDENTS);
      const student = students[targetIdx];
      
      // Random state change
      const rand = Math.random();
      student.element.classList.remove('gotit', 'lost');
      
      if (rand < 0.15) {
        student.status = 'lost';
        student.element.classList.add('lost');
      } else if (rand < 0.4) {
        student.status = 'gotit';
        student.element.classList.add('gotit');
      } else {
        student.status = 'neutral';
      }
    }
    
    // Recalculate totals
    students.forEach(s => {
      if (s.status === 'lost') lostCount++;
      if (s.status === 'gotit') gotitCount++;
    });
    
    // Update DOM
    lostCountEl.textContent = lostCount;
    gotitCountEl.textContent = gotitCount;
    
    // Trigger alert if spike in confusion
    if (lostCount > 6 && Math.random() > 0.7) {
      addAlert(true);
    } else if (Math.random() > 0.8) {
      addAlert(false);
    }
  }

  // Initialize
  initClassroom();
  
  // Start simulation loop
  setInterval(simulateActivity, 2500);
  
  // Initial alert
  addAlert(false);
  
  // Button interaction
  document.querySelector('.action-btn').addEventListener('click', function(e) {
    const originalText = this.innerText;
    this.innerText = "✨ Generating Analogy...";
    this.style.opacity = "0.8";
    
    setTimeout(() => {
      this.innerText = "🔊 Analogy Broadcasted!";
      this.style.background = "linear-gradient(135deg, #10b981, #059669)";
      
      addAlert(false);
      interventionsList.firstChild.innerHTML = `
        <span class="alert-time">Just now</span>
        <p class="alert-msg">✨ Analogy deployed: "Chain rule is like unpacking Russian nesting dolls."</p>
      `;
      
      // Heal the students
      students.forEach(s => {
        if (s.status === 'lost') {
          s.element.classList.remove('lost');
          s.element.classList.add('gotit');
          s.status = 'gotit';
        }
      });
      
      setTimeout(() => {
        this.innerText = originalText;
        this.style.background = "";
        this.style.opacity = "1";
      }, 3000);
    }, 1500);
  });
});
