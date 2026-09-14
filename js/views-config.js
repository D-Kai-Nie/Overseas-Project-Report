/* ============================================================
   ZY-HY-TB-060 填报基础配置
   指标字典（填报/校验/汇总的唯一配置来源）、枚举字典、期间配置、单位范围
   口径变更支持"生效期间"，历史报表按当时口径复现（A10）
   ============================================================ */

const ConfigState = { tab: 'indicator' };

const CONFIG_TABS = [
  { key: 'indicator', name: '指标字典' },
  { key: 'enum', name: '枚举字典' },
  { key: 'period', name: '期间与频率配置' },
  { key: 'unit', name: '单位与主体范围' },
  { key: 'template', name: '导入模板' }
];

VIEWS['config'] = {
  render() { return renderConfigPage(); },
  init() { /* inline handlers */ }
};

function renderConfigPage() {
  const tabs = '<div class="dsc-tabs">' + CONFIG_TABS.map(t =>
    '<div class="dsc-tabs__item' + (ConfigState.tab === t.key ? ' dsc-tabs__item--active' : '') + '" onclick="switchConfigTab(\'' + t.key + '\')">' + t.name + '</div>').join('') + '</div>';

  const body = { indicator: cfgIndicator, enum: cfgEnum, period: cfgPeriod, unit: cfgUnit, template: cfgTemplate }[ConfigState.tab]();

  return '' +
    '<div class="dsc-page-header">' +
    '  <div><div class="dsc-page-header__title">填报基础配置</div>' +
    '  <div class="dsc-field-tip">指标字典是填报表单、校验、汇总的唯一配置来源；新增/调整指标口径或枚举值仅通过配置完成，不修改代码（验收标准 A10）</div></div>' +
    '  <div class="dsc-page-header__actions"><button class="dsc-btn dsc-btn--default" onclick="toast(\'配置变更操作已留痕：操作人、时间、IP、修改前后值\',\'success\')">变更留痕查询</button></div>' +
    '</div>' + tabs + body;
}

function switchConfigTab(key) { ConfigState.tab = key; renderPage('config'); }

/* ---------- 指标字典 ---------- */
function cfgIndicator() {
  const wayOf = d => d.way || (d.source === '计算' ? '系统自动算' : d.source === '带出' ? '自动取自周报' : '需填报');
  const wayTag = w => w === '系统自动算' ? 'dsc-tag--info' : w === '自动取自周报' ? 'dsc-tag--filling' : 'dsc-tag--success';
  const dsName = code => (DATASETS[code] || W_DATASETS[code] || { name: '—' }).name.replace(/（.*）/, '');
  const rows = INDICATOR_DICT.map(d => {
    const way = wayOf(d);
    return '<tr><td style="font-family:var(--font-family-number);">' + esc(d.code) + '</td>' +
    '<td style="font-weight:var(--font-weight-medium);">' + esc(d.name) + '</td>' +
    '<td>' + d.dataset + ' ' + esc(dsName(d.dataset)) + '</td>' +
    '<td>' + esc(d.unit) + '</td>' +
    '<td><span class="dsc-tag ' + wayTag(way) + '">' + esc(way) + '</span></td>' +
    '<td style="font-size:var(--font-size-sm);color:var(--color-text-secondary);max-width:260px;white-space:normal;">' + esc(d.formula) + '</td>' +
    '<td><span class="dsc-tag dsc-tag--warning" style="font-family:var(--font-family-number);">' + esc(d.rules) + '</span></td>' +
    '<td>' + esc(d.required) + '</td>' +
    '<td class="dsc-table__actions">' +
    '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="openIndicatorEditModal(\'' + d.code + '\')">修改</button>' +
    '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="toast(\'已停用指标 ' + d.code + '（仅对后续期间生效，历史报表不受影响）\',\'warning\')">停用</button></td></tr>';
  }).join('');

  return '<div class="dsc-alert dsc-alert--info dsc-mb-md">填报方式三态（V1.1）：<b>需填报</b>（手工录入/导入）、<b>系统自动算</b>（公式计算、界面置灰）、<b>自动取自周报</b>（系统带出、核对确认、允许覆盖留痕）。标记"自动取自周报"的字段在月报界面无手工录入入口（A14）。</div>' +
    '<div class="dsc-row-toolbar">' +
    '<button class="dsc-btn dsc-btn--primary dsc-btn--sm" onclick="toast(\'新增指标：编码自动生成，填报方式/口径/校验规则/是否必填均可配置\',\'success\')">+ 新增指标</button>' +
    '<span class="dsc-row-toolbar__count">共 ' + INDICATOR_DICT.length + ' 项核心指标（节选展示，实际含 D1~D6 / W1~W6 全部字段）</span></div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table" style="white-space:nowrap;">' +
    '<thead><tr><th>指标编码</th><th>指标名称</th><th>所属数据集</th><th>计量单位</th><th>填报方式</th><th>计算公式 / 口径</th><th>校验规则</th><th>必填</th><th>操作</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}

/* 口径变更：生效期间（A10 历史报表按当时口径复现） */
function openIndicatorEditModal(code) {
  const d = INDICATOR_DICT.find(x => x.code === code);
  openModal('修改指标口径 · ' + d.code,
    '<div class="dsc-form-group"><label class="dsc-form-label">指标名称</label><input class="dsc-input" value="' + esc(d.name) + '" disabled></div>' +
    '<div class="dsc-form-row dsc-form-row--2 dsc-mt-sm">' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">计算公式 / 口径</label>' +
    '<input class="dsc-input" id="indFormula" value="' + esc(d.formula) + '"' + (d.source === '计算' ? '' : ' disabled') + '></div>' +
    '<div class="dsc-form-group"><label class="dsc-form-label dsc-form-label--required">生效期间</label>' +
    '<select class="dsc-select" id="indEffect"><option>2026年下半年</option><option>2026年三季度</option><option>2027年上半年</option></select>' +
    '<div class="dsc-field-tip">历史期间报表按当时口径复现，不因本次变更被改写</div></div></div>' +
    '<div class="dsc-alert dsc-alert--info dsc-mt-sm">变更将留痕：操作人、时间、IP、修改前后值（A7），并按生效期间对新报送任务自动生效。</div>',
    '<button class="dsc-btn dsc-btn--default" onclick="closeModal()">取消</button>' +
    '<button class="dsc-btn dsc-btn--primary" onclick="toast(\'指标口径已保存，自所选生效期间起生效；变更已留痕\',\'success\');closeModal()">保存</button>');
}

/* ---------- 枚举字典 ---------- */
function cfgEnum() {
  const cards = ENUM_DICT_CONFIG.map(cfg =>
    '<div class="dsc-form-section"><div class="dsc-form-section__head"><span>' + esc(cfg.name) + '</span>' +
    (cfg.status === '待收敛' ? '<span class="dsc-tag dsc-tag--returned">待收敛</span>' : '<span class="dsc-tag dsc-tag--success">已启用</span>') + '</div>' +
    '<div class="dsc-form-section__body" style="display:block;">' +
    '<div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);">' +
    cfg.items.map(i => '<span class="dsc-tag dsc-tag--info">' + esc(i) + '</span>').join('') +
    '</div>' +
    (cfg.note ? '<div class="dsc-field-tip dsc-mt-sm">' + esc(cfg.note) + '</div>' : '') +
    '<div class="dsc-mt-sm"><button class="dsc-btn dsc-btn--default dsc-btn--sm" onclick="toast(\'新增枚举值：保存后即对填报/导入校验生效，字典外取值无法提交\',\'success\')">+ 新增枚举值</button></div>' +
    '</div></div>').join('');

  return '<div class="dsc-alert dsc-alert--info dsc-mb-md">枚举值 100% 字典化：供货类型、品类、评级、学历、岗位、国别、共享中心取自基础字典并可维护扩展；字典外取值无法提交（V-E01~V-E03）。</div>' +
    '<div class="dsc-form-row dsc-form-row--2">' + cards + '</div>';
}

/* ---------- 期间与频率配置 ---------- */
function cfgPeriod() {
  const rows = PERIOD_CONFIG.map(p =>
    '<tr><td>' + esc(p.period) + '</td>' +
    '<td><span class="dsc-tag ' + (p.freq === '周报' ? 'dsc-tag--filling' : 'dsc-tag--info') + '">' + esc(p.freq) + '</span></td>' +
    '<td>' + esc(p.type) + '</td>' +
    '<td>' + statusTag(p.status === '填报中' ? '填报中' : p.status === '未开始' ? '未开始' : p.status === '已截止' ? '已逾期' : '已通过') + '</td>' +
    '<td>' + esc(p.deadline) + '</td><td>' + esc(p.task) + '</td>' +
    '<td class="dsc-table__actions"><button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="toast(\'期间与频率配置修改已留痕\',\'success\')">编辑</button></td></tr>').join('');

  return '<div class="dsc-alert dsc-alert--info dsc-mb-md">V1.1 双频率：<b>周报</b>每周五填报（共享中心/区域总部/项目级，截止前 1 天自动催办）；<b>月报</b>每月底填报（14 家二级单位，每月底后 5 个工作日内齐套）。人员表原按季度，是否随月报按月填报待确认（Q3）。</div>' +
    '<div class="dsc-row-toolbar">' +
    '<button class="dsc-btn dsc-btn--primary dsc-btn--sm" onclick="toast(\'新增期间：选择周报（每周五）或月报（每月底），支持后续扩展季度/月度专项\',\'success\')">+ 新增期间</button>' +
    '<span class="dsc-row-toolbar__count">共 ' + PERIOD_CONFIG.length + ' 个报送期间</span></div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>期间</th><th>频率</th><th>期间类型</th><th>状态</th><th>截止时间</th><th>关联任务</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- 单位与主体范围 ---------- */
function cfgUnit() {
  const scRows = SHARED_CENTERS.map(s =>
    '<tr><td>' + s.id + '</td><td>' + s.name + '</td>' +
    '<td><span class="dsc-tag dsc-tag--success">已同步</span></td>' +
    '<td>W1~W5 填报人 · 审核人</td>' +
    '<td><span class="dsc-tag dsc-tag--success">已配置</span></td>' +
    '<td class="dsc-table__actions"><button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="toast(\'共享中心/区域总部主体从组织主数据同步，支持按任务圈选\',\'success\')">配置</button></td></tr>').join('');
  const rows = UNITS.map(u =>
    '<tr><td>' + u.id + '</td><td>' + u.name + '</td>' +
    '<td><span class="dsc-tag dsc-tag--success">已同步</span></td>' +
    '<td>D1~D6 填报人 · 审核人（W6 项目级）</td>' +
    '<td>' + (u.id === 'U08' || u.id === 'U12'
      ? '<span class="dsc-tag dsc-tag--danger">未配置</span>'
      : '<span class="dsc-tag dsc-tag--success">已配置</span>') + '</td>' +
    '<td class="dsc-table__actions"><button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="toast(\'单位范围从 DSC 统一组织主数据同步，支持按任务圈选\',\'success\')">配置</button></td></tr>').join('');

  return '<div class="dsc-alert dsc-alert--info dsc-mb-md">V1.1 填报主体：周报为<b>各共享中心/区域总部</b>（W1~W5）与<b>二级单位（项目）</b>（W6）；月报为<b>14 家二级单位</b>（D1~D6）。组织与用户从 DSC 统一组织主数据同步，支持按任务圈选。</div>' +
    '<div class="dsc-card__title dsc-mb-sm">共享中心 / 区域总部（周报主体）</div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>主体编码</th><th>主体名称</th><th>主数据同步</th><th>填报职责</th><th>角色配置</th><th>操作</th></tr></thead><tbody>' + scRows + '</tbody></table></div>' +
    '<div class="dsc-card__title dsc-mb-sm dsc-mt-lg">二级单位（月报主体 / 周报 W6 填报）</div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>单位编码</th><th>单位名称</th><th>主数据同步</th><th>填报职责</th><th>角色配置</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---------- 导入模板 ---------- */
function cfgTemplate() {
  const mk = (d, meta) =>
    '<tr><td><span class="dsc-dtab__code">' + d + '</span></td>' +
    '<td style="font-weight:var(--font-weight-medium);">' + esc(meta.name) + '</td>' +
    '<td>' + (meta.mode === 'form' ? '单记录表单' : '明细行（≤10000 行）') + '</td>' +
    '<td><span class="dsc-tag dsc-tag--success">与线上口径强一致</span></td>' +
    '<td>2026-09-14（随指标字典自动更新）</td>' +
    '<td class="dsc-table__actions"><button class="dsc-btn dsc-btn--text dsc-btn--sm dsc-text-primary" onclick="toast(\'模板已生成并下载：列头/校验规则由指标字典自动生成\',\'success\')">下载模板</button>' +
    '<button class="dsc-btn dsc-btn--text dsc-btn--sm" onclick="toast(\'模板已重新生成，历史版本留痕可查\',\'success\')">重新生成</button></td></tr>';
  const rows = DATASET_ORDER.map(d => mk(d, DATASETS[d])).join('') +
    W_DATASET_ORDER.map(d => mk(d, W_DATASETS[d])).join('');

  return '<div class="dsc-alert dsc-alert--info dsc-mb-md">模板由指标字典自动生成，保证模板与线上字段、校验规则强一致；指标口径调整后模板自动更新（可用性要求）。周报 W1~W6 与月报 D1~D6 模板分列。</div>' +
    '<div class="dsc-table-wrapper"><table class="dsc-table"><thead><tr><th>编码</th><th>数据集</th><th>填报模式</th><th>口径一致性</th><th>最近生成时间</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
