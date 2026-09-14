/* ============================================================
   ZY-HY-TB-010 报送任务管理
   任务创建/下发/催办/关闭 + 六状态进度看板（替代线下"资料报送情况"表）
   ============================================================ */

/* 模块内状态 */
const TaskViewState = {
  view: 'list',                       // list | progress
  filters: { name: '', period: '', status: '' },
  reminders: {}                       // 催办记录 { unitId: time }
};
const PROTO_TODAY = '2026-09-14';     // 原型演示"今天"

function daysLeft(deadline) {
  const d = parseDate(deadline.replace(/-/g, '/'));
  const t = parseDate(PROTO_TODAY.replace(/-/g, '/'));
  return Math.round((d - t) / 86400000);
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
  const periodOptions = ['', '2026年上半年', '2026年三季度', '2025年下半年', '2025年上半年'];
  const statusOptions = ['', '草稿', '进行中', '已截止', '已关闭'];

  let rows = TASKS.filter(t => {
    if (TaskViewState.filters.name && t.name.indexOf(TaskViewState.filters.name) < 0) return false;
    if (TaskViewState.filters.period && t.period !== TaskViewState.filters.period) return false;
    if (TaskViewState.filters.status && t.status !== TaskViewState.filters.status) return false;
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
    '    <div class="dsc-filter-bar__item">' +
    '      <button class="dsc-btn dsc-btn--primary" onclick="applyTaskFilter()">查询</button>' +
    '      <button class="dsc-btn dsc-btn--default" onclick="resetTaskFilter()">重置</button>' +
    '    </div>' +
    '  </div>' +
    '</div></div>' +

    '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body dsc-card__body--no-padding">' +
    '  <div class="dsc-table-wrapper"><table class="dsc-table">' +
    '    <thead><tr><th>任务名称</th><th>报送期间</th><th>数据集范围</th><th>填报单位范围</th><th>截止时间</th><th>任务状态</th><th>创建人</th><th>操作</th></tr></thead>' +
    '    <tbody>' + (tableRows || '<tr><td colspan="8"><div class="dsc-empty"><div class="dsc-empty__icon">📭</div><div class="dsc-empty__text">暂无符合条件的任务</div></div></td></tr>') + '</tbody>' +
    '  </table></div>' +
    '</div></div>';
}

function applyTaskFilter() {
  TaskViewState.filters.name = document.getElementById('filterName').value.trim();
  TaskViewState.filters.period = document.getElementById('filterPeriod').value;
  TaskViewState.filters.status = document.getElementById('filterStatus').value;
  renderPage('task-manage');
}
function resetTaskFilter() {
  TaskViewState.filters = { name: '', period: '', status: '' };
  renderPage('task-manage');
}

/* ---------- 新增 / 编辑任务 ---------- */
function openTaskCreateModal(editId) {
  const t = editId ? TASKS.find(x => x.id === editId) : null;
  const checked = t ? t.scope : DATASET_ORDER;
  const body = '' +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">任务名称</label>' +
    '    <input class="dsc-input" id="tcName" value="' + (t ? esc(t.name) : '') + '" placeholder="如：2026年下半年海外供应链数据报送"></div>' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">报送期间</label>' +
    '    <select class="dsc-select" id="tcPeriod">' +
    ['2026年下半年', '2026年上半年', '2026年三季度', '2025年下半年'].map(p => '<option' + (t && t.period === p ? ' selected' : '') + '>' + p + '</option>').join('') +
    '    </select></div>' +
    '</div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">数据集范围（D1~D6 多选）</label>' +
    '  <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);padding-top:4px;">' +
    DATASET_ORDER.map(d => '<label class="dsc-check"><input type="checkbox" class="tcScope" value="' + d + '"' + (checked.indexOf(d) >= 0 ? ' checked' : '') + '><span class="dsc-check__box"></span>' + d + ' ' + esc(DATASETS[d].name) + '</label>').join('') +
    '  </div></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">填报单位范围</label>' +
    '  <select class="dsc-select" id="tcUnitScope">' +
    '    <option value="all"' + (!t || t.unitScope.indexOf('全部') === 0 ? ' selected' : '') + '>全部二级单位（14家）</option>' +
    '    <option value="partial">圈选单位（从组织主数据选择）</option>' +
    '  </select>' +
    '  <div class="dsc-field-tip">组织与用户从 DSC 统一组织主数据同步，支持按任务圈选</div></div>' +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '  <div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">截止时间</label>' +
    '    <input class="dsc-input" id="tcDeadline" type="date" value="' + (t ? t.deadline : '2027-03-25') + '"></div>' +
    '  <div class="dsc-form-group"><label class="dsc-form-label">填报说明附件</label>' +
    '    <input class="dsc-input" type="file" disabled placeholder="演示原型：附件上传已禁用">' +
    '    <div class="dsc-field-tip">支持下发口径说明等附件</div></div>' +
    '</div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label">填报说明</label>' +
    '  <textarea class="dsc-textarea" id="tcDesc" rows="2" placeholder="如：请各单位于截止时间前完成填报并提交审核，逾期将标记并计入报送情况统计。">' + (t ? esc(t.desc) : '') + '</textarea></div>';

  const footer = '' +
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--default" onclick="saveTask(\'草稿\')">保存为草稿</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="saveTask(\'下发\')">核对无误，直接下发</button>';
  openModal(t ? '编辑报送任务（草稿）' : '新增报送任务', body, footer);
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

/* 业务规则：同一期间+同一数据集范围内，同一单位仅允许一个进行中任务（重复创建系统提示） */
function saveTask(action) {
  const name = document.getElementById('tcName').value.trim();
  const period = document.getElementById('tcPeriod').value;
  const scopes = Array.from(document.querySelectorAll('.tcScope:checked')).map(c => c.value);
  const deadline = document.getElementById('tcDeadline').value;
  if (!name) { toast('请填写任务名称', 'warning'); return; }
  if (!scopes.length) { toast('请至少勾选一个数据集', 'warning'); return; }
  if (!deadline) { toast('请选择截止时间', 'warning'); return; }

  /* 重复创建校验（V：任务规则 1） */
  const dup = TASKS.find(t => t.status === '进行中' && t.period === period &&
    scopes.some(s => t.scope.indexOf(s) >= 0));
  if (dup) {
    openModal('重复创建提示',
      '<div class="dsc-alert dsc-alert--danger">同一期间、同一数据集范围内，同一单位仅允许一个进行中任务。</div>' +
      '<div class="dsc-card__body" style="padding:var(--space-md) 0 0;"><div class="dsc-kv__label">已存在进行中任务</div>' +
      '<div style="font-weight:var(--font-weight-medium);">' + esc(dup.name) + '（' + dup.id + '）</div>' +
      '<div class="dsc-field-tip">数据集范围：' + dup.scope.join('、') + ' · 截止 ' + esc(dup.deadline) + '</div></div>',
      '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">返回修改</button>');
    return;
  }

  const year = period.slice(0, 4);
  const id = 'T-' + year + (period.indexOf('三季度') >= 0 ? 'Q' : '') + period.slice(4, 7).replace(/[上下半]/g, '') + Math.floor(Math.random() * 90 + 10);
  const task = {
    id: id, name: name, status: action === '草稿' ? '草稿' : '进行中',
    year: year, period: period, deadline: deadline, scope: scopes,
    unitScope: document.getElementById('tcUnitScope').value === 'all' ? '全部二级单位（14家）' : '圈选单位（演示）',
    createdBy: AppState.role.id === 'sysadmin' ? '系统管理员' : '王建国',
    createdAt: '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0'),
    publishTime: action === '草稿' ? '' : '2026-09-14 09:00',
    desc: document.getElementById('tcDesc').value.trim()
  };
  TASKS.unshift(task);
  if (action === '下发') {
    toast('任务已下发：系统向范围内单位的审核人、填报人推送待办', 'success');
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
  const store = FILL_STORE[t.id] || {};
  const dl = daysLeft(t.deadline);

  /* 页首统计：应报单位数 / 已报单位数 / 逾期单位数 / 齐套率 */
  let reported = 0, complete = 0, overdue = 0, submittedPending = 0;
  UNITS.forEach(u => {
    const unit = store[u.id] || {};
    const statuses = t.scope.map(d => (unit[d] && unit[d].status) || '未开始');
    if (statuses.some(s => s === '已提交' || s === '已退回' || s === '已通过')) reported++;
    if (statuses.every(s => s === '已通过')) complete++;
    if (statuses.some(s => s === '已逾期')) overdue++;
    if (statuses.some(s => s === '已提交')) submittedPending++;
  });
  const rate = ((complete / UNITS.length) * 100).toFixed(1);

  const matrixRows = UNITS.map(u => {
    const unit = store[u.id] || {};
    /* 最近提交时间 */
    let last = '';
    t.scope.forEach(d => {
      const rec = unit[d];
      if (rec && rec.lastSubmit && rec.lastSubmit > last) last = rec.lastSubmit;
    });
    const hasOverdue = t.scope.some(d => unit[d] && unit[d].status === '已逾期');
    const reminded = TaskViewState.reminders[u.id];
    const cells = t.scope.map(d => {
      const rec = unit[d];
      const st = (rec && rec.status) || '未开始';
      return '<td><span class="dsc-matrix__cell ' + STATUS_CELL_CLASS[st] + '" onclick="openUnitDatasetModal(\'' + u.id + '\',\'' + d + '\')" title="' + u.name + ' · ' + d + ' ' + esc(DATASETS[d].name) + '">' + st + '</span></td>';
    }).join('');
    return '<tr>' +
      '<th class="dsc-matrix__unit"><span class="dsc-matrix__unit-name">' + u.name +
      (reminded ? '<div style="font-size:11px;color:var(--color-warning);">已催办 ' + reminded + '</div>' : '') + '</span></th>' +
      cells +
      '<td style="font-size:var(--font-size-sm);font-family:var(--font-family-number);color:var(--color-text-tertiary);">' + (last || '—') + '</td>' +
      '<td style="font-size:var(--font-size-sm);">' +
      (hasOverdue ? '<span class="dsc-text-danger">' + esc((unit[t.scope[0]] && unit[t.scope[0]].reason) || '未报送') + '</span>' : '—') +
      '</td>' +
      '<td class="dsc-table__actions">' +
      (t.status === '进行中'
        ? '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="remindUnit(\'' + u.id + '\')">催办</button>'
        : '<span class="dsc-text-tertiary dsc-font-sm">—</span>') +
      '</td></tr>';
  }).join('');

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title" style="font-size:var(--font-size-lg);">' + esc(t.name) + ' · 报送进度看板</div>' +
    '  <div class="dsc-field-tip">' + esc(t.period) + ' · 截止 ' + esc(t.deadline) +
    (t.status === '进行中' ? '（剩 ' + dl + ' 天，系统将于截止前 3 天、1 天自动催办未提交单位）' : '') +
    ' · 下发时间 ' + esc(t.publishTime || '—') + '</div></div>' +
    '  <div class="dsc-page-header__actions">' +
    '    <button class="dsc-btn dsc-btn--default" onclick="backToTaskList()">← 返回任务列表</button>' +
    (t.status === '进行中' ? '<button class="dsc-btn dsc-btn--default" onclick="remindAllUnreported()">催办全部未报单位</button>' +
      '<button class="dsc-btn dsc-btn--default" onclick="confirmCloseTask(\'' + t.id + '\')">关闭任务</button>' +
      '<button class="dsc-btn dsc-btn--primary" onclick="navigateTo(\'summary\')">发起汇总</button>' : '') +
    '  </div>' +
    '</div>' +

    '<div class="dsc-stat-row">' +
    statCard('应报单位数', UNITS.length, '', '数据集 ' + t.scope.join('、')) +
    statCard('已报单位数', reported, 'dsc-stat-card__value--primary', '至少提交 1 个数据集') +
    statCard('已通过（齐套）', complete, 'dsc-stat-card__value--success', '全部数据集复核通过') +
    statCard('待复核', submittedPending, 'dsc-stat-card__value--warning', '已提交待单位/局级审核') +
    statCard('逾期单位数', overdue, overdue > 0 ? 'dsc-stat-card__value--danger' : '', '超期未提交自动标记') +
    statCard('齐套率', rate + '%', 'dsc-stat-card__value--primary', '齐套目标 ≥95% / 15 个工作日') +
    '</div>' +

    '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
    '  <div class="dsc-card__title" style="margin-bottom:var(--space-md);">各单位 × 数据集填报状态</div>' +
    '  <div class="dsc-matrix-wrapper"><table class="dsc-matrix">' +
    '    <thead><tr><th class="dsc-matrix__unit">二级单位</th>' +
    t.scope.map(d => '<th>' + d + '<br><span style="font-weight:normal;">' + esc(DATASETS[d].name.replace(/（.*）/, '')) + '</span></th>').join('') +
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
    '    <span style="color:var(--color-text-tertiary);">点击状态格查看单位×数据集详情</span>' +
    '  </div>' +
    '</div></div>';
}

/* 催办：向该单位审核人、填报人发送催办站内信/消息 */
function remindUnit(unitId) {
  TaskViewState.reminders[unitId] = '09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  toast('已向 ' + unitName(unitId) + ' 审核人、填报人发送催办消息（站内信 + 待办）', 'success');
  renderPage('task-manage');
}
function remindAllUnreported() {
  const t = getTask();
  const store = FILL_STORE[t.id] || {};
  let count = 0;
  UNITS.forEach(u => {
    const unit = store[u.id] || {};
    const hasUnstart = t.scope.some(d => !unit[d] || unit[d].status === '未开始');
    if (hasUnstart) {
      count++;
      TaskViewState.reminders[u.id] = '09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
    }
  });
  toast(count ? '已向 ' + count + ' 家未报齐单位批量发送催办' : '各单位均已开始填报，无需催办', count ? 'success' : 'warning');
  renderPage('task-manage');
}

/* 单位 × 数据集详情 */
function openUnitDatasetModal(unitId, ds) {
  const t = getTask();
  const rec = getFill(t.id, unitId, ds);
  const st = (rec && rec.status) || '未开始';
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
    actions += '<button class="dsc-btn dsc-btn--primary" onclick="closeModal();gotoReview(\'' + unitId + '\',\'' + ds + '\')">查看填报明细</button>';
  }
  if (t.status === '进行中' && (st === '未开始' || st === '填报中' || st === '已退回')) {
    actions += '<button class="dsc-btn dsc-btn--default" onclick="closeModal();remindUnit(\'' + unitId + '\')">催办该单位</button>';
  }
  openModal(unitName(unitId) + ' · ' + ds + ' ' + esc(DATASETS[ds].name),
    '<div class="dsc-kv" style="margin-bottom:var(--space-md);">' + info.join('') + '</div>' +
    (rec && rec.rejectReason
      ? '<div class="dsc-alert dsc-alert--warning">退回原因（必填，已留痕）：<br>' + esc(rec.rejectReason) + '</div>'
      : '') +
    (st === '未开始'
      ? '<div class="dsc-field-tip">提示：该单位尚未开始填报此数据集，可发送催办。</div>' : ''),
    actions);
}
