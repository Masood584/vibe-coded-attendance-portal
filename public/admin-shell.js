const adminUser = JSON.parse(localStorage.getItem('user') || 'null');
window.adminToken = localStorage.getItem('token');

if (!window.adminToken || !adminUser) {
  window.location.href = 'login.html';
  throw new Error('Not authenticated, redirecting to login');
}

if (adminUser.role !== 'admin') {
  window.location.href = 'index.html';
  throw new Error('Employee account, redirecting to employee dashboard');
}

document.getElementById('user-info').textContent = `${adminUser.name} (admin)`;
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
});

const adminDrawer = document.getElementById('admin-drawer');
const drawerToggle = document.getElementById('drawer-toggle');
const drawerBackdrop = document.getElementById('drawer-backdrop');

function closeAdminDrawer() {
  adminDrawer.classList.remove('open');
  drawerBackdrop.classList.remove('visible');
  drawerToggle.setAttribute('aria-expanded', 'false');
}

drawerToggle.addEventListener('click', () => {
  const isOpen = adminDrawer.classList.toggle('open');
  drawerBackdrop.classList.toggle('visible', isOpen);
  drawerToggle.setAttribute('aria-expanded', String(isOpen));
});
drawerBackdrop.addEventListener('click', closeAdminDrawer);
adminDrawer.querySelectorAll('.drawer-link').forEach((link) => {
  link.addEventListener('click', closeAdminDrawer);
});
