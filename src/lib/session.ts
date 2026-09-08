export async function logout(reason?: string) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage('CLEAR_RUNTIME_CACHE');
  }
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = reason ? `/login?error=${reason}` : '/login';
}
