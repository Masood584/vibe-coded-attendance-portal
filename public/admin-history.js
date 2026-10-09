const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
document.getElementById('report-from').value = [
  firstOfMonth.getFullYear(),
  String(firstOfMonth.getMonth() + 1).padStart(2, '0'),
  String(firstOfMonth.getDate()).padStart(2, '0'),
].join('-');
document.getElementById('report-to').value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

async function api(path) {
  const response = await fetch(`/api/attendance/${path}`, {
    headers: { Authorization: `Bearer ${window.adminToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
}

function formatDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function addBreakSessionRow(session = {}) {
  const list = document.getElementById('break-sessions-editor');
  const row = document.createElement('div');
  row.className = 'break-edit-row';

  const startLabel = document.createElement('label');
  startLabel.textContent = `Break ${list.children.length + 1} start`;
  const startInput = document.createElement('input');
  startInput.type = 'datetime-local';
  startInput.name = 'breakStart';
  startInput.required = true;
  startInput.value = formatDateTimeInput(session.start);
  startLabel.appendChild(startInput);

  const endLabel = document.createElement('label');
  endLabel.textContent = `Break ${list.children.length + 1} end`;
  const endInput = document.createElement('input');
  endInput.type = 'datetime-local';
  endInput.name = 'breakEnd';
  endInput.value = formatDateTimeInput(session.end);
  endLabel.appendChild(endInput);

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'dialog-cancel remove-break-session';
  removeButton.textContent = 'Remove';
  removeButton.setAttribute('aria-label', `Remove break ${list.children.length + 1}`);
  row.append(startLabel, endLabel, removeButton);
  list.appendChild(row);
}

function renumberBreakSessionRows() {
  document.querySelectorAll('#break-sessions-editor .break-edit-row').forEach((row, index) => {
    const number = index + 1;
    row.querySelector('label:first-child').firstChild.textContent = `Break ${number} start`;
    row.querySelector('label:nth-child(2)').firstChild.textContent = `Break ${number} end`;
    row.querySelector('.remove-break-session').setAttribute('aria-label', `Remove break ${number}`);
  });
}

function renderBreakSessions(sessions) {
  const list = document.getElementById('break-sessions-editor');
  list.replaceChildren();
  sessions.forEach((session) => addBreakSessionRow(session));
}

let allRecords = [];
let recordBeingEdited = null;

function formatBreakSummary(record) {
  const sessions = record.breakSessions || [];
  if (!sessions.length) {
    return record.breakIn && record.breakOut
      ? `${formatTime(record.breakIn)} – ${formatTime(record.breakOut)}`
      : '--:--';
  }
  return sessions
    .map((session) => `${formatTime(session.start)} – ${session.end ? formatTime(session.end) : 'Active'}`)
    .join(', ');
}

function renderHistory() {
  const body = document.getElementById('history-body');
  const selectedId = document.getElementById('employee-filter').value;
  const records = selectedId
    ? allRecords.filter((record) => record.user._id === selectedId)
    : allRecords;
  body.replaceChildren();

  if (!records.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 8;
    cell.className = 'empty-state';
    cell.textContent = selectedId ? 'No attendance records for this employee.' : 'No attendance records found.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  records.forEach((record) => {
    const row = document.createElement('tr');
    addCell(row, record.user.name);
    addCell(row, record.user.department || '—');
    addCell(row, record.date);
    addCell(row, formatTime(record.checkIn));
    addCell(row, formatBreakSummary(record));
    addCell(row, formatTime(record.checkOut));
    addCell(row, record.totalWorkMinutes ? (record.totalWorkMinutes / 60).toFixed(2) : '—');
    const actionCell = addCell(row, '');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'history-button';
    editButton.textContent = 'Edit times';
    editButton.addEventListener('click', () => openAttendanceEditor(record));
    actionCell.appendChild(editButton);
    body.appendChild(row);
  });
}

function openAttendanceEditor(record) {
  recordBeingEdited = record;
  document.getElementById('edit-attendance-employee').textContent =
    `${record.user.name} · ${record.date}`;
  ['checkIn', 'checkOut'].forEach((field) => {
    document.getElementById(`edit-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`).value =
      formatDateTimeInput(record[field]);
  });
  const sessions = record.breakSessions?.length
    ? record.breakSessions
    : record.breakIn
      ? [{ start: record.breakIn, end: record.breakOut }]
      : [];
  renderBreakSessions(sessions);
  document.getElementById('edit-attendance-message').textContent = '';
  document.getElementById('edit-attendance-dialog').showModal();
}

async function saveAttendanceTimes(event) {
  event.preventDefault();
  if (!recordBeingEdited) return;

  const form = event.currentTarget;
  const message = document.getElementById('edit-attendance-message');
  const button = document.getElementById('save-attendance-button');
  const payload = {};
  ['checkIn', 'checkOut'].forEach((field) => {
    const value = form.elements[field].value;
    payload[field] = value ? new Date(value).toISOString() : null;
  });
  payload.breakSessions = [...document.querySelectorAll('#break-sessions-editor .break-edit-row')].map((row) => {
    const start = row.querySelector('[name="breakStart"]').value;
    const end = row.querySelector('[name="breakEnd"]').value;
    return {
      start: start ? new Date(start).toISOString() : '',
      end: end ? new Date(end).toISOString() : null,
    };
  });

  message.textContent = 'Saving attendance times...';
  message.className = 'admin-message';
  button.disabled = true;

  try {
    const response = await fetch(`/api/attendance/team/records/${encodeURIComponent(recordBeingEdited._id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.adminToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not update attendance');

    document.getElementById('edit-attendance-dialog').close();
    recordBeingEdited = null;
    await loadHistory();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadHistory() {
  const message = document.getElementById('history-message');
  message.textContent = 'Loading attendance records...';
  message.className = 'admin-message';

  try {
    const [employees, records] = await Promise.all([
      api('team'),
      api('team/history'),
    ]);
    const filter = document.getElementById('employee-filter');
    const selectedId = filter.value;
    filter.replaceChildren();

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All employees';
    filter.appendChild(allOption);

    employees.forEach((employee) => {
      const option = document.createElement('option');
      option.value = employee._id;
      option.textContent = employee.name;
      filter.appendChild(option);
    });
    filter.value = employees.some((employee) => employee._id === selectedId) ? selectedId : '';

    allRecords = records;
    renderHistory();
    message.textContent = `Showing ${allRecords.length} attendance record${allRecords.length === 1 ? '' : 's'}.`;
    message.className = 'admin-message ok';
  } catch (error) {
    allRecords = [];
    renderHistory();
    message.textContent = error.message;
  }
}

async function exportReport() {
  const message = document.getElementById('export-message');
  const params = new URLSearchParams();
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  const employeeId = document.getElementById('employee-filter').value;
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (employeeId) params.set('employeeId', employeeId);
  message.textContent = 'Preparing CSV report...';
  message.className = 'admin-message';

  try {
    const response = await fetch(`/api/attendance/team/export.csv?${params}`, {
      headers: { Authorization: `Bearer ${window.adminToken}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Could not export report');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `attendance-${from || 'all'}-to-${to || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    message.textContent = 'CSV report downloaded.';
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
    message.className = 'admin-message';
  }
}

document.getElementById('employee-filter').addEventListener('change', renderHistory);
document.getElementById('refresh-history').addEventListener('click', loadHistory);
document.getElementById('export-report').addEventListener('click', exportReport);
const editAttendanceDialog = document.getElementById('edit-attendance-dialog');
document.getElementById('add-break-session').addEventListener('click', () => addBreakSessionRow());
document.getElementById('break-sessions-editor').addEventListener('click', (event) => {
  const removeButton = event.target.closest('.remove-break-session');
  if (removeButton) {
    removeButton.closest('.break-edit-row').remove();
    renumberBreakSessionRows();
  }
});
document.getElementById('close-edit-attendance').addEventListener('click', () => editAttendanceDialog.close());
document.getElementById('cancel-edit-attendance').addEventListener('click', () => editAttendanceDialog.close());
document.getElementById('edit-attendance-form').addEventListener('submit', saveAttendanceTimes);
loadHistory();
