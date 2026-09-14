/* ============================================================
   ZY-HY-TB-020/030 数据填报 + 数据校验与勾稽
   D1~D3 单记录表单模式 / D4~D6 明细行模式
   四级校验：格式(V-F) → 枚举(V-E) → 查重(V-C) → 勾稽(V-G) + 容错(V-T)
   ============================================================ */

const FillState = {
  dataset: 'D1',        // 当前页签数据集
  validateResult: null,  // 最近一次校验结果 { errors:[], warnings:[] }
  submitTarget: null
};

const FILL_UNIT = 'U01';   // 演示：当前填报单位为海外公司
const FILL_TASK = 'T-2026H1';

/* 各数据集可选填列 */
const OPTIONAL_COLS = {
  D4: ['cert1', 'cert2', 'certOther', 'history', 'mainJob'],
  D5: ['email', 'inspector', 'advDesc', 'hq', 'center'],
  D6: ['email', 'inTime', 'hq', 'note']
};
/* 明细行列表显示列（其余列进入编辑弹窗） */
const ROWS_TABLE_COLS = {
  D4: ['seq', 'dept', 'project', 'name', 'empNo', 'gender', 'age', 'education', 'workStart', 'workYears', 'joinStart', 'joinYears', 'dutyStart', 'dutyYears', 'post', 'fullTime', 'phone'],
  D5: ['seq', 'type', 'name', 'region', 'contact', 'phone', 'inTime', 'category', 'rating', 'countries'],
  D6: ['seq', 'type', 'name', 'region', 'contact', 'category', 'badDesc', 'banStart', 'banMonths', 'banEnd', 'cross']
};

VIEWS['my-fill'] = {
  render() { return renderFillPage(); },
  init() { bindFormLiveCalc(); }
};

function currentFillRec() {
  const ds = FillState.dataset;
  return getFill(FILL_TASK, FILL_UNIT, ds);
}

/* ============================================================
   页面骨架：任务带 + 数据集页签 + 内容区
   ============================================================ */
function renderFillPage() {
  const t = getTask(FILL_TASK);
  const dl = daysLeft(t.deadline);
  const all = DATASET_ORDER.map(d => getFill(FILL_TASK, FILL_UNIT, d));
  const passedCount = all.filter(r => r && r.status === '已通过').length;

  const tabs = DATASET_ORDER.map(d => {
    const rec = getFill(FILL_TASK, FILL_UNIT, d);
    const st = rec ? rec.status : '未开始';
    return '<div class="dsc-dtab' + (FillState.dataset === d ? ' dsc-dtab--active' : '') + '" onclick="switchFillTab(\'' + d + '\')">' +
      '<span class="dsc-dtab__code">' + d + '</span><span>' + esc(DATASETS[d].name.replace(/（.*）/, '')) + '</span>' +
      statusTag(st) + '</div>';
  }).join('');

  return '' +
    '<div class="dsc-card"><div class="dsc-card__body">' +
    '  <div class="dsc-flex dsc-flex--between dsc-flex--center dsc-gap-lg" style="flex-wrap:wrap;">' +
    '    <div>' +
    '      <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);">' + esc(t.name) + '</div>' +
    '      <div class="dsc-field-tip">' + esc(t.period) + ' · ' + esc(t.unitScope) + ' · 填报单位：' + unitName(FILL_UNIT) +
    '       · 数据齐套进度 ' + passedCount + '/6</div>' +
    '    </div>' +
    '    <div style="text-align:right;">' +
    '      <div style="font-weight:var(--font-weight-medium);">截止时间 ' + esc(t.deadline) + '</div>' +
    '      <div class="' + (dl <= 3 ? 'dsc-text-danger' : 'dsc-text-tertiary') + '" style="font-size:var(--font-size-sm);">' +
    (dl >= 0 ? '剩 ' + dl + ' 天（临近 3 天内红色提示）' : '已逾期 ' + (-dl) + ' 天') + '</div>' +
    '    </div>' +
    '  </div>' +
    '</div></div>' +

    '<div class="dsc-dtabs dsc-mt-md">' + tabs + '</div>' +
    renderDatasetContent();
}

function switchFillTab(ds) {
  FillState.dataset = ds;
  FillState.validateResult = null;
  renderPage('my-fill');
}

/* ============================================================
   数据集内容区
   ============================================================ */
function renderDatasetContent() {
  const ds = FillState.dataset;
  const rec = currentFillRec();
  const st = rec ? rec.status : '未开始';
  const locked = (st === '已提交' || st === '已通过');
  const showBanner = {
    '已提交': '<div class="dsc-alert dsc-alert--info">已提交，等待本单位审核人审核（数据已锁定，仅审核人可发起撤回到草稿）。</div>',
    '已通过': '<div class="dsc-alert dsc-alert--success">已通过局级复核，数据锁定并纳入汇总。历史期数据如需更正，由报送管理员发起数据更正流程并留痕。</div>',
    '已退回': '<div class="dsc-alert dsc-alert--danger">已退回：' + esc(rec.rejectReason) + '<br><span style="font-size:var(--font-size-sm);">退回人：' + esc(rec.rejectedBy) + ' · ' + esc(rec.rejectedTime) + '。请修改后重新提交，全程留痕。</span></div>'
  }[st] || '';

  const zero = rec && rec.zero;
  const zeroBox = locked ? '' :
    '<label class="dsc-check" style="margin-left:auto;"><input type="checkbox" id="zeroReportChk"' + (zero ? ' checked' : '') + ' onchange="toggleZeroReport(this)">' +
    '<span class="dsc-check__box"></span>本期无数据（零报告提交，计入齐套统计）</label>';

  /* 校验结果面板（提交失败后展示，定位到字段/行） */
  let validatePanel = '';
  if (FillState.validateResult && FillState.validateResult.errors.length) {
    const errs = FillState.validateResult.errors.map((e, i) =>
      '<li class="dsc-validate-item">' +
      '<span class="dsc-validate-item__rule">' + esc(e.rule) + '</span>' +
      '<div><span class="dsc-validate-item__loc">' + esc(e.loc) + '</span> ' + esc(e.msg) + '</div>' +
      (e.fixFn ? '<button class="dsc-btn dsc-btn--sm dsc-btn--primary dsc-validate-item__fix" onclick="' + e.fixFn + '">定位修改</button>' : '') +
      '</li>').join('');
    validatePanel = '<div class="dsc-validate-panel">' +
      '<div class="dsc-validate-panel__head"><span class="dsc-tag dsc-tag--danger">校验未通过</span>' +
      '共 ' + FillState.validateResult.errors.length + ' 项失败，已阻断提交（按 格式→枚举→查重→勾稽 顺序执行）</div>' +
      '<ul class="dsc-validate-list">' + errs + '</ul></div>';
  }

  const body = zero
    ? '<div class="dsc-zero-report"><div class="dsc-empty__icon" style="font-size:32px;">∅</div>' +
      '<div><div style="font-weight:var(--font-weight-medium);">本期无数据</div>' +
      '<div class="dsc-field-tip">该数据集本期无业务，将以零报告形式提交并计入齐套统计（验收标准 A9）。直接点击「提交」完成零报告。</div></div></div>'
    : (DATASETS[ds].mode === 'form' ? renderFormDataset(ds, locked) : renderRowsDataset(ds, locked));

  return validatePanel + showBanner +
    '<div class="dsc-row-toolbar">' +
    (locked
      ? '<span class="dsc-tag dsc-tag--default">只读</span>' +
        '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="exportDetail()">导出明细</button>' +
        '<span class="dsc-row-toolbar__count">状态：' + st + ' · 数据集 ' + ds + '</span>'
      : '<button class="dsc-btn dsc-btn--default" onclick="saveDraft()">保存草稿</button>' +
        '<button class="dsc-btn dsc-btn--primary" onclick="submitFill()">提交</button>' +
        '<button class="dsc-btn dsc-btn--default" onclick="downloadTemplate()">下载模板</button>' +
        (DATASETS[ds].mode === 'rows' ? '<button class="dsc-btn dsc-btn--default" onclick="openImportModal()">批量导入</button>' : '') +
        '<button class="dsc-btn dsc-btn--default" onclick="exportDetail()">导出明细</button>' +
        '<span class="dsc-row-toolbar__count">' + esc(DATASETS[ds].desc) + '</span>') +
    zeroBox +
    '</div>' + body;
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
  toast('已下载「' + FillState.dataset + ' ' + DATASETS[FillState.dataset].name + '」导入模板（由指标字典自动生成，与线上口径强一致）', 'success');
}
function exportDetail() {
  toast('已导出填报明细 Excel（表样兼容现行《海外供应链体系报表》）', 'success');
}
function saveDraft() {
  const rec = currentFillRec();
  if (rec.status === '未开始' || !rec.status) rec.status = '填报中';
  toast('草稿已暂存，可随时继续填报', 'success');
}

/* ============================================================
   表单模式（D1~D3）：计算字段置灰 + 实时计算
   ============================================================ */
const FORM_SECTION_DEFS = { D1: D1_SECTIONS, D2: D2_SECTIONS, D3: D3_SECTIONS };
/* 惰性引用 app.js 计算引擎（避免加载顺序依赖） */
const FORM_CALCS = { D1: v => calcD1(v), D2: v => calcD2(v), D3: v => calcD3(v) };

function renderFormDataset(ds, locked) {
  const rec = currentFillRec();
  const values = rec.values || {};
  const calc = FORM_CALCS[ds](values);

  const sections = FORM_SECTION_DEFS[ds].map(sec => {
    const fields = sec.fields.map(f => {
      const val = f.type === 'calc' ? calc[f.key] : values[f.key];
      return renderSectionField(f, val, f.type === 'calc' ? calc[f.key] : undefined, null, locked);
    }).join('');
    return '<div class="dsc-form-section' + (sec.calcOnly ? ' dsc-form-section--calc' : '') + (locked ? ' dsc-check--disabled' : '') + '">' +
      '<div class="dsc-form-section__head"><span>' + esc(sec.title) + '</span>' +
      (sec.calcOnly ? '<span class="dsc-form-section__tag">合计与率类全部系统计算，不开放录入</span>' : '') + '</div>' +
      '<div class="dsc-form-section__body' + (sec.fields.length > 6 ? '' : '') + '">' + fields + '</div></div>';
  }).join('');

  return sections +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">填报人及联系方式</label>' +
    '<input class="dsc-input" value="张伟 · 13800138001" ' + (locked ? 'disabled' : '') + '></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label">备注</label>' +
    '<input class="dsc-input" placeholder="口径特殊说明" ' + (locked ? 'disabled' : '') + '></div></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">金额单位：元，保留 2 位小数；数量保留 3 位小数；率类字段系统计算，分母为 0 时显示"/"（V-T01 容错）。</div>';
}

/* 实时计算绑定 */
function bindFormLiveCalc() {
  if (DATASETS[FillState.dataset].mode !== 'form') return;
  const rec = currentFillRec();
  if (!rec) return;
  if (rec.status === '已提交' || rec.status === '已通过') return; // 只读不绑定
  document.querySelectorAll('[data-fill-field]').forEach(input => {
    input.addEventListener('input', () => {
      const values = collectFormValues();
      const calc = FORM_CALCS[FillState.dataset](values);
      Object.keys(calc).forEach(k => {
        const el = document.querySelector('[data-calc-field="' + k + '"]');
        if (el) el.value = calc[k];
      });
    });
  });
}

function collectFormValues() {
  const values = {};
  document.querySelectorAll('[data-fill-field]').forEach(el => {
    values[el.dataset.fillField] = Number(el.value === '' ? NaN : el.value);
  });
  return values;
}

/* ============================================================
   明细行模式（D4~D6）
   ============================================================ */
const ROWS_COLUMNS = { D4: D4_COLUMNS, D5: D5_COLUMNS, D6: D6_COLUMNS };

function renderRowsDataset(ds, locked) {
  const rec = currentFillRec();
  const rows = rec.rows || [];
  const cols = ROWS_COLUMNS[ds];
  const showCols = ROWS_TABLE_COLS[ds];

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
  if (ds === 'D5') {
    const tips = [];
    const seen = {};
    UNITS.forEach(u => {
      if (u.id === FILL_UNIT) return;
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
  rows.forEach(r => {
    if (ds === 'D6') {
      const own = getFill(FILL_TASK, FILL_UNIT, 'D5');
      const inOwn = (own.rows || []).some(x => x.name === r.name && x.region === r.region);
      if (inOwn) d5Names[r.id] = true;
    }
  });

  const thead = '<tr>' + showCols.map(k => {
    const c = cols.find(x => x.key === k);
    const w = c.width ? ' style="min-width:' + c.width + '"' : (k === 'seq' ? ' style="min-width:48px"' : '');
    return '<th' + w + '>' + esc(c.label) + (c.calc ? ' <span style="color:var(--color-primary);font-size:11px;">计算</span>' : '') + '</th>';
  }).join('') + '<th style="min-width:120px;">操作</th></tr>';

  const tbody = rows.map((r, i) => {
    const isDup = dupIds[r.id];
    const tds = showCols.map(k => {
      const c = cols.find(x => x.key === k);
      let v = '';
      if (k === 'seq') v = i + 1;
      else if (c.calc && ds === 'D4') v = workYears(r[c.key === 'workYears' ? 'workStart' : c.key === 'joinYears' ? 'joinStart' : 'dutyStart'], getTask(FILL_TASK).deadline);
      else if (c.calc && ds === 'D6' && k === 'banEnd') v = r.banStart && r.banMonths ? fmtDate(banEndDate(r.banStart, r.banMonths)) : '/';
      else if (k === 'countries') v = (r[k] || []).join('、');
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

  return crossUnitTips +
    '<div class="dsc-row-toolbar">' +
    (locked ? '' :
      '<button class="dsc-btn dsc-btn--primary dsc-btn--sm" onclick="openRowEditor(null)">+ 新增行</button>' +
      '<span class="dsc-row-toolbar__count">共 ' + rows.length + ' 条明细（草稿与已退回状态可增删改；支持复制行用于同地区多供应商录入）</span>') +
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

  const fieldHTML = cols.filter(c => c.edit || c.check).map(c => {
    if (c.check) {
      return '<div class="dsc-form-group"><label class="dsc-check"><input type="checkbox" id="ef_' + c.key + '"' + (row[c.key] ? ' checked' : '') + '><span class="dsc-check__box"></span>' + esc(c.label) + '</label></div>';
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
    const isLong = c.key === 'history' || c.key === 'advDesc' || c.key === 'badDesc' || c.key === 'note';
    const isMultiLine = isLong;
    return '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">' + esc(c.label) + '</label>' +
      (isMultiLine
        ? '<textarea class="dsc-textarea" id="ef_' + c.key + '" rows="2">' + esc(row[c.key] || '') + '</textarea>'
        : '<input class="dsc-input" id="ef_' + c.key + '" value="' + esc(row[c.key] === undefined ? '' : row[c.key]) + '" placeholder="">') +
      (c.tip ? '<div class="dsc-field-tip">' + esc(c.tip) + '</div>' : '') + '</div>';
  }).join('');

  openModal((rowId ? '编辑' : '新增') + '明细行 · ' + ds + ' ' + esc(DATASETS[ds].name),
    '<div class="dsc-form-row dsc-form-row--2">' + fieldHTML + '</div>' +
    (ds === 'D4' ? '<div class="dsc-field-tip">三个工作年限由起始时间至报送截止日自动计算取整（V-G06），无需填报。</div>' : '') +
    (ds === 'D6' ? '<div class="dsc-field-tip">禁用到期日由系统按"起始时间+期限"自动计算，到期自动提醒复核；同一供应商不得同时存在于合格库（V-C03 交叉校验）。</div>' : ''),
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="saveRow(\'' + ds + '\',\'' + (rowId || '') + '\',\'' + row.id + '\')">保存</button>');
}

function saveRow(ds, rowId, newId) {
  const rec = currentFillRec();
  const cols = ROWS_COLUMNS[ds];
  const row = rowId ? rec.rows.find(r => r.id === rowId) : { id: newId };
  cols.forEach(c => {
    if (c.check) {
      const el = document.getElementById('ef_' + c.key);
      if (el) row[c.key] = el.checked;
    } else if (c.edit) {
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
  openModal('批量导入 · ' + ds + ' ' + esc(DATASETS[ds].name), body,
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="simulateImport()">模拟导入 20 行数据</button>');
}

function simulateImport() {
  const box = document.getElementById('importResult');
  const fails = [
    { row: 7, rule: 'V-C03', msg: '「迪拜中东建材贸易有限公司（阿联酋·迪拜）」与库内已有有效记录重复（供应商名称+注册地）' },
    { row: 13, rule: 'V-E01', msg: '供应商评级取值"A"不在字典内（字典：A级-推荐使用/B级-建议使用/C级-审慎使用）' },
    { row: 18, rule: 'V-F03', msg: '联系电话格式不正确：62-812-3456' }
  ];
  box.innerHTML = '<div class="dsc-alert dsc-alert--warning dsc-mt-md">导入校验完成：20 行中 17 行通过、3 行失败（整批不入库策略）</div>' +
    '<table class="dsc-table dsc-mt-sm"><thead><tr><th>失败行号</th><th>规则</th><th>失败原因</th></tr></thead><tbody>' +
    fails.map(f => '<tr><td>第 ' + f.row + ' 行</td><td><span class="dsc-tag dsc-tag--danger">' + f.rule + '</span></td><td>' + esc(f.msg) + '</td></tr>').join('') +
    '</tbody></table>' +
    '<div class="dsc-mt-md"><button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="toast(\'失败行已导出为 Excel，修正后可重新上传\',\'success\')">导出失败行修正</button>' +
    '<button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="toast(\'已按配置切换为：仅导入通过校验的行\',\'warning\')">切换：仅导入通过行</button></div>';
  toast('导入校验完成：17 通过 / 3 失败', 'warning');
}

/* ============================================================
   提交与校验（ZY-HY-TB-030）
   顺序：格式(V-F) → 枚举(V-E) → 查重(V-C) → 勾稽(V-G)；V-T 容错不算失败
   ============================================================ */
function submitFill() {
  const ds = FillState.dataset;
  const rec = currentFillRec();
  if (rec.zero) {
    openModal('零报告提交确认',
      '<div class="dsc-alert dsc-alert--info">确认以「本期无数据」零报告形式提交 ' + ds + ' ' + esc(DATASETS[ds].name) + '？零报告计入齐套统计（A9）。</div>',
      '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
      '<button class="dsc-btn dsc-btn--primary" onclick="doSubmitFill()">确认提交</button>');
    return;
  }
  const result = DATASETS[ds].mode === 'form' ? validateForm(ds) : validateRows(ds);
  FillState.validateResult = result;
  if (result.errors.length) {
    renderPage('my-fill');
    toast('校验未通过，已阻断提交：' + result.errors.length + ' 项失败，请按清单修正', 'danger');
    return;
  }
  openModal('提交确认',
    '<div>确认提交 ' + ds + ' ' + esc(DATASETS[ds].name) + '？</div>' +
    '<div class="dsc-alert dsc-alert--success dsc-mt-md">四级校验（格式 → 枚举 → 查重 → 勾稽）共执行 ' + (result.total || 18) + ' 条规则，全部通过。</div>' +
    '<div class="dsc-field-tip">提交后数据锁定，流转至本单位审核人；被退回时按退回原因修改后重新提交，全程留痕。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="doSubmitFill()">确认提交</button>');
}
function doSubmitFill() {
  const rec = currentFillRec();
  rec.status = '已提交';
  rec.lastSubmit = '2026-09-14 ' + new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0');
  FillState.validateResult = null;
  closeModal();
  toast('提交成功：校验全部通过，已流转至本单位审核人审核', 'success');
  renderPage('my-fill');
}

/* ---------- 表单校验 ---------- */
function validateForm(ds) {
  const errors = [];
  const values = collectFormValues();
  FORM_SECTION_DEFS[ds].forEach(sec => {
    sec.fields.forEach(f => {
      if (f.type !== 'number') return;
      const v = values[f.key];
      if (v === undefined || v === null || isNaN(v)) {
        errors.push({ rule: 'V-F01', loc: sec.title + ' · ' + f.label, msg: '必填字段未填写或非数字（金额 2 位小数）',
          fixFn: 'focusFillField(\'' + f.key + '\')' });
      }
    });
  });
  return { errors: errors, warnings: [], total: 18 };
}

function focusFillField(key) {
  closeModal();
  const el = document.querySelector('[data-fill-field="' + key + '"]');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.borderColor = 'var(--color-danger)';
    el.focus();
  }
}

/* ---------- 明细行校验 ---------- */
function validateRows(ds) {
  const errors = [];
  const rec = currentFillRec();
  const rows = rec.rows || [];
  const cols = ROWS_COLUMNS[ds];
  const optional = OPTIONAL_COLS[ds] || [];
  const deadline = getTask(FILL_TASK).deadline.replace(/-/g, '/');

  const label = k => (cols.find(c => c.key === k) || {}).label || k;

  rows.forEach((r, i) => {
    const rowNo = '第 ' + (i + 1) + ' 行';
    /* V-F01 必填 + 数字 */
    cols.forEach(c => {
      if (!c.edit) return;
      if (c.key === 'mainJob') return; // 条件必填单独处理
      if (optional.indexOf(c.key) >= 0) return;
      const v = r[c.key];
      if (v === undefined || v === null || v === '') {
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
    /* V-F02 日期格式 */
    const dateKeys = { D4: ['workStart', 'joinStart', 'dutyStart'], D5: ['inTime'], D6: ['banStart'] }[ds] || [];
    dateKeys.forEach(k => {
      if (optional.indexOf(k) >= 0 && (!r[k] || r[k] === '/')) return;
      if (r[k] && !parseDate(r[k])) {
        errors.push({ rule: 'V-F02', loc: rowNo + ' · ' + label(k), msg: '日期格式应为 yyyy/MM/dd，当前值"' + r[k] + '"', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
    /* V-F03 电话格式 */
    if (ds === 'D4' && r.phone && !/^\+?[\d][\d\s-]{6,}$/.test(r.phone)) {
      errors.push({ rule: 'V-F03', loc: rowNo + ' · 联系电话', msg: '联系电话格式不正确：' + r.phone + '（支持国际号码，如 +20-100-1234567）', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    if ((ds === 'D5' || ds === 'D6') && r.phone && !/^\+?[\d][\d\s-]{6,}$/.test(r.phone)) {
      errors.push({ rule: 'V-F03', loc: rowNo + ' · 联系电话', msg: '联系电话格式不正确：' + r.phone, fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
    /* V-E 枚举 */
    cols.forEach(c => {
      if (!c.edit || !c.enum || c.multi) return;
      const opts = Array.isArray(c.enum) ? c.enum : ENUMS[c.enum] || [];
      if (r[c.key] && opts.indexOf(r[c.key]) < 0) {
        errors.push({ rule: 'V-E01', loc: rowNo + ' · ' + label(c.key), msg: '取值"' + r[c.key] + '"不在字典内（' + opts.join('/') + '），字典外取值无法提交', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
    /* 条件必填：兼职时主职岗位必填 */
    if (ds === 'D4' && r.fullTime === '兼职' && !r.mainJob) {
      errors.push({ rule: 'V-F01', loc: rowNo + ' · 主职岗位', msg: '专职/兼职为"兼职"时主职岗位必填', fixFn: 'openRowEditor(\'' + r.id + '\')' });
    }
  });

  /* V-C02 查重（人员：员工编号+单位；编号空按姓名+三级单位+项目） */
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

  /* V-C03 查重（分供商：供应商名称+注册地） */
  if (ds === 'D5' || ds === 'D6') {
    const seen = {};
    rows.forEach((r, i) => {
      const key = r.name + '|' + r.region;
      if (seen[key] !== undefined) {
        errors.push({ rule: 'V-C03', loc: '第 ' + (i + 1) + ' 行 · ' + r.name,
          msg: '与第 ' + (seen[key] + 1) + ' 行重复（供应商名称+注册地唯一），请删除或修改重复行', fixFn: 'deleteRow(\'' + r.id + '\')' });
      } else { seen[key] = i; }
    });
  }

  /* V-C03 交叉校验（D5 与 D6 之间） */
  if (ds === 'D6') {
    const d5 = getFill(FILL_TASK, FILL_UNIT, 'D5');
    const d5Rows = (d5 && d5.rows) || [];
    rows.forEach((r, i) => {
      if (d5Rows.some(x => x.name === r.name && x.region === r.region)) {
        errors.push({ rule: 'V-C03', loc: '第 ' + (i + 1) + ' 行 · ' + r.name,
          msg: '该供应商同时存在于 D5 合格库有效记录中（交叉提示阻断）：同一供应商不得同时存在于合格库与不合格库，请核实在 D5 中删除或修改本行', fixFn: 'openRowEditor(\'' + r.id + '\')' });
      }
    });
  }

  /* 空行集提示 */
  if (!rows.length) {
    errors.push({ rule: 'V-F01', loc: ds + ' ' + DATASETS[ds].name, msg: '无明细行：请新增/导入明细，或勾选「本期无数据」以零报告提交' });
  }
  return { errors: errors, warnings: [], total: 18 + rows.length * 3 };
}
