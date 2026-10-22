// FILE: popup.js
import * as DB from './modules/db.js';

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  window.close();
});

(async () => {
  try {
    const leads = await DB.getAllLeads();
    const total = leads.length;
    const msgs = leads.filter(l => l.messageText && l.messageText.trim()).length;
    document.getElementById('statTotal').textContent = total.toLocaleString('pt-BR');
    document.getElementById('statMsgs').textContent = msgs.toLocaleString('pt-BR');
  } catch (e) {
    console.warn('Não foi possível ler o banco:', e);
  }
})();