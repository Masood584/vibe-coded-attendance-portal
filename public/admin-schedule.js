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

async function loadOfficeSettings() {
  const message = document.getElementById('office-settings-message');
  try {
    const settings = await api('team/settings');
    document.getElementById('office-start-time').value = settings.officeStartTime;
    document.getElementById('office-end-time').value = settings.officeEndTime;
    document.getElementById('grace-minutes').value = settings.graceMinutes;
    document.querySelectorAll('input[name="workingDays"]').forEach((input) => {
      input.checked = settings.workingDays.includes(Number(input.value));
    });
    message.textContent = `Current schedule: ${settings.officeStartTime}–${settings.officeEndTime}, ${settings.graceMinutes} minute grace.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById('office-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.getElementById('save-office-settings');
  const message = document.getElementById('office-settings-message');
  const workingDays = [...document.querySelectorAll('input[name="workingDays"]:checked')]
    .map((input) => Number(input.value));
  button.disabled = true;
  message.textContent = 'Saving schedule...';
  message.className = 'admin-message';
  try {
    const settings = await api('team/settings', {
      method: 'PUT',
      body: JSON.stringify({
        officeStartTime: document.getElementById('office-start-time').value,
        officeEndTime: document.getElementById('office-end-time').value,
        graceMinutes: Number(document.getElementById('grace-minutes').value),
        workingDays,
      }),
    });
    message.textContent = `Schedule saved: ${settings.officeStartTime}–${settings.officeEndTime}, ${settings.graceMinutes} minute grace.`;
    message.className = 'admin-message ok';
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadOfficeSettings();
