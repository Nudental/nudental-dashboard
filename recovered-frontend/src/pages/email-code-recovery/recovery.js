import { createClient } from '@supabase/supabase-js';
import { dashboardEnvironment } from '../../config/dashboardEnvironment';
import { requirements } from '../reset-password/passwordRequirements';

const { auth } = createClient(dashboardEnvironment.supabaseUrl, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'nu-password-recovery',
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const byId = (id) => document.getElementById(id);
const verify = byId('verify');
const change = byId('change');
const email = byId('email');
const code = byId('code');
const password = byId('password');
const confirm = byId('confirm');
let verifiedUserId;
let busy = false;

function announce(message, error = false) {
  const status = byId('status');
  status.dataset.error = String(error);
  status.textContent = message;
}
function show(form, title) {
  verify.hidden = form !== verify;
  change.hidden = form !== change;
  byId('heading').textContent = title;
  byId('heading').focus();
}
async function submit(action) {
  if (busy) return;
  busy = true;
  const controls = document.querySelectorAll('button, input');
  controls.forEach((control) => { control.disabled = true; });
  announce('');
  try {
    await action();
  } catch {
    announce('The portal could not connect. Check your connection and try again.', true);
  } finally {
    controls.forEach((control) => { control.disabled = false; });
    busy = false;
  }
}

byId('resend').addEventListener('click', () => {
  if (!email.reportValidity()) return;
  submit(async () => {
    const { error } = await auth.resetPasswordForEmail(email.value.trim(), {
      redirectTo: new URL('/recover-account', location.origin).href,
    });
    if (error) {
      announce(error.status === 429 ? 'Please wait a minute before requesting another code.' : 'The code request did not finish. Please try again.', true);
      return;
    }
    code.value = '';
    announce('If this email has a portal account, a new code is on its way. Use the most recent email.');
  });
});

verify.addEventListener('submit', (event) => {
  event.preventDefault();
  submit(async () => {
    const address = email.value.trim().toLowerCase();
    const { data, error } = await auth.verifyOtp({ email: address, token: code.value.trim(), type: 'recovery' });
    if (error || !data.session || !data.user?.id || data.user.email?.toLowerCase() !== address) {
      announce(error?.status === 429 ? 'Too many attempts. Please wait before trying again.' : 'The code could not be verified. Use the most recent code or request a new one.', true);
      return;
    }
    verifiedUserId = data.user.id;
    code.value = '';
    byId('identity').textContent = 'Choose a new password for ' + address + '.';
    show(change, 'Choose a new password');
  });
});

change.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requirements.every((rule) => rule.test(password.value))) {
    announce('Your password must meet all the requirements shown above.', true);
    password.focus();
    return;
  }
  if (password.value !== confirm.value) {
    announce('The passwords do not match. Enter the same password in both fields.', true);
    confirm.focus();
    return;
  }
  submit(async () => {
    const { data } = await auth.getSession();
    if (!verifiedUserId || data.session?.user?.id !== verifiedUserId) {
      change.reset();
      show(verify, 'Reset your password');
      announce('Your reset session expired. Request a new code to continue.', true);
      return;
    }
    const { error } = await auth.updateUser({ password: password.value });
    if (error) {
      announce(error.message || 'Please try again or request a new code.', true);
      return;
    }
    change.reset();
    verify.reset();
    verifiedUserId = undefined;
    show(null, 'Your password has been updated');
    announce('Sign in to NU Dashboard with your new password.');
    // The short-lived recovery session belongs only to this page.
    await auth.signOut({ scope: 'local' }).catch(() => {});
  });
});

byId('policy').textContent = requirements.map((rule) => rule.label).join(' · ');
verify.hidden = false;
