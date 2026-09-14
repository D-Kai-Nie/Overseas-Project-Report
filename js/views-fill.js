/* ============================================================
   ZY-HY-TB-020/030 数据填报 + 数据校验与勾稽
   V1.1 双频：周报 W1~W6（每周五，共享中心/区域总部/项目级）
             月报 D1~D6（每月底，二级单位）
   + ZY-HY-TB-070 周月数据衔接：自动带出/来源标注/核对确认/覆盖留痕/一致性校验/缺失兜底
   四级校验：格式(V-F) → 枚举(V-E) → 查重(V-C) → 勾稽与一致性(V-G) + 容错(V-T)
   ============================================================ */

const FillState = {
  freq: '月报',          // 月报 | 周报
  dataset: 'D1',         // 当前页签数据集
  subjectId: 'U01',      // 当前填报主体（月报=二级单位；周报 W1~W5=共享中心/区域总部，W6=二级单位）
  validateResult: null,  // 最近一次校验结果 { errors:[], warnings:[] }
  submitTarget: null
};

const FILL_TASK = 'T-2026M09';      // 月报任务
const FILL_TASK_W = 'T-2026W38';    // 周报任务（当前周）

/* 各数据集可选填列 */
const OPTIONAL_COLS = {
  D4: ['cert1', 'cert2', 'certOther', 'history', 'mainJob'],
  D5: ['email', 'inspector', 'advDesc', 'hq', 'center'],
  D6: ['email', 'inTime', 'hq', 'note'],
  W2: [],
  W3: ['volume', 'coverProj', 'saveAmount', 'progress', 'overdue', 'bidStartTime', 'bidEndTime', 'nextPlan', 'purchaseNo', 'highlight', 'note'],
  W4: ['email', 'mainContent', 'advDesc', 'reporter'],
  W5: ['spec', 'newPrice', 'note'],
  W6: ['laborPurchase', 'riskType', 'riskLevel', 'strategy', 'owner', 'address', 'materialPurchase', 'riskDesc', 'estLoss', 'resolveTime']
};
/* 日期格式校验列（V-F02） */
const DATE_KEYS = {
  D4: ['workStart', 'joinStart', 'dutyStart'], D5: ['inTime'], D6: ['banStart'],
  W3: ['bidStartTime', 'bidEndTime'], W4: ['inTime'], W5: ['transferTime'], W6: ['resolveTime']
};
/* 明细行列表显示列（其余列进入编辑弹窗） */
const ROWS_TABLE_COLS = {
  D4: ['seq', 'dept', 'project', 'name', 'empNo', 'gender', 'age', 'education', 'workStart', 'workYears', 'joinStart', 'joinYears', 'dutyStart', 'dutyYears', 'post', 'fullTime', 'phone'],
  D5: ['seq', 'type', 'name', 'region', 'contact', 'phone', 'category', 'rating', 'countries', 'paymentTerm'],
  D6: ['seq', 'type', 'name', 'region', 'contact', 'category', 'badDesc', 'banStart', 'banMonths', 'banEnd', 'cross'],
  W2: ['seq', 'name', 'unitName', 'position', 'center', 'fullTime'],
  W3: ['seq', 'category', 'level', 'leadUnit', 'owner', 'inPlan', 'unit', 'volume', 'coverProj', 'amount', 'saveAmount', 'bidStartTime', 'bidEndTime', 'stage', 'progress', 'nextPlan', 'purchaseNo', 'highlight', 'overdue', 'firstResource', 'note'],
  W4: ['seq', 'supplyType', 'name', 'region', 'contact', 'phone', 'category', 'rating', 'countries', 'resourceOrigin', 'paymentTerm'],
  W5: ['seq', 'outProject', 'outCountry', 'inProject', 'inCountry', 'inOrg', 'material', 'spec', 'inPrice', 'transferTime'],
  W6: ['seq', 'project', 'country', 'address', 'contractAmount', 'output', 'purchaseTotal', 'materialPurchase', 'laborPurchase', 'reduceRate', 'benefitRate', 'gjLossRate', 'hntLossRate', 'localSupplierRate', 'localPurchaseRate', 'centralRate', 'hasRisk', 'riskType', 'riskLevel', 'riskDesc', 'estLoss', 'strategy', 'resolveTime', 'owner']
};

VIEWS['my-fill'] = {
  render() { return renderFillPage(); },
  init() { bindFormLiveCalc(); }
};

/* ---------- 统一元数据与数据访问 ---------- */
function dsMeta(code) { return DATASETS[code] || W_DATASETS[code]; }
function subjectName(id) { return SC_MAP[id] || UNIT_MAP[id] || id; }
function currentTask() { return getTask(FillState.freq === '周报' ? FILL_TASK_W : FILL_TASK); }

function getWeekly(subjectId, code) {
  const store = WEEKLY_STORE[FILL_TASK_W];
  if (!store || !store[subjectId]) return null;
  return store[subjectId][code] || null;
}
/* 当前填报记录（按频率/主体/数据集） */
function currentFillRec() {
  if (FillState.freq === '周报') return getWeekly(FillState.subjectId, FillState.dataset);
  return getFill(FILL_TASK, FillState.subjectId, FillState.dataset);
}
/* 月报某主体当月是否有已提交周报（A13 缺失兜底） */
function isWeeklyMissing() {
  return FillState.freq === '月报' && WEEKLY_MISSING_UNITS.indexOf(FillState.subjectId) >= 0;
}
/* 月报带出值查询 */
function fetchedInfo(ds, key) {
  const rec = currentFillRec();
  if (rec && rec.overrides && rec.overrides[key]) {
    const o = rec.overrides[key];
    return { value: o.value, overridden: true, reason: o.reason, by: o.by, time: o.time };
  }
  const src = MONTHLY_FETCHED[FillState.subjectId];
  if (src && src[ds] && src[ds][key]) {
    const f = MONTHLY_FETCHED[FillState.subjectId][ds][key];
    return { value: f.value, source: f.source };
  }
  return { value: (rec && rec.values ? rec.values[key] : ''), manual: isWeeklyMissing() };
}

/* ============================================================
   页面骨架：任务带 + 频率切换 + 主体 + 数据集页签 + 内容区
   ============================================================ */
function renderFillPage() {
  const t = currentTask();
  const dl = daysLeft(t.deadline);
  const order = FillState.freq === '周报' ? W_DATASET_ORDER : DATASET_ORDER;
  const all = order.map(d => currentFillRec0(d));
  const passedCount = all.filter(r => r && r.status === '已通过').length;

  const tabs = order.map(d => {
    const rec = currentFillRec0(d);
    const st = rec && rec.status && rec.status !== '-' ? rec.status : (rec && rec.status === '-' ? '—' : '未开始');
    const meta = dsMeta(d);
    return '<div class="dsc-dtab' + (FillState.dataset === d ? ' dsc-dtab--active' : '') + '" onclick="switchFillTab(\'' + d + '\')">' +
      '<span class="dsc-dtab__code">' + d + '</span><span>' + esc(meta.name.replace(/（.*）/, '')) + '</span>' +
      (rec && rec.status === '-' ? '<span class="dsc-tag dsc-tag--default">不适用</span>' : statusTag(st)) + '</div>';
  }).join('');

  /* 频率切换（原型演示：真实系统按系统功能项授权对应的频率功能） */
  const freqSwitch = '<div class="dsc-seg" style="margin-left:auto;">' +
    ['月报', '周报'].map(f =>
      '<div class="dsc-seg__item' + (FillState.freq === f ? ' dsc-seg__item--active' : '') + '" onclick="switchFillFreq(\'' + f + '\')">' +
      f + '（' + (f === '月报' ? '每月底' : '每周五') + '）</div>').join('') + '</div>';

  /* 填报主体选择（演示用；真实系统为登录用户所属主体） */
  const subjects = subjectOptions();
  const subjectSel = '<div class="dsc-flex dsc-flex--center dsc-gap-sm">' +
    '<span class="dsc-font-sm dsc-text-secondary">填报主体</span>' +
    '<select class="dsc-select" style="width:180px;" onchange="switchFillSubject(this.value)">' +
    subjects.map(s => '<option value="' + s.id + '"' + (FillState.subjectId === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') +
    '</select><span class="dsc-role__badge" style="border-color:var(--color-border);color:var(--color-text-tertiary);">演示</span></div>';

  return '' +
    '<div class="dsc-card"><div class="dsc-card__body">' +
    '  <div class="dsc-flex dsc-flex--between dsc-flex--center dsc-gap-lg" style="flex-wrap:wrap;">' +
    '    <div>' +
    '      <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);">' + esc(t.name) + '</div>' +
    '      <div class="dsc-field-tip">' + esc(t.period) + ' · ' + esc(t.unitScope) + ' · 当前主体：' + esc(subjectName(FillState.subjectId)) +
    '       · 本期齐套进度 ' + passedCount + '/' + order.length + '</div>' +
    '    </div>' +
    '    <div style="text-align:right;">' +
    '      <div style="font-weight:var(--font-weight-medium);">截止时间 ' + esc(t.deadline) + '</div>' +
    '      <div class="' + (dl <= 1 ? 'dsc-text-danger' : 'dsc-text-tertiary') + '" style="font-size:var(--font-size-sm);">' +
    (dl >= 0 ? '剩 ' + dl + ' 天（截止前 1 天系统自动催办）' : '已逾期 ' + (-dl) + ' 天') + '</div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="dsc-flex dsc-flex--between dsc-flex--center dsc-mt-md" style="flex-wrap:wrap;">' + freqSwitch + subjectSel + '</div>' +
    '</div></div>' +

    '<div class="dsc-dtabs dsc-mt-md">' + tabs + '</div>' +
    renderDatasetContent();
}
/* 按数据集取记录（不切换当前页签） */
function currentFillRec0(d) {
  if (FillState.freq === '周报') return getWeekly(FillState.subjectId, d);
  return getFill(FILL_TASK, FillState.subjectId, d);
}
function subjectOptions() {
  if (FillState.freq === '周报' && FillState.dataset !== 'W6') return SHARED_CENTERS;
  return UNITS;
}

function switchFillFreq(freq) {
  FillState.freq = freq;
  FillState.dataset = freq === '周报' ? 'W1' : 'D1';
  FillState.subjectId = freq === '周报' ? 'SC1' : 'U01';
  FillState.validateResult = null;
  renderPage('my-fill');
}
function switchFillSubject(id) {
  FillState.subjectId = id;
  FillState.validateResult = null;
  renderPage('my-fill');
}
function switchFillTab(ds) {
  FillState.dataset = ds;
  FillState.validateResult = null;
  /* W6 由二级单位（项目）填报，主体随之切换 */
  if (FillState.freq === '周报') {
    if (ds === 'W6' && FillState.subjectId.indexOf('SC') === 0) FillState.subjectId = 'U01';
    if (ds !== 'W6' && FillState.subjectId.indexOf('SC') !== 0) FillState.subjectId = 'SC1';
  }
  renderPage('my-fill');
}

/* ============================================================
   数据集内容区
   ============================================================ */
function renderDatasetContent() {
  const ds = FillState.dataset;
  const meta = dsMeta(ds);
  const rec = currentFillRec();
  const st = rec && rec.status && rec.status !== '-' ? rec.status : (rec && rec.status === '-' ? '-' : '未开始');
  const locked = (st === '已提交' || st === '已通过');

  if (st === '-') {
    return '<div class="dsc-card"><div class="dsc-card__body"><div class="dsc-empty">' +
      '<div class="dsc-empty__icon">ℹ️</div>' +
      '<div class="dsc-empty__text">' + esc(meta.name) + '：由' + esc(meta.subject || '对应主体') + '填报，当前主体不适用</div>' +
      '<div class="dsc-field-tip dsc-mt-sm">切换上方「填报主体」或页签查看其他数据集</div></div></div></div>';
  }

  const showBanner = {
    '已提交': '<div class="dsc-alert dsc-alert--info">已提交，等待审核（数据已锁定，仅可撤回到草稿）。</div>',
    '已通过': '<div class="dsc-alert dsc-alert--success">已通过复核，数据锁定并纳入汇总。历史期数据如需更正，由报送管理员发起数据更正流程并留痕。</div>',
    '已退回': '<div class="dsc-alert dsc-alert--danger">已退回：' + esc(rec.rejectReason) + '<br><span style="font-size:var(--font-size-sm);">退回人：' + esc(rec.rejectedBy) + ' · ' + esc(rec.rejectedTime) + '。请修改后重新提交，全程留痕。</span></div>'
  }[st] || '';

  /* A13 缺失兜底提示 */
  const missingBanner = (FillState.freq === '月报' && !locked && isWeeklyMissing())
    ? '<div class="dsc-alert dsc-alert--warning">未取到本期周报数据（2026年9月第3周）：' + esc(subjectName(FillState.subjectId)) +
      ' 当月无已提交周报，本数据集转为<b>全部手工填报</b>，不阻断本月报送；汇总报表将标注该单位数据来源（A13 缺失兜底）。</div>' : '';

  /* 周月衔接提示（有带出数据时） */
  const fetchBanner = (FillState.freq === '月报' && !locked && !isWeeklyMissing() && hasFetched(ds))
    ? '<div class="dsc-alert dsc-alert--info">本数据集含<b>自动取自周报</b>的字段（置灰显示、标注来源期次）：' + fetchSummaryText(ds) +
      '。请核对确认；修改须填写原因并留痕（A11/A12）。</div>' : '';

  /* W6 校验基准说明；月报 D1/D2/D3 与周报基准的对应关系（V1.1 7.1 / 7.3） */
  let baselineBanner = '';
  const base = w6Baseline(FillState.subjectId);
  if (ds === 'W6') {
    baselineBanner = '<div class="dsc-alert dsc-alert--info">W6 为项目级风险全景表：项目行率类由系统计算，<b>按二级单位汇总后作为月报 D1/D2/D3 的一致性校验基准</b>（金额类月报<周报汇总阻断提交；率类偏差>±5% 仅提示核对，PRD 7.3）。</div>';
  } else if (FillState.freq === '月报' && (ds === 'D1' || ds === 'D2' || ds === 'D3') && !locked && !isWeeklyMissing()) {
    const scope = ds === 'D1' ? '采购金额类（物资设备 / 劳务与专业分包）、综合采购成本降低率与综合采购效益率'
      : (ds === 'D2' ? '钢筋 / 混凝土损耗率基数（图纸量须与 D3 保持同口径）' : '钢筋 / 混凝土损耗率（率类互校，仅提示核对）');
    baselineBanner = '<div class="dsc-alert dsc-alert--info">一致性校验基准：' + scope +
      '将与 <b>W6 项目风险全景表按单位汇总值</b>比对（' + esc((base || {}).note || '当月无周报基准，转手工填报（A13）') + '）。</div>';
  }

  /* 勾稽尾差放行状态（V-G02，业务规则 4/20） */
  const waiver = rec && rec.varianceWaiver;
  const waiverBanner = !waiver ? '' :
    '<div class="dsc-alert dsc-alert--warning">勾稽尾差放行（规则 ' + esc((waiver.rules || []).join('、')) + '）：' + esc(waiver.reason) +
    '<br><span style="font-size:var(--font-size-sm);">申请人 ' + esc(waiver.by) + ' · ' + esc(waiver.time) + ' · 状态：' +
    (waiver.confirmed ? '已由 ' + esc(waiver.confirmedBy || '复核人') + ' 书面确认放行' : '待局级复核书面确认（复核确认后归档）') + '</span>' +
    ((!locked && !waiver.confirmed) ? ' <button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="revokeTailWaiver()">撤回申请</button>' : '') + '</div>';

  const zero = rec && rec.zero;
  const zeroBox = locked ? '' :
    '<label class="dsc-check" style="margin-left:auto;"><input type="checkbox" id="zeroReportChk"' + (zero ? ' checked' : '') + ' onchange="toggleZeroReport(this)">' +
    '<span class="dsc-check__box"></span>本期无数据（零报告提交，计入齐套统计）</label>';

  /* 校验结果面板 */
  let validatePanel = '';
  if (FillState.validateResult && (FillState.validateResult.errors.length || FillState.validateResult.warnings.length)) {
    const errs = FillState.validateResult.errors.map(e =>
      '<li class="dsc-validate-item">' +
      '<span class="dsc-validate-item__rule">' + esc(e.rule) + '</span>' +
      '<div><span class="dsc-validate-item__loc">' + esc(e.loc) + '</span> ' + esc(e.msg) + '</div>' +
      (e.fixFn ? '<button class="dsc-btn dsc-btn--sm dsc-btn--primary dsc-validate-item__fix" onclick="' + e.fixFn + '">' + (e.fixLabel || '定位修改') + '</button>' : '') +
      '</li>').join('');
    const warns = FillState.validateResult.warnings.map(w =>
      '<li class="dsc-validate-item dsc-validate-item--warn">' +
      '<span class="dsc-validate-item__rule dsc-validate-item__rule--warn">' + esc(w.rule) + '</span>' +
      '<div><span class="dsc-validate-item__loc">' + esc(w.loc) + '</span> ' + esc(w.msg) + '</div>' +
      (w.fixFn ? '<button class="dsc-btn dsc-btn--sm dsc-btn--default dsc-validate-item__fix" onclick="' + w.fixFn + '">' + (w.fixLabel || '去核对') + '</button>' : '') +
      '</li>').join('');
    validatePanel =
      (errs ? '<div class="dsc-validate-panel">' +
        '<div class="dsc-validate-panel__head"><span class="dsc-tag dsc-tag--danger">校验未通过</span>' +
        '共 ' + FillState.validateResult.errors.length + ' 项失败，已阻断提交（格式→枚举→查重→勾稽/一致性）</div>' +
        '<ul class="dsc-validate-list">' + errs + '</ul></div>' : '') +
      (warns ? '<div class="dsc-validate-panel dsc-validate-panel--warn">' +
        '<div class="dsc-validate-panel__head"><span class="dsc-tag dsc-tag--warning">提示核对</span>' +
        '共 ' + FillState.validateResult.warnings.length + ' 项偏差提示（不阻断提交）</div>' +
        '<ul class="dsc-validate-list">' + warns + '</ul></div>' : '');
  }

  const body = zero
    ? '<div class="dsc-zero-report"><div class="dsc-empty__icon" style="font-size:32px;">∅</div>' +
      '<div><div style="font-weight:var(--font-weight-medium);">本期无数据</div>' +
      '<div class="dsc-field-tip">该数据集本期无业务，将以零报告形式提交并计入齐套统计（验收标准 A9）。直接点击「提交」完成零报告。</div></div></div>'
    : (meta.mode === 'form' ? renderFormDataset(ds, locked) : renderRowsDataset(ds, locked));

  return validatePanel + missingBanner + fetchBanner + baselineBanner + waiverBanner + showBanner +
    '<div class="dsc-row-toolbar">' +
    (locked
      ? '<span class="dsc-tag dsc-tag--default">只读</span>' +
        '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="exportDetail()">导出明细</button>' +
        '<span class="dsc-row-toolbar__count">状态：' + st + ' · 数据集 ' + ds + ' ' + esc(meta.name) + '</span>'
      : '<button class="dsc-btn dsc-btn--default" onclick="saveDraft()">保存草稿</button>' +
        '<button class="dsc-btn dsc-btn--primary" onclick="submitFill()">提交</button>' +
        '<button class="dsc-btn dsc-btn--default" onclick="downloadTemplate()">下载模板</button>' +
        (meta.mode === 'rows' ? '<button class="dsc-btn dsc-btn--default" onclick="openImportModal()">批量导入</button>' : '') +
        '<button class="dsc-btn dsc-btn--default" onclick="exportDetail()">导出明细</button>' +
        '<span class="dsc-row-toolbar__count">' + esc(meta.desc) + '</span>') +
    zeroBox +
    '</div>' + body;
}

/* 该数据集是否含带出字段 */
function hasFetched(ds) {
  const map = FETCH_SOURCES.map[ds];
  return !!(map && Object.keys(map).length);
}
function fetchSummaryText(ds) {
  const map = FETCH_SOURCES.map[ds] || {};
  const froms = {};
  Object.keys(map).forEach(k => { froms[map[k].from] = true; });
  return Object.keys(froms).map(f => f + ' ' + dsMeta(f).name).join('、') + '（' + FETCH_SOURCES.weekLabel + '）';
}

/* ---------- 零报告 ---------- */
function toggleZeroReport(el) {
  const rec = currentFillRec();
  if (el.checked && rec.rows && rec.rows.length) {
    openModal('零报告确认',
      '<div class="dsc-alert dsc-alert--warning">当前数据集已有 ' + rec.rows.length + ' 条明细行，勾选「本期无数据」后提交，这些明细将不随本次提交入库。确认继续？</div>',
      '<button class="dsc-btn dsc-btn--default" onclick="document.getElementById(\'zeroReportChk\').checked=false;closeModal()">取消</button>' +
      '<button class="dsc-btn dsc-btn--primary" onclick="closeModal()">确认零报告</button>');
  }
  rec.zero = el.checked;
  if (rec.status === '未开始' || !rec.status) { rec.status = '填报中'; }
  renderPage('my-fill');
}

/* ---------- 模板 / 导出 ---------- */
function downloadTemplate() {
  toast('已下载「' + FillState.dataset + ' ' + dsMeta(FillState.dataset).name + '」导入模板（由指标字典自动生成，与线上口径强一致）', 'success');
}
function exportDetail() {
  toast('已导出填报明细 Excel（表样兼容现行周报/月报，导出含敏感字段留痕）', 'success');
}
function saveDraft() {
  const rec = currentFillRec();
  if (rec.status === '未开始' || !rec.status) rec.status = '填报中';
  toast('草稿已暂存，可随时继续填报', 'success');
}

/* ============================================================
   周月衔接：覆盖带出值（A12）
   ============================================================ */
/* 覆盖权限（A12：有权限 + 填写原因才可改，无权限不可改；含组织/角色隔离）
   填报人（本单位）与局报送管理员可覆盖；审核人/复核人/查看者/系统管理员无权修改填报数据。 */
const OVERRIDE_ROLES = ['filler', 'admin'];
function canOverrideFetched() { return OVERRIDE_ROLES.indexOf(AppState.role.id) >= 0; }
function nowStamp() {
  return '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
}
/* 无权限尝试亦须留痕（写入审计轨迹） */
function denyOverride(action) {
  const rec = currentFillRec();
  if (rec) {
    rec.deniedOverrides = rec.deniedOverrides || [];
    rec.deniedOverrides.push({ action: action, by: AppState.role.name, role: AppState.role.id, time: nowStamp() });
  }
  toast('权限校验未通过：当前视角「' + AppState.role.name + '」无覆盖自动带出值的权限。A12 规定：覆盖仅开放给填报人（本单位）与局报送管理员，且必须填写原因留痕', 'danger');
}

function openOverrideModal(ds, fieldKey, label) {
  if (!canOverrideFetched()) { denyOverride('覆盖自动带出值 · ' + ds + ' ' + label); return; }
  const info = fetchedInfo(ds, fieldKey);
  openModal('修改自动带出值（覆盖留痕）',
    '<div class="dsc-alert dsc-alert--warning">该字段为<b>自动取自周报</b>（' + esc(((FETCH_SOURCES.map[ds] || {})[fieldKey] || {}).desc || (FETCH_SOURCES.map[ds][fieldKey] || {}).from || '') + '），修改须具备权限并填写原因，全程留痕（A12）。</div>' +
    '<div class="dsc-kv dsc-mt-md" style="grid-template-columns:repeat(2,1fr);">' +
    '<div class="dsc-kv__item"><div class="dsc-kv__label">字段</div><div class="dsc-kv__value">' + esc(label) + '</div></div>' +
    '<div class="dsc-kv__item"><div class="dsc-kv__label">带出值（来源：' + esc(info.source || FETCH_SOURCES.weekLabel) + '）</div><div class="dsc-kv__value">' + fmtMoney(info.value) + '</div></div>' +
    '</div>' +
    '<div class="dsc-form-row dsc-form-row--2 dsc-mt-md">' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">覆盖后数值</label>' +
    '<input class="dsc-input" id="ovValue" value="' + esc(info.value) + '"></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">修改原因</label>' +
    '<input class="dsc-input" id="ovReason" placeholder="如：周报集采金额口径与月报月度归属差异"></div>' +
    '</div>' +
    '<div class="dsc-field-tip">覆盖记录 100% 可查：操作人、时间、原值、原因（A12）；可覆盖指标清单待业务确认（Q7）。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doOverride(\'' + ds + '\',\'' + fieldKey + '\')">确认覆盖并留痕</button>');
}
function doOverride(ds, fieldKey) {
  /* 提交前二次权限校验（A12：无权限不可改） */
  if (!canOverrideFetched()) { closeModal(); denyOverride('覆盖自动带出值 · ' + ds + ' ' + fieldKey); return; }
  const val = document.getElementById('ovValue').value.trim();
  const reason = document.getElementById('ovReason').value.trim();
  if (!reason) { toast('修改原因必填（覆盖留痕要求）', 'warning'); return; }
  const rec = currentFillRec();
  rec.overrides = rec.overrides || {};
  rec.overrides[fieldKey] = {
    value: Number(val) || val, reason: reason,
    by: (AppState.role.id === 'filler' ? '张伟（海外公司·填报人）' : AppState.role.name),
    time: '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0')
  };
  closeModal();
  toast('已覆盖自动带出值并留痕：操作人、时间、原值、原因已记录（A12）', 'success');
  renderPage('my-fill');
}

/* ============================================================
   表单模式（D1~D3 / W1）：计算字段置灰 + 带出字段 + 实时计算
   ============================================================ */
const FORM_SECTION_DEFS = { D1: D1_SECTIONS, D2: D2_SECTIONS, D3: D3_SECTIONS, W1: W1_SECTIONS };
/* 惰性引用 app.js 计算引擎（避免加载顺序依赖） */
const FORM_CALCS = {
  D1: v => calcD1(v), D2: v => calcD2(v), D3: v => calcD3(v),
  W1: v => ({ saveRate: pctDisp(v.saveAmount, v.jcAmountSum) })
};

function renderFormDataset(ds, locked) {
  const rec = currentFillRec();
  const values = rec.values || {};
  const calc = FORM_CALCS[ds](values);

  const sections = FORM_SECTION_DEFS[ds].map(sec => {
    const fields = sec.fields.map(f => {
      if (f.type === 'fetched') {
        const info = fetchedInfo(ds, f.key);
        return renderFetchedField(f, info, ds, locked);
      }
      if (f.type === 'calc') return renderSectionField(f, undefined, calc[f.key], null, locked);
      if (f.type === 'text') {
        return '<div class="dsc-form-group"><label class="dsc-form-label' + (f.required ? ' dsc-form-label--required' : '') + '">' + esc(f.label) + '</label>' +
          '<textarea class="dsc-textarea" data-fill-field="' + f.key + '" rows="2"' + (locked ? ' disabled' : '') + '>' + esc(values[f.key] || '') + '</textarea>' +
          (f.tip ? '<div class="dsc-field-tip">' + esc(f.tip) + '</div>' : '') + '</div>';
      }
      return renderSectionField(f, values[f.key], undefined, null, locked);
    }).join('');
    return '<div class="dsc-form-section' + (sec.calcOnly ? ' dsc-form-section--calc' : '') + '">' +
      '<div class="dsc-form-section__head"><span>' + esc(sec.title) + '</span>' +
      (sec.calcOnly ? '<span class="dsc-form-section__tag">合计与率类全部系统计算，不开放录入</span>' : '') + '</div>' +
      '<div class="dsc-form-section__body">' + fields + '</div></div>';
  }).join('');

  const reporter = FillState.freq === '周报'
    ? (FillState.subjectId === 'SC1' ? '刘志强 · 13910001111' : '林伟 · 13920002222')
    : '张伟 · 13800138001';

  return sections +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">填报人及联系方式</label>' +
    '<input class="dsc-input" value="' + esc(reporter) + '" ' + (locked ? 'disabled' : '') + '></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label">备注</label>' +
    '<input class="dsc-input" placeholder="口径特殊说明" ' + (locked ? 'disabled' : '') + '></div></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">金额单位：元，保留 2 位小数；数量保留 3 位小数；率类字段系统计算，分母为 0 时显示"/"（V-T01 容错）。</div>';
}

/* 自动取自周报的字段（置灰 + 来源标注 + 覆盖入口，A11/A12/A14） */
function renderFetchedField(f, info, ds, locked) {
  const fromMeta = FETCH_SOURCES.map[ds][f.key] || {};
  const isManual = info.manual;
  if (isManual) {
    return '<div class="dsc-form-group"><label class="dsc-form-label' + (f.required ? ' dsc-form-label--required' : '') + '">' + esc(f.label) +
      '<span class="dsc-form-section__tag" style="margin-left:6px;">未取到周报·手工填报</span></label>' +
      '<input class="dsc-input" data-fill-field="' + f.key + '" value="' + esc(info.value === undefined ? '' : info.value) + '"' + (locked ? ' disabled' : '') + '>' +
      '<div class="dsc-field-tip">' + esc(f.tip || '') + '</div></div>';
  }
  return '<div class="dsc-form-group dsc-calc-field dsc-fetched">' +
    '<label class="dsc-form-label">' + esc(f.label) +
    '<span class="dsc-badge-fetched">自动取自周报 ' + esc(fromMeta.from || f.from || '') + '</span>' +
    (info.overridden ? '<span class="dsc-badge-fetched dsc-badge-fetched--overridden">已覆盖</span>' : '') + '</label>' +
    '<input class="dsc-input dsc-calc-input" data-calc-field="' + f.key + '" value="' + esc(info.value === undefined || info.value === '' ? '/' : fmtMoney(info.value)) + '" readonly tabindex="-1">' +
    '<div class="dsc-calc-field__formula">来源：' + esc(info.source || FETCH_SOURCES.weekLabel) +
    (info.overridden ? ' · 覆盖人 ' + esc(info.by) + ' · 原因：' + esc(info.reason) : '') + '</div>' +
    (!locked ? '<div class="dsc-mt-sm">' + (canOverrideFetched()
      ? '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="openOverrideModal(\'' + ds + '\',\'' + f.key + '\',\'' + esc(f.label) + '\')">修改（覆盖留痕）</button>'
      : '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="denyOverride(\'覆盖自动带出值 · ' + ds + ' ' + esc(f.label) + '\')">修改（无权限）</button>') + '</div>' : '') +
    '</div>';
}

/* 实时计算绑定 */
function bindFormLiveCalc() {
  const ds = FillState.dataset;
  if (dsMeta(ds).mode !== 'form') return;
  const rec = currentFillRec();
  if (!rec) return;
  if (rec.status === '已提交' || rec.status === '已通过') return; // 只读不绑定
  document.querySelectorAll('[data-fill-field]').forEach(input => {
    input.addEventListener('input', () => {
      const values = collectFormValues();
      const calc = FORM_CALCS[ds](values);
      Object.keys(calc).forEach(k => {
        const el = document.querySelector('[data-calc-field="' + k + '"]');
        if (el && !el.closest('.dsc-fetched')) el.value = calc[k];
      });
    });
  });
}

function collectFormValues() {
  const values = {};
  document.querySelectorAll('[data-fill-field]').forEach(el => {
    const raw = el.value;
    const num = Number(raw);
    values[el.dataset.fillField] = (raw === '' || isNaN(num)) ? (raw === '' ? NaN : raw) : num;
  });
  return values;
}

/* ============================================================
   明细行模式（D4~D6 / W2~W6）
   ============================================================ */
const ROWS_COLUMNS = {
  D4: D4_COLUMNS, D5: D5_COLUMNS, D6: D6_COLUMNS,
  W2: W2_COLUMNS, W3: W3_COLUMNS, W4: W4_COLUMNS, W5: W5_COLUMNS, W6: W6_COLUMNS
};

function renderRowsDataset(ds, locked) {
  const rec = currentFillRec();
  const rows = rec.rows || [];
  const cols = ROWS_COLUMNS[ds];
  const showCols = ROWS_TABLE_COLS[ds];
  const isMonthly = FillState.freq === '月报';

  /* 查重提示（V-C03：录入即黄色提示阻断；跨单位重复为提示不阻断） */
  const dupMap = {};
  rows.forEach(r => {
    if (ds === 'D5' || ds === 'D6') {
      const key = (r.name || '') + '|' + (r.region || '');
      (dupMap[key] = dupMap[key] || []).push(r);
    }
  });
  if (ds === 'D4') {
    rows.forEach(r => {
      const key = (r.empNo && r.empNo !== '/') ? 'no|' + r.empNo : 'nm|' + r.name + '|' + r.dept + '|' + r.project;
      (dupMap[key] = dupMap[key] || []).push(r);
    });
  }
  const dupIds = {};
  Object.keys(dupMap).forEach(k => {
    if (dupMap[k].length > 1) dupMap[k].forEach(r => { dupIds[r.id] = true; });
  });

  /* 跨单位重复（D5）：提示不阻断 */
  let crossUnitTips = '';
  if (ds === 'D5' && isMonthly) {
    const tips = [];
    const seen = {};
    UNITS.forEach(u => {
      if (u.id === FillState.subjectId) return;
      const other = getFill(FILL_TASK, u.id, 'D5');
      if (!other || !other.rows || (other.status !== '已提交' && other.status !== '已通过')) return;
      other.rows.forEach(or => {
        if (seen[or.name + or.region]) return;
        if (rows.some(r => r.name === or.name && r.region === or.region)) {
          seen[or.name + or.region] = true;
          tips.push('「' + esc(or.name) + '（' + esc(or.region) + '）」本期已被 ' + u.name + ' 录入，提交后进入全局去重，保留各单关联');
        }
      });
    });
    if (tips.length) {
      crossUnitTips = '<div class="dsc-dup-tip">跨单位重复提示（不阻断提交）：' + tips.join('；') + '</div>';
    }
  }

  /* D6 关联警示（与 D5 合格库交叉） */
  const d5Names = {};
  if (ds === 'D6') {
    rows.forEach(r => {
      const own = getFill(FILL_TASK, FillState.subjectId, 'D5');
      if ((own && own.rows || []).some(x => x.name === r.name && x.region === r.region)) d5Names[r.id] = true;
    });
  }

  /* 带出字段提示条（A14：无手工录入入口） */
  let fetchedTip = '';
  const fetchedCols = cols.filter(c => c.fetched);
  if (fetchedCols.length) {
    const froms = {};
    fetchedCols.forEach(c => { froms[c.fetched] = (froms[c.fetched] || 0) + 1; });
    fetchedTip = '<div class="dsc-dup-tip" style="background:var(--color-primary-bg);border-color:#91D5FF;color:var(--color-primary);">' +
      '本数据集 ' + fetchedCols.length + ' 项字段自动取自周报（' + Object.keys(froms).map(f => f + ' ' + dsMeta(f).name).join('、') + '，' + FETCH_SOURCES.weekLabel + '）：' +
      '置灰显示、无手工录入入口，修改须走覆盖留痕（A14）。' +
      (FETCH_SOURCES.manual[ds] ? ' 另行补填 ' + FETCH_SOURCES.manual[ds].length + ' 项：' + FETCH_SOURCES.manual[ds].map(k => (cols.find(c => c.key === k) || {}).label).join('、') + '。' : '') +
      (isWeeklyMissing() ? ' <b>本期未取到周报数据，已转手工填报。</b>' : '') + '</div>';
  }

  const thead = '<tr>' + showCols.map(k => {
    const c = cols.find(x => x.key === k);
    const w = c.width ? ' style="min-width:' + c.width + '"' : (k === 'seq' ? ' style="min-width:48px"' : '');
    return '<th' + w + '>' + esc(c.label) +
      (c.calc ? ' <span style="color:var(--color-primary);font-size:11px;">计算</span>' : '') +
      (c.fetched ? ' <span class="dsc-badge-fetched dsc-badge-fetched--sm">周报</span>' : '') + '</th>';
  }).join('') + '<th style="min-width:120px;">操作</th></tr>';

  const tbody = rows.map((r, i) => {
    const isDup = dupIds[r.id];
    const tds = showCols.map(k => {
      const c = cols.find(x => x.key === k);
      let v = '';
      if (k === 'seq') v = i + 1;
      else if (c.calc && ds === 'D4') v = workYears(r[c.key === 'workYears' ? 'workStart' : c.key === 'joinYears' ? 'joinStart' : 'dutyStart'], currentTask().deadline);
      else if (c.calc && ds === 'D6' && k === 'banEnd') v = r.banStart && r.banMonths ? fmtDate(banEndDate(r.banStart, r.banMonths)) : '/';
      else if (c.calc) v = (r[k] === undefined || r[k] === '') ? '/' : esc(String(r[k]));
      else if (k === 'countries') v = (r[k] || []).join('、');
      else if (k === 'contractAmount' || k === 'output' || k === 'purchaseTotal' || k === 'materialPurchase' || k === 'laborPurchase' || k === 'estLoss' || k === 'newPrice' || k === 'inPrice' || k === 'amount' || k === 'saveAmount') v = fmtMoney(r[k]);
      else v = r[k] === undefined || r[k] === null || r[k] === '' ? '/' : (c.check ? (r[k] ? '√' : '—') : esc(String(r[k])));
      const dupStyle = isDup && (k === 'name' || k === 'region' || k === 'empNo') ? ' style="background:var(--color-warning-bg);"' : '';
      return '<td' + dupStyle + ' class="' + (c.calc ? 'dsc-text-secondary' : '') + '">' + v + '</td>';
    }).join('');
    const crossCell = ds === 'D6' && d5Names[r.id]
      ? '<tr><td colspan="' + (showCols.length + 1) + '" style="padding:0;"><div class="dsc-dup-tip" style="margin:0 0 6px;">⚠ 关联警示（V-C03 交叉）：该供应商同时存在于 D5 合格库有效记录中，同一供应商不得同时存在于合格库与不合格库，提交将被阻断。</div></td></tr>'
      : '';
    return '<tr data-row="' + r.id + '">' + tds +
      '<td class="dsc-table__actions">' +
      (locked ? '<span class="dsc-text-tertiary dsc-font-sm">已锁定</span>' :
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="openRowEditor(\'' + r.id + '\')">编辑</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="copyRow(\'' + r.id + '\')">复制</button>' +
        '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="deleteRow(\'' + r.id + '\')">删除</button>') +
      '</td></tr>' + crossCell;
  }).join('');

  return crossUnitTips + fetchedTip +
    '<div class="dsc-row-toolbar">' +
    (locked ? '' :
      '<button class="dsc-btn dsc-btn--primary dsc-btn--sm" onclick="openRowEditor(null)">+ 新增行</button>' +
      '<span class="dsc-row-toolbar__count">共 ' + rows.length + ' 条明细（草稿与已退回状态可增删改；' +
      (fetchedCols.length ? '带出字段不可直接修改' : '支持复制行用于同类多记录录入') + '）</span>') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead>' + thead + '</thead><tbody>' + (tbody || '<tr><td colspan="' + (showCols.length + 1) + '"><div class="dsc-empty"><div class="dsc-empty__icon">📋</div><div class="dsc-empty__text">暂无明细，点击「新增行」或「批量导入」开始填报</div></div></td></tr>') + '</tbody></table></div>';
}

/* ---------- 行编辑弹窗 ---------- */
function openRowEditor(rowId) {
  const ds = FillState.dataset;
  const rec = currentFillRec();
  const cols = ROWS_COLUMNS[ds];
  const row = rowId ? rec.rows.find(r => r.id === rowId) : {};
  if (!rowId) row.id = 'R' + Date.now() % 100000;
  const weeklyMissing = isWeeklyMissing();

  const fieldHTML = cols.filter(c => c.edit || c.check).map(c => {
    if (c.check) {
      return '<div class="dsc-form-group"><label class="dsc-check"><input type="checkbox" id="ef_' + c.key + '"' + (row[c.key] ? ' checked' : '') + '><span class="dsc-check__box"></span>' + esc(c.label) + '</label></div>';
    }
    /* 自动取自周报的字段：无手工录入入口（A14），仅展示 + 覆盖说明 */
    if (c.fetched && !weeklyMissing) {
      const badge = '<span class="dsc-badge-fetched dsc-badge-fetched--sm">自动取自 ' + esc(c.fetched) + '</span>';
      const val = (c.multi) ? (row[c.key] || []).join('、') : (row[c.key] === undefined || row[c.key] === '' ? '/' : row[c.key]);
      return '<div class="dsc-form-group dsc-fetched"><label class="dsc-form-label">' + esc(c.label) + badge + '</label>' +
        '<input class="dsc-input dsc-calc-input" value="' + esc(val) + '" readonly tabindex="-1">' +
        '<div class="dsc-field-tip">来源：' + esc(FETCH_SOURCES.weekLabel) + ' W' + esc(c.fetched.replace('W', '')) + '；如需修改请走「覆盖留痕」（导出留档）</div></div>';
    }
    if (c.enum) {
      const opts = Array.isArray(c.enum) ? c.enum : ENUMS[c.enum] || [];
      if (c.multi) {
        const cur = row[c.key] || [];
        return '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">' + esc(c.label) + '（可多选）</label>' +
          '<div style="display:flex;flex-wrap:wrap;gap:var(--space-sm) var(--space-md);max-height:96px;overflow-y:auto;padding:4px 0;">' +
          opts.map(o => '<label class="dsc-check"><input type="checkbox" class="efm_' + c.key + '" value="' + esc(o) + '"' + (cur.indexOf(o) >= 0 ? ' checked' : '') + '><span class="dsc-check__box"></span>' + esc(o) + '</label>').join('') +
          '</div></div>';
      }
      return '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">' + esc(c.label) + '</label><select class="dsc-select" id="ef_' + c.key + '">' +
        '<option value="">请选择</option>' + opts.map(o => '<option' + (row[c.key] === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
    }
    const longKeys = ['history', 'advDesc', 'badDesc', 'note', 'progress', 'strategy', 'mainContent', 'weekSummary'];
    return '<div class="dsc-form-group"><label class="dsc-form-label' + (OPTIONAL_COLS[ds] && OPTIONAL_COLS[ds].indexOf(c.key) >= 0 ? '' : ' dsc-form-label--required') + '">' + esc(c.label) + '</label>' +
      (longKeys.indexOf(c.key) >= 0
        ? '<textarea class="dsc-textarea" id="ef_' + c.key + '" rows="2">' + esc(row[c.key] || '') + '</textarea>'
        : '<input class="dsc-input" id="ef_' + c.key + '" value="' + esc(row[c.key] === undefined ? '' : row[c.key]) + '" placeholder="">') +
      (c.tip ? '<div class="dsc-field-tip">' + esc(c.tip) + '</div>' : '') + '</div>';
  }).join('');

  openModal((rowId ? '编辑' : '新增') + '明细行 · ' + ds + ' ' + esc(dsMeta(ds).name),
    (cols.some(c => c.fetched) && !weeklyMissing
      ? '<div class="dsc-alert dsc-alert--info dsc-mb-md">本数据集含自动取自周报的字段（置灰、无手工录入入口，A14）；如需修改请使用「覆盖留痕」。</div>' : '') +
    '<div class="dsc-form-row dsc-form-row--2">' + fieldHTML + '</div>' +
    (ds === 'D4' ? '<div class="dsc-field-tip">三个工作年限由起始时间至报送截止日自动计算取整（V-G06），无需填报。</div>' : '') +
    (ds === 'D6' ? '<div class="dsc-field-tip">禁用到期日由系统按"起始时间+期限"自动计算；同一供应商不得同时存在于合格库（V-C03 交叉校验）。</div>' : ''),
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="saveRow(\'' + ds + '\',\'' + (rowId || '') + '\',\'' + row.id + '\')">保存</button>');
}

function saveRow(ds, rowId, newId) {
  const rec = currentFillRec();
  const cols = ROWS_COLUMNS[ds];
  const row = rowId ? rec.rows.find(r => r.id === rowId) : { id: newId };
  const weeklyMissing = isWeeklyMissing();
  cols.forEach(c => {
    if (c.check) {
      const el = document.getElementById('ef_' + c.key);
      if (el) row[c.key] = el.checked;
    } else if (c.edit) {
      /* 带出字段：无手工录入入口，保持原值（A14） */
      if (c.fetched && !weeklyMissing) return;
      if (c.multi) {
        row[c.key] = Array.from(document.querySelectorAll('.efm_' + c.key + ':checked')).map(x => x.value);
      } else {
        const el = document.getElementById('ef_' + c.key);
        if (el) row[c.key] = el.value.trim();
      }
    }
  });
  if (!rowId) rec.rows.push(row);
  closeModal();
  toast('明细行已保存（草稿）', 'success');
  renderPage('my-fill');
}

function copyRow(rowId) {
  const rec = currentFillRec();
  const src = rec.rows.find(r => r.id === rowId);
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = 'R' + Date.now() % 100000;
  rec.rows.push(copy);
  toast('已复制行，请编辑修改后保存（名称+注册地重复将被查重阻断）', 'warning');
  renderPage('my-fill');
}
function deleteRow(rowId) {
  const rec = currentFillRec();
  rec.rows.splice(rec.rows.findIndex(r => r.id === rowId), 1);
  toast('明细行已删除（仅草稿与已退回状态可删除，操作留痕）', 'success');
  renderPage('my-fill');
}

/* ---------- 批量导入 ---------- */
function openImportModal() {
  const ds = FillState.dataset;
  const body = '' +
    '<div class="dsc-steps dsc-mb-md">' +
    '<div class="dsc-steps__item dsc-steps__item--done"><span class="dsc-steps__num">1</span><span class="dsc-steps__label">下载模板</span></div>' +
    '<div class="dsc-steps__item dsc-steps__item--done"><span class="dsc-steps__num">2</span><span class="dsc-steps__label">填写数据（≤10000 行）</span></div>' +
    '<div class="dsc-steps__item dsc-steps__item--active"><span class="dsc-steps__num">3</span><span class="dsc-steps__label">上传并校验</span></div>' +
    '<div class="dsc-steps__item"><span class="dsc-steps__num">4</span><span class="dsc-steps__label">校验通过入库</span></div></div>' +
    '<div class="dsc-alert dsc-alert--info">导入策略：先校验后入库。默认"整批不入库"（可配置为仅导入通过行）。失败行可导出修正后重新上传，校验响应 ≤30 秒/万行。</div>' +
    '<div class="dsc-form-group dsc-mt-md"><label class="dsc-form-label dsc-form-label--required">上传文件（.xlsx）</label>' +
    '<input class="dsc-input" type="file" accept=".xlsx" disabled placeholder="演示原型：文件上传已禁用，点击下方按钮模拟导入">' +
    '<div class="dsc-field-tip">模板由指标字典自动生成，列头与线上字段、校验规则强一致（A10 口径可配置）</div></div>' +
    '<div id="importResult"></div>';
  openModal('批量导入 · ' + ds + ' ' + esc(dsMeta(ds).name), body,
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="simulateImport()">模拟导入 20 行数据</button>');
}

function simulateImport() {
  const box = document.getElementById('importResult');
  const ds = FillState.dataset;
  const rec = currentFillRec();
  const fails = [
    { row: 7, rule: 'V-C03', msg: '「迪拜中东建材贸易有限公司（阿联酋·迪拜）」与库内已有有效记录重复（供应商名称+注册地）' },
    { row: 13, rule: 'V-E01', msg: '供应商评级取值"A"不在字典内（字典：A级-推荐使用/B级-建议使用/C级-审慎使用）' },
    { row: 18, rule: 'V-F03', msg: '联系电话格式不正确：62-812-3456' }
  ];
  /* 导入文件中的计算列 → 与系统重算值比对（V-G01~V-G06，容差 ±1 元 / ±0.01 个百分点；
     超差行阻断提交，可由填报端申请尾差放行、复核环节书面确认） */
  const calcFails = [];
  if (ds === 'D1') {
    rec.importedCalc = { lw_benefit: 7500000, source: '导入文件《月报-26采购指标》计算列' };
    calcFails.push({ row: '计算列', rule: 'V-G02', msg: '劳务与专业分包采购效益额：导入携带值 7,500,000.00 元 与系统重算值 7,500,002.40 元 偏差 2.40 元（超 ±1 元容差）→ 提交时阻断，可申请尾差放行' });
  } else if (ds === 'D2') {
    calcFails.push({ row: '计算列', rule: 'V-G04', msg: '钢筋节超量/结余率：导入携带值与系统重算值（图纸量 − 同口径用量）不一致，请核对图纸量与同口径用量填报基数' });
  } else if (ds === 'D3') {
    calcFails.push({ row: '计算列', rule: 'V-G05', msg: '钢筋损耗率：导入携带值与系统重算值（（实际用量 − 图纸净用量）÷ 图纸净用量）偏差超出 ±0.01 个百分点' });
  } else if (ds === 'D4') {
    calcFails.push({ row: '计算列', rule: 'V-G06', msg: '工作年限：导入携带值与系统按参加工作起始时间重算值不一致（该项由系统自动计算取整，文件中无须填写）' });
  }
  const allFails = fails.concat(calcFails);
  box.innerHTML = '<div class="dsc-alert dsc-alert--warning dsc-mt-md">导入校验完成：20 行中 ' + (20 - fails.length) + ' 行通过、' + fails.length + ' 行失败（整批不入库策略）' +
    (calcFails.length ? '；另有 ' + calcFails.length + ' 处计算列勾稽差异（' + calcFails.map(f => f.rule).join('、') + '）已单独列出' : '') + '</div>' +
    '<table class="dsc-table dsc-mt-sm"><thead><tr><th>失败行号</th><th>规则</th><th>失败原因</th></tr></thead><tbody>' +
    allFails.map(f => '<tr><td>' + (typeof f.row === 'number' ? '第 ' + f.row + ' 行' : f.row) + '</td><td><span class="dsc-tag dsc-tag--danger">' + f.rule + '</span></td><td>' + esc(f.msg) + '</td></tr>').join('') +
    '</tbody></table>' +
    (calcFails.length ? '<div class="dsc-alert dsc-alert--info dsc-mt-sm">勾稽差异处理：修正数据，或在提交被阻断时点击「申请尾差放行」提交差异原因，由复核环节书面确认放行（业务规则 4/20）。</div>' : '') +
    '<div class="dsc-mt-md"><button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="toast(\'失败行已导出为 Excel，修正后可重新上传\',\'success\')">导出失败行修正</button>' +
    '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="toast(\'已按配置切换为：仅导入通过校验的行\',\'warning\')">切换：仅导入通过行</button></div>';
  toast('导入校验完成：' + (20 - fails.length) + ' 通过 / ' + fails.length + ' 失败' + (calcFails.length ? '（含 ' + calcFails.length + ' 处勾稽差异）' : ''), 'warning');
}

/* ============================================================
   提交与校验（ZY-HY-TB-030 + 070 一致性校验）
   顺序：格式(V-F) → 枚举(V-E) → 查重(V-C) → 勾稽(V-G)/一致性(V-G07/08)；V-T 容错不算失败
   ============================================================ */
function submitFill() {
  const ds = FillState.dataset;
  const rec = currentFillRec();
  if (rec.zero) {
    openModal('零报告提交确认',
      '<div class="dsc-alert dsc-alert--info">确认以「本期无数据」零报告形式提交 ' + ds + ' ' + esc(dsMeta(ds).name) + '？零报告计入齐套统计（A9）。</div>',
      '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
      '<button class="dsc-btn dsc-btn--primary" onclick="doSubmitFill()">确认提交</button>');
    return;
  }
  const result = dsMeta(ds).mode === 'form' ? validateForm(ds) : validateRows(ds);
  FillState.validateResult = result;
  if (result.errors.length) {
    renderPage('my-fill');
    toast('校验未通过，已阻断提交：' + result.errors.length + ' 项失败，请按清单修正', 'danger');
    return;
  }
  const warnHTML = result.warnings.length
    ? '<div class="dsc-validate-panel dsc-validate-panel--warn dsc-mt-md"><div class="dsc-validate-panel__head"><span class="dsc-tag dsc-tag--warning">提示核对</span>' +
      result.warnings.length + ' 项偏差提示（不阻断提交，A13）</div><ul class="dsc-validate-list">' +
      result.warnings.map(w => '<li class="dsc-validate-item dsc-validate-item--warn"><span class="dsc-validate-item__rule dsc-validate-item__rule--warn">' + esc(w.rule) + '</span><div><span class="dsc-validate-item__loc">' + esc(w.loc) + '</span> ' + esc(w.msg) + '</div></li>').join('') +
      '</ul></div>'
    : '<div class="dsc-alert dsc-alert--success dsc-mt-md">四级校验（格式 → 枚举 → 查重 → 勾稽/一致性）共 ' + result.total + ' 条规则全部通过。</div>';
  openModal('提交确认',
    '<div>确认提交 ' + ds + ' ' + esc(dsMeta(ds).name) + '？</div>' + warnHTML +
    '<div class="dsc-field-tip">提交后数据锁定，流转至审核人；被退回时按退回原因修改后重新提交，全程留痕。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doSubmitFill()">确认提交</button>');
}
function doSubmitFill() {
  const rec = currentFillRec();
  rec.status = '已提交';
  rec.lastSubmit = '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  FillState.validateResult = null;
  closeModal();
  if (FillState.freq === '月报') {
    toast('提交成功：校验全部通过，① 已流转至单位审核；② 带出字段与周报源数据一致率 100%（A11）', 'success');
  } else {
    toast('周报提交成功：本数据按周留档，成为当月月报取数来源', 'success');
  }
  renderPage('my-fill');
}

/* ---------- 表单校验 ---------- */
function validateForm(ds) {
  const errors = [], warnings = [];
  const values = collectFormValues();
  FORM_SECTION_DEFS[ds].forEach(sec => {
    sec.fields.forEach(f => {
      if (f.type !== 'number') return;
      const v = values[f.key];
      if (v === undefined || v === null || v === '' || isNaN(v)) {
        errors.push({ rule: 'V-F01', loc: sec.title + ' · ' + f.label, msg: '必填字段未填写或非数字（金额 2 位小数）',
          fixFn: 'focusFillField(\'' + f.key + '\')' });
      }
    });
  });
  /* V-C01 唯一有效记录（主体 + 期间 + 数据集） */
  const dupErr = checkUniqueRecord(ds);
  if (dupErr) errors.push(dupErr);
  /* V-G01~V-G06 勾稽校验（含导入携带计算列与系统重算值比对） */
  const merged = resolveValues(ds, values);
  validateCalcRules(ds, merged, warnings).forEach(e => errors.push(e));
  /* 周月一致性校验（A13 / PRD 7.3）：仅月报 */
  const cons = validateConsistency(ds, merged);
  return { errors: errors.concat(cons.errors), warnings: cons.warnings, total: 22 };
}

/* ---------- V-C01 唯一有效记录（主体 + 期间 + 数据集，ZY-HY-TB-030） ---------- */
function checkUniqueRecord(ds) {
  const rec = currentFillRec();
  if (!rec) return null;
  const taskId = FillState.freq === '周报' ? FILL_TASK_W : FILL_TASK;
  const store = (FillState.freq === '周报' ? WEEKLY_STORE[taskId] : FILL_STORE[taskId]) || {};
  const unitStore = store[FillState.subjectId] || {};
  const others = Object.keys(unitStore).filter(d => d === ds && unitStore[d] !== rec && ['已提交', '已通过', '已退回'].indexOf(unitStore[d].status) >= 0);
  if (others.length) {
    return { rule: 'V-C01', loc: ds + ' ' + dsMeta(ds).name, msg: '同一「主体 + 期间 + 数据集」已存在有效记录（' + others.length + ' 条），仅允许一条有效记录，本次提交已被阻断' };
  }
  if (rec.status === '已提交' || rec.status === '已通过') {
    return { rule: 'V-C01', loc: ds + ' ' + dsMeta(ds).name, msg: '该记录当前状态为「' + rec.status + '」，不可重复提交；如需更正请走退回或数据更正流程' };
  }
  return null;
}

/* ---------- V-G01~V-G06 勾稽规则表与执行（SRS 勾稽校验层） ----------
   规则表用于对外说明每条公式；实际比对对象为「导入/线下携带的计算列原值」与系统重算值，
   容差金额 ±1 元、率类 ±0.01 个百分点，超差阻断；已申请尾差放行则放行并待复核书面确认。 */
const CALC_RULES = [
  { rule: 'V-G01', ds: 'D1', name: '采购汇总勾稽', expr: '采购总金额 = 物资设备采购总金额 + 劳务与专业分包采购总金额' },
  { rule: 'V-G02', ds: 'D1', name: '效益额/降低额勾稽', expr: '效益额 = 对应业主收入 − 采购总金额；降低额 = 标准成本 − 采购总金额' },
  { rule: 'V-G03', ds: 'D1', name: '率类勾稽', expr: '效益率 = 效益额 ÷ 对应业主收入；分母为 0 显示"/"（V-T01）' },
  { rule: 'V-G04', ds: 'D2', name: '结余/节超勾稽', expr: '结余率 =（图纸同口径用量 − 图纸计算量）÷ 图纸计算量；节超量 = 图纸量 − 同口径用量；钢筋同口径用量按（实际用量 − 措施用量 − 临建用量）口径核对（需填报字段，偏差仅提示）' },
  { rule: 'V-G05', ds: 'D3', name: '损耗率/周转率勾稽', expr: '损耗率 =（实际用量 − 图纸净用量）÷ 图纸净用量；周转率 = 调出资产原值 ÷ 项目资产原值' },
  { rule: 'V-G06', ds: 'D4', name: '工作年限勾稽', expr: '工作年限 = 起始时间至报送截止日自动取整（导入携带值须与重算值一致）' }
];
const CALC_TOLERANCE = { amount: 1, rate: 0.01 };   // ±1 元 / ±0.01 个百分点

function validateCalcRules(ds, values, warnings) {
  const errors = [];
  const warn = warnings || [];
  const rec = currentFillRec();
  if (!rec || !CALC_RULES.some(r => r.ds === ds)) return errors;
  /* 已申请尾差放行 → 提交放行，待复核环节书面确认（业务规则 4/20） */
  if (rec.varianceWaiver && rec.varianceWaiver.applied) return errors;
  /* V-G04 口径核对：D2 钢筋同口径用量为「需填报」字段（裁定④），系统按口径参考值核对，偏差仅提示不阻断 */
  if (ds === 'D2' && values && values.gj_tkL !== undefined && values.gj_tkL !== '' && !isNaN(Number(values.gj_tkL))) {
    const ref = Number(values.gj_syL) - Number(values.gj_csL) - Number(values.gj_ljL);
    const diff = Number(values.gj_tkL) - ref;
    if (!isNaN(ref) && Math.abs(diff) > CALC_TOLERANCE.amount) {
      warn.push({
        rule: 'V-G04', loc: '钢筋（t） · 同口径用量',
        msg: '同口径用量 ' + fmtQty(values.gj_tkL) + ' t 与口径参考值（实际用量 − 措施用量 − 临建用量 = ' + fmtQty(ref) +
          ' t）偏差 ' + fmtQty(Math.abs(diff)) + ' t，请核对口径（需填报字段，仅提示不阻断）',
        fixFn: 'focusFillField(\'gj_tkL\')', fixLabel: '定位字段'
      });
    }
  }
  const imported = rec.importedCalc;
  if (!imported) return errors;
  if (ds === 'D1' && imported.lw_benefit !== undefined && values) {
    const c1 = calcD1(values);
    const sys = Number(c1.lw_benefit), line = Number(imported.lw_benefit);
    if (!isNaN(sys) && !isNaN(line) && Math.abs(sys - line) > CALC_TOLERANCE.amount) {
      errors.push({
        rule: 'V-G02', loc: '劳务与专业分包区块 · 采购效益额',
        msg: '导入携带计算值 ' + fmtMoney(line) + ' 元与系统重算值 ' + fmtMoney(sys) + ' 元偏差 ' + fmtMoney(Math.abs(sys - line)) +
          ' 元（容差 ±' + CALC_TOLERANCE.amount + ' 元；来源：' + (imported.source || '导入文件') + '）。请修正数据，或申请尾差放行后由复核环节书面确认',
        fixFn: 'openTailWaiverModal(\'' + ds + '\')', fixLabel: '申请尾差放行'
      });
    }
  }
  return errors;
}

/* 合并表单输入与带出值（带出字段不在 DOM 中作为可编辑项） */
function resolveValues(ds, values) {
  const merged = {};
  const rec = currentFillRec();
  Object.keys(values || {}).forEach(k => { merged[k] = values[k]; });
  const map = FETCH_SOURCES.map[ds] || {};
  Object.keys(map).forEach(k => {
    if (merged[k] === undefined) {
      const info = fetchedInfo(ds, k);
      merged[k] = Number(info.value);
    }
  });
  return merged;
}

function focusFillField(key) {
  closeModal();
  const el = document.querySelector('[data-fill-field="' + key + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--color-danger)';
    el.focus();
  } else {
    toast('该字段为自动带出字段，请使用「修改（覆盖留痕）」', 'warning');
  }
}

/* ---------- 一致性校验（月报 ↔ 周报 W6 按单位汇总基准，业务规则 11/13/14，PRD 7.3） ----------
   金额类：月报值 < 周报汇总值 → 阻断（可填差异说明留痕放行）；
   率类：由月报填报数据系统重算后与 W6 汇总率比对，偏差 >±5% 仅提示核对（率类不直接带入月报）。 */
const CONSISTENCY_BASELINE_FIELD = {
  wz_purchase: 'purchaseTotal', lw_purchase: 'laborPurchase',
  sum_reduce_rate: 'reduceRate', sum_benefit_rate: 'benefitRate',
  gj_shl: 'gjLossRate', hnt_shl: 'hntLossRate'
};
const CONSISTENCY_RATE_KEYS = ['sum_reduce_rate', 'sum_benefit_rate', 'gj_shl', 'hnt_shl'];
/* 率类字段（"12.34%"）→ 数值 */
function parseRateVal(v) {
  if (v === undefined || v === null || v === '' || v === '/') return NaN;
  const n = parseFloat(String(v).replace(/[%,\s]/g, ''));
  return isNaN(n) ? NaN : n;
}
function validateConsistency(ds, values) {
  const errors = [], warnings = [];
  if (FillState.freq !== '月报') return { errors: errors, warnings: warnings };
  const uid = FillState.subjectId;
  const base = w6Baseline(uid);
  if (!base || isWeeklyMissing()) return { errors: errors, warnings: warnings };
  const rec = currentFillRec();
  const confirmed = rec.consistencyConfirmed || {};

  const checks = [];   // kind：amount=金额类（低于基准阻断）｜rate=率类（仅提示核对）
  if (ds === 'D1' && values) {
    checks.push({ key: 'wz_purchase', label: '物资设备采购总金额', mv: Number(values.wz_purchase), wv: base.purchaseTotal, kind: 'amount' });
    checks.push({ key: 'lw_purchase', label: '劳务与专业分包采购总金额', mv: Number(values.lw_purchase), wv: base.laborPurchase, kind: 'amount' });
    /* V1.1 扩展：D1 率类与 W6 汇总率互校（率类由系统重算，不作带入） */
    const c1 = calcD1(values);
    checks.push({ key: 'sum_reduce_rate', label: '综合采购成本降低率（月报重算）', mv: parseRateVal(c1.sum_reduce_rate), wv: base.reduceRate, kind: 'rate' });
    checks.push({ key: 'sum_benefit_rate', label: '综合采购效益率（月报重算）', mv: parseRateVal(c1.sum_benefit_rate), wv: base.benefitRate, kind: 'rate' });
  }
  if (ds === 'D3' && values) {
    /* V1.1 扩展：D3 损耗率与 W6 汇总损耗率互为校验基准（PRD 7.2：W6 汇总损耗率作一致性校验基准） */
    const c3 = calcD3(values);
    checks.push({ key: 'gj_shl', label: '钢筋损耗率（月报重算）', mv: parseRateVal(c3.gj_shl), wv: base.gjLossRate, kind: 'rate' });
    checks.push({ key: 'hnt_shl', label: '混凝土损耗率（月报重算）', mv: parseRateVal(c3.hnt_shl), wv: base.hntLossRate, kind: 'rate' });
  }
  if (ds === 'D2' && values) {
    /* D2 率类为系统按填报基数计算，不设数值比对；但图纸量基数为 D3 损耗率的分母，
       按「同一指标全系统一处填报、各处仅引用」须与 D3 完全一致（PRD 7.2 D2 行 / 规则 13）。 */
    const d3 = getFill(FILL_TASK, uid, 'D3');
    const d3v = (d3 && d3.values) || {};
    [
      { k: 'gj_tuL', other: 'gj_tuL', label: '钢筋图纸量', otherLabel: 'D3 钢筋图纸净用量' },
      { k: 'hnt_tuL', other: 'hnt_ysL', label: '混凝土图纸计算量', otherLabel: 'D3 混凝土施工图预算量' }
    ].forEach(b => {
      if (d3v[b.other] === undefined || values[b.k] === undefined || isNaN(Number(values[b.k]))) return;
      if (Number(values[b.k]) !== Number(d3v[b.other])) {
        errors.push({
          rule: 'V-G04', loc: b.label,
          msg: b.label + ' ' + fmtQty(Number(values[b.k])) + ' 与 ' + b.otherLabel + ' ' + fmtQty(Number(d3v[b.other])) +
            ' 不一致（损耗率基数须与 D3 同口径；同一指标全系统一处填报、各处仅引用）',
          fixFn: 'focusFillField(\'' + b.k + '\')'
        });
      }
    });
  }
  checks.forEach(c => {
    if (isNaN(c.mv) || !c.wv) return;
    const dev = (c.mv - c.wv) / c.wv;
    if (c.kind === 'amount') {
      if (c.mv < c.wv && !confirmed[c.key]) {
        errors.push({
          rule: 'V-G07', loc: c.label,
          msg: '月报值 ' + fmtMoney(c.mv) + ' 小于周报汇总值 ' + fmtMoney(c.wv) + '（' + base.note + '），已阻断提交；确因口径差异请填写差异说明留痕',
          fixFn: 'openConsistencyExplain(\'' + c.key + '\',\'' + ds + '\',\'' + c.label + '\')', fixLabel: '差异说明'
        });
      } else if (Math.abs(dev) > CONSISTENCY_CONFIG.deviationWarn) {
        warnings.push({
          rule: 'V-G08', loc: c.label,
          msg: '月报值 ' + fmtMoney(c.mv) + ' 与周报汇总值 ' + fmtMoney(c.wv) + ' 偏差 ' + (dev * 100).toFixed(1) + '%（阈值 ±' + (CONSISTENCY_CONFIG.deviationWarn * 100) + '%），请核对口径（提示不阻断）',
          fixFn: 'openConsistencyExplain(\'' + c.key + '\',\'' + ds + '\',\'' + c.label + '\')', fixLabel: '说明差异'
        });
      }
    } else {
      if (confirmed[c.key]) return;   // 已留痕差异说明 → 不再重复提示
      if (Math.abs(dev) > CONSISTENCY_CONFIG.deviationWarn) {
        warnings.push({
          rule: 'V-G08', loc: c.label,
          msg: '月报重算值 ' + c.mv.toFixed(2) + '% 与 W6 汇总基准 ' + c.wv.toFixed(2) + '% 偏差 ' + (dev * 100).toFixed(1) +
            '%（阈值 ±' + (CONSISTENCY_CONFIG.deviationWarn * 100) + '%），率类仅提示核对、不阻断提交（PRD 7.3）',
          fixFn: 'openConsistencyExplain(\'' + c.key + '\',\'' + ds + '\',\'' + c.label + '\')', fixLabel: '说明差异'
        });
      }
    }
  });
  return { errors: errors, warnings: warnings };
}

function openConsistencyExplain(key, ds, label) {
  const base = w6Baseline(FillState.subjectId);
  const bKey = CONSISTENCY_BASELINE_FIELD[key];
  const isRate = CONSISTENCY_RATE_KEYS.indexOf(key) >= 0;
  const bv = base ? base[bKey] : null;
  const baseText = (bv === null || bv === undefined) ? '—' : (isRate ? Number(bv).toFixed(2) + '%' : fmtMoney(bv));
  openModal('周月一致性差异说明（留痕）',
    '<div class="dsc-alert dsc-alert--warning">' + (isRate
      ? '率类指标由系统按月报填报数据重算，与 W6 汇总基准偏差 >±5% 时<b>提示核对</b>（不阻断提交，PRD 7.3）；填写差异说明留痕后消除该提示，记录写入审计轨迹（业务规则 11、A13）。'
      : '金额类指标月报值小于周报汇总值触发<b>阻断</b>；确因统计口径/时点差异，可填写差异说明后放行，记录将写入审计轨迹（业务规则 11、A13）。') + '</div>' +
    '<div class="dsc-kv dsc-mt-md" style="grid-template-columns:repeat(2,1fr);">' +
    '<div class="dsc-kv__item"><div class="dsc-kv__label">字段</div><div class="dsc-kv__value">' + esc(label) + '</div></div>' +
    '<div class="dsc-kv__item"><div class="dsc-kv__label">周报汇总基准</div><div class="dsc-kv__value">' + baseText + '</div></div>' +
    '<div class="dsc-kv__item" style="grid-column:span 2;"><div class="dsc-kv__label">基准来源</div><div class="dsc-kv__value" style="font-size:var(--font-size-sm);">' + esc(base ? base.note : '当月无周报基准（A13 缺失兜底：转手工填报）') + '</div></div>' +
    '</div>' +
    '<div class="dsc-form-group dsc-mt-md"><label class="dsc-form-label dsc-form-label--required">差异说明（必填）</label>' +
    '<textarea class="dsc-textarea" id="consReason" rows="3" placeholder="如：周报按付款进度统计、月报按权责发生制确认，差额为跨月结算部分"></textarea></div>' +
    '<div class="dsc-field-tip">说明经留痕后本次提交放行；同类差异建议在报表口径中明确（Q9）。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doConsistencyExplain(\'' + key + '\')">提交说明并放行</button>');
}
function doConsistencyExplain(key) {
  const reason = document.getElementById('consReason').value.trim();
  if (!reason) { toast('差异说明必填', 'warning'); return; }
  const rec = currentFillRec();
  rec.consistencyConfirmed = rec.consistencyConfirmed || {};
  rec.consistencyConfirmed[key] = { reason: reason, by: AppState.role.name, time: '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0') };
  closeModal();
  toast('差异说明已留痕（操作人/时间/原值/原因），可继续提交', 'success');
  submitFill();
}

/* ---------- 尾差放行（V-G02 容差外差异的书面确认流程，业务规则 4/20） ----------
   填报端提交申请并留痕 → 随数据流转至复核环节书面确认放行 → 归档；
   未确认前可撤回申请，撤回后须修正数据或重新申请。 */
function openTailWaiverModal(ds) {
  const rec = currentFillRec();
  const w = rec.varianceWaiver;
  openModal('申请尾差放行（V-G02）',
    '<div class="dsc-alert dsc-alert--warning">导入携带的计算值与系统重算值偏差超出容差（金额 ±1 元 / 率类 ±0.01 个百分点）。按业务规则 4/20，勾稽差异须由复核环节<b>书面确认放行</b>并留痕；本申请将随提交流转至审核/复核，未确认前数据状态标注「尾差放行待复核确认」。</div>' +
    (w && w.applied ? '<div class="dsc-alert dsc-alert--info dsc-mt-sm">已提交申请：' + esc(w.reason) + '（' + esc(w.by) + ' · ' + esc(w.time) + '）</div>' : '') +
    '<div class="dsc-form-group dsc-mt-md"><label class="dsc-form-label dsc-form-label--required">差异原因（必填）</label>' +
    '<textarea class="dsc-textarea" id="twReason" rows="3" placeholder="如：线下月报按四舍五入取整至元，系统按分录明细重算，差异 +2.40 元"></textarea></div>' +
    '<div class="dsc-field-tip">放行范围仅限本次勾稽尾差（规则 ' + CALC_RULES.filter(r => r.ds === ds).map(r => r.rule).join('、') + '），不影响其他校验规则。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doTailWaiver(\'' + ds + '\')">提交尾差放行申请</button>');
}
function doTailWaiver(ds) {
  const reason = (document.getElementById('twReason').value || '').trim();
  if (!reason) { toast('差异原因必填：尾差放行须书面留痕后方可放行', 'warning'); return; }
  const rec = currentFillRec();
  rec.varianceWaiver = {
    applied: true, rules: CALC_RULES.filter(r => r.ds === ds).map(r => r.rule),
    reason: reason, by: AppState.role.name, role: AppState.role.id, time: nowStamp(), confirmed: false
  };
  closeModal();
  toast('尾差放行申请已留痕（规则 ' + rec.varianceWaiver.rules.join('、') + '）：提交后由局级复核书面确认放行', 'success');
  renderPage('my-fill');
}
function revokeTailWaiver() {
  const rec = currentFillRec();
  if (!rec.varianceWaiver) return;
  delete rec.varianceWaiver;
  toast('尾差放行申请已撤回，请修正数据或重新提交申请', 'warning');
  renderPage('my-fill');
}

/* ---------- 明细行校验 ---------- */
function validateRows(ds) {
  const errors = [], warnings = [];
  const rec = currentFillRec();
  const rows = rec.rows || [];
  const cols = ROWS_COLUMNS[ds];
  const optional = OPTIONAL_COLS[ds] || [];
  const deadline = currentTask().deadline.replace(/-/g, '/');
  const weeklyMissing = isWeeklyMissing();
  const label = k => (cols.find(c => c.key === k) || {}).label || k;

  rows.forEach((r, i) => {
    const rowNo = '第 ' + (i + 1) + ' 行';
    /* V-F01 必填 */
    cols.forEach(c => {
      if (!c.edit) return;
      if (c.key === 'mainJob') return;
      if (optional.indexOf(c.key) >= 0) return;
      if (c.fetched && !weeklyMissing) return;   // 带出字段由系统保证
      const v = r[c.key];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) {
        errors.push({ rule: 'V-F01', loc: rowNo + ' · ' + label(c.key), msg: '必填字段未填写', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
    /* 数字字段 */
    if (ds === 'D4' && (isNaN(Number(r.age)) || !r.age)) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · 年龄', msg: '年龄须为整数', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    if (ds === 'D6' && (isNaN(Number(r.banMonths)) || !r.banMonths)) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · 禁用期限（月）', msg: '禁用期限须为数字', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    if ((ds === 'W3' || ds === 'W5' || ds === 'W6') && r.amount !== undefined && r.amount !== '' && isNaN(Number(r.amount))) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · ' + label('amount'), msg: '金额须为数字（保留 2 位小数）', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    /* V-F02 日期格式 */
    (DATE_KEYS[ds] || []).forEach(k => {
      if (optional.indexOf(k) >= 0 && (!r[k] || r[k] === '/')) return;
      if (r[k] && r[k] !== '/' && !parseDate(r[k])) {
        errors.push({ rule: 'V-F02', loc: rowNo + ' · ' + label(k), msg: '日期格式应为 yyyy/MM/dd，当前值"' + r[k] + '"', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
    /* V-F03 电话格式 */
    if (r.phone && !/^\+?[\d][\d\s-]{6,}$/.test(r.phone)) {
      errors.push({ rule: 'V-F03', loc: rowNo + ' · ' + label('phone'), msg: '联系电话格式不正确：' + r.phone + '（支持国际号码，如 +20-100-1234567）', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    /* V-E 枚举 */
    cols.forEach(c => {
      if (!c.edit || !c.enum || c.multi) return;
      if (c.fetched && !weeklyMissing) return;
      const opts = Array.isArray(c.enum) ? c.enum : ENUMS[c.enum] || [];
      if (r[c.key] && opts.indexOf(r[c.key]) < 0) {
        errors.push({ rule: 'V-E01', loc: rowNo + ' · ' + label(c.key), msg: '取值"' + r[c.key] + '"不在字典内（' + opts.join('/') + '），字典外取值无法提交', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
    /* 条件必填 */
    if (ds === 'D4' && r.fullTime === '兼职' && !r.mainJob) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · 主职岗位', msg: '专职/兼职为"兼职"时主职岗位必填', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    if (ds === 'W6' && r.hasRisk === '是' && (!r.riskType || !r.riskLevel || !r.riskDesc)) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · 风险类型/等级/描述', msg: '标记"有风险"时风险类型、风险等级、风险描述必填', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    /* V-G06 勾稽：导入携带的工作年限须与系统按起始时间重算值一致 */
    if (ds === 'D4' && r.importedWorkYears !== undefined) {
      const sysYears = workYears(r.workStart, deadline);
      if (Number(r.importedWorkYears) !== Number(sysYears)) {
        errors.push({ rule: 'V-G06', loc: rowNo + ' · 工作年限', msg: '导入携带值 ' + r.importedWorkYears + ' 年与系统按参加工作起始时间重算值 ' + sysYears + ' 年不一致（该项由系统自动计算取整）', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    }
  });

  /* V-C02 查重（人员） */
  if (ds === 'D4') {
    const seen = {};
    rows.forEach((r, i) => {
      const key = (r.empNo && r.empNo !== '/') ? r.empNo : (r.name + '|' + r.dept + '|' + r.project);
      if (seen[key] !== undefined) {
        errors.push({ rule: 'V-C02', loc: '第 ' + (i + 1) + ' 行 · ' + r.name,
          msg: '与第 ' + (seen[key] + 1) + ' 行重复（' + (r.empNo && r.empNo !== '/' ? '员工编号 ' + r.empNo : '姓名+三级单位+项目') + '查重）', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      } else { seen[key] = i; }
    });
  }
  /* V-C03 查重（分供商 D5/D6/W4） */
  if (ds === 'D5' || ds === 'D6' || ds === 'W4') {
    const seen = {};
    rows.forEach((r, i) => {
      const key = r.name + '|' + r.region;
      if (seen[key] !== undefined) {
        errors.push({ rule: 'V-C03', loc: '第 ' + (i + 1) + ' 行 · ' + r.name,
          msg: '与第 ' + (seen[key] + 1) + ' 行重复（供应商名称+注册地唯一），请删除或修改重复行', fixFn: 'deleteRow(\'' + r.id + '\')' });
      } else { seen[key] = i; }
    });
  }
  /* V-C03 交叉（D5 ↔ D6） */
  if (ds === 'D6') {
    const d5 = getFill(FILL_TASK, FillState.subjectId, 'D5');
    const d5Rows = (d5 && d5.rows) || [];
    rows.forEach((r, i) => {
      if (d5Rows.some(x => x.name === r.name && x.region === r.region)) {
        errors.push({ rule: 'V-C03', loc: '第 ' + (i + 1) + ' 行 · ' + r.name,
          msg: '该供应商同时存在于 D5 合格库有效记录中（交叉提示阻断）：同一供应商不得同时存在于合格库与不合格库，请核实在 D5 中删除或修改本行', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
  }
  /* 空行集 */
  if (!rows.length) {
    errors.push({ rule: 'V-F01', loc: ds + ' ' + dsMeta(ds).name, msg: '无明细行：请新增/导入明细，或勾选「本期无数据」以零报告提交' });
  }
  return { errors: errors, warnings: warnings, total: 22 + rows.length * 3 };
}
