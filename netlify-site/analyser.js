(() => {
  const storageKey = 'pv-market-lab-holdings-v1';
  const rows = document.querySelector('#holding-rows');
  const emptyState = document.querySelector('#empty-state');
  const horizon = document.querySelector('#horizon');
  const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const riskSpread = { low: 0.04, medium: 0.08, high: 0.14 };
  let holdings = loadHoldings();

  function loadHoldings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter(item => item && typeof item === 'object') : [];
    } catch { return []; }
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(holdings)); } catch { /* The planner still works when storage is unavailable. */ }
  }
  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }
  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function addHolding(kind = 'Stock') {
    holdings.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), name: '', kind, invested: 0, value: 0, rate: 10, risk: 'medium' });
    save(); render();
    rows.querySelector('tr:last-child input')?.focus();
  }
  function render() {
    rows.innerHTML = holdings.map((item, index) => `
      <tr data-id="${escapeText(item.id)}">
        <td><input data-key="name" aria-label="Asset name, row ${index + 1}" maxlength="60" placeholder="e.g. My index fund" value="${escapeText(item.name || '')}"></td>
        <td><select data-key="kind" aria-label="Asset type, row ${index + 1}"><option ${item.kind === 'Stock' ? 'selected' : ''}>Stock</option><option ${item.kind === 'Mutual fund' ? 'selected' : ''}>Mutual fund</option></select></td>
        <td><input data-key="invested" aria-label="Amount invested in rupees, row ${index + 1}" type="number" min="0" step="100" value="${safeNumber(item.invested)}"></td>
        <td><input data-key="value" aria-label="Current value in rupees, row ${index + 1}" type="number" min="0" step="100" value="${safeNumber(item.value)}"></td>
        <td><input class="return-input" data-key="rate" aria-label="Expected annual return percent, row ${index + 1}" type="number" min="-50" max="100" step="0.5" value="${Number.isFinite(Number(item.rate)) ? Number(item.rate) : 10}"></td>
        <td><select data-key="risk" aria-label="Scenario width, row ${index + 1}"><option value="low" ${item.risk === 'low' ? 'selected' : ''}>Lower</option><option value="medium" ${!item.risk || item.risk === 'medium' ? 'selected' : ''}>Medium</option><option value="high" ${item.risk === 'high' ? 'selected' : ''}>Higher</option></select></td>
        <td><button class="remove-row" type="button" aria-label="Remove ${escapeText(item.name || `row ${index + 1}`)}">×</button></td>
      </tr>`).join('');
    emptyState.hidden = holdings.length > 0;
    update();
  }
  function projections(years) {
    return holdings.reduce((totals, item) => {
      const value = safeNumber(item.value);
      const rate = Math.max(-0.5, Math.min(1, Number(item.rate) / 100 || 0));
      const spread = riskSpread[item.risk] ?? riskSpread.medium;
      const compound = annualRate => value * Math.pow(1 + annualRate, years);
      totals.current += value;
      totals.invested += safeNumber(item.invested);
      totals.downside += compound(Math.max(-0.95, rate - spread));
      totals.base += compound(rate);
      totals.upside += compound(Math.min(2, rate + spread));
      return totals;
    }, { current: 0, invested: 0, downside: 0, base: 0, upside: 0 });
  }
  function update() {
    const years = Number(horizon.value) || 3;
    const total = projections(years);
    document.querySelector('#current-total').textContent = money.format(total.current);
    document.querySelector('#base-total').textContent = money.format(total.base);
    document.querySelector('#scenario-base-total').textContent = money.format(total.base);
    document.querySelector('#range-total').textContent = `${money.format(total.downside)} — ${money.format(total.upside)}`;
    document.querySelector('#downside-total').textContent = money.format(total.downside);
    document.querySelector('#upside-total').textContent = money.format(total.upside);
    document.querySelector('#horizon-caption').textContent = `${years} ${years === 1 ? 'YEAR' : 'YEARS'}`;
    const pnl = total.current - total.invested;
    const pnlText = total.invested ? `${pnl >= 0 ? '+' : '−'}${money.format(Math.abs(pnl))} unrealised vs invested` : 'Add invested amounts to see current gain / loss';
    document.querySelector('#invested-caption').textContent = pnlText;
    const change = total.current ? ((total.base / total.current) - 1) * 100 : 0;
    document.querySelector('#base-change').textContent = total.current ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}% over ${years} ${years === 1 ? 'year' : 'years'} in this scenario` : 'Uses your expected annual returns';
    document.querySelector('#downside-caption').textContent = `Expected return less each holding’s risk band over ${years} ${years === 1 ? 'year' : 'years'}`;
    document.querySelector('#upside-caption').textContent = `Expected return plus each holding’s risk band over ${years} ${years === 1 ? 'year' : 'years'}`;
    const max = Math.max(total.upside, total.current, 1);
    document.querySelector('#downside-bar').style.width = `${Math.max(2, total.downside / max * 100)}%`;
    document.querySelector('#base-bar').style.width = `${Math.max(2, total.base / max * 100)}%`;
    document.querySelector('#upside-bar').style.width = `${Math.max(2, total.upside / max * 100)}%`;
  }
  function csvRows() {
    const years = Number(horizon.value) || 3;
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [['Asset', 'Type', 'Invested (INR)', 'Current value (INR)', 'Expected annual return (%)', 'Risk band', `Downside ${years}y (INR)`, `Base ${years}y (INR)`, `Upside ${years}y (INR)`]];
    holdings.forEach(item => {
      const current = safeNumber(item.value);
      const rate = Math.max(-0.5, Math.min(1, Number(item.rate) / 100 || 0));
      const spread = riskSpread[item.risk] ?? riskSpread.medium;
      const future = annualRate => current * Math.pow(1 + annualRate, years);
      lines.push([item.name || 'Untitled', item.kind || 'Stock', safeNumber(item.invested), current, Number(item.rate) || 0, item.risk || 'medium', future(Math.max(-0.95, rate - spread)).toFixed(0), future(rate).toFixed(0), future(Math.min(2, rate + spread)).toFixed(0)]);
    });
    return lines.map(line => line.map(quote).join(',')).join('\r\n');
  }
  rows.addEventListener('input', event => {
    const input = event.target.closest('[data-key]');
    if (!input) return;
    const item = holdings.find(record => record.id === input.closest('tr')?.dataset.id);
    if (!item) return;
    item[input.dataset.key] = ['invested', 'value', 'rate'].includes(input.dataset.key) ? Number(input.value) : input.value;
    save(); update();
  });
  rows.addEventListener('change', event => {
    const input = event.target.closest('[data-key]');
    if (!input) return;
    const item = holdings.find(record => record.id === input.closest('tr')?.dataset.id);
    if (!item) return;
    item[input.dataset.key] = ['invested', 'value', 'rate'].includes(input.dataset.key) ? Number(input.value) : input.value;
    save(); update();
  });
  rows.addEventListener('click', event => {
    const button = event.target.closest('.remove-row');
    if (!button) return;
    holdings = holdings.filter(item => item.id !== button.closest('tr')?.dataset.id);
    save(); render();
  });
  document.querySelector('#add-holding').addEventListener('click', () => addHolding());
  document.querySelector('#empty-add').addEventListener('click', () => addHolding());
  document.querySelector('#clear-holdings').addEventListener('click', () => { holdings = []; save(); render(); });
  horizon.addEventListener('change', update);
  document.querySelector('#copy-portfolio').addEventListener('click', async () => {
    const feedback = document.querySelector('#copy-feedback');
    try { await navigator.clipboard.writeText(csvRows()); feedback.textContent = 'Portfolio rows copied.'; }
    catch { feedback.textContent = 'Copy unavailable here — use Download CSV instead.'; }
    window.setTimeout(() => { feedback.textContent = ''; }, 4000);
  });
  document.querySelector('#download-csv').addEventListener('click', () => {
    const blob = new Blob([csvRows()], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'portfolio-scenarios.csv'; link.click();
    URL.revokeObjectURL(link.href);
  });
  document.querySelector('#model-date').textContent = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date());
  render();
})();
