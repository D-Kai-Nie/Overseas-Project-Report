/* ============================================================
   ZY-HY-TB-050 汇总统计与报表导出
   金额/数量逐级求和；率类一律用汇总分子/分母重算（禁止对率平均）
   分供商按"供应商名称+注册地"自动去重并保留各单关联
   ============================================================ */

const SummaryState = {
  dataset: 'D1',
  includeSubmitted: false,   // 包含"已提交待复核"数据（部分汇总）
  weekTaskId: 'T-2026W38',   // 周报周度明细区：当前期次（默认最近一个已提交周）
  wTab: 'W1',                // 周报明细子页签 W1~W6
  wFilter: { center: '', fullTime: '' }   // W2 筛选
};

VIEWS['summary'] = {
  render() { return renderSummaryPage(); },
  init() { /* inline handlers */ }
};

/* 参与汇总的单位：默认仅"已通过"；勾选后包含"已提交"（部分汇总） */
function summaryUnits(ds) {
  const base = [], partial = [];
  UNITS.forEach(u => {
    const rec = getFill('T-2026M09', u.id, ds);
    if (!rec) return;
    if (rec.status === '已通过') base.push(u);
    else if (rec.status === '已提交') partial.push(u);
  });
  return SummaryState.includeSubmitted ? base.concat(partial) : base;
}

function renderSummaryPage() {
  const ds = SummaryState.dataset;
  const units = summaryUnits(ds);
  const isCompare = ds === 'CMP';

  const isWeekly = ds === 'WK';
  const week = currentWeek();

  /* PRD 6.1：三个报表区（① 月度汇总区 / ② 周报周度明细区 / ③ 周月对比区） */
  const tabOf = (code, label, short) =>
    '<div class="dsc-dtab' + (ds === code ? ' dsc-dtab--active' : '') + '" onclick="switchSummaryTab(\'' + code + '\')">' +
    '<span class="dsc-dtab__code">' + short + '</span><span>' + label + '</span></div>';
  const tabs = '<span class="dsc-dtabs__group-label">① 月度汇总区</span>' +
    DATASET_ORDER.map(d => tabOf(d, esc(DATASETS[d].name.replace(/（.*）/, '')), d)).join('') +
    '<span class="dsc-dtabs__group-label">② 周报周度明细区</span>' + tabOf('WK', 'W1~W6 周度明细', '周报') +
    '<span class="dsc-dtabs__group-label">③ 周月对比区</span>' + tabOf('CMP', '周报/月报对比', '周月');

  const body = isWeekly ? summaryWeekly()
    : isCompare ? summaryCompare()
    : { D1: summaryD1, D2: summaryD2, D3: summaryD3, D4: summaryD4, D5: summaryD5, D6: summaryD6 }[ds](units);

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title">汇总统计与报表导出</div>' +
    '  <div class="dsc-field-tip">' + (isWeekly
      ? '周报周度明细报表区：W1~W6 按周次展示（表样与现行周报一致），含月内周趋势与覆盖范围标注'
      : isCompare
      ? '周报（周维度）与月报（月维度）同指标对比，含数据来源标注与一致性结论'
      : '报送期间 2026年9月（月度粒度）· 汇总计算 ≤10 秒 · 导出兼容现行周报/月报表样') + '</div></div>' +
    '  <div class="dsc-page-header__actions">' +
    ((isCompare || isWeekly) ? '' : '<label class="dsc-check"><input type="checkbox"' + (SummaryState.includeSubmitted ? ' checked' : '') + ' onchange="toggleIncludeSubmitted(this)"><span class="dsc-check__box"></span>包含已提交待复核数据</label>') +
    (isWeekly ? '' : '    <button class="dsc-btn dsc-btn--primary" onclick="exportSummary()">导出 Excel</button>') +
    '  </div>' +
    '</div>' +

    '<div class="dsc-coverage-note dsc-mb-md"><span>⚠</span>数据覆盖范围：' + (isWeekly
      ? '当前期次 ' + week.period + '（' + week.status + '）；周度明细仅展示已提交/已通过数据，历史周只读'
      : isCompare
      ? '周报来源＝各共享中心 2026年9月第3周（W1~W5）；月报来源＝已通过/已提交单位（D1~D6）；无周报单位（' + WEEKLY_MISSING_UNITS.slice(0, 3).map(id => unitName(id)).join('、') + ' 等）已在月报侧标注"转手工填报"'
      : '已通过 ' + units.length + '/14 家二级单位（部分汇总已显著标注）') +
    '；率类指标为汇总分子/分母重算值，禁止对率直接平均。</div>' +

    '<div class="dsc-dtabs">' + tabs + '</div>' +
    '<div class="dsc-card"><div class="dsc-card__body">' + body + '</div></div>';
}

function switchSummaryTab(ds) { SummaryState.dataset = ds; renderPage('summary'); }

/* ============================================================
   ② 周报周度明细报表区
   期次选择（年度+周次）· W1~W6 六张明细报表 · 月内周趋势 · 覆盖范围标注 · 导出留痕
   ============================================================ */
function currentWeek() {
  return WEEK_PERIODS.find(w => w.taskId === SummaryState.weekTaskId) || WEEK_PERIODS[2];
}
function switchWeekPeriod(taskId) { SummaryState.weekTaskId = taskId; renderPage('summary'); }
function switchWeekTab(w) { SummaryState.wTab = w; renderPage('summary'); }
function applyWeekFilter() {
  SummaryState.wFilter.center = document.getElementById('wfCenter').value;
  SummaryState.wFilter.fullTime = document.getElementById('wfFullTime').value;
  renderPage('summary');
}
function exportWeekReport() {
  toast('已导出 ' + currentWeek().period + ' 周报（表样兼容现行周报 6 张表），导出操作已留痕', 'success');
}
function exportMonthReport() {
  toast('已导出 ' + WEEK_MONTH + ' 月内多周合并报表（含周次列），导出操作已留痕', 'success');
}

/* 周次数据访问：仅取"已提交/已通过"记录 */
function weekRecsOf(store, wCode, useUnits) {
  const subjects = useUnits ? UNITS : SHARED_CENTERS;
  return subjects
    .map(s => ({ sub: s, rec: (store[s.id] || {})[wCode] }))
    .filter(x => weekReportable(x.rec));
}
function weekRowsOf(store, wCode, useUnits) {
  const out = [];
  weekRecsOf(store, wCode, useUnits).forEach(x => {
    (x.rec.rows || []).forEach(r => out.push(Object.assign({ _ownerId: x.sub.id, _owner: x.sub.name }, r)));
  });
  return out;
}

function summaryWeekly() {
  const week = currentWeek();
  const store = WEEKLY_STORE[week.taskId] || {};
  const isFuture = week.status === '未开始';

  /* 期次选择器：年度+月份 / 周次（支持按月展示该月全部周次） */
  const picker = '<div class="dsc-filter-bar dsc-mb-md">' +
    '<div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">年度 / 月份</label>' +
    '<select class="dsc-select" style="width:130px;" onchange="toast(\'演示数据覆盖 2026年9月；10 月周次待生成\',\'warning\')">' +
    '<option>' + WEEK_MONTH + '</option><option>2026年10月</option></select></div>' +
    '<div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">周次</label>' +
    '<select class="dsc-select" style="width:180px;" onchange="switchWeekPeriod(this.value)">' +
    WEEK_PERIODS.map(w => '<option value="' + w.taskId + '"' + (w.taskId === SummaryState.weekTaskId ? ' selected' : '') + '>' +
      w.period + (w.status === '未开始' ? '（未开始）' : '') + '</option>').join('') + '</select>' +
    '<span class="dsc-tag ' + (week.status === '进行中' ? 'dsc-tag--info' : week.status === '未开始' ? 'dsc-tag--default' : 'dsc-tag--success') + '" style="margin-left:var(--space-sm);">' + week.status + '</span></div>' +
    '<div class="dsc-filter-bar__item" style="margin-left:auto;">' +
    '<button class="dsc-btn dsc-btn--default" onclick="exportWeekReport()">导出本周（周报表样）</button>' +
    '<button class="dsc-btn dsc-btn--default" onclick="exportMonthReport()">月内多周合并导出</button>' +
    '</div></div>';

  if (isFuture) {
    return picker +
      '<div class="dsc-empty" style="padding:var(--space-xxl) 0;"><div class="dsc-empty__icon">🗓️</div>' +
      '<div class="dsc-empty__text">' + week.period + ' 尚未开始（每周五 17:00 截止）</div>' +
      '</div>' +
      renderWeekTrend();
  }

  /* 覆盖范围标注 */
  const reported15 = weekRecsOf(store, 'W1', false);
  const missing15 = SHARED_CENTERS.filter(sc => reported15.every(x => x.sub.id !== sc.id));
  const w6Units = weekRecsOf(store, 'W6', true);
  const coverage = '<div class="dsc-coverage-note dsc-mb-md"><span>⚠</span>数据覆盖范围（' + week.period + '）：' +
    'W1~W5 应报 ' + SHARED_CENTERS.length + ' 个主体、已报 ' + reported15.length + ' 个' +
    (missing15.length ? '（未提交：' + missing15.map(s => s.name).join('、') + '）' : '') +
    '；W6 应报 ' + UNITS.length + ' 家二级单位、已报 ' + w6Units.length + ' 家。仅展示已提交/已通过数据，历史周只读。</div>';

  const wTabs = '<div class="dsc-dtabs">' + W_DATASET_ORDER.map(w =>
    '<div class="dsc-dtab' + (SummaryState.wTab === w ? ' dsc-dtab--active' : '') + '" onclick="switchWeekTab(\'' + w + '\')">' +
    '<span class="dsc-dtab__code">' + w + '</span><span>' + esc(W_DATASETS[w].name) + '</span></div>').join('') + '</div>';

  const body = {
    W1: weekReportW1, W2: weekReportW2, W3: weekReportW3,
    W4: weekReportW4, W5: weekReportW5, W6: weekReportW6
  }[SummaryState.wTab](store, week);

  return picker + coverage + wTabs + '<div class="dsc-card"><div class="dsc-card__body">' + body + '</div></div>' + renderWeekTrend();
}

/* ---------- W1 汇总表：数值求和、率类重算、文本类逐条列示 ---------- */
function weekReportW1(store, week) {
  const recs = weekRecsOf(store, 'W1', false);
  const numKeys = ['projCount', 'catPlanCount', 'catStarted', 'catDone', 'doneCoverProj'];
  const labels = ['在建项目数量', '年度集采品类个数', '已发起集采品类个数', '已完成集采品类个数', '已完成品类覆盖项目数'];
  const T = { saveAmount: 0, jcAmountSum: 0 };
  numKeys.forEach(k => { T[k] = 0; });
  recs.forEach(x => {
    const v = x.rec.values || {};
    numKeys.forEach(k => { T[k] += Number(v[k]) || 0; });
    T.saveAmount += Number(v.saveAmount) || 0;
    T.jcAmountSum += Number(v.jcAmountSum) || 0;
  });
  const rows = recs.map(x => {
    const v = x.rec.values || {};
    return '<tr><td>' + x.sub.name + '</td>' +
      numKeys.map(k => '<td class="dsc-sum-table__num">' + (Number(v[k]) || 0) + '</td>').join('') +
      '<td class="dsc-sum-table__num">' + fmtMoney(v.saveAmount) + '</td>' +
      '<td class="dsc-sum-table__num">' + fmtMoney(v.jcAmountSum) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.saveAmount, v.jcAmountSum) + '</td></tr>';
  }).join('');
  const total = '<tr class="dsc-sum-table__total"><td>合计（' + recs.length + ' 个主体）</td>' +
    numKeys.map(k => '<td class="dsc-sum-table__num">' + T[k] + '</td>').join('') +
    '<td class="dsc-sum-table__num">' + fmtMoney(T.saveAmount) + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(T.jcAmountSum) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.saveAmount, T.jcAmountSum) + '</td></tr>';

  const texts = recs.map(x => {
    const v = x.rec.values || {};
    return '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>' + esc(x.sub.name) + ' · 周工作总结</span>' +
      '<span class="dsc-form-section__tag">文本类不汇总、逐条列示</span></div>' +
      '<div class="dsc-form-section__body" style="display:block;">' + esc(v.weekSummary || '—') +
      '<div class="dsc-field-tip dsc-mt-sm">重点项目采购与长周期设备情况：' + esc(v.keyProject || '—') + '</div></div></div>';
  }).join('');

  return '<div class="dsc-card__title dsc-mb-md">W1 共享中心/区域总部汇总表 · ' + week.period + '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table dsc-sum-table" style="white-space:nowrap;">' +
    '<thead><tr><th>填报主体</th>' + labels.map(l => '<th class="dsc-sum-table__num">' + l + '</th>').join('') +
    '<th class="dsc-sum-table__num">采购成本降低额（元）</th><th class="dsc-sum-table__num">集采金额合计（元）</th><th class="dsc-sum-table__num">采购成本降低率</th></tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="9">本周暂无已提交数据</td></tr>') + total + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">跨主体合计：数值类求和；率类按分子/分母重算（如降低率 = Σ降低额 ÷ Σ集采金额），禁止对率平均。</div>' +
    '<div class="dsc-mt-lg">' + texts + '</div>';
}

/* ---------- W2 人员配备：明细 + 筛选 + 小计 ---------- */
function weekReportW2(store, week) {
  const all = weekRowsOf(store, 'W2', false);
  const f = SummaryState.wFilter;
  const rows = all.filter(r => (!f.center || r._owner === f.center) && (!f.fullTime || r.fullTime === f.fullTime));
  const centerSel = '<select class="dsc-select" id="wfCenter" style="width:160px;"><option value="">全部共享中心</option>' +
    SHARED_CENTERS.map(s => '<option value="' + esc(s.name) + '"' + (f.center === s.name ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('') + '</select>';
  const ftSel = '<select class="dsc-select" id="wfFullTime" style="width:130px;"><option value="">专职/兼职</option>' +
    ['专职', '兼职'].map(x => '<option value="' + x + '"' + (f.fullTime === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select>';

  const byCenter = {};
  rows.forEach(r => { byCenter[r._owner] = (byCenter[r._owner] || 0) + 1; });
  const ftCount = { '专职': 0, '兼职': 0 };
  rows.forEach(r => { ftCount[r.fullTime] = (ftCount[r.fullTime] || 0) + 1; });

  const list = rows.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(r._owner) + '</td><td>' + esc(r.name) + '</td>' +
    '<td>' + esc(r.unitName) + '</td><td>' + esc(r.position) + '</td>' +
    '<td>' + (r.fullTime === '专职' ? '<span class="dsc-tag dsc-tag--success">专职</span>' : '<span class="dsc-tag dsc-tag--warning">兼职</span>') + '</td></tr>').join('');

  return '<div class="dsc-card__title dsc-mb-md">W2 人员配备表 · ' + week.period + '</div>' +
    '<div class="dsc-filter-bar dsc-mb-md">' +
    '<div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">共享中心</label>' + centerSel + '</div>' +
    '<div class="dsc-filter-bar__item"><label class="dsc-filter-bar__label">专职/兼职</label>' + ftSel + '</div>' +
    '<div class="dsc-filter-bar__item"><button class="dsc-btn dsc-btn--primary" onclick="applyWeekFilter()">查询</button></div>' +
    '<div class="dsc-filter-bar__item dsc-text-tertiary dsc-font-sm">共 ' + rows.length + ' 人</div></div>' +
    '<div class="dsc-stat-row dsc-mb-md">' +
    Object.keys(byCenter).map(k => statCard(k, byCenter[k] + ' 人', '', '小计')).join('') +
    statCard('专职 / 兼职', ftCount['专职'] + ' / ' + ftCount['兼职'], 'dsc-stat-card__value--primary', '按用工性质小计') +
    '</div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>序号</th><th>共享中心</th><th>姓名</th><th>所在单位</th><th>职务</th><th>是否专职</th></tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="6">无符合条件数据</td></tr>') + '</tbody></table></div>';
}

/* ---------- W3 集采跟踪：明细 + 统计汇总 ---------- */
function weekReportW3(store, week) {
  const all = weekRowsOf(store, 'W3', false);
  const DONE = ['定标', '合同签订', '执行中'];
  const statOf = rs => ({
    start: rs.length,
    done: rs.filter(r => DONE.indexOf(r.stage) >= 0).length,
    save: rs.reduce((s, r) => s + (Number(r.saveAmount) || 0), 0),
    overdue: rs.filter(r => r.overdue === '是').length,
    first: rs.filter(r => r.firstResource === '是').length
  });
  const levels = ['局级集采', '公司级集采', '区域集采'];
  const statRows = levels.map(lv => {
    const rs = all.filter(r => r.level === lv);
    const st = statOf(rs);
    return '<tr><td>' + lv + '</td><td class="dsc-sum-table__num">' + st.start + '</td><td class="dsc-sum-table__num">' + st.done + '</td>' +
      '<td class="dsc-sum-table__num">' + fmtMoney(st.save) + '</td><td class="dsc-sum-table__num">' + st.overdue + '</td><td class="dsc-sum-table__num">' + st.first + '</td></tr>';
  }).join('');
  const T = statOf(all);
  const totalRow = '<tr class="dsc-sum-table__total"><td>合计</td><td class="dsc-sum-table__num">' + T.start + '</td><td class="dsc-sum-table__num">' + T.done + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(T.save) + '</td><td class="dsc-sum-table__num">' + T.overdue + '</td><td class="dsc-sum-table__num">' + T.first + '</td></tr>';

  const cols = W3_COLUMNS.filter(c => ['seq', 'category', 'level', 'leadUnit', 'owner', 'unit', 'amount', 'saveAmount', 'stage', 'progress', 'overdue', 'firstResource'].indexOf(c.key) >= 0);
  const detail = all.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td>' +
    cols.filter(c => c.key !== 'seq').map(c => {
      if (c.key === 'amount' || c.key === 'saveAmount') return '<td class="dsc-sum-table__num">' + fmtMoney(r[c.key]) + '</td>';
      if (c.key === 'overdue') return '<td>' + (r.overdue === '是' ? '<span class="dsc-tag dsc-tag--danger">超期</span>' : '<span class="dsc-tag dsc-tag--success">正常</span>') + '</td>';
      if (c.key === 'firstResource') return '<td>' + (r.firstResource === '是' ? '<span class="dsc-tag dsc-tag--warning">是</span>' : '否') + '</td>';
      return '<td>' + esc(r[c.key] === undefined || r[c.key] === '' ? '/' : r[c.key]) + '</td>';
    }).join('') + '</tr>').join('');

  return '<div class="dsc-card__title dsc-mb-md">W3 集采跟踪表 · ' + week.period + '（明细 ' + all.length + ' 项，表样含 21 字段，此处展示核心列）</div>' +
    '<div class="dsc-table-wrapper dsc-mb-md"><table class="dsc-table dsc-sum-table"><thead><tr><th>集采层级</th><th class="dsc-sum-table__num">发起数</th><th class="dsc-sum-table__num">完成数</th><th class="dsc-sum-table__num">预计降本额合计（元）</th><th class="dsc-sum-table__num">超期项数（>50天）</th><th class="dsc-sum-table__num">首次资源配置项数</th></tr></thead>' +
    '<tbody>' + statRows + totalRow + '</tbody></table></div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th>' + cols.filter(c => c.key !== 'seq').map(c => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead>' +
    '<tbody>' + (detail || '<tr><td colspan="12">本周暂无已提交数据</td></tr>') + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">完成数口径：当前阶段为定标/合同签订/执行中；超期按招采发起时间 >50 天判定。</div>';
}

/* ---------- W4 分供方资源库：明细（脱敏）+ 分布统计 ---------- */
function weekReportW4(store, week) {
  const all = weekRowsOf(store, 'W4', false);
  const maskContact = n => (!n ? '/' : String(n).charAt(0) + '*'.repeat(Math.max(1, String(n).length - 1)));
  /* 电话脱敏：保留国家码/区号段，其余号码段整体掩码（如 +971-4-885-2121 → +971-4-***-****） */
  const maskPhone = p => {
    if (!p) return '/';
    const str = String(p);
    const parts = str.split('-');
    if (parts.length >= 3) {
      return parts.slice(0, 2).join('-') + '-' + parts.slice(2).map(x => '*'.repeat(Math.max(1, x.length))).join('-');
    }
    return str.length > 6 ? str.slice(0, 3) + '*'.repeat(str.length - 5) + str.slice(-2) : '*'.repeat(str.length);
  };
  const maskEmail = e => {
    if (!e || e === '/') return '/';
    const parts = String(e).split('@');
    return parts[0].charAt(0) + '***@' + (parts[1] || '');
  };
  const dist = (fn) => {
    const m = {};
    all.forEach(r => { const k = fn(r); if (k) m[k] = (m[k] || 0) + 1; });
    return m;
  };
  const bar = (m, total) => Object.keys(m).sort((a, b) => m[b] - m[a]).map(k =>
    '<div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:6px;">' +
    '<span style="width:150px;color:var(--color-text-secondary);">' + esc(k) + '</span>' +
    '<div style="flex:1;height:10px;background:#F0F2F5;border-radius:5px;overflow:hidden;">' +
    '<div style="width:' + (total ? m[k] / total * 100 : 0) + '%;height:100%;background:var(--color-primary);"></div></div>' +
    '<span style="width:28px;text-align:right;font-family:var(--font-family-number);">' + m[k] + '</span></div>').join('');

  const byRating = dist(r => r.rating);
  const byOrigin = dist(r => r.resourceOrigin);
  const byCategory = dist(r => r.category);
  const byCountry = {};
  all.forEach(r => (r.countries || []).forEach(c => { byCountry[c] = (byCountry[c] || 0) + 1; }));

  const cols = ['supplyType', 'name', 'region', 'contact', 'phone', 'email', 'inTime', 'inspector', 'biz', 'category', 'rating', 'countries', 'resourceOrigin', 'paymentTerm'];
  const list = all.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td>' +
    cols.map(k => {
      if (k === 'contact') return '<td>' + esc(maskContact(r.contact)) + '</td>';
      if (k === 'phone') return '<td>' + esc(maskPhone(r.phone)) + '</td>';
      if (k === 'email') return '<td>' + esc(maskEmail(r.email)) + '</td>';
      if (k === 'countries') return '<td>' + ((r.countries || []).join('、') || '/') + '</td>';
      if (k === 'rating') {
        const cls = r.rating && r.rating.indexOf('A') === 0 ? 'dsc-tag--success' : r.rating && r.rating.indexOf('B') === 0 ? 'dsc-tag--info' : 'dsc-tag--warning';
        return '<td><span class="dsc-tag ' + cls + '">' + esc(r.rating) + '</span></td>';
      }
      return '<td>' + esc(r[k] === undefined || r[k] === '' ? '/' : r[k]) + '</td>';
    }).join('') + '</tr>').join('');

  return '<div class="dsc-card__title dsc-mb-md">W4 分供方资源库 · ' + week.period + '（明细 ' + all.length + ' 家，共 21 列）</div>' +
    '<div class="dsc-form-row dsc-form-row--2 dsc-mb-md">' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按评级分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byRating, all.length) + '</div></div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按资源所属国别分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byOrigin, all.length) + '</div></div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按品类分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byCategory, all.length) + '</div></div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按可供应国别分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byCountry, all.length) + '</div></div>' +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th>' + cols.map(k => '<th>' + esc((W4_COLUMNS.find(c => c.key === k) || {}).label || k) + '</th>').join('') + '</tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="15">本周暂无已提交数据</td></tr>') + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">联系人、电话、邮箱按组织权限脱敏展示，导出留痕。</div>';
}

/* ---------- W5 调拨台账：明细 + 按调入组织汇总 ---------- */
function weekReportW5(store, week) {
  const all = weekRowsOf(store, 'W5', false);
  const byOrg = {};
  all.forEach(r => {
    const k = r.inOrg || '/';
    byOrg[k] = byOrg[k] || { n: 0, amount: 0 };
    byOrg[k].n += 1;
    byOrg[k].amount += Number(r.inPrice) || 0;
  });
  const orgRows = Object.keys(byOrg).map(k =>
    '<tr><td>' + esc(k) + '</td><td class="dsc-sum-table__num">' + byOrg[k].n + '</td><td class="dsc-sum-table__num">' + fmtMoney(byOrg[k].amount) + '</td></tr>').join('');
  const orgTotal = '<tr class="dsc-sum-table__total"><td>合计</td><td class="dsc-sum-table__num">' + all.length + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(all.reduce((s, r) => s + (Number(r.inPrice) || 0), 0)) + '</td></tr>';

  const cols = ['outProject', 'outCountry', 'inProject', 'inCountry', 'inOrg', 'material', 'spec', 'newPrice', 'inPrice', 'transferTime'];
  const list = all.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td>' + cols.map(k =>
      (k === 'newPrice' || k === 'inPrice') ? '<td class="dsc-sum-table__num">' + fmtMoney(r[k]) + '</td>' : '<td>' + esc(r[k] === undefined || r[k] === '' ? '/' : r[k]) + '</td>').join('') + '</tr>').join('');

  return '<div class="dsc-card__title dsc-mb-md">W5 调拨台账 · ' + week.period + '（明细 ' + all.length + ' 笔，共 15 列）</div>' +
    '<div class="dsc-table-wrapper dsc-mb-md"><table class="dsc-table dsc-sum-table"><thead><tr><th>调入组织</th><th class="dsc-sum-table__num">调拨笔数</th><th class="dsc-sum-table__num">调入价格合计（元）</th></tr></thead>' +
    '<tbody>' + (orgRows || '<tr><td colspan="3">本周暂无已提交数据</td></tr>') + orgTotal + '</tbody></table></div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th>' + cols.map(k => '<th>' + esc((W5_COLUMNS.find(c => c.key === k) || {}).label || k) + '</th>').join('') + '</tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="11">—</td></tr>') + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">调入价格按调入组织汇总后，自动带出至月报 D3 调出资产原值金额。</div>';
}

/* ---------- W6 项目风险全景：按项目明细 + 按单位风险统计 ---------- */
function weekReportW6(store, week) {
  let all = weekRowsOf(store, 'W6', true);
  /* 权限：二级单位可见本单位 W6 明细及涉及本单位的汇总行 */
  const restrictUnit = (AppState.role.id === 'filler' || AppState.role.id === 'auditor') ? 'U01' : null;
  const visible = restrictUnit ? all.filter(r => r._ownerId === restrictUnit) : all;

  const byUnit = {};
  visible.forEach(r => {
    const k = r._owner;
    byUnit[k] = byUnit[k] || { n: 0, high: 0, mid: 0, low: 0, loss: 0 };
    byUnit[k].n += 1;
    if (r.riskLevel === '高') byUnit[k].high += 1;
    else if (r.riskLevel === '中') byUnit[k].mid += 1;
    else byUnit[k].low += 1;
    byUnit[k].loss += Number(r.estLoss) || 0;
  });
  const unitRows = Object.keys(byUnit).map(k =>
    '<tr><td>' + esc(k) + '</td><td class="dsc-sum-table__num">' + byUnit[k].n + '</td>' +
    '<td class="dsc-sum-table__num">' + (byUnit[k].high ? '<span class="dsc-tag dsc-tag--danger">' + byUnit[k].high + '</span>' : '0') + '</td>' +
    '<td class="dsc-sum-table__num">' + (byUnit[k].mid ? '<span class="dsc-tag dsc-tag--warning">' + byUnit[k].mid + '</span>' : '0') + '</td>' +
    '<td class="dsc-sum-table__num">' + byUnit[k].low + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(byUnit[k].loss) + '</td></tr>').join('');
  const totals = visible.reduce((a, r) => {
    a.n++; a.loss += Number(r.estLoss) || 0;
    if (r.riskLevel === '高') a.high++; else if (r.riskLevel === '中') a.mid++; else a.low++;
    return a;
  }, { n: 0, high: 0, mid: 0, low: 0, loss: 0 });

  const cols = ['project', 'country', 'address', 'contractAmount', 'output', 'purchaseTotal', 'materialPurchase', 'laborPurchase',
    'reduceRate', 'benefitRate', 'gjLossRate', 'hntLossRate', 'localSupplierRate', 'localPurchaseRate', 'centralRate',
    'hasRisk', 'riskType', 'riskLevel', 'riskDesc', 'estLoss', 'strategy', 'resolveTime', 'owner'];
  const list = visible.map((r, i) =>
    '<tr><td>' + (i + 1) + '</td>' +
    '<td>' + esc(r._owner) + '</td>' +
    cols.map(k => {
      if (['contractAmount', 'output', 'purchaseTotal', 'materialPurchase', 'laborPurchase', 'estLoss'].indexOf(k) >= 0) {
        return '<td class="dsc-sum-table__num">' + (k === 'estLoss' && (r[k] === '/' || r[k] === undefined) ? '/' : fmtMoney(r[k])) + '</td>';
      }
      if (k === 'riskLevel') {
        const cls = r.riskLevel === '高' ? 'dsc-tag--danger' : r.riskLevel === '中' ? 'dsc-tag--warning' : 'dsc-tag--success';
        return '<td>' + (r.hasRisk === '是' ? '<span class="dsc-tag ' + cls + '">' + esc(r.riskLevel) + '</span>' : '—') + '</td>';
      }
      if (k === 'riskDesc' || k === 'strategy') return '<td style="white-space:normal;max-width:220px;font-size:var(--font-size-sm);">' + esc(r[k] || '—') + '</td>';
      return '<td>' + esc(r[k] === undefined || r[k] === '' ? '/' : r[k]) + '</td>';
    }).join('') + '</tr>').join('');

  return '<div class="dsc-card__title dsc-mb-md">W6 项目供应链风险全景表 · ' + week.period +
    '（项目行 ' + visible.length + ' 条，共 27 字段，此处展示核心列）' +
    (restrictUnit ? '<span class="dsc-form-section__tag" style="margin-left:var(--space-sm);">按权限仅展示本单位明细</span>' : '') + '</div>' +
    '<div class="dsc-table-wrapper dsc-mb-md"><table class="dsc-table dsc-sum-table"><thead><tr><th>二级单位</th><th class="dsc-sum-table__num">项目数</th><th class="dsc-sum-table__num">高风险</th><th class="dsc-sum-table__num">中风险</th><th class="dsc-sum-table__num">低风险</th><th class="dsc-sum-table__num">预计损失合计（元）</th></tr></thead>' +
    '<tbody>' + (unitRows || '<tr><td colspan="6">本周暂无已提交数据</td></tr>') +
    '<tr class="dsc-sum-table__total"><td>合计</td><td class="dsc-sum-table__num">' + totals.n + '</td><td class="dsc-sum-table__num">' + totals.high + '</td><td class="dsc-sum-table__num">' + totals.mid + '</td><td class="dsc-sum-table__num">' + totals.low + '</td><td class="dsc-sum-table__num">' + fmtMoney(totals.loss) + '</td></tr>' +
    '</tbody></table></div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th><th>二级单位</th>' + cols.map(k => '<th>' + esc((W6_COLUMNS.find(c => c.key === k) || {}).label || k) + '</th>').join('') + '</tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="25">—</td></tr>') + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">W6 率类按单位汇总后作为月报 D1/D2 一致性校验基准（金额求和、率类按采购总额加权）。</div>';
}

/* ---------- 月内周趋势视图（关键指标各周对比） ---------- */
function renderWeekTrend() {
  const rows = WEEK_PERIODS.map(w => {
    const t = w.status === '未开始' ? null : weekTrend(w);
    const cur = w.taskId === SummaryState.weekTaskId;
    return '<tr' + (cur ? ' style="background:var(--color-primary-bg);"' : '') + '>' +
      '<td>' + w.period + (cur ? ' <span class="dsc-tag dsc-tag--info">当前</span>' : '') + '</td>' +
      '<td>' + w.status + '</td>' +
      '<td class="dsc-sum-table__num">' + (t ? t.reported + '/' + SHARED_CENTERS.length : '—') + '</td>' +
      '<td class="dsc-sum-table__num">' + (t ? t.projCount : '—') + '</td>' +
      '<td class="dsc-sum-table__num">' + (t ? t.catDone : '—') + '</td>' +
      '<td class="dsc-sum-table__num">' + (t ? fmtMoney(t.saveAmount) : '—') + '</td>' +
      '<td class="dsc-sum-table__num">' + (t ? t.rate : '—') + '</td></tr>';
  }).join('');

  /* 趋势条形（集采完成个数，用当周最大值归一） */
  const vals = WEEK_PERIODS.map(w => (w.status === '未开始' ? null : weekTrend(w))).filter(Boolean);
  const maxDone = Math.max.apply(null, vals.map(v => v.catDone).concat([1]));
  const bars = WEEK_PERIODS.map(w => {
    const t = w.status === '未开始' ? null : weekTrend(w);
    return '<div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:6px;">' +
      '<span style="width:150px;color:var(--color-text-secondary);">' + w.period + '</span>' +
      '<div style="flex:1;height:12px;background:#F0F2F5;border-radius:6px;overflow:hidden;">' +
      '<div style="width:' + (t ? (t.catDone / maxDone * 100) : 0) + '%;height:100%;background:linear-gradient(90deg,#0A75D9,#1890FF);"></div></div>' +
      '<span style="width:80px;text-align:right;font-family:var(--font-family-number);">' + (t ? t.catDone + ' 个品类' : '—') + '</span></div>';
  }).join('');

  return '<div class="dsc-card dsc-mt-md"><div class="dsc-card__body">' +
    '<div class="dsc-card__title dsc-mb-md">月内周趋势（' + WEEK_MONTH + '）— 支撑月报核对与局例会通报</div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table dsc-sum-table"><thead><tr><th>周次</th><th>状态</th><th class="dsc-sum-table__num">已报主体</th>' +
    '<th class="dsc-sum-table__num">在建项目数</th><th class="dsc-sum-table__num">集采完成个数</th><th class="dsc-sum-table__num">预计降本额（元）</th><th class="dsc-sum-table__num">采购成本降低率（重算）</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<div class="dsc-mt-md">' + bars + '</div>' +
    '<div class="dsc-field-tip dsc-mt-sm">趋势口径：W1 数值区跨主体汇总；率类按各周分子/分母重算；历史周为快照只读。</div>' +
    '</div></div>';
}


/* ============================================================
   周报 / 月报对比
   ============================================================ */
function summaryCompare() {
  const wstore = WEEKLY_STORE[FILL_TASK_W] || {};
  const weekLabel = '2026年9月第3周周报';

  /* 周报侧汇总（共享中心/区域总部 W1~W5） */
  let wJc = 0, wSave = 0, wW4 = 0, wW2 = 0, wW3rows = 0;
  ['SC1', 'SC2', 'SC3', 'SC4'].forEach(id => {
    const s = wstore[id] || {};
    ((s.W3 && s.W3.rows) || []).forEach(r => { wJc += Number(r.amount) || 0; });
    ((s.W4 && s.W4.rows) || []).forEach(() => { wW4++; });
    ((s.W2 && s.W2.rows) || []).forEach(() => { wW2++; });
    wW3rows += ((s.W3 && s.W3.rows) || []).length;
    const v = (s.W1 && s.W1.values) || {};
    const rec = s.W1 || {};
    if (rec.status === '已提交' || rec.status === '已通过') wSave += Number(v.saveAmount) || 0;
  });

  /* 月报侧汇总（已通过 + 已提交，口径与对比联动） */
  const d1Units = summaryUnits('D1');
  let mJc = 0, mSave = 0;
  d1Units.forEach(u => {
    const v = getFill(FILL_TASK, u.id, 'D1').values || {};
    mJc += Number(v.jc_amount) || 0;
    mSave += ((v.wz_cost - v.wz_purchase) + (v.lw_cost - v.lw_purchase)) || 0;
  });
  const d4Units = summaryUnits('D4');
  const mW2 = d4Units.reduce((n, u) => n + (((getFill(FILL_TASK, u.id, 'D4').rows) || []).length), 0);
  const d5Units = summaryUnits('D5');
  const rawD5 = [];
  d5Units.forEach(u => ((getFill(FILL_TASK, u.id, 'D5').rows) || []).forEach(r => rawD5.push(r)));
  const dedupMap = {};
  rawD5.forEach(r => { dedupMap[r.name + '|' + r.region] = true; });
  const mW4 = Object.keys(dedupMap).length;

  const fmtV = (v, unit) => unit === '元' ? fmtMoney(v) : String(v);
  const judge = (w, m, unit) => {
    if (!w) return { tag: '<span class="dsc-tag dsc-tag--default">周报无数值</span>', note: '周报侧无数据，月报按手工填报处理' };
    const dev = (m - w) / w;
    if (m < w) return { tag: '<span class="dsc-tag dsc-tag--danger">月报＜周报，阻断</span>', note: '月报值小于周报值，提交被阻断' };
    if (Math.abs(dev) > CONSISTENCY_CONFIG.deviationWarn) return { tag: '<span class="dsc-tag dsc-tag--warning">偏差 ' + (dev * 100).toFixed(1) + '%，提示核对</span>', note: '偏差超 ±5%，提示核对口径' };
    return { tag: '<span class="dsc-tag dsc-tag--success">一致（偏差 ' + (dev * 100).toFixed(1) + '%）</span>', note: '周月口径一致' };
  };

  const items = [
    { name: '集采金额', unit: '元', w: wJc, m: mJc, wSrc: 'W3 集采跟踪表（' + wW3rows + ' 条）', mSrc: 'D1 集采引用金额（' + d1Units.length + ' 家单位）' },
    { name: '采购成本降低额', unit: '元', w: wSave, m: mSave, wSrc: 'W1 汇总表（共享中心）', mSrc: 'D1 成本降低额（重算）' },
    { name: '合格分供商（去重后）', unit: '家', w: wW4, m: mW4, wSrc: 'W4 分供方资源库', mSrc: 'D5 名录（名称+注册地去重）' },
    { name: '采购及物资管理人员', unit: '人', w: wW2, m: mW2, wSrc: 'W2 人员配备表', mSrc: 'D4 人员明细' }
  ];

  const rows = items.map(it => {
    const j = judge(it.w, it.m, it.unit);
    return '<tr>' +
      '<td style="font-weight:var(--font-weight-medium);">' + esc(it.name) + '（' + it.unit + '）</td>' +
      '<td class="dsc-sum-table__num">' + fmtV(it.w, it.unit) + '<div style="font-size:11px;color:var(--color-text-tertiary);font-family:var(--font-family-base);">' + esc(it.wSrc) + '</div></td>' +
      '<td class="dsc-sum-table__num">' + fmtV(it.m, it.unit) + '<div style="font-size:11px;color:var(--color-text-tertiary);font-family:var(--font-family-base);">' + esc(it.mSrc) + '</div></td>' +
      '<td class="dsc-sum-table__num">' + (it.w ? ((it.m - it.w) / it.w * 100).toFixed(1) + '%' : '—') + '</td>' +
      '<td>' + j.tag + '<div class="dsc-field-tip" style="margin-top:2px;">' + esc(j.note) + '</div></td></tr>';
  }).join('');

  /* 数据来源标注（含周报缺失单位） */
  const missingNote = '<div class="dsc-field-tip dsc-mt-sm">数据来源标注：月报自动带出字段来源＝' + weekLabel +
    '；当月无已提交周报的单位（' + WEEKLY_MISSING_UNITS.map(id => unitName(id)).join('、') + '）已转手工填报，报表按单位标注来源。</div>';

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('周报汇总（9月第3周）', fmtMoney(wJc) + ' 元', 'dsc-stat-card__value--primary', '集采金额（W3 汇总）') +
    statCard('月报汇总（9月）', fmtMoney(mJc) + ' 元', 'dsc-stat-card__value--primary', '集采引用金额（D1 汇总）') +
    statCard('分供商资源', wW4 + ' → ' + mW4 + ' 家', '', 'W4 原始 → D5 去重后') +
    statCard('人员配备', wW2 + ' → ' + mW2 + ' 人', '', 'W2 → D4（基础信息带出）') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table dsc-sum-table" style="white-space:nowrap;">' +
    '<thead><tr><th>对比指标</th><th class="dsc-sum-table__num">周报汇总值（来源）</th><th class="dsc-sum-table__num">月报汇总值（来源）</th><th class="dsc-sum-table__num">偏差</th><th>一致性结论</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' + missingNote;
}
function toggleIncludeSubmitted(el) {
  SummaryState.includeSubmitted = el.checked;
  renderPage('summary');
  toast(el.checked ? '已包含"已提交待复核"数据（部分汇总）' : '仅按"已通过"数据汇总');
}
function exportSummary() {
  toast('汇总报表已导出：表样兼容现行《海外供应链体系报表》，含数据覆盖范围标注页', 'success');
}

/* ============================================================
   D1 采购管理指标汇总
   ============================================================ */
function summaryD1(units) {
  const rows = units.map(u => {
    const v = getFill('T-2026M09', u.id, 'D1').values;
    const r = calcD1(v);
    return { u: u, v: v, r: r };
  });
  /* 合计：金额求和，率类用汇总分子/分母重算 */
  const T = { income: 0, cost: 0, purchase: 0, lIncome: 0, lCost: 0, lPurchase: 0, zg: 0, jc: 0, dc: 0 };
  rows.forEach(x => {
    T.income += x.v.wz_income; T.cost += x.v.wz_cost; T.purchase += x.v.wz_purchase;
    T.lIncome += x.v.lw_income; T.lCost += x.v.lw_cost; T.lPurchase += x.v.lw_purchase;
    T.zg += x.v.zg_amount; T.jc += x.v.jc_amount; T.dc += x.v.dc_amount;
  });
  const tBenefit = (T.income - T.purchase) + (T.lIncome - T.lPurchase);
  const tReduce = (T.cost - T.purchase) + (T.lCost - T.lPurchase);

  const trs = rows.map(x => {
    const benefit = (x.v.wz_income - x.v.wz_purchase) + (x.v.lw_income - x.v.lw_purchase);
    const reduce = (x.v.wz_cost - x.v.wz_purchase) + (x.v.lw_cost - x.v.lw_purchase);
    return '<tr><td>' + x.u.name + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(x.v.wz_purchase + x.v.lw_purchase) + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(benefit) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(benefit, x.v.wz_income + x.v.lw_income) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(reduce, x.v.wz_cost + x.v.lw_cost) + '</td>' +
    '<td class="dsc-sum-table__num">' + x.r.zg_rate + '</td>' +
    '<td class="dsc-sum-table__num">' + x.r.jc_rate + '</td>' +
    '<td class="dsc-sum-table__num">' + x.r.dc_rate + '</td></tr>';
  }).join('');

  const total = '<tr class="dsc-sum-table__total">' +
    '<td>局汇总（' + rows.length + ' 家）</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(T.purchase + T.lPurchase) + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtMoney(tBenefit) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(tBenefit, T.income + T.lIncome) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(tReduce, T.cost + T.lCost) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.zg, T.purchase + T.lPurchase) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.jc, T.purchase) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.dc, T.purchase) + '</td></tr>';

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('汇总采购总金额', fmtMoney(T.purchase + T.lPurchase) + ' 元', 'dsc-stat-card__value--primary', '单位→局逐级求和') +
    statCard('综合采购效益率', pctDisp(tBenefit, T.income + T.lIncome), 'dsc-stat-card__value--success', 'Σ效益额 ÷ Σ业主收入（重算）') +
    statCard('综合成本降低率', pctDisp(tReduce, T.cost + T.lCost), '', 'Σ降低额 ÷ Σ标准成本（重算）') +
    statCard('中国资源引入率', pctDisp(T.zg, T.purchase + T.lPurchase), '', 'Σ引用金额 ÷ Σ采购总金额') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table dsc-sum-table" style="white-space:nowrap;">' +
    '<thead><tr><th>二级单位</th><th>采购总金额（元）</th><th>采购效益总额（元）</th><th>综合采购效益率</th><th>综合成本降低率</th><th>中国资源引入率</th><th>集采率</th><th>直采率</th></tr></thead>' +
    '<tbody>' + (trs || '<tr><td colspan="8">暂无已通过数据</td></tr>') + total + '</tbody></table></div>' +
    '';
}

/* ============================================================
   D2 物资管理指标汇总（混凝土结余率 / 钢筋节超率）
   ============================================================ */
function summaryD2(units) {
  const rows = units.map(u => {
    const v = getFill('T-2026M09', u.id, 'D2').values;
    return { u: u, v: v };
  });
  const T = { hCg: 0, hTk: 0, hTu: 0, gCg: 0, gSy: 0, gCs: 0, gLj: 0, gTu: 0 };
  rows.forEach(x => {
    T.hCg += x.v.hnt_cgL; T.hTk += x.v.hnt_tkL; T.hTu += x.v.hnt_tuL;
    T.gCg += x.v.gj_cgL; T.gSy += x.v.gj_syL; T.gCs += x.v.gj_csL; T.gLj += x.v.gj_ljL; T.gTu += x.v.gj_tuL;
  });
  const gTk = T.gSy - T.gCs - T.gLj;
  const gJcl = T.gTu - gTk;

  const trs = rows.map(x => {
    const v = x.v;
    const tk = v.gj_syL - v.gj_csL - v.gj_ljL;
    return '<tr><td>' + x.u.name + '</td>' +
      '<td class="dsc-sum-table__num">' + fmtQty(v.hnt_cgL) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.hnt_tkL - v.hnt_tuL, v.hnt_tuL) + '</td>' +
      '<td class="dsc-sum-table__num">' + fmtQty(v.gj_cgL) + '</td>' +
      '<td class="dsc-sum-table__num">' + fmtQty(v.gj_tuL - tk) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.gj_tuL - tk, v.gj_tuL) + '</td></tr>';
  }).join('');

  const total = '<tr class="dsc-sum-table__total"><td>局汇总（' + rows.length + ' 家）</td>' +
    '<td class="dsc-sum-table__num">' + fmtQty(T.hCg) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.hTk - T.hTu, T.hTu) + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtQty(T.gCg) + '</td>' +
    '<td class="dsc-sum-table__num">' + fmtQty(gJcl) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(gJcl, T.gTu) + '</td></tr>';

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('混凝土采购量合计', fmtQty(T.hCg) + ' m³', 'dsc-stat-card__value--primary', '开累口径求和') +
    statCard('混凝土综合结余率', pctDisp(T.hTk - T.hTu, T.hTu), '', '(Σ同口径用量−Σ图纸计算量)÷Σ图纸计算量') +
    statCard('钢筋节超量合计', fmtQty(gJcl) + ' t', '', 'Σ图纸量 − Σ同口径用量') +
    statCard('钢筋综合节超率', pctDisp(gJcl, T.gTu), '', 'Σ节超量 ÷ Σ图纸量（重算）') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table dsc-sum-table" style="white-space:nowrap;">' +
    '<thead><tr><th>二级单位</th><th>混凝土采购量（m³）</th><th>混凝土结余率</th><th>钢筋采购量（t）</th><th>钢筋节超量（t）</th><th>钢筋节超率</th></tr></thead>' +
    '<tbody>' + (trs || '<tr><td colspan="6">暂无已通过数据</td></tr>') + total + '</tbody></table></div>';
}

/* ============================================================
   D3 物资损耗与资产周转汇总
   ============================================================ */
function summaryD3(units) {
  const rows = units.map(u => {
    const v = getFill('T-2026M09', u.id, 'D3').values;
    return { u: u, v: v };
  });
  const T = { gCg: 0, gTu: 0, gSy: 0, hYs: 0, hXh: 0, cYs: 0, cXh: 0, zYz: 0, zDc: 0 };
  rows.forEach(x => {
    T.gCg += x.v.gj_cgL; T.gTu += x.v.gj_tuL; T.gSy += x.v.gj_syL;
    T.hYs += x.v.hnt_ysL; T.hXh += x.v.hnt_xhL;
    T.cYs += x.v.cz_ysL; T.cXh += x.v.cz_xhL;
    T.zYz += x.v.zc_yz; T.zDc += x.v.zc_dc;
  });

  const trs = rows.map(x => {
    const v = x.v;
    return '<tr><td>' + x.u.name + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.gj_syL - v.gj_tuL, v.gj_tuL) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.hnt_xhL - v.hnt_ysL, v.hnt_ysL) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.cz_xhL - v.cz_ysL, v.cz_ysL) + '</td>' +
      '<td class="dsc-sum-table__num">' + pctDisp(v.zc_dc, v.zc_yz) + '</td></tr>';
  }).join('');

  const total = '<tr class="dsc-sum-table__total"><td>局汇总（' + rows.length + ' 家）</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.gSy - T.gTu, T.gTu) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.hXh - T.hYs, T.hYs) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.cXh - T.cYs, T.cYs) + '</td>' +
    '<td class="dsc-sum-table__num">' + pctDisp(T.zDc, T.zYz) + '</td></tr>';

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('钢筋综合损耗率', pctDisp(T.gSy - T.gTu, T.gTu), '', '(Σ实际用量−Σ图纸净用量)÷Σ图纸净用量') +
    statCard('混凝土综合损耗率', pctDisp(T.hXh - T.hYs, T.hYs), '', '(Σ实际消耗−Σ预算量)÷Σ预算量') +
    statCard('瓷砖综合损耗率', pctDisp(T.cXh - T.cYs, T.cYs), '', '线下 6 家 #DIV/0! 场景线上显示"/"') +
    statCard('综合资产周转率', pctDisp(T.zDc, T.zYz), '', 'Σ调出原值 ÷ Σ项目原值') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table dsc-sum-table" style="white-space:nowrap;">' +
    '<thead><tr><th>二级单位</th><th>钢筋损耗率</th><th>混凝土损耗率</th><th>瓷砖施工损耗率</th><th>项目资产周转率</th></tr></thead>' +
    '<tbody>' + (trs || '<tr><td colspan="5">暂无已通过数据</td></tr>') + total + '</tbody></table></div>';
}

/* ============================================================
   D4 人员多维统计
   ============================================================ */
function summaryD4(units) {
  const pool = [];
  units.forEach(u => {
    const rec = getFill('T-2026M09', u.id, 'D4');
    (rec.rows || []).forEach(r => { pool.push(Object.assign({ unitName: u.name }, r)); });
  });

  const groupCount = (fn) => {
    const m = {};
    pool.forEach(r => { const k = fn(r); m[k] = (m[k] || 0) + 1; });
    return m;
  };
  const byPost = groupCount(r => r.post);
  const byEdu = groupCount(r => r.education);
  const byFt = groupCount(r => r.fullTime);
  const byNat = groupCount(r => r.nationality);
  const bar = (m, total) => Object.keys(m).map(k =>
    '<div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:6px;">' +
    '<span style="width:110px;color:var(--color-text-secondary);">' + esc(k) + '</span>' +
    '<div style="flex:1;height:10px;background:#F0F2F5;border-radius:5px;overflow:hidden;">' +
    '<div style="width:' + (total ? m[k] / total * 100 : 0) + '%;height:100%;background:var(--color-primary);"></div></div>' +
    '<span style="width:28px;text-align:right;font-family:var(--font-family-number);">' + m[k] + '</span></div>').join('');

  const byUnitRows = units.map(u => {
    const rec = getFill('T-2026M09', u.id, 'D4');
    const n = (rec.rows || []).length;
    return '<tr><td>' + u.name + '</td><td class="dsc-sum-table__num">' + n + '</td><td>' + (rec.zero ? '零报告' : '明细行 ' + n + ' 条') + '</td></tr>';
  }).join('');

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('人员总数', pool.length + ' 人', 'dsc-stat-card__value--primary', units.length + ' 家单位已通过') +
    statCard('专职 / 兼职', (byFt['专职'] || 0) + ' / ' + (byFt['兼职'] || 0), '', '兼职需填主职岗位') +
    statCard('属地化人员', (byNat['其他国家'] || 0) + ' 人', '', '国籍统计（含属地化招聘）') +
    statCard('持一级建造师', pool.filter(r => r.cert2).length + ' 人', '', '持证情况结构化统计') +
    '</div>' +
    '<div class="dsc-form-row dsc-form-row--2">' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按从事岗位分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byPost, pool.length) +
    '</div></div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按学历分布</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byEdu, pool.length) + '</div></div>' +
    '</div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按单位统计</span></div>' +
    '<div class="dsc-form-section__body" style="display:block;padding:0;"><table class="dsc-table"><thead><tr><th>二级单位</th><th>人数</th><th>填报情况</th></tr></thead><tbody>' +
    byUnitRows + '</tbody></table></div></div>';
}

/* ============================================================
   D5 分供商自动去重名录
   ============================================================ */
function summaryD5(units) {
  const raw = [];
  units.forEach(u => {
    const rec = getFill('T-2026M09', u.id, 'D5');
    (rec.rows || []).forEach(r => { raw.push({ row: r, unit: u }); });
  });

  /* 按"供应商名称+注册地"自动去重，保留各单关联 */
  const dedup = [];
  const index = {};
  raw.forEach(x => {
    const key = x.row.name + '|' + x.row.region;
    if (index[key]) {
      index[key].units.push(x.unit.name);
    } else {
      const e = { data: x.row, units: [x.unit.name] };
      index[key] = e;
      dedup.push(e);
    }
  });
  const removed = raw.length - dedup.length;

  /* 分布统计 */
  const dist = fn => {
    const m = {};
    dedup.forEach(e => { const k = fn(e.data); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.keys(m).sort((a, b) => m[b] - m[a]);
  };
  const byRating = {}, byType = {}, byCountry = {};
  dedup.forEach(e => { byRating[e.data.rating] = (byRating[e.data.rating] || 0) + 1; byType[e.data.type] = (byType[e.data.type] || 0) + 1; });
  dedup.forEach(e => (e.data.countries || []).forEach(c => { byCountry[c] = (byCountry[c] || 0) + 1; }));

  const distBar = (m, total) => Object.keys(m).sort((a, b) => m[b] - m[a]).map(k =>
    '<div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:6px;">' +
    '<span style="width:120px;color:var(--color-text-secondary);">' + esc(k) + '</span>' +
    '<div style="flex:1;height:10px;background:#F0F2F5;border-radius:5px;overflow:hidden;">' +
    '<div style="width:' + (total ? m[k] / total * 100 : 0) + '%;height:100%;background:var(--color-primary);"></div></div>' +
    '<span style="width:28px;text-align:right;font-family:var(--font-family-number);">' + m[k] + '</span></div>').join('');

  const list = dedup.map((e, i) =>
    '<tr><td>' + (i + 1) + '</td><td>' + esc(e.data.type) + '</td><td style="font-weight:var(--font-weight-medium);">' + esc(e.data.name) + '</td>' +
    '<td>' + esc(e.data.region) + '</td><td>' + esc(e.data.category) + '</td>' +
    '<td><span class="dsc-tag ' + (e.data.rating.indexOf('A') === 0 ? 'dsc-tag--success' : e.data.rating.indexOf('B') === 0 ? 'dsc-tag--info' : 'dsc-tag--warning') + '">' + esc(e.data.rating) + '</span></td>' +
    '<td>' + (e.data.countries || []).join('、') + '</td>' +
    '<td>' + (e.units.length > 1 ? '<span class="dsc-tag dsc-tag--warning">跨 ' + e.units.length + ' 家单位</span> ' + e.units.join('、') : e.units[0]) + '</td></tr>').join('');

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('原始记录数', raw.length + ' 条', '', units.length + ' 家单位录入') +
    statCard('自动去重后', dedup.length + ' 家', 'dsc-stat-card__value--primary', '按"供应商名称+注册地"自动去重（100% 替代人工）') +
    statCard('跨单位重复', removed + ' 条', 'dsc-stat-card__value--warning', '与人工"已去重"口径一致') +
    statCard('A级占比', ((byRating['A级-推荐使用'] || 0) / (dedup.length || 1) * 100).toFixed(1) + '%', 'dsc-stat-card__value--success', '评级分布统计') +
    '</div>' +
    '<div class="dsc-form-row dsc-form-row--2 dsc-mb-md">' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按评级分布</span></div><div class="dsc-form-section__body" style="display:block;">' + distBar(byRating, dedup.length) + '</div></div>' +
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按可供应国别分布</span></div><div class="dsc-form-section__body" style="display:block;">' + distBar(byCountry, dedup.length) + '</div></div>' +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th><th>供货类型</th><th>供应商名称</th><th>注册地</th><th>品类</th><th>供应商评级</th><th>可供应国别</th><th>关联单位</th></tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="8">暂无已通过数据</td></tr>') + '</tbody></table></div>' +
    '<div class="dsc-field-tip dsc-mt-sm">去重不误删各单位有效记录：同一供应商多单位录入时，名录保留各单关联关系（反向指标约束）。</div>';
}

/* ============================================================
   D6 不合格分供商名录（禁用到期提醒）
   ============================================================ */
function summaryD6(units) {
  const pool = [];
  units.forEach(u => {
    const rec = getFill('T-2026M09', u.id, 'D6');
    (rec.rows || []).forEach(r => { pool.push({ row: r, unit: u }); });
  });

  const list = pool.map((x, i) => {
    const end = x.row.banStart && x.row.banMonths ? banEndDate(x.row.banStart, x.row.banMonths) : null;
    const expired = end && end.getTime() < parseDate('2026/09/14').getTime();
    const soon = end && !expired && (end.getTime() - parseDate('2026/09/14').getTime()) < 30 * 86400000;
    return '<tr><td>' + (i + 1) + '</td><td>' + x.unit.name + '</td><td>' + esc(x.row.type) + '</td>' +
      '<td style="font-weight:var(--font-weight-medium);">' + esc(x.row.name) + '</td><td>' + esc(x.row.region) + '</td>' +
      '<td style="max-width:240px;white-space:normal;">' + esc(x.row.badDesc) + '</td>' +
      '<td class="dsc-sum-table__num">' + esc(x.row.banStart) + '</td>' +
      '<td class="dsc-sum-table__num">' + x.row.banMonths + '</td>' +
      '<td class="dsc-sum-table__num">' + (end ? fmtDate(end) : '/') + '</td>' +
      '<td>' + (expired ? '<span class="dsc-tag dsc-tag--danger">已到期，请复核</span>'
        : soon ? '<span class="dsc-tag dsc-tag--warning">30 天内到期</span>'
        : '<span class="dsc-tag dsc-tag--default">禁用中</span>') + '</td></tr>';
  }).join('');

  return '<div class="dsc-stat-row dsc-mb-md">' +
    statCard('不合格分供商', pool.length + ' 家', 'dsc-stat-card__value--danger', units.length + ' 家单位已通过') +
    statCard('已到期待复核', pool.filter(x => banEndDate(x.row.banStart, x.row.banMonths) && banEndDate(x.row.banStart, x.row.banMonths).getTime() < parseDate('2026/09/14').getTime()).length + ' 家', 'dsc-stat-card__value--warning', '到期自动提醒复核（站内信）') +
    '</div>' +
    '<div class="dsc-table-wrapper" style="overflow-x:auto;"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>序号</th><th>录入单位</th><th>供货类型</th><th>供应商名称</th><th>注册地</th><th>不良行为描述</th><th>禁用起始</th><th>期限（月）</th><th>禁用到期日（计算）</th><th>状态</th></tr></thead>' +
    '<tbody>' + (list || '<tr><td colspan="10">暂无已通过数据</td></tr>') + '</tbody></table></div>' +
    '';
}
