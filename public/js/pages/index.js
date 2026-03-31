import { api } from '../api.js';
import { renderHeader } from '../components.js';

async function init() {
  // Check if already authenticated
  const me = await api.getMe();
  if (me) {
    window.location.href = '/dashboard.html';
    return;
  }

  // Render header (no user)
  document.getElementById('header').appendChild(renderHeader(null));

  // Registration form
  const form = document.getElementById('register-form');
  const errorEl = document.getElementById('register-error');
  const registerBtn = document.getElementById('register-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.innerHTML = '';
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating...';

    const displayName = document.getElementById('displayName').value.trim();
    const email = document.getElementById('email').value.trim();

    const result = await api.register(displayName, email || undefined);

    if (result.error) {
      errorEl.innerHTML = `<div class="error-message">${result.error}</div>`;
      // If duplicate email (409), add a link to switch to login form
      if (result.error.includes('already exists')) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = 'Go to Reconnect form';
        link.style.display = 'block';
        link.style.textAlign = 'center';
        link.style.marginTop = '8px';
        link.addEventListener('click', (ev) => {
          ev.preventDefault();
          document.getElementById('show-login')?.click();
        });
        errorEl.appendChild(link);
      }
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Workspace';
      return;
    }

    // Show credentials
    document.getElementById('register-section').style.display = 'none';
    document.getElementById('login-toggle').style.display = 'none';
    const credSection = document.getElementById('credentials-section');
    credSection.style.display = 'block';

    document.getElementById('credentials').innerHTML = `
      <dt>Schema Name</dt>
      <dd>${result.schemaName}</dd>
      <dt>Status</dt>
      <dd>Ready</dd>
    `;

    document.getElementById('continue-btn').addEventListener('click', () => {
      window.location.href = '/dashboard.html';
    });
  });

  // Toggle login/register forms
  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('register-section').style.display = 'none';
    document.getElementById('login-toggle').style.display = 'none';
    document.getElementById('login-section').style.display = 'block';
  });

  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('register-section').style.display = 'block';
    document.getElementById('login-toggle').style.display = 'block';
  });

  // Login form
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.innerHTML = '';

    const schemaName = document.getElementById('loginSchema').value.trim();
    const password = document.getElementById('loginPassword').value;

    const result = await api.login(schemaName, password);

    if (result.error) {
      loginError.innerHTML = `<div class="error-message">${result.error}</div>`;
      return;
    }

    window.location.href = '/dashboard.html';
  });
}

init();
