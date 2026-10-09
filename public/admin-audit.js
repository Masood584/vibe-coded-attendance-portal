async function loadAudit() {
  const message = document.getElementById('audit-message');
  const body = document.getElementById('audit-body');
  message.textContent = 'Loading audit log...';
  message.className = 'admin-message';
  try {
    const response = await fetch('/api/attendance/team/audit?limit=50', {
      headers: { Authorization: `Bearer ${window.adminToken}` },
    });
    const entries = await response.json();
    if (!response.ok) throw new Error(entries.message || 'Could not load audit log');
    body.replaceChildren();
    if (!entries.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'empty-state';
      cell.textContent = 'No attendance edits recorded yet.';
      row.appendChild(cell);
      body.appendChild(row);
    } else {
      const labels = {
        checkIn: 'Check in',
        breakIn: 'Break in',
        breakOut: 'Break out',
        checkOut: 'Check out',
        breakSessions: 'Break sessions',
        totalWorkMinutes: 'Total work minutes',
      };
      const formatBreakSessions = (sessions) => (sessions || [])
        .map((session, index) => {
          const start = session.start ? new Date(session.start).toLocaleString() : '—';
          const end = session.end ? new Date(session.end).toLocaleString() : 'Active';
          return `Break ${index + 1}: ${start} – ${end}`;
        })
        .join(', ') || 'None';
      const breakSessionsKey = (sessions) => (sessions || [])
        .map((session) => `${session.start ? new Date(session.start).toISOString() : ''}/${session.end ? new Date(session.end).toISOString() : ''}`)
        .join('|');
      entries.forEach((entry) => {
        const row = document.createElement('tr');
        [
          entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—',
          entry.admin?.name || 'Unknown admin',
          entry.employee?.name || 'Employee no longer available',
          entry.date,
        ].forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        const changesCell = document.createElement('td');
        changesCell.textContent = Object.keys(labels).filter((field) => {
          const before = entry.before?.[field] ?? null;
          const after = entry.after?.[field] ?? null;
          if (field === 'totalWorkMinutes') return before !== after;
          if (field === 'breakSessions') {
            return breakSessionsKey(before) !== breakSessionsKey(after);
          }
          return (before ? new Date(before).getTime() : null) !== (after ? new Date(after).getTime() : null);
        }).map((field) => {
          const before = entry.before?.[field];
          const after = entry.after?.[field];
          const format = (value) => {
            if (field === 'totalWorkMinutes') return value ?? 0;
            if (field === 'breakSessions') return formatBreakSessions(value);
            return value ? new Date(value).toLocaleString() : '—';
          };
          return `${labels[field]}: ${format(before)} → ${format(after)}`;
        }).join('; ');
        row.appendChild(changesCell);
        body.appendChild(row);
      });
    }
    message.textContent = `Showing ${entries.length} recent edit${entries.length === 1 ? '' : 's'}.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById('refresh-audit').addEventListener('click', loadAudit);
loadAudit();
