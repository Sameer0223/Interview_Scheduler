document.getElementById("upload-form").addEventListener("submit", function (e) {
  e.preventDefault();
  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a CSV file.");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const csvText = event.target.result;
      const candidates = parseCSV(csvText);
      const assignments = generateSchedule(candidates);
      displaySchedule(assignments);
    } catch (error) {
      alert("Error processing CSV: " + error.message);
    }
  };
  reader.readAsText(file);
});

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV is empty or lacks data rows.");
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const expected = ["name", "april 14", "april 15", "april 16"];
  if (!headers.every((h, i) => h === expected[i])) {
    throw new Error(
      "Invalid CSV format. Expected columns: Name, April 14, April 15, April 16"
    );
  }
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    if (values.length !== 4) throw new Error(`Invalid row format: ${line}`);
    const [name, april14, april15, april16] = values;
    return {
      name,
      "April 14": april14,
      "April 15": april15,
      "April 16": april16,
    };
  });
}

function getSessions(day, availability) {
  if (availability === "None") return [];
  if (availability === "8:30-12:00") return [`${day} Morning`];
  if (availability === "14:30-18:00") return [`${day} Afternoon`];
  if (availability === "8:30-12:00|14:30-18:00")
    return [`${day} Morning`, `${day} Afternoon`];
  throw new Error(`Invalid availability format: ${availability}`);
}

function getCandidateSessions(candidate) {
  const available = [];
  ["April 14", "April 15", "April 16"].forEach((day) => {
    available.push(...getSessions(day, candidate[day]));
  });
  return { name: candidate.name, available };
}

function generateSchedule(data) {
  const sessionOrder = [
    "April 14 Morning",
    "April 14 Afternoon",
    "April 15 Morning",
    "April 15 Afternoon",
    "April 16 Morning",
    "April 16 Afternoon",
  ];

  const candidates = data
    .map(getCandidateSessions)
    .filter((c) => c.available.length > 0);
  candidates.sort((a, b) => a.available.length - b.available.length);

  const sessionCounts = Object.fromEntries(sessionOrder.map((s) => [s, 0]));
  const dayCounts = { "April 14": 0, "April 15": 0, "April 16": 0 };
  const assignments = Object.fromEntries(sessionOrder.map((s) => [s, []]));
  const dayOfSession = {
    "April 14 Morning": "April 14",
    "April 14 Afternoon": "April 14",
    "April 15 Morning": "April 15",
    "April 15 Afternoon": "April 15",
    "April 16 Morning": "April 16",
    "April 16 Afternoon": "April 16",
  };
  const maxSessionSize = 8; // Cap to ensure balance

  for (const candidate of candidates) {
    const sessionsByDay = {};
    candidate.available.forEach((session) => {
      const day = dayOfSession[session];
      if (!sessionsByDay[day]) sessionsByDay[day] = [];
      sessionsByDay[day].push(session);
    });

    const days = Object.keys(sessionsByDay);
    const minDayCount = Math.min(...days.map((day) => dayCounts[day]));
    const leastLoadedDays = days.filter(
      (day) => dayCounts[day] === minDayCount
    );

    let pickedSession = null;
    let minSessionCount = Infinity;

    // First, try to assign to sessions below the max size
    leastLoadedDays.forEach((day) => {
      const daySessions = sessionsByDay[day].filter(
        (session) => sessionCounts[session] < maxSessionSize
      );
      daySessions.forEach((session) => {
        if (sessionCounts[session] < minSessionCount) {
          minSessionCount = sessionCounts[session];
          pickedSession = session;
        } else if (
          sessionCounts[session] === minSessionCount &&
          sessionOrder.indexOf(session) < sessionOrder.indexOf(pickedSession)
        ) {
          pickedSession = session;
        }
      });
    });

    // If no session below max size is found, pick the least loaded available session
    if (!pickedSession) {
      candidate.available.forEach((session) => {
        if (sessionCounts[session] < minSessionCount) {
          minSessionCount = sessionCounts[session];
          pickedSession = session;
        } else if (
          sessionCounts[session] === minSessionCount &&
          sessionOrder.indexOf(session) < sessionOrder.indexOf(pickedSession)
        ) {
          pickedSession = session;
        }
      });
    }

    if (!pickedSession)
      throw new Error(`No valid session for ${candidate.name}`);
    assignments[pickedSession].push(candidate.name);
    sessionCounts[pickedSession]++;
    dayCounts[dayOfSession[pickedSession]]++;
  }

  return assignments;
}

function displaySchedule(assignments) {
  const scheduleDiv = document.getElementById("schedule");
  const grid = document.getElementById("schedule-grid");
  grid.innerHTML = "";

  const days = ["April 14", "April 15", "April 16"];
  days.forEach((day) => {
    const morning = assignments[`${day} Morning`] || [];
    const afternoon = assignments[`${day} Afternoon`] || [];

    const dayCol = document.createElement("div");
    dayCol.className = "col-md-4 mb-4";
    dayCol.innerHTML = `
            <h3>${day}</h3>
            <div class="session card mb-3 card-morning">
                <div class="card-body">
                    <h4 class="card-title">Morning (8:30-12:00) <span class="badge bg-primary">${
                      morning.length
                    } candidates</span></h4>
                    <ul>${morning
                      .map((name) => `<li>${name}</li>`)
                      .join("")}</ul>
                </div>
            </div>
            <div class="session card mb-3 card-afternoon">
                <div class="card-body">
                    <h4 class="card-title">Afternoon (14:30-18:00) <span class="badge bg-primary">${
                      afternoon.length
                    } candidates</span></h4>
                    <ul>${afternoon
                      .map((name) => `<li>${name}</li>`)
                      .join("")}</ul>
                </div>
            </div>
        `;
    grid.appendChild(dayCol);
  });

  scheduleDiv.style.display = "block";

  document
    .getElementById("download-excel")
    .addEventListener("click", () => downloadExcel(assignments));
  document
    .getElementById("download-pdf")
    .addEventListener("click", () => downloadPDF(assignments));
}

function downloadExcel(assignments) {
  const workbook = XLSX.utils.book_new();
  const days = ["April 14", "April 15", "April 16"];

  days.forEach((day) => {
    const morning = assignments[`${day} Morning`] || [];
    const afternoon = assignments[`${day} Afternoon`] || [];
    const sheetData = [
      [`${day} Morning (8:30-12:00)`, ...morning],
      [`${day} Afternoon (14:30-18:00)`, ...afternoon],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, day);
  });

  XLSX.writeFile(workbook, "Interview_Schedule.xlsx");
}

function downloadPDF(assignments) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const lineHeight = 10;
  let y = margin;

  function checkPageSpace(requiredHeight) {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  doc.setFontSize(16);
  doc.text("Interview Schedule", margin, y);
  y += lineHeight;
  doc.setFontSize(12);

  const days = ["April 14", "April 15", "April 16"];
  days.forEach((day) => {
    checkPageSpace(lineHeight);
    doc.text(day, margin, y);
    y += lineHeight;

    const morning = assignments[`${day} Morning`] || [];
    checkPageSpace(lineHeight * (2 + morning.length));
    doc.text(
      `Morning (8:30-12:00): ${morning.length} candidates`,
      margin + 10,
      y
    );
    morning.forEach((name, index) => {
      doc.text(
        `${index + 1}. ${name}`,
        margin + 20,
        y + (index + 1) * lineHeight
      );
    });
    y += (morning.length + 1) * lineHeight;

    const afternoon = assignments[`${day} Afternoon`] || [];
    checkPageSpace(lineHeight * (2 + afternoon.length));
    doc.text(
      `Afternoon (14:30-18:00): ${afternoon.length} candidates`,
      margin + 10,
      y
    );
    afternoon.forEach((name, index) => {
      doc.text(
        `${index + 1}. ${name}`,
        margin + 20,
        y + (index + 1) * lineHeight
      );
    });
    y += (afternoon.length + 1) * lineHeight;
  });

  doc.save("Interview_Schedule.pdf");
}
