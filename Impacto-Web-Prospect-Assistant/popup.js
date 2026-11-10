// FILE: popup.js
import * as DB from './modules/db.js';

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});

document.getElementById('quickAnalyze').addEventListener('click', () => {
  const value = document.getElementById('quickHandle').value.trim();
  const url = new URL(chrome.runtime.getURL('dashboard.html'));
  if (value) url.searchParams.set('instagram', value);
  chrome.tabs.create({ url: url.href });
  window.close();
});

document.getElementById('quickHandle').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('quickAnalyze').click();
});

(async () => {
  try {
    const leads = await DB.getAllLeads();
    const total = leads.length;
    const hot = leads.filter(l => Number(l.score || 0) >= 4).length;
    const msgs = leads.filter(l => l.messageText && l.messageText.trim()).length;
    document.getElementById('statTotal').textContent = total.toLocaleString('pt-BR');
    document.getElementById('statHot').textContent = hot.toLocaleString('pt-BR');
    document.getElementById('statMsgs').textContent = msgs.toLocaleString('pt-BR');
  } catch (e) {
    console.warn('Não foi possível ler o banco:', e);
  }
})();
