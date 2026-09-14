/* ============================================================
   ZY-HY-TB-050 汇总统计与报表导出
   金额/数量逐级求和；率类一律用汇总分子/分母重算（禁止对率平均）
   分供商按"供应商名称+注册地"自动去重并保留各单关联
   ============================================================ */

const SummaryState = {
  dataset: 'D1',
  includeSubmitted: false   // 包含"已提交待复核"数据（部分汇总）
};

VIEWS['summary'] = {
  render() { return renderSummaryPage(); },
  init() { /* inline handlers */ }
};

/* 参与汇总的单位：默认仅"已通过"；勾选后包含"已提交"（部分汇总） */
function summaryUnits(ds) {
  const base = [], partial = [];
  UNITS.forEach(u => {
    const rec = getFill('T-2026H1', u.id, ds);
    if (!rec) return;
    if (rec.status === '已通过') base.push(u);
    else if (rec.status === '已提交' && rec.unitAudited !== undefined) partial.push(u);
    else if (rec.status === '已提交') partial.push(u);
  });
  return SummaryState.includeSubmitted ? base.concat(partial) : base;
}

function renderSummaryPage() {
  const ds = SummaryState.dataset;
  const units = summaryUnits(ds);

  const tabs = DATASET_ORDER.map(d =>
    '<div class="dsc-dtab' + (ds === d ? ' dsc-dtab--active' : '') + '" onclick="switchSummaryTab(\'' + d + '\')">' +
    '<span class="dsc-dtab__code">' + d + '</span><span>' + esc(DATASETS[d].name.replace(/（.*）/, '')) + '</span></div>').join('');

  const body = { D1: summaryD1, D2: summaryD2, D3: summaryD3, D4: summaryD4, D5: summaryD5, D6: summaryD6 }[ds](units);

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title">汇总统计与报表导出</div>' +
    '  <div class="dsc-field-tip">报送期间 2026年上半年 · 汇总计算 ≤10 秒 · 导出兼容现行《海外供应链体系报表》表样（ZY-HY-TB-050）</div></div>' +
    '  <div class="dsc-page-header__actions">' +
    '    <label class="dsc-check"><input type="checkbox"' + (SummaryState.includeSubmitted ? ' checked' : '') + ' onchange="toggleIncludeSubmitted(this)"><span class="dsc-check__box"></span>包含已提交待复核数据</label>' +
    '    <button class="dsc-btn dsc-btn--primary" onclick="exportSummary()">导出 Excel</button>' +
    '  </div>' +
    '</div>' +

    '<div class="dsc-coverage-note dsc-mb-md"><span>⚠</span>数据覆盖范围：已通过 ' + units.length + '/14 家二级单位（部分汇总已显著标注，验收标准 A6）；率类指标为汇总分子/分母重算值，禁止对率直接平均（业务规则 11）。</div>' +

    '<div class="dsc-dtabs">' + tabs + '</div>' +
    '<div class="dsc-card"><div class="dsc-card__body">' + body + '</div></div>';
}

function switchSummaryTab(ds) { SummaryState.dataset = ds; renderPage('summary'); }
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
    const v = getFill('T-2026H1', u.id, 'D1').values;
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
    '<div class="dsc-field-tip dsc-mt-sm">率类全部为汇总后分子/分母重算值（如综合采购效益率 = Σ效益额 ÷ Σ对应业主收入），禁止对各单率值求平均；分母为 0 显示"/"（V-T01）。</div>';
}

/* ============================================================
   D2 物资管理指标汇总（混凝土结余率 / 钢筋节超率）
   ============================================================ */
function summaryD2(units) {
  const rows = units.map(u => {
    const v = getFill('T-2026H1', u.id, 'D2').values;
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
    const v = getFill('T-2026H1', u.id, 'D3').values;
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
    const rec = getFill('T-2026H1', u.id, 'D4');
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
    const rec = getFill('T-2026H1', u.id, 'D4');
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
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>按从事岗位分布</span><span class="dsc-form-section__tag">Q2 待收敛</span></div><div class="dsc-form-section__body" style="display:block;">' + bar(byPost, pool.length) +
    '<div class="dsc-field-tip">"采购物资管理"归类待业务确认后字典收敛为两类（待决事项 Q2）</div></div></div>' +
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
    const rec = getFill('T-2026H1', u.id, 'D5');
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
    statCard('跨单位重复', removed + ' 条', 'dsc-stat-card__value--warning', '与人工"已去重"口径一致（A4）') +
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
    const rec = getFill('T-2026H1', u.id, 'D6');
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
    '<div class="dsc-field-tip dsc-mt-sm">禁用到期日由系统按"禁用起始时间 + 期限"自动计算，到期自动提醒复核是否移出不合格库；与 D5 合格库交叉校验（V-C03）。</div>';
}
