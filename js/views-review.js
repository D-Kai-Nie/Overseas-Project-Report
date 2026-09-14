/* ============================================================
   ZY-HY-TB-040 审核与退回
   单位审核（通过/退回/撤回到草稿）→ 局级复核（按数据集分工、批量通过）
   退回必填原因，全程留痕（审计轨迹）
   ============================================================ */

/* 局级复核分工（可配置）：采购指标→采购管理部，物资指标→物资管理部 */
const REVIEW_ASSIGN = {
  D1: '局采购管理部', D2: '局物资管理部', D3: '局物资管理部',
  D4: '局采购管理部', D5: '局物资管理部', D6: '局物资管理部'
};

const ReviewState = {
  view: 'list',            // list | detail
  unitId: null, dataset: null,
  checked: {}              // 批量通过勾选
};

VIEWS['review'] = {
  render() { return ReviewState.view === 'detail' ? renderReviewDetail() : renderReviewList(); },
  init() { /* inline handlers */ }
};

/* 当前角色的复核分工数据集 */
function myReviewDatasets() {
  if (AppState.role.id === 'admin') return ['D1', 'D4'];           // 局采购管理部
  if (AppState.role.id === 'reviewer') return ['D2', 'D3', 'D5', 'D6']; // 局物资管理部
  return DATASET_ORDER;                                            // 单位审核人看全部
}

/* ============================================================
   审核列表
   ============================================================ */
function renderReviewList() {
  const role = AppState.role.id;
  const isUnitAuditor = role === 'auditor';
  const isBureau = role === 'admin' || role === 'reviewer';

  const pending = [];    // 待处理
  const done = [];       // 已处理/历史
  UNITS.forEach(u => {
    DATASET_ORDER.forEach(d => {
      const rec = getFill('T-2026H1', u.id, d);
      if (!rec) return;
      if (isUnitAuditor) {
        /* 单位审核人：本单位全部数据集 */
        if (u.id !== 'U01') return;
        if (rec.status === '已提交') {
          (rec.unitAudited ? done : pending).push({ unit: u, ds: d, rec: rec });
        } else if (rec.status === '已通过' || rec.status === '已退回') {
          done.push({ unit: u, ds: d, rec: rec });
        }
      } else if (isBureau) {
        /* 局级复核：按数据集分工 + 已通过单位审核 */
        if (myReviewDatasets().indexOf(d) < 0) return;
        if (rec.status === '已提交' && rec.unitAudited) pending.push({ unit: u, ds: d, rec: rec });
        if (rec.status === '已通过' && rec.passedBy) done.push({ unit: u, ds: d, rec: rec });
      }
    });
  });

  const rowHTML = item => {
    const { unit, ds, rec } = item;
    const stage = rec.status === '已提交'
      ? (rec.unitAudited ? '<span class="dsc-tag dsc-tag--info">待局级复核</span>' : '<span class="dsc-tag dsc-tag--filling">待单位审核</span>')
      : statusTag(rec.status);
    const canCheck = rec.status === '已提交' && rec.unitAudited && isBureau;
    return '<tr>' +
      (isBureau ? '<td><label class="dsc-check"><input type="checkbox" onchange="toggleReviewCheck(\'' + unit.id + '_' + ds + '\',this.checked)"' + (ReviewState.checked[unit.id + '_' + ds] ? ' checked' : '') + '><span class="dsc-check__box"></span></label></td>' : '') +
      '<td>' + unit.name + '</td>' +
      '<td><span class="dsc-dtab__code">' + ds + '</span> ' + esc(DATASETS[ds].name) + '</td>' +
      '<td>' + stage + '</td>' +
      '<td style="font-size:var(--font-size-sm);font-family:var(--font-family-number);">' + esc(rec.lastSubmit || '—') + '</td>' +
      '<td style="font-size:var(--font-size-sm);">' + (rec.zero ? '零报告' : (DATASETS[ds].mode === 'form' ? '单记录表单' : (rec.rows ? rec.rows.length : 0) + ' 条明细')) + '</td>' +
      '<td style="font-size:var(--font-size-sm);color:var(--color-text-tertiary);">' + esc(REVIEW_ASSIGN[ds]) + '</td>' +
      '<td class="dsc-table__actions"><button class="dsc-btn dsc-btn--text dsc-btn--sm dsc-text-primary" onclick="openReviewDetail(\'' + unit.id + '\',\'' + ds + '\')">' +
      (rec.status === '已提交' ? '审核' : '查看') + '</button></td></tr>';
  };

  const doneRows = done.map(rowHTML).join('');
  const pendingRows = pending.map(rowHTML).join('');
  const checkedCount = Object.keys(ReviewState.checked).filter(k => ReviewState.checked[k]).length;

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title">' + (isUnitAuditor ? '单位审核' : '局级复核') + '</div>' +
    '  <div class="dsc-field-tip">' + (isUnitAuditor
      ? '审核本单位提交数据的完整性与准确性；通过后提交局级；仅审核人可对已提交数据发起撤回到草稿'
      : '按数据集分工复核：采购指标 → 局采购管理部，物资指标 → 局物资管理部（分工可配置）；支持批量通过校验全部通过的记录') + '</div></div>' +
    (isBureau && checkedCount
      ? '<div class="dsc-page-header__actions"><button class="dsc-btn dsc-btn--primary" onclick="batchPass()">批量通过（' + checkedCount + '）</button></div>' : '') +
    '</div>' +

    '<div class="dsc-card"><div class="dsc-card__body dsc-card__body--no-padding">' +
    '  <div class="dsc-card__body" style="padding-bottom:0;"><div class="dsc-card__title">待审核（' + pending.length + '）</div></div>' +
    '  <div class="dsc-table-wrapper"><table class="dsc-table">' +
    '    <thead><tr>' + (isBureau ? '<th style="width:36px;"></th>' : '') + '<th>二级单位</th><th>数据集</th><th>审核阶段</th><th>提交时间</th><th>数据量</th><th>复核分工</th><th>操作</th></tr></thead>' +
    '    <tbody>' + (pendingRows || '<tr><td colspan="8"><div class="dsc-empty"><div class="dsc-empty__icon">✅</div><div class="dsc-empty__text">暂无待审核任务</div></div></td></tr>') + '</tbody>' +
    '  </table></div>' +
    '</div></div>' +

    (doneRows ? '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body dsc-card__body--no-padding">' +
    '  <div class="dsc-card__body" style="padding-bottom:0;"><div class="dsc-card__title">已处理 / 历史（' + done.length + '）</div></div>' +
    '  <div class="dsc-table-wrapper"><table class="dsc-table">' +
    '    <thead><tr>' + (isBureau ? '<th style="width:36px;"></th>' : '') + '<th>二级单位</th><th>数据集</th><th>审核阶段</th><th>提交时间</th><th>数据量</th><th>复核分工</th><th>操作</th></tr></thead>' +
    '    <tbody>' + doneRows + '</tbody></table></div>' +
    '</div></div>' : '');
}

function toggleReviewCheck(key, checked) { ReviewState.checked[key] = checked; }

function batchPass() {
  const keys = Object.keys(ReviewState.checked).filter(k => ReviewState.checked[k]);
  openModal('批量通过确认',
    '<div>确认批量通过 ' + keys.length + ' 条复核记录？</div>' +
    '<div class="dsc-alert dsc-alert--info dsc-mt-md">批量通过仅适用于校验全部通过的记录；通过后数据锁定并纳入汇总（留痕）。</div>' +
    '<div class="dsc-field-tip dsc-mt-sm">' + keys.map(k => {
      const p = k.split('_');
      return unitName(p[0]) + '·' + p[1];
    }).join('、') + '</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doBatchPass()">确认批量通过</button>');
}
function doBatchPass() {
  const keys = Object.keys(ReviewState.checked).filter(k => ReviewState.checked[k]);
  keys.forEach(k => {
    const p = k.split('_');
    const rec = getFill('T-2026H1', p[0], p[1]);
    rec.status = '已通过';
    rec.passedBy = AppState.role.id === 'admin' ? '王建国' : '李秀芳';
    rec.passedTime = '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  });
  ReviewState.checked = {};
  closeModal();
  toast('已批量通过 ' + keys.length + ' 条记录，数据锁定并纳入汇总', 'success');
  renderPage('review');
}

/* ============================================================
   审核详情：填报明细 + 校验结果 + 审核操作 + 审计轨迹
   ============================================================ */
function openReviewDetail(unitId, ds) {
  ReviewState.view = 'detail';
  ReviewState.unitId = unitId;
  ReviewState.dataset = ds;
  renderPage('review');
}
function backReviewList() {
  ReviewState.view = 'list';
  renderPage('review');
}

function renderReviewDetail() {
  const unitId = ReviewState.unitId, ds = ReviewState.dataset;
  const rec = getFill('T-2026H1', unitId, ds);
  const role = AppState.role.id;
  const isUnitAuditor = role === 'auditor';
  const canAct = rec.status === '已提交';
  const canUnitAudit = canAct && isUnitAuditor && !rec.unitAudited;
  const canBureauReview = canAct && (role === 'admin' || role === 'reviewer') && rec.unitAudited && myReviewDatasets().indexOf(ds) >= 0;
  const canWithdraw = isUnitAuditor && canAct;   // 撤回到草稿

  /* 填报明细内容 */
  let detailHTML;
  if (rec.zero) {
    detailHTML = '<div class="dsc-zero-report"><div class="dsc-empty__icon" style="font-size:32px;">∅</div><div><div style="font-weight:var(--font-weight-medium);">本期无数据（零报告）</div><div class="dsc-field-tip">该单位本期无相关业务，零报告计入齐套统计。</div></div></div>';
  } else if (DATASETS[ds].mode === 'form') {
    detailHTML = renderReviewFormDetail(ds, rec);
  } else {
    detailHTML = renderReviewRowsDetail(ds, rec);
  }

  /* 审核操作区 */
  let actionBar = '';
  if (canUnitAudit || canBureauReview) {
    actionBar = '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
      '<div class="dsc-card__title" style="margin-bottom:var(--space-md);">审核操作</div>' +
      '<div class="dsc-flex dsc-flex--center dsc-gap-md">' +
      '<button class="dsc-btn dsc-btn--primary" onclick="passReview()">通过</button>' +
      '<button class="dsc-btn dsc-btn--danger" onclick="openRejectModal()">退回</button>' +
      (isUnitAuditor ? '<button class="dsc-btn dsc-btn--default" onclick="withdrawToDraft()">撤回到草稿</button>' : '') +
      '<span class="dsc-field-tip">退回必填原因，支持按数据集整单退回；全部操作留痕（A7）。</span>' +
      '</div></div></div>';
  } else if (canWithdraw && !canUnitAudit) {
    /* 单位审核人视角：已通过单位审核、等待局级复核，仅可撤回到草稿 */
    actionBar = '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body dsc-flex dsc-flex--center dsc-gap-md">' +
      '<span class="dsc-field-tip">该记录已通过单位审核，等待局级复核（' + esc(REVIEW_ASSIGN[ds]) + '）。</span>' +
      '<button class="dsc-btn dsc-btn--default" onclick="withdrawToDraft()">撤回到草稿</button></div></div>';
  }

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title" style="font-size:var(--font-size-lg);">' + unitName(unitId) + ' · ' + ds + ' ' + esc(DATASETS[ds].name) + '</div>' +
    '  <div class="dsc-field-tip">报送期间 2026年上半年 · 提交时间 ' + esc(rec.lastSubmit || '—') + ' · 复核分工：' + esc(REVIEW_ASSIGN[ds]) + '</div></div>' +
    '  <div class="dsc-page-header__actions"><button class="dsc-btn dsc-btn--default" onclick="backReviewList()">← 返回列表</button></div>' +
    '</div>' +

    /* 状态与校验结果摘要 */
    '<div class="dsc-stat-row">' +
    statCard('当前状态', '<span class="dsc-tag ' + STATUS_TAG_CLASS[rec.status] + '" style="font-size:var(--font-size-base);">' + rec.status + '</span>', '', rec.unitAudited ? '单位审核已通过' : (rec.status === '已提交' ? '待单位审核' : '')) +
    statCard('校验结果', '<span class="dsc-text-success">全部通过</span>', 'dsc-stat-card__value--success', '格式→枚举→查重→勾稽 18 条规则') +
    statCard('数据量', rec.zero ? '零报告' : (DATASETS[ds].mode === 'form' ? '1 条记录' : (rec.rows ? rec.rows.length : 0) + ' 条明细'), '') +
    (rec.rejectReason ? statCard('退回原因', '<span class="dsc-text-danger" style="font-size:var(--font-size-base);white-space:normal;">详见下方</span>', 'dsc-stat-card__value--danger', '退回人 ' + esc(rec.rejectedBy)) : '') +
    '</div>' +

    (rec.rejectReason ? '<div class="dsc-alert dsc-alert--danger dsc-mt-md">退回原因：' + esc(rec.rejectReason) + '<br><span style="font-size:var(--font-size-sm);">退回人：' + esc(rec.rejectedBy) + ' · ' + esc(rec.rejectedTime) + '</span></div>' : '') +
    '<div class="dsc-mt-md"></div>' +
    detailHTML + actionBar +
    '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
    '<div class="dsc-card__title" style="margin-bottom:var(--space-md);">审计轨迹（操作人 / 时间 / 动作 / 前后值）</div>' +
    '<ul class="dsc-audit-log">' + buildAuditTrail(unitId, ds, rec) + '</ul></div></div>';
}

/* 表单类明细（复核视角，只读） */
function renderReviewFormDetail(ds, rec) {
  const calc = FORM_CALCS[ds](rec.values || {});
  const sections = FORM_SECTION_DEFS[ds].map(sec => {
    const fields = sec.fields.map(f => {
      const val = f.type === 'calc' ? calc[f.key] : (rec.values || {})[f.key];
      const shown = f.type !== 'calc' && f.unit === '元' ? fmtMoney(val) : (f.unit === '%' ? val : (f.unit === 'm³' || f.unit === 't' || f.unit === 'm²' ? fmtQty(val) : val));
      return '<div class="dsc-kv__item"><div class="dsc-kv__label">' + esc(f.label) + (f.unit ? '（' + esc(f.unit) + '）' : '') + (f.type === 'calc' ? ' <span style="color:var(--color-primary);">计算</span>' : '') + '</div><div class="dsc-kv__value' + (f.type === 'calc' ? ' dsc-kv__value--primary' : '') + '">' + esc(shown === undefined || shown === '' ? '/' : shown) + '</div></div>';
    }).join('');
    return '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>' + esc(sec.title) + '</span></div><div class="dsc-form-section__body">' + fields + '</div></div>';
  }).join('');
  return sections;
}

/* 明细行类明细 */
function renderReviewRowsDetail(ds, rec) {
  const cols = ROWS_COLUMNS[ds];
  const showCols = ROWS_TABLE_COLS[ds];
  const rows = rec.rows || [];
  const thead = '<tr>' + showCols.map(k => {
    const c = cols.find(x => x.key === k);
    return '<th>' + esc(c.label) + '</th>';
  }).join('') + '</tr>';
  const tbody = rows.map((r, i) => {
    const tds = showCols.map(k => {
      const c = cols.find(x => x.key === k);
      let v;
      if (k === 'seq') v = i + 1;
      else if (c.calc && ds === 'D4') v = workYears(r[c.key === 'workYears' ? 'workStart' : c.key === 'joinYears' ? 'joinStart' : 'dutyStart'], '2026/09/25');
      else if (c.calc && ds === 'D6' && k === 'banEnd') v = r.banStart && r.banMonths ? fmtDate(banEndDate(r.banStart, r.banMonths)) : '/';
      else if (k === 'countries') v = (r[k] || []).join('、');
      else v = r[k] === undefined || r[k] === null || r[k] === '' ? '/' : (c.check ? (r[k] ? '√' : '—') : esc(String(r[k])));
      return '<td>' + v + '</td>';
    }).join('');
    return '<tr>' + tds + '</tr>';
  }).join('');
  return '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead>' + thead + '</thead><tbody>' + (tbody || '<tr><td colspan="' + showCols.length + '">无明细（零报告）</td></tr>') + '</tbody></table></div>';
}

/* 审计轨迹 */
function buildAuditTrail(unitId, ds, rec) {
  if (unitId === 'U01' && ds === 'D1') {
    return AUDIT_LOGS_U01_D1.map(l => auditItem(l.time, l.operator, l.action, l.detail)).join('');
  }
  const items = [];
  if (rec.lastSubmit) items.push(auditItem(rec.lastSubmit, unitName(unitId) + '·填报人', '提交填报单', ds + ' ' + DATASETS[ds].name + '提交，四级校验全部通过（IP 10.8.' + (unitId.slice(1) * 3 % 250) + '.12）'));
  if (rec.unitAudited) items.push(auditItem(rec.unitAuditTime, rec.unitAuditBy, '单位审核通过', '审核通过后数据锁定，提交局级复核'));
  if (rec.passedBy) items.push(auditItem(rec.passedTime, rec.passedBy + '（局级复核）', '局级复核通过', '复核通过，数据纳入汇总'));
  if (rec.rejectedBy) items.push(auditItem(rec.rejectedTime, rec.rejectedBy + '（局级）', '退回', '退回原因：' + rec.rejectReason));
  return items.join('') || '<li class="dsc-audit-log__item"><span class="dsc-audit-log__detail">暂无操作记录</span></li>';
}
function auditItem(time, operator, action, detail) {
  return '<li class="dsc-audit-log__item">' +
    '<span class="dsc-audit-log__time">' + esc(time) + '</span>' +
    '<span class="dsc-audit-log__action"><strong>' + esc(action) + '</strong><br><span style="color:var(--color-text-tertiary);">' + esc(operator) + '</span></span>' +
    '<span class="dsc-audit-log__detail">' + esc(detail) + '</span></li>';
}

/* ---------- 审核动作 ---------- */
function passReview() {
  const unitId = ReviewState.unitId, ds = ReviewState.dataset;
  const rec = getFill('T-2026H1', unitId, ds);
  const now = '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  if (AppState.role.id === 'auditor') {
    rec.unitAudited = true;
    rec.unitAuditBy = '陈国强（海外公司·审核人）';
    rec.unitAuditTime = now;
    toast('单位审核通过：数据锁定，已流转至局级复核（' + REVIEW_ASSIGN[ds] + '）', 'success');
  } else {
    rec.status = '已通过';
    rec.passedBy = AppState.role.id === 'admin' ? '王建国' : '李秀芳';
    rec.passedTime = now;
    toast('局级复核通过：数据锁定并纳入汇总', 'success');
  }
  ReviewState.view = 'list';
  renderPage('review');
}

function openRejectModal() {
  const unitId = ReviewState.unitId, ds = ReviewState.dataset;
  const reason = document.getElementById('rejectReason');
  openModal('退回 · ' + unitName(unitId) + ' ' + ds + ' ' + esc(DATASETS[ds].name),
    '<div class="dsc-alert dsc-alert--warning">退回后填报人需按退回原因修改后重新提交；退回操作与原因将写入审计轨迹（退回必填原因）。</div>' +
    '<div class="dsc-form-group dsc-mt-md"><label class="dsc-form-label dsc-form-label--required">退回原因</label>' +
    '<textarea class="dsc-textarea" id="rejectReason" rows="4" placeholder="请填写具体退回原因，如：勾稽偏差超阈值（±1 元），请核对××字段后重新提交"></textarea></div>' +
    '<div class="dsc-field-tip">支持按数据集整单退回；如存在勾稽尾差确需放行，请复核环节书面确认放行并留痕（业务规则：尾差放行）。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--danger" onclick="doReject()">确认退回</button>');
}
function doReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { toast('退回原因必填', 'warning'); return; }
  const unitId = ReviewState.unitId, ds = ReviewState.dataset;
  const rec = getFill('T-2026H1', unitId, ds);
  rec.status = '已退回';
  rec.rejectReason = reason;
  rec.rejectedBy = AppState.role.id === 'auditor' ? '陈国强（海外公司·审核人）' : (AppState.role.id === 'admin' ? '王建国' : '李秀芳');
  rec.rejectedTime = '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  rec.unitAudited = false;
  closeModal();
  toast('已退回并通知填报人（站内信 + 待办），全程留痕', 'success');
  ReviewState.view = 'list';
  renderPage('review');
}

function withdrawToDraft() {
  const unitId = ReviewState.unitId, ds = ReviewState.dataset;
  openModal('撤回到草稿确认',
    '<div class="dsc-alert dsc-alert--warning">撤回后该数据集回到「填报中」状态，填报人可修改数据并重新提交。撤回操作留痕。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doWithdraw()">确认撤回</button>');
}
function doWithdraw() {
  const rec = getFill('T-2026H1', ReviewState.unitId, ReviewState.dataset);
  rec.status = '填报中';
  rec.unitAudited = false;
  closeModal();
  toast('已撤回到草稿，通知填报人继续修改', 'success');
  ReviewState.view = 'list';
  renderPage('review');
}
