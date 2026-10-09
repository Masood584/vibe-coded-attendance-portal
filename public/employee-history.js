async function loadHistory() {
  const message = document.getElementById('history-message');
  const body = document.getElementById('history-body');
  message.textContent = 'Loading attendance history...';
  message.className = 'admin-message';
  try {
    const response = await fetch('/api/attendance/history?limit=90', {
      headers: { Authorization: `Bearer ${window.employeeToken}` },
    });
    const records = await response.json();
    if (!response.ok) throw new Error(records.message || 'Could not load attendance history');

    body.replaceChildren();
    if (!records.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'empty-state';
      cell.textContent = 'No attendance records yet.';
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      records.forEach((record) => {
        const row = document.createElement('tr');
        const formatTime = (value) => value
          ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '--:--';
        const formatBreaks = () => {
          const sessions = record.breakSessions || [];
          if (!sessions.length) {
            return record.breakIn && record.breakOut
              ? `${formatTime(record.breakIn)} – ${formatTime(record.breakOut)}`
              : '--:--';
          }
          return sessions
            .map((session) => `${formatTime(session.start)} – ${session.end ? formatTime(session.end) : 'Active'}`)
            .join(', ');
        };
        [
          record.date,
          formatTime(record.checkIn),
          formatBreaks(),
          formatTime(record.checkOut),
          record.totalWorkMinutes ? (record.totalWorkMinutes / 60).toFixed(2) : '—',
        ].forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        body.appendChild(row);
      });
    }
    message.textContent = `Showing ${records.length} recent record${records.length === 1 ? '' : 's'}.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById('refresh-history').addEventListener('click', loadHistory);
loadHistory();
