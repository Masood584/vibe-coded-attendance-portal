async function api(path, options = {}) {
  const response = await fetch(`/api/attendance/${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${window.adminToken}`,
      ...options.headers,
    },
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

function renderLeaveRequests(requests) {
  const body = document.getElementById('leave-requests-body');
  body.replaceChildren();
  if (!requests.length) {
    const row = document.createElement('tr');
    const cell = addCell(row, 'No leave requests yet.');
    cell.colSpan = 5;
    cell.className = 'empty-state';
    body.appendChild(row);
    return;
  }
  requests.sort((left, right) => Number(right.status === 'pending') - Number(left.status === 'pending'));
  requests.forEach((request) => {
    const row = document.createElement('tr');
    addCell(row, request.employee?.name || 'Employee unavailable');
    addCell(row, `${request.startDate} – ${request.endDate}`);
    addCell(row, request.reason);
    addCell(row, request.status);
    const actionCell = addCell(row, '');
    if (request.status === 'pending') {
      ['approved', 'rejected'].forEach((status) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = status === 'approved' ? 'history-button' : 'leave-reject-button';
        button.textContent = status === 'approved' ? 'Approve' : 'Reject';
        button.addEventListener('click', () => reviewLeaveRequest(request._id, status));
        actionCell.appendChild(button);
      });
    } else {
      actionCell.textContent = request.reviewedBy?.name ? `By ${request.reviewedBy.name}` : '—';
    }
    body.appendChild(row);
  });
}

async function loadLeaveRequests() {
  const message = document.getElementById('leave-requests-message');
  message.textContent = 'Loading leave requests...';
  message.className = 'admin-message';
  try {
    const requests = await api('leave');
    renderLeaveRequests(requests);
    const pending = requests.filter((request) => request.status === 'pending').length;
    message.textContent = `${pending} pending request${pending === 1 ? '' : 's'} · ${requests.length} total.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

async function reviewLeaveRequest(requestId, status) {
  const message = document.getElementById('leave-requests-message');
  try {
    await api(`leave/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadLeaveRequests();
  } catch (error) {
    message.textContent = error.message;
    message.className = 'admin-message';
  }
}

document.getElementById('refresh-leave-requests').addEventListener('click', loadLeaveRequests);
loadLeaveRequests();
