document.getElementById('today-date').textContent = new Date().toDateString();

const api = async (path, method = 'GET') => {
  const res = await fetch(`/api/attendance/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${window.employeeToken}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

function getActiveBreak(record) {
  return (record.breakSessions || []).find((session) => !session.end) || null;
}

function renderTimeline(record) {
  const activeBreak = getActiveBreak(record);
  const steps = [
    ['checkin', record.checkIn],
    ['breakin', activeBreak ? activeBreak.start : record.breakIn],
    ['breakout', activeBreak ? new Date() : record.breakOut],
    ['checkout', record.checkOut],
  ];
  steps.forEach(([key, value]) => {
    const el = document.getElementById(`step-${key}`);
    el.classList.toggle('done', !!value);
    el.querySelector('.time').textContent = fmtTime(value);
  });
}

function renderButtons(record) {
  const btnCheckin = document.getElementById('btn-checkin');
  const btnBreakin = document.getElementById('btn-breakin');
  const btnBreakout = document.getElementById('btn-breakout');
  const btnCheckout = document.getElementById('btn-checkout');

  const hasCheckedIn = !!record.checkIn;
  const hasCheckedOut = !!record.checkOut;
  const activeBreak = getActiveBreak(record);
  const approvedLeave = !!record.approvedLeave;

  const canAttendToday = !approvedLeave || hasCheckedIn;
  btnCheckin.disabled = !canAttendToday || hasCheckedIn || hasCheckedOut;
  btnBreakin.disabled = !canAttendToday || !hasCheckedIn || hasCheckedOut || !!activeBreak;
  btnBreakout.disabled = !canAttendToday || !activeBreak;
  btnCheckout.disabled = !canAttendToday || !hasCheckedIn || hasCheckedOut || !!activeBreak;

  const notice = document.getElementById('leave-day-notice');
  notice.hidden = !approvedLeave;
  notice.textContent = approvedLeave
    ? hasCheckedIn
      ? 'Your leave is approved for today. You are already checked in, so you can complete your attendance flow.'
      : 'Your leave is approved for today. Attendance actions are disabled.'
    : '';

  const officeHours = document.getElementById('office-hours');
  if (record.officeSchedule) {
    officeHours.textContent = `Office hours: ${record.officeSchedule.officeStartTime} – ${record.officeSchedule.officeEndTime}`;
  }
  const earlyCheckoutNotice = document.getElementById('early-checkout-notice');
  const checkedOutEarly = record.checkOut && record.officeSchedule
    && new Date(record.checkOut).getHours() * 60 + new Date(record.checkOut).getMinutes()
      < Number(record.officeSchedule.officeEndTime.slice(0, 2)) * 60
        + Number(record.officeSchedule.officeEndTime.slice(3, 5));
  earlyCheckoutNotice.hidden = !checkedOutEarly;
  earlyCheckoutNotice.textContent = checkedOutEarly
    ? `You checked out before the scheduled office end time (${record.officeSchedule.officeEndTime}).`
    : '';
}

function showMsg(text, ok) {
  const el = document.getElementById('action-msg');
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.textContent = ''; }, 3500);
}

async function loadToday() {
  const record = await api('today');
  renderTimeline(record);
  renderButtons(record);
}

async function handleAction(path, successText) {
  try {
    await api(path, 'POST');
    showMsg(successText, true);
    await loadToday();
  } catch (err) {
    showMsg(err.message, false);
  }
}

document.getElementById('btn-checkin').addEventListener('click', () => handleAction('checkin', 'Checked in ✅'));
document.getElementById('btn-breakin').addEventListener('click', () => handleAction('breakin', 'Break started ☕'));
document.getElementById('btn-breakout').addEventListener('click', () => handleAction('breakout', 'Break ended, back to work 💪'));
document.getElementById('btn-checkout').addEventListener('click', () => handleAction('checkout', 'Checked out 👋'));

loadToday();
