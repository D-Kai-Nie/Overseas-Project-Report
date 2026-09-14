/* ============================================================
   ZY-HY-TB-010 报送任务管理
   任务创建/下发/催办/关闭 + 六状态进度看板（替代线下"资料报送情况"表）
   ============================================================ */

/* 模块内状态 */
const TaskViewState = {
  view: 'list',                       // list | progress
  filters: { name: '', period: '', status: '', freq: '' },
  reminders: {}                       // 催办记录 { unitId: time }
};
const PROTO_TODAY = '2026-09-14';     // 原型演示"今天"

function daysLeft(deadline) {
  const d = parseDate(deadline.replace(/-/g, '/'));
  const t = parseDate(PROTO_TODAY.replace(/-/g, '/'));
  return Math.round((d - t) / 86400000);
}

/* 任务的数据来源：周报=共享中心/区域总部（W1~W5）+ 二级单位（W6）；月报=二级单位（D1~D6） */
function taskSource(t) {
  const weekly = t.freq === '周报';
  const store = weekly ? WEEKLY_STORE[t.id] : FILL_STORE[t.id];
  return {
    weekly: weekly,
    store: store || {},
    matrixSubjects: weekly ? SHARED_CENTERS : UNITS,
    matrixDatasets: weekly ? ['W1', 'W2', 'W3', 'W4', 'W5'] : t.scope,
    w6Units: weekly ? UNITS : []
  };
}

VIEWS['task-manage'] = {
  render() {
    return TaskViewState.view === 'progress' ? renderProgressBoard() : renderTaskList();
  },
  init() { /* 事件通过 inline handler 绑定 */ }
};

/* ============================================================
   任务列表
   ============================================================ */
function renderTaskList() {
  const canCreate = AppState.role.id === 'admin' || AppState.role.id === 'sysadmin';
  const periodOptions = ['', '2026年9月第3周', '2026年9月', '2026年9月（专项）', '2026年9月第2周', '2025年12月', '2025年6月'];
  const statusOptions = ['', '草稿', '进行中', '已截止', '已关闭'];
  const freqOptions = ['', '周报', '月报'];

  let rows = TASKS.filter(t => {
    if (TaskViewState.filters.name && t.name.indexOf(TaskViewState.filters.name) < 0) return false;
    if (TaskViewState.filters.period && t.period !== TaskViewState.filters.period) return false;
    if (TaskViewState.filters.status && t.status !== TaskViewState.filters.status) return false;
    if (TaskViewState.filters.freq && t.freq !== TaskViewState.filters.freq) return false;
    return true;
  });

  const taskStatusTag = {
    '草稿': 'dsc-tag--default', '进行中': 'dsc-tag--info',
    '已截止': 'dsc-tag--returned', '已关闭': 'dsc-tag--success'
  };

  const tableRows = rows.map(t => {
    const dl = t.status === '进行中' ? daysLeft(t.deadline) : null;
    let actions = '';
    if (t.status === '草稿') {
      actions = '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="editTaskDraft(\'' + t.id + '\')">编辑</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="deleteTaskDraft(\'' + t.id + '\')">删除</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm dsc-text-primary" onclick="publishTask(\'' + t.id + '\')">下发</button>';
    } else if (t.status === '进行中') {
      actions = '<button class="dsc-btn dsc-btn--text dsc-btn--sm dsc-text-primary" onclick="viewProgress(\'' + t.id + '\')">进度看板</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="remindAllUnreported()">催办</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="confirmCloseTask(\'' + t.id + '\')">关闭</button>';
    } else {
      actions = '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="viewProgress(\'' + t.id + '\')">查看进度</button>';
    }
    return '<tr>' +
      '<td><div style="font-weight:var(--font-weight-medium);">' + esc(t.name) + '</div>' +
      '<div style="font-size:var(--font-size-sm);color:var(--color-text-tertiary);margin-top:2px;">' + esc(t.id) + ' · 创建于 ' + t.createdAt + '</div></td>' +
      '<td><span class="dsc-tag ' + (t.freq === '周报' ? 'dsc-tag--filling' : 'dsc-tag--info') + '">' + esc(t.freq || '月报') + '</span>' +
      '<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:2px;">' + (t.freq === '周报' ? '每周五' : '每月底') + '</div></td>' +
      '<td>' + esc(t.period) + '</td>' +
      '<td style="font-size:var(--font-size-sm);">' + t.scope.join('、') + '</td>' +
      '<td style="font-size:var(--font-size-sm);">' + esc(t.unitScope) + '</td>' +
      '<td>' + esc(t.deadline) +
      (dl !== null ? '<div class="' + (dl <= 3 ? 'dsc-text-danger' : 'dsc-text-tertiary') + '" style="font-size:var(--font-size-sm);">' + (dl >= 0 ? '剩 ' + dl + ' 天' : '已过期 ' + (-dl) + ' 天') + '</div>' : '') +
      '</td>' +
      '<td><span class="dsc-tag ' + taskStatusTag[t.status] + '">' + t.status + '</span></td>' +
      '<td style="font-size:var(--font-size-sm);">' + esc(t.createdBy) + '</td>' +
      '<td class="dsc-table__actions">' + actions + '</td></tr>';
  }).join('');

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title">报送任务管理</div>' +
    '  <div class="dsc-field-tip">任务统一下发 → 单位在线填报 → 分级审核 → 自动汇总（ZY-HY-TB-010）</div></div>' +
    (canCreate ? '<div class="dsc-page-header__actions"><button class="dsc-btn dsc-btn--primary" onclick="openTaskCreateModal()">+ 新增报送任务</button></div>' : '') +
    '</div>' +

    '<div class="dsc-card"><div class="dsc-card__body">' +
    '  <div class="dsc-filter-bar">' +
    '    <div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">任务名称</label>' +
    '      <input class="dsc-input" id="filterName" placeholder="支持模糊查询" value="' + esc(TaskViewState.filters.name) + '" style="width:200px;"></div>' +
    '    <div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">报送期间</label>' +
    '      <select class="dsc-select" id="filterPeriod" style="width:160px;">' +
    periodOptions.map(p => '<option value="' + p + '"' + (TaskViewState.filters.period === p ? ' selected' : '') + '>' + (p || '全部期间') + '</option>').join('') +
    '      </select></div>' +
    '    <div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">任务状态</label>' +
    '      <select class="dsc-select" id="filterStatus" style="width:130px;">' +
    statusOptions.map(s => '<option value="' + s + '"' + (TaskViewState.filters.status === s ? ' selected' : '') + '>' + (s || '全部状态') + '</option>').join('') +
    '      </select></div>' +
    '    <div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">报送频率</label>' +
    '      <select class="dsc-select" id="filterFreq" style="width:120px;">' +
    freqOptions.map(f => '<option value="' + f + '"' + (TaskViewState.filters.freq === f ? ' selected' : '') + '>' + (f || '全部频率') + '</option>').join('') +
    '      </select></div>' +
    '    <div class="dsc-filter-bar__item">' +
    '      <button class="dsc-btn dsc-btn--primary" onclick="applyTaskFilter()">查询</button>' +
    '      <button class="dsc-btn dsc-btn--default" onclick="resetTaskFilter()">重置</button>' +
    '    </div>' +
    '  </div>' +
    '</div></div>' +

    '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body dsc-card__body--no-padding">' +
    '  <div class="dsc-table-wrapper"><table class="dsc-table">' +
    '    <thead><tr><th>任务名称</th><th>报送频率</th><th>报送期间</th><th>数据集范围</th><th>填报单位范围</th><th>截止时间</th><th>任务状态</th><th>创建人</th><th>操作</th></tr></thead>' +
    '    <tbody>' + (tableRows || '<tr><td colspan="8"><div class="dsc-empty"><div class="dsc-empty__icon">📭</div><div class="dsc-empty__text">暂无符合条件的任务</div></div></td></tr>') + '</tbody>' +
    '  </table></div>' +
    '</div></div>';
}

function applyTaskFilter() {
  TaskViewState.filters.name = document.getElementById('filterName').value.trim();
  TaskViewState.filters.period = document.getElementById('filterPeriod').value;
  TaskViewState.filters.status = document.getElementById('filterStatus').value;
  TaskViewState.filters.freq = document.getElementById('filterFreq').value;
  renderPage('task-manage');
}
function resetTaskFilter() {
  TaskViewState.filters = { name: '', period: '', status: '', freq: '' };
  renderPage('task-manage');
}

/* ---------- 新增 / 编辑任务（V1.1 双频率） ---------- */
function openTaskCreateModal(editId, freq, keepName) {
  const t = editId ? TASKS.find(x => x.id === editId) : null;
  const curFreq = freq || (t ? t.freq : '月报');
  const scopePool = curFreq === '周报' ? W_DATASET_ORDER : DATASET_ORDER;
  const checked = t ? t.scope : scopePool;
  const periodPool = curFreq === '周报'
    ? ['2026年9月第4周', '2026年9月第3周', '2026年9月第2周']
    : ['2026年10月', '2026年9月', '2026年9月（专项）'];
  const nameVal = keepName !== undefined ? keepName : (t ? t.name : '');
  const body = '' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">报送频率</label>' +
    '  <div class="dsc-seg">' +
    ['月报', '周报'].map(f =>
      '<div class="dsc-seg__item' + (curFreq === f ? ' dsc-seg__item--active' : '') + '" onclick="switchCreateFreq(\'' + f + '\')">' +
      f + '（' + (f === '月报' ? '每月底' : '每周五') + '）</div>').join('') +
    '  </div>' +
    '  <div class="dsc-field-tip">' + (curFreq === '月报'
      ? '月报由 14 家二级单位填报，数据集 D1~D6；数据进入时自动带出当月周报数据（ZY-HY-TB-070）'
      : '周报由各共享中心/区域总部填报 W1~W5、二级单位（项目）填报 W6；每周五 17:00 前提交') + '</div></div>' +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">任务名称</label>' +
    '    <input class="dsc-input" id="tcName" value="' + esc(nameVal) + '" placeholder="如：' + (curFreq === '周报' ? '2026年9月第4周周报' : '2026年10月海外供应链数据月报') + '"></div>' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">报送期间</label>' +
    '    <select class="dsc-select" id="tcPeriod">' +
    periodPool.map(p => '<option' + (t && t.period === p ? ' selected' : '') + '>' + p + '</option>').join('') +
    '    </select></div>' +
    '</div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">数据集范围（多选）</label>' +
    '  <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);padding-top:4px;">' +
    scopePool.map(d => '<label class="dsc-check"><input type="checkbox" class="tcScope" value="' + d + '"' + (checked.indexOf(d) >= 0 ? ' checked' : '') + '><span class="dsc-check__box"></span>' + d + ' ' + esc(dsMeta(d).name) + '</label>').join('') +
    '  </div></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">填报主体范围</label>' +
    '  <select class="dsc-select" id="tcUnitScope">' +
    '    <option value="all"' + (!t || t.unitScope.indexOf('全部') === 0 ? ' selected' : '') + '>' +
    (curFreq === '周报' ? '各共享中心、区域总部、二级单位（项目）' : '全部二级单位（14家）') + '</option>' +
    '    <option value="partial">圈选主体（从组织主数据选择）</option>' +
    '  </select>' +
    '  <div class="dsc-field-tip">组织与用户从 DSC 统一组织主数据同步，支持按任务圈选</div></div>' +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">截止时间</label>' +
    '    <input class="dsc-input" id="tcDeadline" type="date" value="' + (t ? t.deadline : (curFreq === '周报' ? '2026-09-25' : '2026-10-31')) + '">' +
    '    <div class="dsc-field-tip">' + (curFreq === '周报' ? '每周五 17:00（截止前 1 天系统自动催办未提交主体）' : '每月底后 5 个工作日内齐套（截止前 1 天自动催办）') + '</div></div>' +
    '  <div class="dsc-form-group"><label class="dsc-form-label">填报说明附件</label>' +
    '    <input class="dsc-input" type="file" disabled placeholder="演示原型：附件上传已禁用"></div>' +
    '</div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label">填报说明</label>' +
    '  <textarea class="dsc-textarea" id="tcDesc" rows="2" placeholder="如：请各主体于截止时间前完成填报并提交审核，逾期将标记并计入报送情况统计。">' + (t ? esc(t.desc) : '') + '</textarea></div>';

  const footer = '' +
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--default" onclick="saveTask(\'草稿\')">保存为草稿</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="saveTask(\'下发\')">核对无误，直接下发</button>';
  openModal(t ? '编辑报送任务（草稿）' : '新增报送任务', body, footer);
}
/* 切换新建任务的频率（保留已填名称） */
function switchCreateFreq(f) {
  const nameEl = document.getElementById('tcName');
  openTaskCreateModal(null, f, nameEl ? nameEl.value : '');
}

function editTaskDraft(id) { openTaskCreateModal(id); }

function deleteTaskDraft(id) {
  const idx = TASKS.findIndex(t => t.id === id);
  openModal('删除确认', '<div class="dsc-alert dsc-alert--warning">草稿任务删除后不可恢复，且不影响已下发的任务。确认删除「' + esc(TASKS[idx].name) + '」？</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--danger" onclick="doDeleteTaskDraft(\'' + id + '\')">确认删除</button>');
}
function doDeleteTaskDraft(id) {
  TASKS.splice(TASKS.findIndex(t => t.id === id), 1);
  closeModal();
  toast('草稿任务已删除，操作已留痕', 'success');
  renderPage('task-manage');
}

/* 业务规则：同一期间+同一频率+同一数据集范围内，同一填报主体仅允许一个进行中任务（V1.1 规则 1） */
function saveTask(action) {
  const name = document.getElementById('tcName').value.trim();
  const period = document.getElementById('tcPeriod').value;
  const freq = document.querySelector('.dsc-seg__item--active').textContent.indexOf('周报') >= 0 ? '周报' : '月报';
  const scopes = Array.from(document.querySelectorAll('.tcScope:checked')).map(c => c.value);
  const deadline = document.getElementById('tcDeadline').value;
  if (!name) { toast('请填写任务名称', 'warning'); return; }
  if (!scopes.length) { toast('请至少勾选一个数据集', 'warning'); return; }
  if (!deadline) { toast('请选择截止时间', 'warning'); return; }

  /* 重复创建校验（同一期间 + 同一频率 + 同一数据集范围） */
  const dup = TASKS.find(t => t.status === '进行中' && t.freq === freq && t.period === period &&
    scopes.some(s => t.scope.indexOf(s) >= 0));
  if (dup) {
    openModal('重复创建提示',
      '<div class="dsc-alert dsc-alert--danger">同一期间、同一频率、同一数据集范围内，同一填报主体仅允许一个进行中任务。</div>' +
      '<div class="dsc-card__body" style="padding:var(--space-md) 0 0;"><div class="dsc-kv__label">已存在进行中任务</div>' +
      '<div style="font-weight:var(--font-weight-medium);">' + esc(dup.name) + '（' + dup.id + '）</div>' +
      '<div class="dsc-field-tip">' + esc(dup.freq) + ' · 数据集范围：' + dup.scope.join('、') + ' · 截止 ' + esc(dup.deadline) + '</div></div>',
      '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">返回修改</button>');
    return;
  }

  const year = period.slice(0, 4);
  const seq = Math.floor(Math.random() * 90 + 10);
  const id = freq === '周报' ? 'T-' + year + 'W' + period.slice(-3, -1) + seq
                             : 'T-' + year + 'M' + period.slice(5, 7) + seq;
  const task = {
    id: id, name: name, status: action === '草稿' ? '草稿' : '进行中', freq: freq,
    year: year, period: period, deadline: deadline, scope: scopes,
    unitScope: document.getElementById('tcUnitScope').value === 'all'
      ? (freq === '周报' ? '各共享中心、区域总部、二级单位（项目）' : '全部二级单位（14家）')
      : '圈选主体（演示）',
    createdBy: AppState.role.id === 'sysadmin' ? '系统管理员' : '王建国',
    createdAt: '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0'),
    publishTime: action === '草稿' ? '' : '2026-09-14 09:00',
    desc: document.getElementById('tcDesc').value.trim()
  };
  TASKS.unshift(task);
  if (action === '下发') {
    toast('任务已下发：系统向范围内主体的审核人、填报人推送待办；截止前 1 天自动催办', 'success');
  } else {
    toast('任务已保存为草稿', 'success');
  }
  closeModal();
  renderPage('task-manage');
}

function publishTask(id) {
  const t = TASKS.find(x => x.id === id);
  openModal('下发确认',
    '<div>确认下发任务「' + esc(t.name) + '」？</div>' +
    '<div class="dsc-alert dsc-alert--info dsc-mt-md">下发后系统将：① 生成各单位 × 各数据集填报任务单；② 向单位审核人、填报人推送待办；③ 截止前 3 天、1 天自动催办未提交单位。</div>' +
    '<div class="dsc-field-tip">下发前未产生填报数据时可撤回重配（业务规则 2）。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doPublishTask(\'' + id + '\')">确认下发</button>');
}
function doPublishTask(id) {
  const t = TASKS.find(x => x.id === id);
  t.status = '进行中';
  t.publishTime = '2026-09-14 09:00';
  closeModal();
  toast('任务已下发，待办已推送至相关单位', 'success');
  renderPage('task-manage');
}

function confirmCloseTask(id) {
  const t = getTask(id);
  const store = FILL_STORE[t.id];
  const unPassed = [];
  UNITS.forEach(u => {
    t.scope.forEach(d => {
      const rec = store[u.id] && store[u.id][d];
      if (!rec || rec.status !== '已通过') unPassed.push(u.name + '·' + d);
    });
  });
  openModal('关闭任务确认',
    (unPassed.length
      ? '<div class="dsc-alert dsc-alert--warning">当前尚有 ' + unPassed.length + ' 项单位数据集未通过复核（如 ' + unPassed.slice(0, 3).join('、') + '…）。任务关闭后所有关联填报单将<b>只读</b>，未通过数据不再纳入汇总。</div>'
      : '<div class="dsc-alert dsc-alert--success">全部单位数据集均已通过复核，可以关闭任务并归档。</div>') +
    '<div class="dsc-field-tip">关闭操作留痕：操作人、时间、IP 均记录（验收标准 A7）。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn ' + (unPassed.length ? 'dsc-btn--danger' : 'dsc-btn--primary') + '" onclick="doCloseTask(\'' + id + '\')">确认关闭任务</button>');
}
function doCloseTask(id) {
  getTask(id).status = '已关闭';
  closeModal();
  toast('任务已关闭归档，全部关联填报单转为只读', 'success');
  TaskViewState.view = 'list';
  renderPage('task-manage');
}

/* ============================================================
   进度看板（六状态矩阵，替代"资料报送情况"人工登记表）
   ============================================================ */
function viewProgress(id) {
  AppState.taskId = id;
  TaskViewState.view = 'progress';
  renderPage('task-manage');
}
function backToTaskList() {
  TaskViewState.view = 'list';
  renderPage('task-manage');
}

function renderProgressBoard() {
  const t = getTask();
  const src = taskSource(t);
  const store = src.store;
  const dl = daysLeft(t.deadline);
  const datasets = src.matrixDatasets;
  const weekly = src.weekly;
  const subjectLabel = weekly ? '填报主体' : '二级单位';

  /* 应报主体：周报含 W6 二级单位（项目） */
  const allSubjects = weekly ? src.matrixSubjects.concat(UNITS) : src.matrixSubjects;
  const dsOf = subjectId => {
    if (!weekly) return datasets;
    return (subjectId.indexOf('SC') === 0 || subjectId === 'RH1') ? datasets : ['W6'];
  };

  /* 页首统计：应报主体数 / 已报主体数 / 逾期主体数 / 齐套率 */
  let reported = 0, complete = 0, overdue = 0, submittedPending = 0, total = 0;
  allSubjects.forEach(s => {
    const sub = store[s.id] || {};
    const dsList = dsOf(s.id).filter(d => sub[d] && sub[d].status !== '-');
    if (!dsList.length) return;
    total++;
    const statuses = dsList.map(d => sub[d].status);
    if (statuses.some(st => st === '已提交' || st === '已退回' || st === '已通过')) reported++;
    if (statuses.every(st => st === '已通过')) complete++;
    if (statuses.some(st => st === '已逾期')) overdue++;
    if (statuses.some(st => st === '已提交')) submittedPending++;
  });
  const rate = ((complete / (total || 1)) * 100).toFixed(1);

  const matrixRows = src.matrixSubjects.map(s => {
    const sub = store[s.id] || {};
    const dsList = datasets.filter(d => sub[d] && sub[d].status !== '-');
    let last = '';
    dsList.forEach(d => {
      const rec = sub[d];
      if (rec && rec.lastSubmit && rec.lastSubmit > last) last = rec.lastSubmit;
    });
    const overdueDs = dsList.filter(d => sub[d].status === '已逾期');
    const reason = overdueDs.length ? (sub[overdueDs[0]].reason || '未报送') : '';
    const reminded = TaskViewState.reminders[s.id];
    const cells = datasets.map(d => {
      const rec = sub[d];
      if (!rec || rec.status === '-') {
        return '<td><span class="dsc-matrix__cell dsc-matrix__cell--na" title="不适用">—</span></td>';
      }
      const st = rec.status;
      return '<td><span class="dsc-matrix__cell ' + STATUS_CELL_CLASS[st] + '" onclick="openUnitDatasetModal(\'' + s.id + '\',\'' + d + '\')" title="' + s.name + ' · ' + d + ' ' + esc(dsMeta(d).name) + '">' + st + '</span></td>';
    }).join('');
    return '<tr>' +
      '<th class="dsc-matrix__unit"><span class="dsc-matrix__unit-name">' + s.name +
      (reminded ? '<div style="font-size:11px;color:var(--color-warning);">已催办 ' + reminded + '</div>' : '') + '</span></th>' +
      cells +
      '<td style="font-size:var(--font-size-sm);font-family:var(--font-family-number);color:var(--color-text-tertiary);">' + (last || '—') + '</td>' +
      '<td style="font-size:var(--font-size-sm);">' +
      (overdueDs.length ? '<span class="dsc-text-danger">' + esc(reason) + '</span>' : '—') +
      '</td>' +
      '<td class="dsc-table__actions">' +
      (t.status === '进行中'
        ? (overdueDs.length ? '<button class="dsc-btn dsc-btn--text dsc-btn--sm dsc-text-danger" onclick="openReasonModal(\'' + s.id + '\',\'' + overdueDs[0] + '\')">登记原因</button>' : '') +
          '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="remindUnit(\'' + s.id + '\')">催办</button>'
        : '<span class="dsc-text-tertiary dsc-font-sm">—</span>') +
      '</td></tr>';
  }).join('');

  /* 周报任务：W6 项目供应链风险全景表（二级单位填报） */
  let w6Card = '';
  if (weekly && t.scope.indexOf('W6') >= 0) {
    const rows = UNITS.map(u => {
      const rec = (store[u.id] || {}).W6;
      if (!rec || rec.status === '-') return '';
      return '<tr><td>' + u.name + '</td><td>' + statusTag(rec.status) + '</td>' +
        '<td>' + (rec.zero ? '零报告' : (rec.rows ? rec.rows.length + ' 个项目' : '—')) + '</td>' +
        '<td style="font-family:var(--font-family-number);font-size:var(--font-size-sm);">' + esc(rec.lastSubmit || '—') + '</td>' +
        '<td class="dsc-table__actions">' +
        (t.status === '进行中' && (rec.status === '未开始' || rec.status === '填报中')
          ? '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="remindUnit(\'' + u.id + '\')">催办</button>'
          : '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="openUnitDatasetModal(\'' + u.id + '\',\'W6\')">查看</button>') +
        '</td></tr>';
    }).join('');
    w6Card = '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
      '<div class="dsc-card__title" style="margin-bottom:var(--space-md);">W6 项目供应链风险全景表（由各二级单位/项目填报）</div>' +
      '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>二级单位</th><th>状态</th><th>数据量</th><th>最近提交</th><th>操作</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="5">暂无数据</td></tr>') + '</tbody></table></div>' +
      '<div class="dsc-field-tip dsc-mt-sm">W6 按二级单位汇总作为月报一致性校验基准：金额类项目行求和、率类按采购总额加权（不对率直接平均）；金额类月报＜周报汇总阻断提交，率类偏差＞±5% 仅提示核对（V1.1 第 7.1 / 7.3 节、规则 13/18）。</div>' +
      '</div></div>';
  }

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title" style="font-size:var(--font-size-lg);">' + esc(t.name) + ' · 报送进度看板</div>' +
    '  <div class="dsc-field-tip">' + esc(t.freq) + ' · ' + esc(t.period) + ' · 截止 ' + esc(t.deadline) +
    (t.status === '进行中' ? '（剩 ' + dl + ' 天，系统于截止前 1 天自动催办未提交主体）' : '') +
    ' · 下发时间 ' + esc(t.publishTime || '—') + '</div></div>' +
    '  <div class="dsc-page-header__actions">' +
    '    <button class="dsc-btn dsc-btn--default" onclick="backToTaskList()">← 返回任务列表</button>' +
    (t.status === '进行中' ? '<button class="dsc-btn dsc-btn--default" onclick="remindAllUnreported()">催办全部未报主体</button>' +
      '<button class="dsc-btn dsc-btn--default" onclick="confirmCloseTask(\'' + t.id + '\')">关闭任务</button>' +
      '<button class="dsc-btn dsc-btn--primary" onclick="navigateTo(\'summary\')">发起汇总</button>' : '') +
    '  </div>' +
    '</div>' +

    '<div class="dsc-stat-row">' +
    statCard('应报主体数', total, '', '数据集 ' + datasets.join('、') + (weekly ? '（W6 由二级单位填报）' : '')) +
    statCard('已报主体数', reported, 'dsc-stat-card__value--primary', '至少提交 1 个数据集') +
    statCard('已通过（齐套）', complete, 'dsc-stat-card__value--success', '全部数据集复核通过') +
    statCard('待复核', submittedPending, 'dsc-stat-card__value--warning', weekly ? '周报提交后直接待复核' : '已提交待单位/局级审核') +
    statCard('逾期主体数', overdue, overdue > 0 ? 'dsc-stat-card__value--danger' : '', '超期未提交自动标记并登记原因') +
    statCard('齐套率', rate + '%', 'dsc-stat-card__value--primary', weekly ? '目标：每周五当日 ≥95%' : '目标：每月底后 5 个工作日 ≥95%') +
    '</div>' +

    '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
    '  <div class="dsc-card__title" style="margin-bottom:var(--space-md);">' + subjectLabel + ' × 数据集填报状态</div>' +
    '  <div class="dsc-matrix-wrapper"><table class="dsc-matrix">' +
    '    <thead><tr><th class="dsc-matrix__unit">' + subjectLabel + '</th>' +
    datasets.map(d => '<th>' + d + '<br><span style="font-weight:normal;">' + esc(dsMeta(d).name.replace(/（.*）/, '')) + '</span></th>').join('') +
    '    <th>最近提交</th><th>未报送原因</th><th>操作</th></tr></thead>' +
    '    <tbody>' + matrixRows + '</tbody>' +
    '  </table></div>' +
    '  <div class="dsc-matrix__foot-legend">状态图例：' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#F5F5F5;border:1px solid #E8E8E8;"></span>未开始</span>' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#E6F7FF;border:1px solid #91D5FF;"></span>填报中</span>' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#E6F7FF;border:1px solid #69C0FF;"></span>已提交</span>' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#FFF7E6;border:1px solid #FFD591;"></span>已退回</span>' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#F6FFED;border:1px solid #B7EB8F;"></span>已通过</span>' +
    '    <span class="dsc-matrix__legend-item"><span class="dsc-matrix__legend-dot" style="background:#FFF1F0;border:1px solid #FFA39E;"></span>已逾期</span>' +
    '    <span style="color:var(--color-text-tertiary);">点击状态格查看主体×数据集详情；"登记原因"记录逾期未报送原因</span>' +
    '  </div>' +
    '</div></div>' + w6Card;
}

/* 登记未报送原因（V1.1 010：逾期主体填写未报送原因） */
function openReasonModal(subjectId, ds) {
  const rec = (taskSource(getTask()).store[subjectId] || {})[ds] || {};
  openModal('登记未报送原因 · ' + subjectName(subjectId),
    '<div class="dsc-alert dsc-alert--warning">该主体 ' + ds + ' ' + esc(dsMeta(ds).name) + ' 已逾期未报送，请登记原因（将计入报送情况统计并留痕）。</div>' +
    '<div class="dsc-form-group dsc-mt-md"><label class="dsc-form-label dsc-form-label--required">未报送原因</label>' +
    '<textarea class="dsc-textarea" id="reasonText" rows="3" placeholder="如：总结未报送 / 数据未汇总完成 / 人员变动交接中">' + esc(rec.reason || '') + '</textarea></div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doSaveReason(\'' + subjectId + '\',\'' + ds + '\')">保存并留痕</button>');
}
function doSaveReason(subjectId, ds) {
  const txt = document.getElementById('reasonText').value.trim();
  if (!txt) { toast('未报送原因必填', 'warning'); return; }
  const rec = (taskSource(getTask()).store[subjectId] || {})[ds];
  if (rec) rec.reason = txt;
  closeModal();
  toast('未报送原因已登记并留痕（操作人/时间/内容）', 'success');
  renderPage('task-manage');
}

/* 催办：向该主体审核人、填报人发送催办站内信/消息 */
function remindUnit(subjectId) {
  TaskViewState.reminders[subjectId] = '09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  toast('已向 ' + subjectName(subjectId) + ' 审核人、填报人发送催办消息（站内信 + 待办）', 'success');
  renderPage('task-manage');
}
function remindAllUnreported() {
  const t = getTask();
  const src = taskSource(t);
  const weekly = src.weekly;
  const subjects = weekly ? src.matrixSubjects.concat(UNITS) : src.matrixSubjects;
  let count = 0;
  subjects.forEach(s => {
    const sub = src.store[s.id] || {};
    const dsList = (weekly && s.id.indexOf('SC') !== 0 && s.id !== 'RH1') ? ['W6'] : src.matrixDatasets;
    const hasUnstart = dsList.some(d => sub[d] && sub[d].status !== '-' && (sub[d].status === '未开始' || sub[d].status === '填报中'));
    if (hasUnstart) {
      count++;
      TaskViewState.reminders[s.id] = '09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
    }
  });
  toast(count ? '已向 ' + count + ' 个未报齐主体批量发送催办' : '各主体均已提交，无需催办', count ? 'success' : 'warning');
  renderPage('task-manage');
}

/* 主体 × 数据集详情 */
function openUnitDatasetModal(subjectId, ds) {
  const t = getTask();
  const src = taskSource(t);
  const rec = (src.store[subjectId] || {})[ds];
  const st = (rec && rec.status && rec.status !== '-') ? rec.status : '未开始';
  const info = [];
  info.push('<div class="dsc-kv__item"><div class="dsc-kv__label">当前状态</div><div class="dsc-kv__value">' + statusTag(st) + '</div></div>');
  info.push('<div class="dsc-kv__item"><div class="dsc-kv__label">最近提交时间</div><div class="dsc-kv__value">' + esc((rec && rec.lastSubmit) || '—') + '</div></div>');
  if (rec && rec.rejectReason) {
    info.push('<div class="dsc-kv__item"><div class="dsc-kv__label">退回人 / 时间</div><div class="dsc-kv__value">' + esc(rec.rejectedBy) + ' · ' + esc(rec.rejectedTime) + '</div></div>');
  }
  if (rec && rec.passedBy) {
    info.push('<div class="dsc-kv__item"><div class="dsc-kv__label">复核通过人 / 时间</div><div class="dsc-kv__value dsc-kv__value--success">' + esc(rec.passedBy) + ' · ' + esc(rec.passedTime) + '</div></div>');
  }
  if (rec && rec.reason) {
    info.push('<div class="dsc-kv__item"><div class="dsc-kv__label">未报送原因</div><div class="dsc-kv__value dsc-kv__value--danger">' + esc(rec.reason) + '</div></div>');
  }

  let actions = '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">关闭</button>';
  if (st !== '未开始' && st !== '已逾期') {
    actions += '<button class="dsc-btn dsc-btn--primary" onclick="closeModal();gotoReview(\'' + subjectId + '\',\'' + ds + '\')">查看填报明细</button>';
  }
  if (t.status === '进行中' && st === '已逾期') {
    actions += '<button class="dsc-btn dsc-btn--default" onclick="closeModal();openReasonModal(\'' + subjectId + '\',\'' + ds + '\')">登记未报送原因</button>';
  }
  if (t.status === '进行中' && (st === '未开始' || st === '填报中' || st === '已退回')) {
    actions += '<button class="dsc-btn dsc-btn--default" onclick="closeModal();remindUnit(\'' + subjectId + '\')">催办该主体</button>';
  }
  openModal(subjectName(subjectId) + ' · ' + ds + ' ' + esc(dsMeta(ds).name),
    '<div class="dsc-kv" style="margin-bottom:var(--space-md);">' + info.join('') + '</div>' +
    (rec && rec.rejectReason
      ? '<div class="dsc-alert dsc-alert--warning">退回原因（必填，已留痕）：<br>' + esc(rec.rejectReason) + '</div>'
      : '') +
    (st === '未开始'
      ? '<div class="dsc-field-tip">提示：该主体尚未开始填报此数据集，可发送催办。</div>' : ''),
    actions);
}
