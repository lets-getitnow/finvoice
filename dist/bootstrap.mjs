try {
  const {mountApp}=await import('./app.mjs');
  mountApp();
} catch {
  const status=document.getElementById('status');
  status.textContent='Finvoice could not start. Reload the page to try again.';
  status.hidden=false;
  status.dataset.error='true';
  document.getElementById('talk').disabled=true;
  document.getElementById('submit').disabled=true;
}
