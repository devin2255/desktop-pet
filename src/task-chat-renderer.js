const form = document.getElementById('task-form');
const input = document.getElementById('task-input');
const error = document.getElementById('task-error');

function showError(text) {
  error.textContent = text;
  error.hidden = !text;
}

const submitButton = form.querySelector('.submit');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value;
  if (!text.trim()) {
    showError('先写一句要交给千问的任务。');
    input.focus();
    return;
  }
  showError('');
  submitButton.disabled = true;
  try {
    const result = await window.taskChat.submit(text);
    if (result?.ok) {
      window.taskChat.close();
      return;
    }
    showError('这句话没送出去，再试一次。');
    input.focus();
  } catch {
    showError('这句话没送出去，再试一次。');
    input.focus();
  } finally {
    submitButton.disabled = false;
  }
});

function closeChat() {
  window.taskChat.close();
}

document.getElementById('task-cancel').addEventListener('click', closeChat);
document.getElementById('task-close').addEventListener('click', closeChat);
document.body.addEventListener('mousedown', (event) => {
  if (event.target === document.body) closeChat();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.taskChat.close();
});

input.focus();
