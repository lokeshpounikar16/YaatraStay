const form = document.querySelector('#booking-form');

if (form) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  const toast = document.querySelector('.toast');
  const data = Object.fromEntries(new FormData(form));
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'We could not save your request.');
    toast.textContent = `Reservation request received. Reference: ${result.reservationId.slice(0, 8)}.`;
    form.reset();
  } catch (error) {
    toast.textContent = error.message;
  } finally {
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 5000);
    button.disabled = false;
    button.innerHTML = 'Find a room <span>→</span>';
  }
});
