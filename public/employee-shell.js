const employeeUser = JSON.parse(localStorage.getItem('user') || 'null');
window.employeeToken = localStorage.getItem('token');

if (!window.employeeToken || !employeeUser) {
  window.location.href = 'login.html';
  throw new Error('Not authenticated, redirecting to login');
}

if (employeeUser.role !== 'employee') {
  window.location.href = 'admin.html';
  throw new Error('Admin account, redirecting to admin dashboard');
}

document.getElementById('user-info').textContent = `${employeeUser.name} (employee)`;
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

const employeeDrawer = document.getElementById('admin-drawer');
const drawerToggle = document.getElementById('drawer-toggle');
const drawerBackdrop = document.getElementById('drawer-backdrop');

function closeEmployeeDrawer() {
  employeeDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('visible');
  drawerToggle.setAttribute('aria-expanded', 'false');
}

drawerToggle.addEventListener('click', () => {
  const isOpen = employeeDrawer.classList.toggle('open');
  drawerBackdrop.classList.toggle('visible', isOpen);
  drawerToggle.setAttribute('aria-expanded', String(isOpen));
});
drawerBackdrop.addEventListener('click', closeEmployeeDrawer);
employeeDrawer.querySelectorAll('.drawer-link').forEach((link) => {
  link.addEventListener('click', closeEmployeeDrawer);
});
