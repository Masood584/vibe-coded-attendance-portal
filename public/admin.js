async function createEmployee(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('create-employee-message');
  const button = document.getElementById('create-employee-button');
  const dialog = document.getElementById('create-employee-dialog');
  const formData = new FormData(form);
  message.textContent = 'Creating employee account...';
  message.className = 'admin-message';
  button.disabled = true;

  try {
    const response = await fetch('/api/auth/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.adminToken}`,
      },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not create employee');

    form.reset();
    dialog.close();
    document.getElementById('create-employee-notice').textContent = `${data.employee.name} account created successfully.`;
    await loadTeam();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

let employeeBeingEdited = null;

async function saveEmployeeChanges(event) {
  event.preventDefault();
  if (!employeeBeingEdited) return;

  const form = event.currentTarget;
  const message = document.getElementById('edit-employee-message');
  const button = document.getElementById('save-employee-button');
  const dialog = document.getElementById('edit-employee-dialog');
  message.textContent = 'Saving changes...';
  message.className = 'admin-message';
  button.disabled = true;

  try {
    const response = await fetch(`/api/auth/employees/${encodeURIComponent(employeeBeingEdited._id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.adminToken}`,
      },
      body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Could not update employee');

    dialog.close();
    document.getElementById('create-employee-notice').textContent = `${data.employee.name}'s details updated successfully.`;
    employeeBeingEdited = null;
    await loadTeam();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function api(path) {
  const response = await fetch(`/api/attendance/${path}`, {
    headers: { Authorization: `Bearer ${window.adminToken}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';
}

function addCell(row, text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

function showEmptyRow(body, columns, text) {
  const row = document.createElement('tr');
  const cell = addCell(row, text);
  cell.colSpan = columns;
  cell.className = 'empty-state';
  body.appendChild(row);
}

function formatBreakSummary(attendance) {
  const sessions = attendance?.breakSessions || [];
  if (!sessions.length) {
    return attendance?.breakIn && attendance?.breakOut
      ? `${formatTime(attendance.breakIn)} – ${formatTime(attendance.breakOut)}`
      : '--:--';
  }

  return sessions
    .map((session) => {
      const start = session.start ? formatTime(session.start) : '--:--';
      const end = session.end ? formatTime(session.end) : 'Active';
      return `${start} – ${end}`;
    })
    .join(', ');
}

function renderTeam(employees) {
  const body = document.getElementById('team-body');
  body.replaceChildren();
  if (!employees.length) {
    showEmptyRow(body, 7, 'No employees found.');
    return;
  }

  employees.forEach((employee) => {
    const attendance = employee.attendance || {};
    const row = document.createElement('tr');
    const nameCell = addCell(row, employee.name);
    const contact = document.createElement('small');
    contact.textContent = employee.email;
    contact.style.display = 'block';
    contact.style.color = 'var(--muted)';
    nameCell.appendChild(contact);
    addCell(row, employee.department || '—');

    const flowCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `flow-badge ${employee.currentFlow.toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`;
    badge.textContent = employee.currentFlow;
    flowCell.appendChild(badge);
    row.appendChild(flowCell);

    addCell(row, formatTime(attendance.checkIn));
    addCell(row, formatBreakSummary(attendance));
    addCell(row, formatTime(attendance.checkOut));

    const actionCell = document.createElement('td');
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'history-button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => openEditEmployee(employee));
    actionCell.appendChild(editButton);
    row.appendChild(actionCell);
    body.appendChild(row);
  });
}

function openEditEmployee(employee) {
  employeeBeingEdited = employee;
  document.getElementById('edit-employee-name').value = employee.name;
  document.getElementById('edit-employee-department').value = employee.department || '';
  document.getElementById('edit-employee-message').textContent = '';
  document.getElementById('edit-employee-dialog').showModal();
  document.getElementById('edit-employee-name').focus();
}

async function loadTeam() {
  const message = document.getElementById('team-message');
  message.textContent = 'Loading employees...';
  message.className = 'admin-message';
  try {
    const employees = await api('team');
    renderTeam(employees);
    message.textContent = `Showing ${employees.length} employee${employees.length === 1 ? '' : 's'}.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

const createEmployeeDialog = document.getElementById('create-employee-dialog');
document.getElementById('open-create-employee').addEventListener('click', () => {
  document.getElementById('create-employee-form').reset();
  document.getElementById('create-employee-message').textContent = '';
  createEmployeeDialog.showModal();
  document.getElementById('employee-name').focus();
});
document.getElementById('close-create-employee').addEventListener('click', () => createEmployeeDialog.close());
document.getElementById('cancel-create-employee').addEventListener('click', () => createEmployeeDialog.close());
document.getElementById('create-employee-form').addEventListener('submit', createEmployee);
document.getElementById('refresh-team').addEventListener('click', loadTeam);

const editEmployeeDialog = document.getElementById('edit-employee-dialog');
document.getElementById('close-edit-employee').addEventListener('click', () => editEmployeeDialog.close());
document.getElementById('cancel-edit-employee').addEventListener('click', () => editEmployeeDialog.close());
document.getElementById('edit-employee-form').addEventListener('submit', saveEmployeeChanges);

document.getElementById('today-date').textContent = new Date().toDateString();
loadTeam();
