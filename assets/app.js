const ICON_OPTIONS = { heart: '健康', briefcase: '工作', 'book-open': '学习', dumbbell: '运动', droplet: '喝水', coffee: '咖啡', utensils: '饮食', book: '阅读', code: '编程', pen: '写作', music: '音乐', sun: '晨间', moon: '睡前', leaf: '冥想', smile: '心情', star: '目标', flame: '习惯', bike: '出行', wallet: '财务', palette: '创作', phone: '社交', users: '家庭', home: '家务', lightbulb: '灵感', target: '专注' };
const COLOR_OPTIONS = ['#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#A855F7', '#64748B'];
const ICON_EMOJI = { heart: '❤️', book: '📖', briefcase: '💼', dumbbell: '💪', coffee: '☕', 'book-open': '📚', code: '💻', pen: '✏️', music: '🎵', sun: '☀️', moon: '🌙', leaf: '🌿', utensils: '🍽️', droplet: '💧', smile: '😊', star: '⭐', flame: '🔥', bike: '🚴', wallet: '💰', palette: '🎨', phone: '📱', users: '👥', home: '🏠', lightbulb: '💡', target: '🎯' };
const ASSET_TYPES = { real_estate: '🏠 房产', stock: '📈 股票', business: '💼 企业', bond: '📋 债券', other: '📦 其他' };
const LIABILITY_TYPES = { credit_card: '💳 信用卡', mortgage: '🏠 房贷', car_loan: '🚗 车贷', student_loan: '🎓 学贷', other: '📦 其他' };
const INCOME_TYPES = { salary: '💰 工资', bonus: '🎁 奖金', investment: '📈 投资', business: '💼 生意', other: '📦 其他' };
const EXPENSE_TYPES = { housing: '🏠 住房', food: '🍽️ 餐饮', transport: '🚗 交通', education: '📚 教育', healthcare: '🏥 医疗', entertainment: '🎮 娱乐', other: '📦 其他' };
const HEALTH_FREQ_LABELS = { daily: '每日', twice_daily: '每日两次', weekly: '每周', monthly: '每月' };

const DEFAULT_SETTINGS = {
  timezone: 'Asia/Shanghai',
  language: 'zh-CN',
  notificationEnabled: true,
  remindAheadMinutes: 0,
  nutstore: { enabled: false, baseUrl: 'https://dav.jianguoyun.com/dav/', username: '', password: '', remotePath: '小秘书/app-data.json' }
};

let APP_DATA = {
  categories: [],
  items: [],
  records: [],
  settings: DEFAULT_SETTINGS,
  finance: { profile: { name: '我的财务', cash: 0 }, assets: [], liabilities: [], incomes: [], expenses: [] },
  health: { meds: [], bloodPressures: [], heartRates: [], weights: [], waistMeasurements: [], medicationLogs: [] }
};
let CURRENT_PAGE = 'home';
const LOCAL_STORAGE_KEY = 'xiaomishu-local-data-v1';

function readLocalFallbackData() {
  try {
    const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('读取本地数据失败', error);
    return null;
  }
}

function writeLocalFallbackData(data) {
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('写入本地数据失败', error);
    return false;
  }
}

function todayKey() {
  const now = new Date();
  const tzOffset = 8 * 60;
  const localNow = new Date(now.getTime() + tzOffset * 60 * 1000);
  return localNow.toISOString().slice(0, 10);
}

function formatDate(dateKey) {
  if (!dateKey) return '';
  return dateKey;
}

function formatCurrency(val) {
  const num = Number(val || 0);
  return `¥${num.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  document.getElementById('toastIcon').textContent = { success: '✅', error: '❌', info: 'ℹ️' }[type] || 'ℹ️';
  document.getElementById('toastMsg').textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
}

function resolveAppUrl(path) {
  if (typeof window !== 'undefined' && window.XMCompat?.resolveUrl) {
    return window.XMCompat.resolveUrl(path, window.location.href);
  }
  return path;
}

function fallbackApiResponse(path, method, options = {}) {
  if (path.includes('/api/data')) {
    if (method === 'GET') {
      const localData = readLocalFallbackData();
      return { ok: true, data: normalizeData(localData || APP_DATA), message: '使用本地缓存数据' };
    }
    let bodyData = null;
    try { bodyData = options.body ? JSON.parse(options.body) : null; } catch { bodyData = null; }
    if (bodyData) {
      const nextData = normalizeData(bodyData);
      writeLocalFallbackData(nextData);
      APP_DATA = nextData;
      return { ok: true, data: nextData, message: '已保存到本地' };
    }
  }
  if (path.includes('/api/sync-now')) {
    return { ok: true, message: '本地模式下无需同步' };
  }
  return { ok: false, message: '网络不可用，已切换为本地模式' };
}

async function api(path, options = {}) {
  const resolvedPath = resolveAppUrl(path);
  const method = options.method || 'POST';
  try {
    const res = await fetch(resolvedPath, { method, headers: { 'Content-Type': 'application/json' }, ...options });
    const text = await res.text();
    if (!res.ok) {
      console.warn('API request returned non-OK response:', res.status, path);
      return fallbackApiResponse(path, method, options);
    }
    try {
      return text ? JSON.parse(text) : { ok: true };
    } catch (error) {
      console.warn('API response was not valid JSON:', error);
      return fallbackApiResponse(path, method, options);
    }
  } catch (error) {
    console.warn('API request failed, falling back to local state:', error);
    return fallbackApiResponse(path, method, options);
  }
}

function normalizeData(payload) {
  const data = payload || {};
  const settings = data.settings || {};
  return {
    categories: Array.isArray(data.categories) ? data.categories : [],
    items: Array.isArray(data.items) ? data.items : [],
    records: Array.isArray(data.records) ? data.records : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      nutstore: { ...DEFAULT_SETTINGS.nutstore, ...(settings.nutstore || {}) }
    },
    finance: {
      profile: { name: '我的财务', cash: 0, ...(data.finance?.profile || {}) },
      assets: Array.isArray(data.finance?.assets) ? data.finance.assets : [],
      liabilities: Array.isArray(data.finance?.liabilities) ? data.finance.liabilities : [],
      incomes: Array.isArray(data.finance?.incomes) ? data.finance.incomes : [],
      expenses: Array.isArray(data.finance?.expenses) ? data.finance.expenses : []
    },
    health: {
      meds: Array.isArray(data.health?.meds) ? data.health.meds : [],
      bloodPressures: Array.isArray(data.health?.bloodPressures) ? data.health.bloodPressures : [],
      heartRates: Array.isArray(data.health?.heartRates) ? data.health.heartRates : [],
      weights: Array.isArray(data.health?.weights) ? data.health.weights : [],
      waistMeasurements: Array.isArray(data.health?.waistMeasurements) ? data.health.waistMeasurements : [],
      medicationLogs: Array.isArray(data.health?.medicationLogs) ? data.health.medicationLogs : []
    }
  };
}

function updateStatusPill() {
  const enabled = APP_DATA.settings?.nutstore?.enabled;
  const label = enabled ? '已开启同步' : '本地存储';
  const pill = document.getElementById('status-pill');
  const mobilePill = document.getElementById('mobile-status-pill');
  if (pill) pill.textContent = label;
  if (mobilePill) mobilePill.textContent = label;
}

function setActiveNav(page) {
  document.querySelectorAll('[data-page]').forEach(el => {
    const active = el.dataset.page === page;
    el.classList.toggle('text-mint-600', active);
    el.classList.toggle('bg-mint-50', active);
    el.classList.toggle('font-medium', active);
    el.classList.toggle('text-ink-500', !active);
  });
}

function renderPage(page) {
  CURRENT_PAGE = page;
  setActiveNav(page);
  const container = document.getElementById('mainContent');
  if (!container) return;
  container.innerHTML = '<div class="p-6 text-sm text-ink-600">正在加载页面…</div>';

  if (page === 'home') renderHome();
  else if (page === 'timeplan') renderTimePlan();
  else if (page === 'categories') renderCategories();
  else if (page === 'trends') renderTrends();
  else if (page === 'finance') renderFinance();
  else if (page === 'health') renderHealth();
  else if (page === 'settings') renderSettings();
}

function renderHome() {
  const container = document.getElementById('mainContent');
  const today = todayKey();
  const records = (APP_DATA.records || []).filter(item => item.dateKey === today);
  const categories = APP_DATA.categories || [];
  const items = (APP_DATA.items || []).filter(item => categories.some(cat => cat.id === item.categoryId));
  let html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-ink-500">今日打卡</p>
            <h2 class="text-xl font-semibold text-ink-900">${escapeHtml(formatDate(today))}</h2>
          </div>
          <div class="text-right text-sm text-ink-500"><div>${records.length} 次记录</div><div>${items.length} 项事项</div></div>
        </div>
      </section>
      <section class="space-y-3">
  `;
  if (!items.length) {
    html += '<div class="card p-4 text-sm text-ink-600">当前还没有事项，先去分类里创建吧。</div>';
  } else {
    items.forEach(item => {
      const completed = records.filter(r => r.itemId === item.id).reduce((sum, r) => sum + (Number(r.value) || 0), 0);
      const percent = Math.min(100, Math.round((completed / (item.target || 1)) * 100));
      html += `
        <div class="card p-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-ink-900">${escapeHtml(item.name)}</div>
              <div class="text-xs text-ink-500">${escapeHtml(item.unit)} · ${escapeHtml(item.planTime || '未安排')}</div>
            </div>
            <button class="btn-primary" onclick="markItem('${item.id}', '${escapeHtml(item.name)}')">打卡</button>
          </div>
          <div class="mt-3 h-2 rounded-full bg-ink-100">
            <div class="h-2 rounded-full bg-mint-500" style="width:${percent}%"></div>
          </div>
          <div class="mt-2 text-xs text-ink-500">已完成 ${completed}${item.unit} · 目标 ${item.target}${item.unit}</div>
        </div>`;
    });
  }
  html += '</section></div>';
  container.innerHTML = html;
}

async function markItem(id, name) {
  const payload = normalizeData({ ...APP_DATA, records: [...(APP_DATA.records || []), { id: `rec-${Date.now()}`, itemId: id, categoryId: (APP_DATA.items || []).find(i => i.id === id)?.categoryId || '', value: 1, note: '', dateKey: todayKey() }] });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    APP_DATA = normalizeData(res.data || payload);
    showToast(`已记录：${name}`, 'success');
    renderPage(CURRENT_PAGE);
  } else {
    showToast('记录失败', 'error');
  }
}

function renderTimePlan() {
  const container = document.getElementById('mainContent');
  const selectedDate = window._selectedDate || todayKey();
  const dateRecords = (APP_DATA.records || []).filter(record => record.dateKey === selectedDate);
  const doneSet = new Set(dateRecords.map(record => record.itemId));
  const categoriesMap = Object.fromEntries((APP_DATA.categories || []).map(cat => [cat.id, cat]));
  const dayItems = (APP_DATA.items || [])
    .filter(item => categoriesMap[item.categoryId])
    .map(item => ({ item, category: categoriesMap[item.categoryId], isDone: doneSet.has(item.id) }))
    .sort((a, b) => (a.item.planTime || '').localeCompare(b.item.planTime || ''));
  const doneCount = dayItems.filter(item => item.isDone).length;
  const pendingCount = dayItems.length - doneCount;
  const prevDate = new Date(`${selectedDate}T00:00:00`).getTime() - 86400000;
  const nextDate = new Date(`${selectedDate}T00:00:00`).getTime() + 86400000;
  const prevDateKey = new Date(prevDate).toISOString().slice(0, 10);
  const nextDateKey = new Date(nextDate).toISOString().slice(0, 10);
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="text-lg font-semibold text-ink-900">时间规划</h2>
            <p class="text-sm text-ink-500 mt-1">${escapeHtml(selectedDate)} · ${doneCount} 已完成 · ${pendingCount} 待完成</p>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn-ghost" onclick="changeTimePlanDate('${prevDateKey}')">‹</button>
            <button class="btn-outline" onclick="changeTimePlanDate('${todayKey()}')">今天</button>
            <button class="btn-ghost" onclick="changeTimePlanDate('${nextDateKey}')">›</button>
            <button class="btn-primary" onclick="openItemModal()">新增事项</button>
          </div>
        </div>
      </section>
      <section class="space-y-3">
        ${dayItems.length ? dayItems.map(({ item, category, isDone }) => `
          <div class="card p-4 flex gap-3 ${isDone ? 'opacity-70' : ''}">
            <div class="w-20 text-xs text-ink-500 pt-0.5">${escapeHtml(item.planTime || '未安排')}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style="background:${category.color}"></span>
                <span class="font-medium text-ink-900">${escapeHtml(item.name)}</span>
              </div>
              <div class="mt-1 text-xs text-ink-500">${escapeHtml(item.unit)} · ${item.duration || 30} 分钟 · ${escapeHtml(category.name)}</div>
              <div class="mt-3 flex gap-2">
                ${isDone ? '<span class="text-xs text-mint-600">✓ 已完成</span>' : `<button class="btn-primary text-xs px-2.5 py-1" onclick="completeItem('${item.id}', '${escapeHtml(item.name)}')">完成</button><button class="btn-outline text-xs px-2.5 py-1" onclick="delayItem('${item.id}', '${escapeHtml(item.name)}')">延迟</button>`}
              </div>
            </div>
          </div>`).join('') : '<div class="card p-4 text-sm text-ink-600">当前日期下没有计划事项。</div>'}
      </section>
    </div>`;
  container.innerHTML = html;
}

function changeTimePlanDate(dateKey) {
  window._selectedDate = dateKey;
  renderPage('timeplan');
}

async function completeItem(itemId, name) {
  const payload = normalizeData({ ...APP_DATA, records: [...(APP_DATA.records || []), { id: `rec-${Date.now()}`, itemId, categoryId: (APP_DATA.items || []).find(item => item.id === itemId)?.categoryId || '', value: 1, note: '', dateKey: window._selectedDate || todayKey() }] });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    APP_DATA = normalizeData(res.data || payload);
    showToast(`已完成：${name}`, 'success');
    renderPage('timeplan');
  } else {
    showToast('保存失败', 'error');
  }
}

async function delayItem(itemId, name) {
  const payload = normalizeData({ ...APP_DATA, records: [...(APP_DATA.records || []), { id: `rec-${Date.now()}`, itemId, categoryId: (APP_DATA.items || []).find(item => item.id === itemId)?.categoryId || '', value: 0, note: '已延迟', dateKey: window._selectedDate || todayKey(), delayedTime: Date.now() }] });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(payload) });
  if (res.ok) {
    APP_DATA = normalizeData(res.data || payload);
    showToast(`已记录延迟：${name}`, 'success');
    renderPage('timeplan');
  } else {
    showToast('保存失败', 'error');
  }
}

function renderCategories() {
  const container = document.getElementById('mainContent');
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-ink-900">分类管理</h2>
          <button class="btn-primary" onclick="openCategoryModal()">新建分类</button>
        </div>
      </section>
      <section class="space-y-3">
        ${(APP_DATA.categories || []).map(cat => `
          <div class="card p-4 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background:${cat.color}14; color:${cat.color}">${ICON_EMOJI[cat.icon] || '🏷️'}</div>
              <div class="min-w-0">
                <div class="font-medium text-ink-900">${escapeHtml(cat.name)}</div>
                <div class="text-xs text-ink-500">${escapeHtml(cat.description || '暂无描述')}</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button class="btn-outline text-xs px-2.5 py-1" onclick="openCategoryModal('${cat.id}')">编辑</button>
              <button class="btn-ghost text-xs px-2.5 py-1" onclick="deleteCategory('${cat.id}')">删除</button>
            </div>
          </div>`).join('')}
      </section>
    </div>`;
  container.innerHTML = html;
}

function renderTrends() {
  const container = document.getElementById('mainContent');
  const records = APP_DATA.records || [];
  const categories = APP_DATA.categories || [];
  const today = todayKey();
  const recentDates = Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(`${today}T00:00:00`);
    dt.setDate(dt.getDate() - (6 - idx));
    return dt.toISOString().slice(0, 10);
  });
  const dailyCounts = recentDates.map(dateKey => records.filter(record => record.dateKey === dateKey).length);
  const categoryCounts = categories.map(cat => ({
    name: cat.name,
    count: records.filter(record => (APP_DATA.items || []).find(item => item.id === record.itemId)?.categoryId === cat.id).length
  }));
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <h2 class="text-lg font-semibold text-ink-900">趋势</h2>
        <p class="text-sm text-ink-600 mt-2">汇总打卡记录与分类分布，帮助你看见习惯变化。</p>
      </section>
      <section class="grid gap-3 lg:grid-cols-2">
        <div class="card p-4">
          <div class="text-sm font-medium text-ink-900">近 7 日打卡</div>
          <div class="mt-3">${buildBarChart(recentDates, dailyCounts, ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#14B8A6', '#64748B'])}</div>
        </div>
        <div class="card p-4">
          <div class="text-sm font-medium text-ink-900">分类占比</div>
          <div class="mt-3 space-y-2">${categoryCounts.map((item, idx) => `<div class="flex items-center gap-2"><div class="w-20 text-xs text-ink-500">${escapeHtml(item.name)}</div><div class="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.max(8, (item.count / Math.max(1, records.length)) * 100)}%; background:${COLOR_OPTIONS[idx % COLOR_OPTIONS.length]}"></div></div><div class="w-8 text-right text-xs text-ink-600">${item.count}</div></div>`).join('')}</div>
        </div>
      </section>
    </div>`;
  container.innerHTML = html;
}

function renderFinance() {
  const container = document.getElementById('mainContent');
  const finance = APP_DATA.finance || { profile: {}, assets: [], liabilities: [], incomes: [], expenses: [] };
  const assets = finance.assets || [];
  const liabilities = finance.liabilities || [];
  const incomes = finance.incomes || [];
  const expenses = finance.expenses || [];
  const totalAssets = assets.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const totalLiabilities = liabilities.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const netWorth = Number(finance.profile.cash || 0) + totalAssets - totalLiabilities;
  const totalIncome = incomes.reduce((sum, item) => sum + Number(item.monthlyAmount || 0), 0);
  const passiveIncome = assets.reduce((sum, item) => sum + Number(item.monthlyCashFlow || 0), 0);
  const totalExpense = expenses.reduce((sum, item) => sum + Number(item.monthlyAmount || 0), 0);
  const totalLiabilityPayment = liabilities.reduce((sum, item) => sum + Number(item.monthlyPayment || 0), 0);
  const monthlyCashFlow = totalIncome + passiveIncome - totalExpense - totalLiabilityPayment;
  const isFinancialFreedom = passiveIncome > (totalExpense + totalLiabilityPayment);
  const assetByType = assets.reduce((acc, item) => { acc[item.type || 'other'] = (acc[item.type || 'other'] || 0) + Number(item.value || 0); return acc; }, {});
  const expenseByType = expenses.reduce((acc, item) => { acc[item.type || 'other'] = (acc[item.type || 'other'] || 0) + Number(item.monthlyAmount || 0); return acc; }, {});
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 class="text-lg font-semibold text-ink-900">财务管理</h2>
            <p class="text-sm text-ink-600 mt-1">理清收支资产负债，走向财务自由</p>
          </div>
          <div class="text-sm ${isFinancialFreedom ? 'text-mint-600' : 'text-ink-500'}">${isFinancialFreedom ? '✅ 已实现财务自由' : '⏳ 财务自由进行中'}</div>
        </div>
      </section>
      <section class="grid gap-3 lg:grid-cols-4">
        <div class="card p-4"><div class="text-xs text-ink-500">现金余额</div><div class="text-xl font-semibold text-ink-900 mt-1">${formatCurrency(finance.profile.cash || 0)}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">净资产</div><div class="text-xl font-semibold text-ink-900 mt-1">${formatCurrency(netWorth)}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">月现金流</div><div class="text-xl font-semibold ${monthlyCashFlow >= 0 ? 'text-mint-600' : 'text-red-500'} mt-1">${formatCurrency(monthlyCashFlow)}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">财务自由进度</div><div class="text-xl font-semibold text-ink-900 mt-1">${Math.round((passiveIncome / Math.max(1, totalExpense + totalLiabilityPayment)) * 100)}%</div></div>
      </section>
      <section class="card p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="font-medium text-ink-900">现金管理</div>
          <div class="flex items-center gap-2">
            <input id="cashInput" class="input w-28 text-right" value="${Number(finance.profile.cash || 0)}" type="number">
            <button class="btn-primary" onclick="updateCash()">更新</button>
          </div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">资产</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openFinanceModal('asset')">+ 添加</button>
          </div>
          <div class="divide-y divide-ink-100/40">${assets.length ? assets.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(item.name)}</div><div class="text-xs text-ink-500">${ASSET_TYPES[item.type] || ASSET_TYPES.other} · ${formatCurrency(item.value)}</div></div><div class="flex items-center gap-2"><button class="p-1 rounded text-ink-400 hover:text-ink-700" onclick='openFinanceModal("asset", ${JSON.stringify(item)})'>✏️</button><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteFinanceEntry('asset','${item.id}','${escapeHtml(item.name)}')">🗑️</button></div></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有资产</div>'}</div>
        </div>
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">负债</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openFinanceModal('liability')">+ 添加</button>
          </div>
          <div class="divide-y divide-ink-100/40">${liabilities.length ? liabilities.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(item.name)}</div><div class="text-xs text-ink-500">${LIABILITY_TYPES[item.type] || LIABILITY_TYPES.other} · ${formatCurrency(item.amount)}</div></div><div class="flex items-center gap-2"><button class="p-1 rounded text-ink-400 hover:text-ink-700" onclick='openFinanceModal("liability", ${JSON.stringify(item)})'>✏️</button><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteFinanceEntry('liability','${item.id}','${escapeHtml(item.name)}')">🗑️</button></div></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有负债</div>'}</div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">收入</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openFinanceModal('income')">+ 添加</button>
          </div>
          <div class="divide-y divide-ink-100/40">${incomes.length ? incomes.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(item.name)}</div><div class="text-xs text-ink-500">${INCOME_TYPES[item.type] || INCOME_TYPES.other} · ${formatCurrency(item.monthlyAmount)}</div></div><div class="flex items-center gap-2"><button class="p-1 rounded text-ink-400 hover:text-ink-700" onclick='openFinanceModal("income", ${JSON.stringify(item)})'>✏️</button><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteFinanceEntry('income','${item.id}','${escapeHtml(item.name)}')">🗑️</button></div></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有收入记录</div>'}</div>
        </div>
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">支出</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openFinanceModal('expense')">+ 添加</button>
          </div>
          <div class="divide-y divide-ink-100/40">${expenses.length ? expenses.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(item.name)}</div><div class="text-xs text-ink-500">${EXPENSE_TYPES[item.type] || EXPENSE_TYPES.other} · ${formatCurrency(item.monthlyAmount)}</div></div><div class="flex items-center gap-2"><button class="p-1 rounded text-ink-400 hover:text-ink-700" onclick='openFinanceModal("expense", ${JSON.stringify(item)})'>✏️</button><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteFinanceEntry('expense','${item.id}','${escapeHtml(item.name)}')">🗑️</button></div></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有支出记录</div>'}</div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card p-4"><div class="text-sm font-medium text-ink-900">资产分布</div><div class="mt-3">${buildBarChart(Object.keys(assetByType), Object.values(assetByType), ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EF4444'])}</div></div>
        <div class="card p-4"><div class="text-sm font-medium text-ink-900">支出结构</div><div class="mt-3">${buildBarChart(Object.keys(expenseByType), Object.values(expenseByType), ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'])}</div></div>
      </section>
    </div>`;
  container.innerHTML = html;
}

function renderHealth() {
  const container = document.getElementById('mainContent');
  const health = APP_DATA.health || { meds: [], bloodPressures: [], heartRates: [], weights: [], waistMeasurements: [], medicationLogs: [] };
  const meds = health.meds || [];
  const bloodPressures = health.bloodPressures || [];
  const heartRates = health.heartRates || [];
  const weights = health.weights || [];
  const waistMeasurements = health.waistMeasurements || [];
  const medicationLogs = health.medicationLogs || [];
  const latestBP = bloodPressures[0];
  const latestHR = heartRates[0];
  const latestWeight = weights[0];
  const latestWaist = waistMeasurements[0];
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4">
        <h2 class="text-lg font-semibold text-ink-900">健康跟踪</h2>
        <p class="text-sm text-ink-600 mt-1">记录血压、心率、体重、腰围和吃药情况</p>
      </section>
      <section class="grid gap-3 lg:grid-cols-4">
        <div class="card p-4"><div class="text-xs text-ink-500">血压</div><div class="text-xl font-semibold text-ink-900 mt-1">${latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : '--'}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">心率</div><div class="text-xl font-semibold text-ink-900 mt-1">${latestHR ? `${latestHR.bpm}` : '--'}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">体重</div><div class="text-xl font-semibold text-ink-900 mt-1">${latestWeight ? `${latestWeight.weight}` : '--'}</div></div>
        <div class="card p-4"><div class="text-xs text-ink-500">腰围</div><div class="text-xl font-semibold text-ink-900 mt-1">${latestWaist ? `${latestWaist.waist}` : '--'}</div></div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">药品管理</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openHealthModal('med')">+ 添加</button>
          </div>
          <div class="divide-y divide-ink-100/40">${meds.length ? meds.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(item.name)}</div><div class="text-xs text-ink-500">${HEALTH_FREQ_LABELS[item.frequency] || '每日'} · ${escapeHtml(item.dosage || '未填写剂量')}</div></div><div class="flex items-center gap-2"><button class="p-1 rounded text-ink-400 hover:text-ink-700" onclick='openHealthModal("med", ${JSON.stringify(item)})'>✏️</button><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteHealthEntry('med','${item.id}','${escapeHtml(item.name)}')">🗑️</button></div></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有添加药品</div>'}</div>
        </div>
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-ink-100/60">
            <div class="font-medium text-ink-900">吃药记录</div>
            <button class="btn-primary text-xs px-2.5 py-1.5" onclick="openHealthModal('medication')">+ 记录</button>
          </div>
          <div class="divide-y divide-ink-100/40">${medicationLogs.length ? medicationLogs.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${escapeHtml(getMedicationName(item.medId))}</div><div class="text-xs text-ink-500">${escapeHtml(item.note || '')}</div></div><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteHealthEntry('medication','${item.id}','${escapeHtml(getMedicationName(item.medId))}')">🗑️</button></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有吃药记录</div>'}</div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card p-4">
          <div class="flex items-center justify-between">
            <div class="font-medium text-ink-900">快速记录</div>
            <div class="flex gap-2">
              <button class="btn-outline text-xs px-2.5 py-1" onclick="openHealthModal('bp')">血压</button>
              <button class="btn-outline text-xs px-2.5 py-1" onclick="openHealthModal('hr')">心率</button>
              <button class="btn-outline text-xs px-2.5 py-1" onclick="openHealthModal('weight')">体重</button>
              <button class="btn-outline text-xs px-2.5 py-1" onclick="openHealthModal('waist')">腰围</button>
            </div>
          </div>
        </div>
        <div class="card p-4">
          <div class="text-sm font-medium text-ink-900">健康趋势</div>
          <div class="mt-3">${buildSparkline(weights.map(item => Number(item.weight || 0)), '#F59E0B')}</div>
        </div>
      </section>
      <section class="grid gap-4 lg:grid-cols-2">
        <div class="card overflow-hidden">
          <div class="px-4 py-3 border-b border-ink-100/60 font-medium text-ink-900">血压历史</div>
          <div class="divide-y divide-ink-100/40">${bloodPressures.length ? bloodPressures.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${item.systolic}/${item.diastolic}</div><div class="text-xs text-ink-500">${escapeHtml(item.note || '')}</div></div><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteHealthEntry('bp','${item.id}','${item.systolic}/${item.diastolic}')">🗑️</button></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有血压记录</div>'}</div>
        </div>
        <div class="card overflow-hidden">
          <div class="px-4 py-3 border-b border-ink-100/60 font-medium text-ink-900">体重历史</div>
          <div class="divide-y divide-ink-100/40">${weights.length ? weights.map(item => `<div class="flex items-center justify-between px-4 py-3"><div><div class="font-medium text-ink-800">${item.weight} kg</div><div class="text-xs text-ink-500">${escapeHtml(item.note || '')}</div></div><button class="p-1 rounded text-ink-400 hover:text-red-500" onclick="deleteHealthEntry('weight','${item.id}','${item.weight}')">🗑️</button></div>`).join('') : '<div class="p-4 text-sm text-ink-500">还没有体重记录</div>'}</div>
        </div>
      </section>
    </div>`;
  container.innerHTML = html;
}

function renderSettings() {
  const container = document.getElementById('mainContent');
  const nutstore = APP_DATA.settings?.nutstore || {};
  const html = `
    <div class="p-4 lg:p-6 space-y-4">
      <section class="card p-4 space-y-3">
        <h2 class="text-lg font-semibold text-ink-900">设置</h2>
        <div>
          <label class="label">坚果云同步</label>
          <label class="flex items-center gap-2 text-sm text-ink-600"><input id="syncEnabled" type="checkbox" ${nutstore.enabled ? 'checked' : ''}> 启用同步</label>
        </div>
        <div>
          <label class="label">用户名</label>
          <input id="syncUser" class="input" value="${escapeHtml(nutstore.username || '')}">
        </div>
        <div>
          <label class="label">应用密码</label>
          <input id="syncPassword" class="input" type="password" value="${escapeHtml(nutstore.password || '')}">
        </div>
        <div>
          <label class="label">同步地址</label>
          <input id="syncUrl" class="input" value="${escapeHtml(nutstore.baseUrl || 'https://dav.jianguoyun.com/dav/')}">
        </div>
        <div>
          <label class="label">远程文件路径</label>
          <input id="syncPath" class="input" value="${escapeHtml(nutstore.remotePath || '小秘书/app-data.json')}">
        </div>
        <div class="flex gap-2">
          <button class="btn-primary" onclick="saveSettings()">保存设置</button>
          <button class="btn-outline" onclick="syncNow()">立即同步</button>
        </div>
      </section>
    </div>`;
  container.innerHTML = html;
}

async function saveSettings() {
  const nextData = normalizeData({ ...APP_DATA, settings: { ...APP_DATA.settings, nutstore: { enabled: document.getElementById('syncEnabled').checked, username: document.getElementById('syncUser').value, password: document.getElementById('syncPassword').value, baseUrl: document.getElementById('syncUrl').value, remotePath: document.getElementById('syncPath').value } } });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res && res.ok !== false) {
    APP_DATA = normalizeData(res?.data || nextData);
    writeLocalFallbackData(APP_DATA);
    updateStatusPill();
    showToast(res?.message || '设置已保存', 'success');
  } else {
    APP_DATA = normalizeData(nextData);
    writeLocalFallbackData(APP_DATA);
    showToast(res?.message || '设置已保存', 'success');
  }
}

async function syncNow() {
  const payload = await api('/api/sync-now', { method: 'POST' });
  if (payload.ok) showToast(payload.message || '同步完成', 'success'); else showToast(payload.message || '同步失败', 'error');
}

function openCategoryModal(id = null) {
  const cat = (APP_DATA.categories || []).find(item => item.id === id);
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-backdrop" onclick="closeModal()"></div>
      <div class="modal-box">
        <div class="px-5 py-4 border-b border-ink-100"><h3 class="text-lg font-semibold">${id ? '编辑分类' : '新建分类'}</h3></div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div><label class="label">名称</label><input id="catName" class="input" value="${escapeHtml(cat?.name || '')}"></div>
          <div><label class="label">描述</label><input id="catDesc" class="input" value="${escapeHtml(cat?.description || '')}"></div>
          <div><label class="label">颜色</label><div class="flex flex-wrap gap-2">${COLOR_OPTIONS.map(color => `<button type="button" class="color-btn ${cat?.color === color ? 'active' : ''}" data-color="${color}" style="background:${color}" onclick="selectColor('${color}')"></button>`).join('')}</div></div>
          <div><label class="label">图标</label><div class="icon-grid">${Object.entries(ICON_OPTIONS).map(([value, label]) => `<button class="icon-btn ${cat?.icon === value ? 'active' : ''}" data-icon="${value}" onclick="selectIcon('${value}')">${ICON_EMOJI[value] || '🏷️'}</button>`).join('')}</div></div>
        </div>
        <div class="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button class="btn-ghost" onclick="closeModal()">取消</button>
          <button class="btn-primary" onclick="submitCategory('${id || ''}')">保存</button>
        </div>
      </div>
    </div>`;
  window._catForm = { icon: cat?.icon || 'target', color: cat?.color || '#10B981' };
}

function selectIcon(value) { window._catForm.icon = value; document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.icon === value)); }
function selectColor(value) { window._catForm.color = value; document.querySelectorAll('.color-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.color === value)); }

async function submitCategory(id) {
  const payload = { name: document.getElementById('catName').value.trim(), description: document.getElementById('catDesc').value.trim(), icon: window._catForm.icon, color: window._catForm.color, order: 0 };
  const categories = [...(APP_DATA.categories || [])];
  if (id) {
    const idx = categories.findIndex(cat => cat.id === id);
    if (idx >= 0) categories[idx] = { ...categories[idx], ...payload };
  } else {
    categories.push({ id: `cat-${Date.now()}`, ...payload });
  }
  const nextData = normalizeData({ ...APP_DATA, categories });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); closeModal(); renderPage('categories'); showToast(id ? '分类已更新' : '分类已创建', 'success'); }
  else showToast('保存失败', 'error');
}

async function deleteCategory(id) {
  if (!window.confirm('删除分类会同时移除它下面的事项，是否继续？')) return;
  const items = (APP_DATA.items || []).filter(item => item.categoryId !== id);
  const records = (APP_DATA.records || []).filter(record => !items.some(item => item.id === record.itemId) && !items.some(item => item.categoryId === id));
  const nextData = normalizeData({ ...APP_DATA, categories: (APP_DATA.categories || []).filter(cat => cat.id !== id), items, records });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); renderPage('categories'); showToast('分类已删除', 'success'); }
  else showToast('删除失败', 'error');
}

function openItemModal(id = null) {
  const item = (APP_DATA.items || []).find(entry => entry.id === id);
  const modal = document.getElementById('modalContainer');
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-backdrop" onclick="closeModal()"></div>
      <div class="modal-box">
        <div class="px-5 py-4 border-b border-ink-100"><h3 class="text-lg font-semibold">${id ? '编辑事项' : '新建事项'}</h3></div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div><label class="label">事项名称</label><input id="itemName" class="input" value="${escapeHtml(item?.name || '')}"></div>
          <div><label class="label">分类</label><select id="itemCategory" class="input">${(APP_DATA.categories || []).map(cat => `<option value="${cat.id}" ${item?.categoryId === cat.id ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`).join('')}</select></div>
          <div class="grid grid-cols-2 gap-3"><div><label class="label">单位</label><input id="itemUnit" class="input" value="${escapeHtml(item?.unit || '次')}"></div><div><label class="label">每日目标</label><input id="itemTarget" class="input" type="number" value="${Number(item?.target || 1)}"></div></div>
          <div class="grid grid-cols-2 gap-3"><div><label class="label">计划时间</label><input id="itemPlanTime" class="input" type="time" value="${escapeHtml(item?.planTime || '')}"></div><div><label class="label">预估时长（分钟）</label><input id="itemDuration" class="input" type="number" value="${Number(item?.duration || 30)}"></div></div>
        </div>
        <div class="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button class="btn-ghost" onclick="closeModal()">取消</button>
          <button class="btn-primary" onclick="submitItem('${id || ''}')">保存</button>
        </div>
      </div>
    </div>`;
}

async function submitItem(id) {
  const items = [...(APP_DATA.items || [])];
  const payload = { name: document.getElementById('itemName').value.trim(), categoryId: document.getElementById('itemCategory').value, unit: document.getElementById('itemUnit').value.trim() || '次', target: Number(document.getElementById('itemTarget').value) || 1, planTime: document.getElementById('itemPlanTime').value, duration: Number(document.getElementById('itemDuration').value) || 30 };
  if (id) {
    const idx = items.findIndex(item => item.id === id);
    if (idx >= 0) items[idx] = { ...items[idx], ...payload };
  } else {
    items.push({ id: `item-${Date.now()}`, ...payload, createdAt: new Date().toISOString() });
  }
  const nextData = normalizeData({ ...APP_DATA, items });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); closeModal(); renderPage('timeplan'); showToast(id ? '事项已更新' : '事项已创建', 'success'); }
  else showToast('保存失败', 'error');
}

function openFinanceModal(kind, entry = null) {
  const modal = document.getElementById('modalContainer');
  const isEdit = Boolean(entry);
  const entryId = entry?.id || '';
  let form = '';
  if (kind === 'asset') {
    form = `
      <div><label class="label">名称</label><input id="financeName" class="input" value="${escapeHtml(entry?.name || '')}"></div>
      <div><label class="label">类型</label><select id="financeType" class="input">${Object.entries(ASSET_TYPES).map(([value, label]) => `<option value="${value}" ${entry?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="label">价值</label><input id="financeValue" class="input" type="number" value="${Number(entry?.value || 0)}"></div><div><label class="label">月现金流</label><input id="financeMonthlyCashFlow" class="input" type="number" value="${Number(entry?.monthlyCashFlow || 0)}"></div></div>
      <div><label class="label">说明</label><input id="financeDescription" class="input" value="${escapeHtml(entry?.description || '')}"></div>`;
  } else if (kind === 'liability') {
    form = `
      <div><label class="label">名称</label><input id="financeName" class="input" value="${escapeHtml(entry?.name || '')}"></div>
      <div><label class="label">类型</label><select id="financeType" class="input">${Object.entries(LIABILITY_TYPES).map(([value, label]) => `<option value="${value}" ${entry?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="label">金额</label><input id="financeValue" class="input" type="number" value="${Number(entry?.amount || 0)}"></div><div><label class="label">月还款</label><input id="financeMonthlyCashFlow" class="input" type="number" value="${Number(entry?.monthlyPayment || 0)}"></div></div>
      <div><label class="label">说明</label><input id="financeDescription" class="input" value="${escapeHtml(entry?.description || '')}"></div>`;
  } else if (kind === 'income') {
    form = `
      <div><label class="label">名称</label><input id="financeName" class="input" value="${escapeHtml(entry?.name || '')}"></div>
      <div><label class="label">类型</label><select id="financeType" class="input">${Object.entries(INCOME_TYPES).map(([value, label]) => `<option value="${value}" ${entry?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <div><label class="label">月收入</label><input id="financeValue" class="input" type="number" value="${Number(entry?.monthlyAmount || 0)}"></div>
      <div><label class="label">说明</label><input id="financeDescription" class="input" value="${escapeHtml(entry?.description || '')}"></div>`;
  } else if (kind === 'expense') {
    form = `
      <div><label class="label">名称</label><input id="financeName" class="input" value="${escapeHtml(entry?.name || '')}"></div>
      <div><label class="label">类型</label><select id="financeType" class="input">${Object.entries(EXPENSE_TYPES).map(([value, label]) => `<option value="${value}" ${entry?.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
      <div><label class="label">月支出</label><input id="financeValue" class="input" type="number" value="${Number(entry?.monthlyAmount || 0)}"></div>
      <div><label class="label">说明</label><input id="financeDescription" class="input" value="${escapeHtml(entry?.description || '')}"></div>`;
  }
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-backdrop" onclick="closeModal()"></div>
      <div class="modal-box">
        <div class="px-5 py-4 border-b border-ink-100"><h3 class="text-lg font-semibold">${isEdit ? '编辑' : '新增'}${kind === 'asset' ? '资产' : kind === 'liability' ? '负债' : kind === 'income' ? '收入' : '支出'}</h3></div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">${form}</div>
        <div class="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button class="btn-ghost" onclick="closeModal()">取消</button>
          <button class="btn-primary" onclick="submitFinance('${kind}', '${entryId}')">保存</button>
        </div>
      </div>
    </div>`;
}

async function submitFinance(kind, id) {
  const finance = { ...APP_DATA.finance };
  const name = document.getElementById('financeName').value.trim();
  const type = document.getElementById('financeType').value;
  const value = Number(document.getElementById('financeValue').value || 0);
  const description = document.getElementById('financeDescription').value.trim();
  const monthlyCashFlow = Number(document.getElementById('financeMonthlyCashFlow')?.value || 0);
  const entry = { id: id || `fin-${Date.now()}`, name, type, description, createdAt: Date.now() };
  if (kind === 'asset') {
    finance.assets = [...(finance.assets || [])];
    if (id) {
      const idx = finance.assets.findIndex(item => item.id === id);
      if (idx >= 0) finance.assets[idx] = { ...finance.assets[idx], ...entry, value, monthlyCashFlow };
    } else {
      finance.assets.push({ ...entry, value, monthlyCashFlow });
    }
  } else if (kind === 'liability') {
    finance.liabilities = [...(finance.liabilities || [])];
    if (id) {
      const idx = finance.liabilities.findIndex(item => item.id === id);
      if (idx >= 0) finance.liabilities[idx] = { ...finance.liabilities[idx], ...entry, amount: value, monthlyPayment: monthlyCashFlow };
    } else {
      finance.liabilities.push({ ...entry, amount: value, monthlyPayment: monthlyCashFlow });
    }
  } else if (kind === 'income') {
    finance.incomes = [...(finance.incomes || [])];
    if (id) {
      const idx = finance.incomes.findIndex(item => item.id === id);
      if (idx >= 0) finance.incomes[idx] = { ...finance.incomes[idx], ...entry, monthlyAmount: value };
    } else {
      finance.incomes.push({ ...entry, monthlyAmount: value });
    }
  } else if (kind === 'expense') {
    finance.expenses = [...(finance.expenses || [])];
    if (id) {
      const idx = finance.expenses.findIndex(item => item.id === id);
      if (idx >= 0) finance.expenses[idx] = { ...finance.expenses[idx], ...entry, monthlyAmount: value };
    } else {
      finance.expenses.push({ ...entry, monthlyAmount: value });
    }
  }
  const nextData = normalizeData({ ...APP_DATA, finance });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); closeModal(); renderPage('finance'); showToast('财务记录已保存', 'success'); }
  else showToast('保存失败', 'error');
}

async function updateCash() {
  const value = Number(document.getElementById('cashInput').value || 0);
  const finance = { ...APP_DATA.finance, profile: { ...(APP_DATA.finance?.profile || {}), cash: value } };
  const nextData = normalizeData({ ...APP_DATA, finance });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); renderPage('finance'); showToast('现金余额已更新', 'success'); }
  else showToast('保存失败', 'error');
}

async function deleteFinanceEntry(kind, id, name) {
  if (!window.confirm(`删除 ${name}？`)) return;
  const finance = { ...APP_DATA.finance };
  if (kind === 'asset') finance.assets = (finance.assets || []).filter(item => item.id !== id);
  if (kind === 'liability') finance.liabilities = (finance.liabilities || []).filter(item => item.id !== id);
  if (kind === 'income') finance.incomes = (finance.incomes || []).filter(item => item.id !== id);
  if (kind === 'expense') finance.expenses = (finance.expenses || []).filter(item => item.id !== id);
  const nextData = normalizeData({ ...APP_DATA, finance });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); renderPage('finance'); showToast('已删除', 'success'); }
  else showToast('删除失败', 'error');
}

function openHealthModal(kind, entry = null) {
  const modal = document.getElementById('modalContainer');
  const isEdit = Boolean(entry);
  let form = '';
  if (kind === 'med') {
    form = `
      <div><label class="label">药品名称</label><input id="healthName" class="input" value="${escapeHtml(entry?.name || '')}"></div>
      <div><label class="label">剂量</label><input id="healthDosage" class="input" value="${escapeHtml(entry?.dosage || '')}"></div>
      <div><label class="label">频率</label><select id="healthFrequency" class="input"><option value="daily" ${entry?.frequency === 'daily' ? 'selected' : ''}>每日</option><option value="twice_daily" ${entry?.frequency === 'twice_daily' ? 'selected' : ''}>每日两次</option><option value="weekly" ${entry?.frequency === 'weekly' ? 'selected' : ''}>每周</option><option value="monthly" ${entry?.frequency === 'monthly' ? 'selected' : ''}>每月</option></select></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="label">开始日期</label><input id="healthStartDate" class="input" value="${escapeHtml(entry?.startDate || '')}"></div><div><label class="label">结束日期</label><input id="healthEndDate" class="input" value="${escapeHtml(entry?.endDate || '')}"></div></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  } else if (kind === 'medication') {
    form = `
      <div><label class="label">药品</label><select id="medicationMedId" class="input">${(APP_DATA.health?.meds || []).map(med => `<option value="${med.id}" ${entry?.medId === med.id ? 'selected' : ''}>${escapeHtml(med.name)}</option>`).join('')}</select></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  } else if (kind === 'bp') {
    form = `
      <div class="grid grid-cols-2 gap-3"><div><label class="label">收缩压</label><input id="healthSystolic" class="input" type="number" value="${Number(entry?.systolic || 120)}"></div><div><label class="label">舒张压</label><input id="healthDiastolic" class="input" type="number" value="${Number(entry?.diastolic || 80)}"></div></div>
      <div><label class="label">心率</label><input id="healthPulse" class="input" type="number" value="${Number(entry?.pulse || 0)}"></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  } else if (kind === 'hr') {
    form = `
      <div><label class="label">心率</label><input id="healthBpm" class="input" type="number" value="${Number(entry?.bpm || 72)}"></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  } else if (kind === 'weight') {
    form = `
      <div><label class="label">体重（kg）</label><input id="healthWeight" class="input" type="number" value="${Number(entry?.weight || 70)}"></div>
      <div><label class="label">体脂率（%）</label><input id="healthBodyFat" class="input" type="number" value="${Number(entry?.bodyFat || 0)}"></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  } else if (kind === 'waist') {
    form = `
      <div><label class="label">腰围（cm）</label><input id="healthWaist" class="input" type="number" value="${Number(entry?.waist || 80)}"></div>
      <div><label class="label">备注</label><input id="healthNote" class="input" value="${escapeHtml(entry?.note || '')}"></div>`;
  }
  modal.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-backdrop" onclick="closeModal()"></div>
      <div class="modal-box">
        <div class="px-5 py-4 border-b border-ink-100"><h3 class="text-lg font-semibold">${isEdit ? '编辑' : '新增'}${kind === 'med' ? '药品' : kind === 'medication' ? '吃药记录' : kind === 'bp' ? '血压' : kind === 'hr' ? '心率' : kind === 'weight' ? '体重' : '腰围'}</h3></div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">${form}</div>
        <div class="px-5 py-3 border-t border-ink-100 flex justify-end gap-2">
          <button class="btn-ghost" onclick="closeModal()">取消</button>
          <button class="btn-primary" onclick="submitHealth('${kind}', '${entry?.id || ''}')">保存</button>
        </div>
      </div>
    </div>`;
}

async function submitHealth(kind, id) {
  const health = { ...APP_DATA.health };
  const nextData = normalizeData({ ...APP_DATA, health });
  const now = Date.now();
  if (kind === 'med') {
    const payload = { id: id || `med-${Date.now()}`, name: document.getElementById('healthName').value.trim(), dosage: document.getElementById('healthDosage').value.trim(), frequency: document.getElementById('healthFrequency').value, startDate: document.getElementById('healthStartDate').value, endDate: document.getElementById('healthEndDate').value, note: document.getElementById('healthNote').value.trim(), createdAt: now };
    health.meds = [...(health.meds || [])];
    if (id) {
      const idx = health.meds.findIndex(item => item.id === id);
      if (idx >= 0) health.meds[idx] = { ...health.meds[idx], ...payload };
    } else {
      health.meds.push(payload);
    }
  } else if (kind === 'medication') {
    health.medicationLogs = [...(health.medicationLogs || [])];
    health.medicationLogs.push({ id: `medlog-${Date.now()}`, medId: document.getElementById('medicationMedId').value, takenAt: now, note: document.getElementById('healthNote').value.trim(), dateKey: todayKey() });
  } else if (kind === 'bp') {
    health.bloodPressures = [...(health.bloodPressures || [])];
    health.bloodPressures.push({ id: `bp-${Date.now()}`, systolic: Number(document.getElementById('healthSystolic').value || 0), diastolic: Number(document.getElementById('healthDiastolic').value || 0), pulse: Number(document.getElementById('healthPulse').value || 0), note: document.getElementById('healthNote').value.trim(), timestamp: now, dateKey: todayKey() });
  } else if (kind === 'hr') {
    health.heartRates = [...(health.heartRates || [])];
    health.heartRates.push({ id: `hr-${Date.now()}`, bpm: Number(document.getElementById('healthBpm').value || 0), note: document.getElementById('healthNote').value.trim(), timestamp: now, dateKey: todayKey() });
  } else if (kind === 'weight') {
    health.weights = [...(health.weights || [])];
    health.weights.push({ id: `weight-${Date.now()}`, weight: Number(document.getElementById('healthWeight').value || 0), bodyFat: Number(document.getElementById('healthBodyFat').value || 0), note: document.getElementById('healthNote').value.trim(), timestamp: now, dateKey: todayKey() });
  } else if (kind === 'waist') {
    health.waistMeasurements = [...(health.waistMeasurements || [])];
    health.waistMeasurements.push({ id: `waist-${Date.now()}`, waist: Number(document.getElementById('healthWaist').value || 0), note: document.getElementById('healthNote').value.trim(), timestamp: now, dateKey: todayKey() });
  }
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(normalizeData({ ...APP_DATA, health })) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); closeModal(); renderPage('health'); showToast('健康记录已保存', 'success'); }
  else showToast('保存失败', 'error');
}

async function deleteHealthEntry(kind, id, name) {
  if (!window.confirm(`删除 ${name}？`)) return;
  const health = { ...APP_DATA.health };
  if (kind === 'med') health.meds = (health.meds || []).filter(item => item.id !== id);
  if (kind === 'medication') health.medicationLogs = (health.medicationLogs || []).filter(item => item.id !== id);
  if (kind === 'bp') health.bloodPressures = (health.bloodPressures || []).filter(item => item.id !== id);
  if (kind === 'hr') health.heartRates = (health.heartRates || []).filter(item => item.id !== id);
  if (kind === 'weight') health.weights = (health.weights || []).filter(item => item.id !== id);
  if (kind === 'waist') health.waistMeasurements = (health.waistMeasurements || []).filter(item => item.id !== id);
  const nextData = normalizeData({ ...APP_DATA, health });
  const res = await api('/api/data', { method: 'POST', body: JSON.stringify(nextData) });
  if (res.ok) { APP_DATA = normalizeData(res.data || nextData); renderPage('health'); showToast('已删除', 'success'); }
  else showToast('删除失败', 'error');
}

function getMedicationName(medId) {
  return (APP_DATA.health?.meds || []).find(item => item.id === medId)?.name || '未知药品';
}

function buildBarChart(labels, values, colors) {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeValues = Array.isArray(values) ? values : [];
  const max = Math.max(1, ...safeValues.map(Number));
  return `<div class="space-y-2">${safeLabels.map((label, index) => `<div class="flex items-center gap-2"><div class="w-20 text-[11px] text-ink-500">${escapeHtml(label)}</div><div class="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.max(8, (Number(safeValues[index]) / max) * 100)}%; background:${colors[index % colors.length]}"></div></div><div class="w-8 text-right text-[11px] text-ink-600">${Number(safeValues[index] || 0)}</div></div>`).join('')}</div>`;
}

function buildSparkline(values, color) {
  const safeValues = Array.isArray(values) ? values : [];
  if (!safeValues.length) return '<div class="text-sm text-ink-500">暂无趋势数据</div>';
  const max = Math.max(...safeValues.map(Number), 1);
  const min = Math.min(...safeValues.map(Number), 0);
  const range = max - min || 1;
  const points = safeValues.map((value, index) => `${(index / Math.max(1, safeValues.length - 1)) * 100},${100 - ((Number(value) - min) / range) * 100}`).join(' ');
  return `<svg viewBox="0 0 100 100" class="w-full h-24"><polyline fill="none" stroke="${color}" stroke-width="3" points="${points}"/></svg>`;
}

function closeModal() { document.getElementById('modalContainer').innerHTML = ''; }

document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); renderPage(el.dataset.page); });
});

async function initialize() {
  try {
    const result = await api('/api/data', { method: 'GET' });
    if (result?.data) {
      APP_DATA = normalizeData(result.data);
    } else {
      APP_DATA = normalizeData(readLocalFallbackData() || APP_DATA);
    }
    updateStatusPill();
    renderPage('home');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(console.error);
    }
  } catch (error) {
    console.error(error);
    APP_DATA = normalizeData(readLocalFallbackData() || APP_DATA);
    updateStatusPill();
    renderPage('home');
    showToast('后端不可用，已使用本地演示数据', 'info');
  }
}

window.addEventListener('load', initialize);
