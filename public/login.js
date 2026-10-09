const form = document.getElementById('auth-form');
const errorMsg = document.getElementById('error-msg');
const switchLink = document.getElementById('switch-link');
const switchText = document.getElementById('switch-text');
const nameField = document.getElementById('name-field');
const formTitle = document.getElementById('form-title');
const formSub = document.getElementById('form-sub');
const submitBtn = document.getElementById('submit-btn');

function dashboardFor(user) {
  return user?.role === 'admin' ? 'admin.html' : 'index.html';
}

// already logged in? go straight to the correct dashboard
if (localStorage.getItem('token')) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  window.location.href = dashboardFor(user);
}

let mode = 'login'; // or 'register'

switchLink.addEventListener('click', (e) => {
  e.preventDefault();
  mode = mode === 'login' ? 'register' : 'login';
  const isRegister = mode === 'register';

  nameField.style.display = isRegister ? 'block' : 'none';
  formTitle.textContent = isRegister ? 'Create your account' : 'Welcome back';
  formSub.textContent = isRegister ? 'Register once, then login daily' : 'Login to mark your attendance';
  submitBtn.textContent = isRegister ? 'Register' : 'Login';
  switchText.textContent = isRegister ? 'Already have an account?' : 'New employee?';
  switchLink.textContent = isRegister ? 'Login here' : 'Create an account';
  errorMsg.textContent = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const name = document.getElementById('name').value.trim();

  const url = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
  const body = mode === 'login' ? { email, password } : { name, email, password };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.message || 'Something went wrong';
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = dashboardFor(data.user);
  } catch (err) {
    errorMsg.textContent = 'Could not reach server. Is the backend running?';
  }
});
