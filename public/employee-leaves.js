async function api(path, options = {}) {
  const response = await fetch(`/api/attendance/${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${window.employeeToken}`,
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function renderLeaveRequests(requests) {
  const body = document.getElementById('my-leave-requests');
  body.replaceChildren();
  if (!requests.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'empty-state';
    cell.textContent = 'No leave requests yet.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  requests.forEach((request) => {
    const row = document.createElement('tr');
    [
      `${request.startDate} – ${request.endDate}`,
      request.reason,
      request.status,
      request.reviewedBy?.name || '—',
    ].forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

async function loadLeaveRequests() {
  const message = document.getElementById('leave-list-message');
  message.textContent = 'Loading your leave requests...';
  message.className = 'admin-message';
  try {
    renderLeaveRequests(await api('leave/mine'));
    message.textContent = 'Your leave requests are up to date.';
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

async function submitLeaveRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('leave-request-message');
  const button = document.getElementById('submit-leave-request');
  button.disabled = true;
  message.textContent = 'Submitting leave request...';
  message.className = 'msg';

  try {
    const formData = new FormData(form);
    await api('leave', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    form.reset();
    message.textContent = 'Leave request submitted for approval.';
    message.className = 'msg ok';
    await loadLeaveRequests();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'msg err';
  } finally {
    button.disabled = false;
  }
}

const todayDate = new Date();
const todayValue = [
  todayDate.getFullYear(),
  String(todayDate.getMonth() + 1).padStart(2, '0'),
  String(todayDate.getDate()).padStart(2, '0'),
].join('-');
document.getElementById('leave-start-date').min = todayValue;
document.getElementById('leave-end-date').min = todayValue;
document.getElementById('leave-start-date').addEventListener('change', (event) => {
  document.getElementById('leave-end-date').min = event.target.value || todayValue;
});
document.getElementById('leave-request-form').addEventListener('submit', submitLeaveRequest);
document.getElementById('refresh-leave-requests').addEventListener('click', loadLeaveRequests);
loadLeaveRequests();
