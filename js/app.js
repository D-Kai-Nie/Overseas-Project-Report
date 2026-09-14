/* ============================================================
   海外项目数据集指标填报 - 核心逻辑
   路由 / 角色视角 / 通用组件 / 计算引擎（口径权威定义）
   ============================================================ */

/* ---------- 全局状态 ---------- */
const AppState = {
  role: ROLES[0],        // 当前视角角色（默认局报送管理员）
  page: 'task-manage',   // 当前页面
  taskId: 'T-2026H1',    // 当前任务上下文
  fillCtx: null,         // 填报页上下文 { unitId, dataset, activeTab }
  reviewCtx: null        // 审核页上下文 { unitId, dataset }
};

/* 视图注册表已在 mock-data.js 中声明（window.VIEWS，需先于视图文件加载） */

/* ---------- 侧边栏菜单图标 ---------- */
const MENU_ICONS = {
  task: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-2"/><path d="M6 1.5h4v3H6zM5 7.5h6M5 10.5h6"/></svg>',
  fill: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13.5l.9-3.2L11.2 2.5l2.3 2.3-7.8 7.8z"/><path d="M10 3.7l2.3 2.3"/></svg>',
  review: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5l5.5 2v4c0 3.4-2.3 5.9-5.5 7-3.2-1.1-5.5-3.6-5.5-7v-4z"/><path d="M5.6 7.8l1.7 1.7 3.1-3.4"/></svg>',
  summary: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 13V4M7 13V2.5M11.5 13V6M2 13h12"/></svg>',
  config: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>'
};

/* ============================================================
   通用工具
   ============================================================ */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 金额：千分位 + 2 位小数 */
function fmtMoney(n) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '/';
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/* 数量：千分位 + 3 位小数 */
function fmtQty(n) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '/';
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/* 率类显示：分母为 0/空 → "/"（V-T01 容错，杜绝 #DIV/0!） */
function pctDisp(num, den) {
  const n = Number(num), d = Number(den);
  if (!den || d === 0 || isNaN(d)) return '/';
  const val = n / d * 100;
  if (isNaN(val) || !isFinite(val)) return '/';
  return (val >= 0 ? '' : '') + val.toFixed(2) + '%';
}
/* 率类数值（汇总重算用）：返回 null 表示分母为 0 */
function rateNum(num, den) {
  const n = Number(num), d = Number(den);
  if (!den || d === 0 || isNaN(d) || isNaN(n)) return null;
  return n / d * 100;
}

/* 日期解析（yyyy/MM/dd 或 yyyy-MM-dd） */
function parseDate(str) {
  if (!str) return null;
  const m = String(str).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function fmtDate(d) {
  if (!d) return '/';
  return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
}
/* 工作年限：起始时间至报送截止日自动计算取整（V-G06） */
function workYears(startStr, refStr) {
  const s = parseDate(startStr), r = parseDate(refStr || '2026/09/25');
  if (!s) return null;
  let years = r.getFullYear() - s.getFullYear();
  const before = (r.getMonth() * 100 + r.getDate()) < (s.getMonth() * 100 + s.getDate());
  if (before) years -= 1;
  return years >= 0 ? years : null;
}
/* 禁用到期日：起始时间 + 禁用期限（月） */
function banEndDate(startStr, months) {
  const s = parseDate(startStr);
  if (!s || !months) return null;
  const d = new Date(s);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

/* ---------- 状态标签 ---------- */
const STATUS_TAG_CLASS = {
  '未开始': 'dsc-tag--default',
  '填报中': 'dsc-tag--filling',
  '已提交': 'dsc-tag--info',
  '已退回': 'dsc-tag--returned',
  '已通过': 'dsc-tag--success',
  '已逾期': 'dsc-tag--overdue'
};
function statusTag(status) {
  return '<span class="dsc-tag ' + (STATUS_TAG_CLASS[status] || 'dsc-tag--default') + '">' + esc(status) + '</span>';
}
/* 矩阵格子状态样式 */
const STATUS_CELL_CLASS = {
  '未开始': 'dsc-matrix__cell--unstart',
  '填报中': 'dsc-matrix__cell--filling',
  '已提交': 'dsc-matrix__cell--submitted',
  '已退回': 'dsc-matrix__cell--returned',
  '已通过': 'dsc-matrix__cell--passed',
  '已逾期': 'dsc-matrix__cell--overdue'
};

/* ---------- 数据访问 ---------- */
function getTask(id) { return TASKS.find(t => t.id === (id || AppState.taskId)); }
function getFill(taskId, unitId, ds) {
  const t = FILL_STORE[taskId || AppState.taskId];
  if (!t || !t[unitId]) return null;
  return t[unitId][ds] || null;
}
function unitName(id) { return UNIT_MAP[id] || id; }

/* ============================================================
   计算引擎（SRS 5.1~5.3 口径权威定义，填报与汇总共用）
   ============================================================ */
function calcD1(v) {
  const r = {};
  r.wz_benefit = v.wz_income - v.wz_purchase;
  r.wz_benefit_rate = pctDisp(r.wz_benefit, v.wz_income);
  r.wz_reduce = v.wz_cost - v.wz_purchase;
  r.wz_reduce_rate = pctDisp(r.wz_reduce, v.wz_cost);
  r.lw_benefit = v.lw_income - v.lw_purchase;
  r.lw_benefit_rate = pctDisp(r.lw_benefit, v.lw_income);
  r.lw_reduce = v.lw_cost - v.lw_purchase;
  r.lw_reduce_rate = pctDisp(r.lw_reduce, v.lw_cost);
  r.sum_purchase = v.wz_purchase + v.lw_purchase;
  r.sum_benefit = r.wz_benefit + r.lw_benefit;
  r.sum_benefit_rate = pctDisp(r.sum_benefit, v.wz_income + v.lw_income);
  r.sum_reduce = r.wz_reduce + r.lw_reduce;
  r.sum_reduce_rate = pctDisp(r.sum_reduce, v.wz_cost + v.lw_cost);
  r.zg_rate = pctDisp(v.zg_amount, r.sum_purchase);
  r.jc_rate = pctDisp(v.jc_amount, v.wz_purchase);
  r.dc_rate = pctDisp(v.dc_amount, v.wz_purchase);
  return r;
}
function calcD2(v) {
  const r = {};
  r.hnt_jyl = pctDisp(v.hnt_tkL - v.hnt_tuL, v.hnt_tuL);
  r.gj_tkL = v.gj_syL - v.gj_csL - v.gj_ljL;
  r.gj_jcl = v.gj_tuL - r.gj_tkL;
  r.gj_jclv = pctDisp(r.gj_jcl, v.gj_tuL);
  return r;
}
function calcD3(v) {
  const r = {};
  r.gj_shl = pctDisp(v.gj_syL - v.gj_tuL, v.gj_tuL);
  r.hnt_shl = pctDisp(v.hnt_xhL - v.hnt_ysL, v.hnt_ysL);
  r.cz_shl = pctDisp(v.cz_xhL - v.cz_ysL, v.cz_ysL);
  r.zc_zzl = pctDisp(v.zc_dc, v.zc_yz);
  return r;
}

/* ============================================================
   通用 UI 组件
   ============================================================ */
let toastTimer = null;
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'dsc-toast dsc-toast--visible' + (type ? ' dsc-toast--' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'dsc-toast'; }, 2600);
}

function openModal(title, bodyHTML, footerHTML) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHTML;
  document.getElementById('modalFooter').innerHTML = footerHTML ||
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>';
  document.getElementById('modalOverlay').classList.add('dsc-modal-overlay--visible');
}
function closeModal() {
  document.getElementById('modalOverlay').classList.remove('dsc-modal-overlay--visible');
}

/* 通用统计卡 */
function statCard(label, value, cls, footer) {
  return '<div class="dsc-stat-card"><div class="dsc-stat-card__label">' + label + '</div>' +
    '<div class="dsc-stat-card__value ' + (cls || '') + '">' + value + '</div>' +
    (footer ? '<div class="dsc-stat-card__footer">' + footer + '</div>' : '') + '</div>';
}

/* 表单字段渲染（D1~D3 区块） */
function renderSectionField(f, value, calcValue, errorMap, disabled) {
  if (f.type === 'calc') {
    return '<div class="dsc-form-group dsc-calc-field"><label class="dsc-form-label">' + esc(f.label) +
      '<span class="dsc-form-section__tag" style="margin-left:6px;">计算</span></label>' +
      '<input class="dsc-input dsc-calc-input" data-calc-field="' + f.key + '" value="' + esc(calcValue !== undefined && calcValue !== null ? calcValue : '/') + '" readonly tabindex="-1">' +
      '<div class="dsc-calc-field__formula">' + esc(f.formula) + '</div></div>';
  }
  const err = errorMap && errorMap[f.key];
  return '<div class="dsc-form-group' + (err ? ' dsc-calc-field--error' : '') + '" data-field="' + f.key + '">' +
    '<label class="dsc-form-label' + (f.required ? ' dsc-form-label--required' : '') + '">' + esc(f.label) +
    (f.unit ? '<span style="color:var(--color-text-tertiary);font-weight:normal;">（' + esc(f.unit) + '）</span>' : '') + '</label>' +
    '<input class="dsc-input' + (err ? ' dsc-input--error' : '') + '" type="text" data-fill-field="' + f.key + '" value="' + esc(value !== undefined && value !== null ? value : '') + '"' + (disabled ? ' disabled' : '') + ' placeholder="请输入数字">' +
    (err ? '<div class="dsc-field-error-text">⚠ ' + esc(err) + '</div>' : (f.tip ? '<div class="dsc-field-tip">' + esc(f.tip) + '</div>' : '')) +
    '</div>';
}

/* ============================================================
   角色视角（顶栏右上，仅作示意）
   DSC 系统无角色切换入口，功能权限由「系统功能项」授权控制；
   此处切换仅用于对比不同角色在页面内的数据范围与操作权限，
   左侧「海外填报」菜单为全量展示，不随视角变化。
   ============================================================ */
/* 该角色的功能项授权范围文案（由 ROLES.menus 映射为功能项名称） */
function roleScopeText(role) {
  return role.menus.map(k => {
    const m = HYTB_MENUS.find(x => x.key === k);
    return m ? m.name : k;
  }).join('、');
}
function renderRoleMenu() {
  const menu = document.getElementById('roleMenu');
  menu.innerHTML =
    '<div class="dsc-role__menu-tip">视角切换仅作演示：真实系统无此入口，功能权限由「系统功能项」授权控制；左侧菜单为全量展示，不随视角变化</div>' +
    ROLES.map(r =>
      '<div class="dsc-role__menu-item' + (r.id === AppState.role.id ? ' dsc-role__menu-item--active' : '') + '" onclick="switchRole(\'' + r.id + '\')">' +
      '<span>' + r.name + '</span>' +
      '<span class="dsc-role__menu-desc">' + r.user + '</span>' +
      '<span class="dsc-role__menu-scope">功能项：' + roleScopeText(r) + '</span></div>'
    ).join('');
  document.getElementById('roleName').textContent = AppState.role.name;
  document.getElementById('userName').textContent = AppState.role.user;
}
function switchRole(roleId) {
  const role = ROLES.find(r => r.id === roleId);
  if (!role) return;
  AppState.role = role;
  document.getElementById('roleSwitcher').classList.remove('dsc-role--open');
  renderRoleMenu();
  renderSidebarMenus();
  /* 左侧菜单为全量展示：切换视角不改变当前页面，仅页面内数据范围与操作权限按角色联动 */
  renderPage(AppState.page);
  toast('已切换至「' + role.name + '」视角（演示）：' + roleScopeText(role));
}

/* ============================================================
   侧边栏与路由
   ============================================================ */
/* 海外填报子菜单：全量展示（真实系统按「系统功能项」授权控制菜单可见性，原型不做角色过滤） */
function renderSidebarMenus() {
  const container = document.getElementById('hytbSubmenu');
  container.innerHTML = HYTB_MENUS.map(m =>
    '<li class="dsc-sidebar__submenu-item' + (AppState.page === m.key ? ' dsc-sidebar__submenu-item--active' : '') + '" data-page="' + m.key + '" title="' + esc(m.desc) + '">' +
    '<span class="dsc-sidebar__submenu-icon">' + MENU_ICONS[m.icon] + '</span>' +
    '<span class="dsc-sidebar__menu-text">' + m.name + '</span></li>'
  ).join('');
  container.querySelectorAll('[data-page]').forEach(li => {
    li.addEventListener('click', () => navigateTo(li.dataset.page));
  });
}

function navigateTo(page) {
  AppState.page = page;
  const menu = HYTB_MENUS.find(m => m.key === page);
  document.getElementById('breadcrumbPage').textContent = menu ? menu.breadcrumb : '';
  renderSidebarMenus();
  renderPage(page);
  document.getElementById('pageContainer').scrollTop = 0;
  window.scrollTo(0, 0);
}

function renderPage(page) {
  const view = VIEWS[page];
  const container = document.getElementById('pageContainer');
  if (view && typeof view.render === 'function') {
    container.innerHTML = view.render();
    if (typeof view.init === 'function') view.init();
  } else {
    container.innerHTML = '<div class="dsc-empty"><div class="dsc-empty__icon">🚧</div><div class="dsc-empty__text">页面开发中</div></div>';
  }
}

/* ---------- 填报页返回其他页面的上下文辅助 ---------- */
function gotoFill(dataset) {
  AppState.fillCtx = {
    unitId: AppState.role.id === 'filler' || AppState.role.id === 'auditor' ? 'U01' : 'U01',
    dataset: dataset || null
  };
  navigateTo('my-fill');
}
function gotoReview(unitId, dataset) {
  AppState.reviewCtx = { unitId: unitId, dataset: dataset || null };
  navigateTo('review');
}
function gotoProgress(taskId) {
  AppState.taskId = taskId;
  navigateTo('task-manage');
}

/* ============================================================
   初始化
   ============================================================ */
function initShell() {
  /* 角色切换器 */
  renderRoleMenu();
  document.getElementById('roleCurrent').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('roleSwitcher').classList.toggle('dsc-role--open');
  });
  document.addEventListener('click', () => {
    document.getElementById('roleSwitcher').classList.remove('dsc-role--open');
  });

  /* 侧边栏分组折叠 */
  document.getElementById('hytbGroupHead').addEventListener('click', () => {
    document.getElementById('hytbSubmenu').classList.toggle('dsc-sidebar__submenu--open');
    document.getElementById('hytbCaret').classList.toggle('dsc-sidebar__caret--open');
  });

  /* 侧边栏收起/展开 */
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('dsc-sidebar--collapsed');
    document.getElementById('mainContent').classList.toggle('dsc-main--expanded');
  });

  /* 平台级菜单点击提示（本原型仅覆盖海外填报） */
  document.querySelectorAll('[data-nav="platform"]').forEach(li => {
    li.addEventListener('click', () => toast('本原型仅覆盖「海外填报」功能模块，其他模块请参照 DSC 正式系统'));
  });

  /* 站内信 */
  document.querySelector('.dsc-header__recycle').addEventListener('click', () => openMsgModal());

  /* 模态框关闭 */
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
}

function openMsgModal() {
  const rows = MESSAGES.map(m =>
    '<div class="dsc-audit-log__item">' +
    '<span class="dsc-audit-log__time">' + m.time + '</span>' +
    '<span style="flex-shrink:0;">' + statusTag(m.type === '催办' ? '填报中' : m.type === '退回' ? '已退回' : m.type === '通过' ? '已通过' : '已提交') + '</span>' +
    '<span class="dsc-audit-log__detail"><strong>' + esc(m.title) + '</strong><br><span style="color:var(--color-text-tertiary);">' + esc(m.detail) + '</span></span>' +
    '</div>'
  ).join('');
  openModal('站内信（5 条未读）', '<ul class="dsc-audit-log">' + rows + '</ul>',
    '<button class="dsc-btn dsc-btn--primary" onclick="closeModal();toast(\'已全部标记为已读\',\'success\')">全部已读</button>');
}

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  renderSidebarMenus();

  /* URL 深链接：?role=&page=&ds= &view= &unit= （原型演示与联调用） */
  const params = new URLSearchParams(location.search);
  const roleParam = params.get('role');
  if (roleParam) {
    const r = ROLES.find(x => x.id === roleParam);
    if (r) AppState.role = r;
  }
  const pageParam = params.get('page');
  const dsParam = params.get('ds');
  const viewParam = params.get('view');
  const unitParam = params.get('unit');

  if (pageParam === 'task-manage' && viewParam === 'progress') TaskViewState.view = 'progress';
  if (pageParam === 'my-fill' && dsParam) FillState.dataset = dsParam;
  if (pageParam === 'summary' && dsParam) SummaryState.dataset = dsParam;
  if (pageParam === 'config' && dsParam) ConfigState.tab = dsParam;
  if (pageParam === 'review' && unitParam && dsParam) {
    ReviewState.view = 'detail';
    ReviewState.unitId = unitParam;
    ReviewState.dataset = dsParam;
  }

  renderRoleMenu();
  /* 菜单全量展示：page 参数命中任一功能项即可直达，否则落到第一个功能项（与视角无关） */
  const target = pageParam && HYTB_MENUS.some(m => m.key === pageParam) ? pageParam : HYTB_MENUS[0].key;
  navigateTo(target);
});
