(() => {
  const els = {
    kicker: document.getElementById('kicker'),
    title: document.getElementById('title'),
    sub: document.getElementById('sub'),
    origin: document.getElementById('origin'),
    verse: document.getElementById('verse'),
    almanac: document.getElementById('almanac'),
    flower: document.getElementById('flower'),
    grid: document.getElementById('grid')
  };

  function formatDate(monthDay, exactToday) {
    if (!Array.isArray(monthDay) || monthDay.length !== 2) return '';
    if (exactToday) return '今日';
    return `约 ${monthDay[0]} 月 ${monthDay[1]} 日`;
  }

  function render(payload) {
    const moments = Array.isArray(payload?.moments) ? payload.moments : [];
    const current = moments.find((item) => item.id === payload.currentId) || moments[0];
    const exactToday = Boolean(payload.todayExact && current && current.id === payload.todayId);
    els.kicker.textContent = payload.petName ? `${payload.petName} · 节气历` : '节气历';
    els.title.textContent = current?.name || '时令';
    els.sub.textContent = current ? formatDate(current.monthDay, exactToday) : '';
    els.origin.textContent = current?.origin || current?.know || current?.greeting || '';
    if (els.verse) els.verse.textContent = current?.verse || '';
    if (els.almanac) els.almanac.textContent = current?.almanac || '';
    if (els.flower) els.flower.textContent = current?.flower || '';
    els.grid.innerHTML = '';
    moments.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      const isExact = Boolean(payload.todayExact && item.id === payload.todayId);
      if (isExact) button.classList.add('today');
      button.setAttribute('aria-pressed', String(item.id === payload.currentId));
      button.innerHTML = `${item.name}<small>${formatDate(item.monthDay, isExact)}</small>`;
      button.addEventListener('click', async () => {
        await window.calendarApi.select(item.id);
        const next = await window.calendarApi.get();
        render(next);
      });
      els.grid.appendChild(button);
    });
  }

  window.calendarApi.onUpdate(render);
  window.calendarApi.get().then(render);
})();
