/* ============================================================
   海外项目数据集指标填报 - Mock 数据层
   依据《DSC-需求规格说明书-海外项目数据集指标填报-V1.0》第五章数据集定义编制
   ============================================================ */

/* 视图注册表（由 views-*.js 填充；需先于视图文件加载） */
window.VIEWS = {};

/* ---------- 角色（SRS 2.3 六类角色，仅用于顶栏「视角演示」下拉示意） ----------
   注：DSC 系统无角色切换入口，功能权限由「系统功能项」授权控制；
   此处 menus 表示该角色的功能项授权范围（示意），不用于左侧菜单过滤。 */
const ROLES = [
  { id: 'admin',   name: '局报送管理员',  user: '王建国 · 局采购管理部',  menus: ['task-manage', 'review', 'summary'] },
  { id: 'reviewer',name: '局级复核人',    user: '李秀芳 · 局物资管理部',  menus: ['review', 'summary'] },
  { id: 'filler',  name: '二级单位填报人', user: '张伟 · 海外公司',      menus: ['my-fill'] },
  { id: 'auditor', name: '二级单位审核人', user: '陈国强 · 海外公司',    menus: ['my-fill', 'review'] },
  { id: 'sysadmin',name: '系统管理员',    user: '系统管理员 · 信息中心', menus: ['config', 'task-manage'] },
  { id: 'viewer',  name: '查看人员',      user: '赵敏 · 局领导',          menus: ['summary'] }
];

/* ---------- 侧边栏子菜单定义（全量展示，不随视角变化） ---------- */
const HYTB_MENUS = [
  { key: 'task-manage', name: '报送任务管理',  breadcrumb: '报送任务管理',  icon: 'task',
    desc: '任务创建下发、六状态进度看板、在线催办（ZY-HY-TB-010）' },
  { key: 'my-fill',     name: '数据填报',     breadcrumb: '数据填报',      icon: 'fill',
    desc: '六类数据集在线填报、批量导入、草稿暂存（ZY-HY-TB-020）' },
  { key: 'review',      name: '审核与退回',   breadcrumb: '审核与退回',    icon: 'review',
    desc: '单位审核、局级复核、退回留痕、审计轨迹（ZY-HY-TB-040）' },
  { key: 'summary',     name: '汇总统计与报表', breadcrumb: '汇总统计与报表', icon: 'summary',
    desc: '自动汇总、率类重算、分供商去重、报表导出（ZY-HY-TB-050）' },
  { key: 'config',      name: '填报基础配置',  breadcrumb: '填报基础配置',  icon: 'config',
    desc: '指标字典、枚举字典、期间与单位配置（ZY-HY-TB-060）' }
];

/* ---------- 二级单位（14 家，SRS 1.3） ---------- */
const UNITS = [
  { id: 'U01', name: '海外公司' },
  { id: 'U02', name: '一公司' },
  { id: 'U03', name: '二公司' },
  { id: 'U04', name: '三公司' },
  { id: 'U05', name: '华北公司' },
  { id: 'U06', name: '华南公司' },
  { id: 'U07', name: '西南公司' },
  { id: 'U08', name: '东北公司' },
  { id: 'U09', name: '上海公司' },
  { id: 'U10', name: '土木公司' },
  { id: 'U11', name: '总承包公司' },
  { id: 'U12', name: '发展建设公司' },
  { id: 'U13', name: '轨道公司' },
  { id: 'U14', name: '新型建造公司' }
];
const UNIT_MAP = {};
UNITS.forEach(u => { UNIT_MAP[u.id] = u.name; });

/* ---------- 数据集定义（D1~D6） ---------- */
const DATASET_ORDER = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const DATASETS = {
  D1: { code: 'D1', name: '采购管理指标',            mode: 'form', unit: '元',  fillFreq: '半年度',
        desc: '物资设备采购、劳务与专业分包采购、采购汇总与资源结构，单位×期间每期一条' },
  D2: { code: 'D2', name: '物资管理指标（混凝土/钢筋）', mode: 'form', unit: 'm³/t', fillFreq: '半年度',
        desc: '混凝土、钢筋消耗与结余节超指标，单位×期间每期一条' },
  D3: { code: 'D3', name: '物资损耗与资产管理指标',   mode: 'form', unit: 't/m³/m²/元', fillFreq: '半年度',
        desc: '钢筋/混凝土/瓷砖损耗率与项目资产周转率，单位×期间每期一条' },
  D4: { code: 'D4', name: '采购及物资管理人员',       mode: 'rows', unit: '人', fillFreq: '半年度',
        desc: '逐人明细行填报，工作年限系统自动计算，支持批量导入 ≤10000 行' },
  D5: { code: 'D5', name: '合格分供商',              mode: 'rows', unit: '家', fillFreq: '半年度',
        desc: '合格分供商名录明细行，按"供应商名称+注册地"查重，汇总自动去重' },
  D6: { code: 'D6', name: '不合格分供商',            mode: 'rows', unit: '家', fillFreq: '半年度',
        desc: '不合格分供商名录明细行，禁用期限结构化，与合格库交叉校验' }
};

/* ---------- 枚举字典（SRS V-E01~V-E03，可配置扩展） ---------- */
const ENUMS = {
  rating:      ['A级-推荐使用', 'B级-建议使用', 'C级-审慎使用'],
  education:  ['博士', '硕士', '本科', '专科及以下'],
  post:        ['采购管理', '物资管理', '采购物资管理'],   // Q2：待收敛为两类
  supplyType:  ['物资', '设备', '租赁', '劳务分包', '专业分包', '服务'],
  category:    ['钢筋及钢材', '混凝土', '瓷砖及装饰材料', '木方模板', '周转材料', '机械设备', '临建设施', '劳务', '专业分包', '物流清关', '生活物资', '办公物资'],
  country:     ['中国', '阿联酋', '沙特阿拉伯', '卡塔尔', '埃及', '阿尔及利亚', '马来西亚', '印度尼西亚', '泰国', '越南', '柬埔寨', '斯里兰卡', '巴基斯坦', '孟加拉国', '肯尼亚', '埃塞俄比亚', '赞比亚', '刚果（金）', '俄罗斯', '乌兹别克斯坦'],
  sharedCenter: ['中东共享中心', '东南亚共享中心', '非洲共享中心', '国内共享中心'],
  gender:      ['男', '女'],
  nationality: ['中国', '其他国家']
};

/* 校验配置（Q4：勾稽偏差阈值，可配置） */
const VALIDATE_CONFIG = {
  deviation: { amount: 1, rate: 0.0001 },   // ±1 元 / ±0.01%
  importMaxRows: 10000
};

/* ---------- 报送任务 ---------- */
const TASKS = [
  {
    id: 'T-2026H1', name: '2026年上半年海外供应链数据报送', status: '进行中',
    year: 2026, period: '2026年上半年', deadline: '2026-09-25',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2026-08-26 10:12', publishTime: '2026-08-28 09:00',
    desc: '请各单位于截止时间前完成六类数据集填报并提交审核，逾期将标记并计入报送情况统计。'
  },
  {
    id: 'T-2026Q3R', name: '2026年三季度人员专项摸底（临时）', status: '草稿',
    year: 2026, period: '2026年三季度', deadline: '2026-10-20',
    scope: ['D4'], unitScope: '海外业务相关单位（10家）',
    createdBy: '王建国', createdAt: '2026-09-09 15:40',
    desc: '应局人力资源部门要求，临时发起的人员专项摸底任务，尚未下发。'
  },
  {
    id: 'T-2025H2', name: '2025年下半年海外供应链数据报送', status: '已截止',
    year: 2025, period: '2025年下半年', deadline: '2026-01-15',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2025-12-20 09:30', publishTime: '2025-12-22 09:00',
    desc: '该期东北公司、发展建设公司部分数据集逾期未报，已按规则标记。'
  },
  {
    id: 'T-2025H1', name: '2025年上半年海外供应链数据报送', status: '已关闭',
    year: 2025, period: '2025年上半年', deadline: '2025-07-15',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2025-06-01 11:00', publishTime: '2025-06-05 09:00',
    desc: '全部单位已通过并完成汇总归档，任务关联填报单已只读。'
  }
];

/* ============================================================
   填报数据仓库（唯一真值：进度看板、审核、汇总均从此读取）
   FILL_STORE[任务][单位][数据集] = { status, zero, values|rows, ... }
   状态机：未开始 → 填报中 → 已提交 →（已退回↔填报中）→ 已通过；逾期为并行标记
   ============================================================ */
const FILL_STORE = {
  'T-2026H1': {
    /* ---- 海外公司（填报人视角主数据） ---- */
    'U01': {
      D1: { status: '已通过', zero: false, lastSubmit: '2026-09-05 16:40', passedBy: '李秀芳', passedTime: '2026-09-08 10:15' },
      D2: { status: '填报中', zero: false },
      D3: { status: '已提交', zero: false, lastSubmit: '2026-09-10 14:32' },
      D4: { status: '已提交', zero: false, lastSubmit: '2026-09-10 14:35' },
      D5: { status: '填报中', zero: false },
      D6: { status: '填报中', zero: false }
    },
    /* ---- 一公司：全部已通过（汇总主力数据） ---- */
    'U02': {
      D1: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:20', passedBy: '王建国', passedTime: '2026-09-04 11:00' },
      D2: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:22', passedBy: '李秀芳', passedTime: '2026-09-04 11:05' },
      D3: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:25', passedBy: '李秀芳', passedTime: '2026-09-04 11:08' },
      D4: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:30', passedBy: '王建国', passedTime: '2026-09-04 11:12' },
      D5: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:35', passedBy: '李秀芳', passedTime: '2026-09-04 11:16' },
      D6: { status: '已通过', zero: false, lastSubmit: '2026-09-03 09:40', passedBy: '李秀芳', passedTime: '2026-09-04 11:20' }
    },
    /* ---- 二公司：D1 已退回（审核/退回场景） ---- */
    'U03': {
      D1: { status: '已退回', zero: false, lastSubmit: '2026-09-06 15:10',
            rejectReason: '劳务与专业分包采购效益额勾稽偏差超阈值（偏差 +2.40 元，超 ±1 元），请核对效益额与对应业主收入口径后重新提交。',
            rejectedBy: '李秀芳', rejectedTime: '2026-09-07 09:45' },
      D2: { status: '填报中', zero: false },
      D3: { status: '未开始', zero: false },
      D4: { status: '已提交', zero: false, lastSubmit: '2026-09-06 15:20' },
      D5: { status: '填报中', zero: false },
      D6: { status: '未开始', zero: false }
    },
    /* ---- 三公司 ---- */
    'U04': {
      D1: { status: '已提交', zero: false, lastSubmit: '2026-09-09 10:00' },
      D2: { status: '已提交', zero: false, lastSubmit: '2026-09-09 10:02' },
      D3: { status: '已提交', zero: false, lastSubmit: '2026-09-09 10:05' },
      D4: { status: '填报中', zero: false },
      D5: { status: '未开始', zero: false },
      D6: { status: '未开始', zero: false }
    },
    /* ---- 华北公司 ---- */
    'U05': {
      D1: { status: '填报中', zero: false }, D2: { status: '未开始', zero: false }, D3: { status: '未开始', zero: false },
      D4: { status: '未开始', zero: false }, D5: { status: '未开始', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 华南公司：全部已通过 ---- */
    'U06': {
      D1: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:10', passedBy: '王建国', passedTime: '2026-09-03 09:30' },
      D2: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:12', passedBy: '李秀芳', passedTime: '2026-09-03 09:33' },
      D3: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:15', passedBy: '李秀芳', passedTime: '2026-09-03 09:36' },
      D4: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:20', passedBy: '王建国', passedTime: '2026-09-03 09:40' },
      D5: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:25', passedBy: '李秀芳', passedTime: '2026-09-03 09:44' },
      D6: { status: '已通过', zero: false, lastSubmit: '2026-09-02 14:30', passedBy: '李秀芳', passedTime: '2026-09-03 09:48' }
    },
    /* ---- 西南公司：线下 #DIV/0! 的典型（线上分母为 0 显示"/"） ---- */
    'U07': {
      D1: { status: '填报中', zero: false }, D2: { status: '填报中', zero: false },
      D3: { status: '已提交', zero: false, lastSubmit: '2026-09-08 17:20', unitAudited: true, unitAuditBy: '刘成（西南公司·审核人）', unitAuditTime: '2026-09-09 10:20' },
      D4: { status: '已提交', zero: false, lastSubmit: '2026-09-08 17:25' },
      D5: { status: '已提交', zero: false, lastSubmit: '2026-09-08 17:30', unitAudited: true, unitAuditBy: '刘成（西南公司·审核人）', unitAuditTime: '2026-09-09 10:25' },
      D6: { status: '未开始', zero: false }
    },
    /* ---- 东北公司：未报送典型（催办目标） ---- */
    'U08': {
      D1: { status: '未开始', zero: false }, D2: { status: '未开始', zero: false }, D3: { status: '未开始', zero: false },
      D4: { status: '未开始', zero: false }, D5: { status: '未开始', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 上海公司：全部已提交，单位审核已通过、待局级复核 ---- */
    'U09': {
      D1: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:00', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:00' },
      D2: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:02', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:02' },
      D3: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:05', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:05' },
      D4: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:08', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:08' },
      D5: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:10', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:10' },
      D6: { status: '已提交', zero: false, lastSubmit: '2026-09-10 09:12', unitAudited: true, unitAuditBy: '马丽（上海公司·审核人）', unitAuditTime: '2026-09-10 16:12' }
    },
    /* ---- 土木公司：填报中 ---- */
    'U10': {
      D1: { status: '填报中', zero: false }, D2: { status: '填报中', zero: false }, D3: { status: '填报中', zero: false },
      D4: { status: '填报中', zero: false }, D5: { status: '填报中', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 总承包公司 ---- */
    'U11': {
      D1: { status: '已通过', zero: false, lastSubmit: '2026-09-04 11:30', passedBy: '王建国', passedTime: '2026-09-05 10:00' },
      D2: { status: '已通过', zero: false, lastSubmit: '2026-09-04 11:32', passedBy: '李秀芳', passedTime: '2026-09-05 10:04' },
      D3: { status: '已通过', zero: false, lastSubmit: '2026-09-04 11:35', passedBy: '李秀芳', passedTime: '2026-09-05 10:07' },
      D4: { status: '填报中', zero: false }, D5: { status: '未开始', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 发展建设公司：未报送典型（催办目标） ---- */
    'U12': {
      D1: { status: '未开始', zero: false }, D2: { status: '未开始', zero: false }, D3: { status: '未开始', zero: false },
      D4: { status: '未开始', zero: false }, D5: { status: '未开始', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 轨道公司：D1 已退回（劳务效益率线下 #DIV/0! 典型） ---- */
    'U13': {
      D1: { status: '已退回', zero: false, lastSubmit: '2026-09-04 16:00',
            rejectReason: '物资设备采购效益额勾稽校验失败：效益额与"对应业主收入−采购总金额"偏差超 ±1 元；另请核实劳务与专业分包区块，线下报表该区块曾出现 #DIV/0!。',
            rejectedBy: '王建国', rejectedTime: '2026-09-05 09:20' },
      D2: { status: '未开始', zero: false }, D3: { status: '未开始', zero: false },
      D4: { status: '未开始', zero: false }, D5: { status: '未开始', zero: false }, D6: { status: '未开始', zero: false }
    },
    /* ---- 新型建造公司 ---- */
    'U14': {
      D1: { status: '填报中', zero: false }, D2: { status: '填报中', zero: false }, D3: { status: '填报中', zero: false },
      D4: { status: '填报中', zero: false }, D5: { status: '填报中', zero: false }, D6: { status: '未开始', zero: false }
    }
  },
  /* ---- T-2025H2：已截止任务，含已逾期状态演示 ---- */
  'T-2025H2': {},
  'T-2025H1': {}
};

/* T-2025H2：11 家全部通过，3 家逾期未报 */
(function () {
  const store = FILL_STORE['T-2025H2'];
  UNITS.forEach(u => {
    store[u.id] = {};
    const overdue = (u.id === 'U08' || u.id === 'U12' || u.id === 'U14');
    DATASET_ORDER.forEach(d => {
      store[u.id][d] = overdue
        ? { status: '已逾期', zero: false, reason: '总结未报送' }
        : { status: '已通过', zero: false, lastSubmit: '2026-01-10 15:00', passedBy: '王建国', passedTime: '2026-01-12 10:00' };
    });
    if (overdue) { store[u.id].D1.reason = '数据未报送'; }
  });
})();

/* T-2025H1：全部通过（已关闭） */
(function () {
  const store = FILL_STORE['T-2025H1'];
  UNITS.forEach(u => {
    store[u.id] = {};
    DATASET_ORDER.forEach(d => {
      store[u.id][d] = { status: '已通过', zero: false, lastSubmit: '2025-07-10 10:00', passedBy: '王建国', passedTime: '2025-07-12 09:00' };
    });
  });
})();

/* ============================================================
   D1 采购管理指标 - 表单区块定义（SRS 5.1，计算字段口径权威定义）
   type: number=填报 / calc=计算（置灰）
   ============================================================ */
const D1_SECTIONS = [
  {
    key: 'wz', title: '物资设备采购', fields: [
      { key: 'wz_income',  label: '对应业主收入',     type: 'number', unit: '元', required: true, tip: '总包合同约定或过程确认的物资设备（不含税）收入' },
      { key: 'wz_cost',    label: '标准成本总金额',   type: 'number', unit: '元', required: true, tip: '物资设备标准成本合计' },
      { key: 'wz_purchase', label: '采购总金额',      type: 'number', unit: '元', required: true, tip: '物资设备实际采购金额（不含税）' },
      { key: 'wz_benefit', label: '采购效益额',       type: 'calc',   unit: '元', formula: '对应业主收入 − 采购总金额' },
      { key: 'wz_benefit_rate', label: '采购效益率',  type: 'calc',   unit: '%', formula: '效益额 ÷ 对应业主收入' },
      { key: 'wz_reduce',  label: '采购成本降低额',   type: 'calc',   unit: '元', formula: '标准成本总金额 − 采购总金额' },
      { key: 'wz_reduce_rate', label: '采购成本降低率', type: 'calc', unit: '%', formula: '成本降低额 ÷ 标准成本总金额' }
    ]
  },
  {
    key: 'lw', title: '劳务与专业分包采购', fields: [
      { key: 'lw_income',  label: '对应业主收入',     type: 'number', unit: '元', required: true, tip: '口径同物资设备区块，范围为劳务与专业分包' },
      { key: 'lw_cost',    label: '标准成本总金额',   type: 'number', unit: '元', required: true, tip: '口径同物资设备区块，范围为劳务与专业分包' },
      { key: 'lw_purchase', label: '采购总金额',      type: 'number', unit: '元', required: true, tip: '口径同物资设备区块，范围为劳务与专业分包' },
      { key: 'lw_benefit', label: '采购效益额',       type: 'calc',   unit: '元', formula: '对应业主收入 − 采购总金额' },
      { key: 'lw_benefit_rate', label: '采购效益率',  type: 'calc',   unit: '%', formula: '效益额 ÷ 对应业主收入' },
      { key: 'lw_reduce',  label: '采购成本降低额',   type: 'calc',   unit: '元', formula: '标准成本总金额 − 采购总金额' },
      { key: 'lw_reduce_rate', label: '采购成本降低率', type: 'calc', unit: '%', formula: '成本降低额 ÷ 标准成本总金额' }
    ]
  },
  {
    key: 'sum', title: '采购汇总与资源结构', calcOnly: true, fields: [
      { key: 'sum_purchase', label: '采购总金额',       type: 'calc', unit: '元', formula: '物资设备采购总金额 + 劳务与专业分包采购总金额' },
      { key: 'sum_benefit',  label: '采购效益总额',     type: 'calc', unit: '元', formula: '物资设备效益额 + 劳务与专业分包效益额' },
      { key: 'sum_benefit_rate', label: '综合采购效益率', type: 'calc', unit: '%', formula: '效益总额 ÷ 对应业主收入合计' },
      { key: 'sum_reduce',   label: '采购成本降低总额', type: 'calc', unit: '元', formula: '物资设备降低额 + 劳务与专业分包降低额' },
      { key: 'sum_reduce_rate', label: '综合采购成本降低率', type: 'calc', unit: '%', formula: '降低总额 ÷ 标准成本总金额合计' },
      { key: 'zg_amount', label: '中国资源引用金额',   type: 'number', unit: '元', required: true, tip: '当期采购中引用中国资源的金额' },
      { key: 'zg_rate',   label: '中国资源引入率',     type: 'calc',   unit: '%', formula: '中国资源引用金额 ÷ 采购总金额' },
      { key: 'jc_amount', label: '物资设备集采引用金额', type: 'number', unit: '元', required: true, tip: '纳入局/公司集采的物资设备金额' },
      { key: 'jc_rate',   label: '物资设备集采率',     type: 'calc',   unit: '%', formula: '集采引用金额 ÷ 物资设备采购总金额' },
      { key: 'dc_amount', label: '厂家/一级代理直采金额', type: 'number', unit: '元', required: true, tip: '向厂家或一级代理直采的物资设备金额' },
      { key: 'dc_rate',   label: '直采率',             type: 'calc',   unit: '%', formula: '直采金额 ÷ 物资设备采购总金额' }
    ]
  }
];

/* D1 填报值（元）：[业主收入, 标准成本, 采购金额] × 物资设备 + 劳务分包 + 中国资源, 集采, 直采 */
const D1_TUPLES = {
  U01: [386500000, 342800000, 331200000, 215000000, 198600000, 203400000, 268000000, 142600000, 88400000],
  U02: [523400000, 465200000, 448600000, 312800000, 291500000, 298700000, 356200000, 198800000, 124500000],
  U06: [298700000, 268500000, 259100000, 176400000, 165800000, 168900000, 201500000, 112300000, 72600000],
  U11: [189200000, 172500000, 166800000, 98500000, 93200000, 94800000, 126800000, 71500000, 45300000],
  U04: [215600000, 198700000, 191500000, 132400000, 124600000, 126900000, 142300000, 83500000, 52100000],
  U09: [176800000, 163200000, 158400000, 104500000, 98700000, 100600000, 112600000, 64800000, 41200000],
  U13: [98500000, 91200000, 88600000, 0, 0, 0, 62300000, 35800000, 22400000],          // 劳务分包本期无业务（线下曾 #DIV/0!）
  U07: [0, 0, 0, 0, 0, 0, 0, 0, 0],                                                     // 本期暂无采购业务（线下全表 #DIV/0!，线上显示"/"）
  U03: [268400000, 246500000, 238900000, 158700000, 148200000, 151200000, 178500000, 98600000, 63400000],
  U05: [142300000, 131500000, 127800000, 86500000, 82100000, 83600000, 96500000, 54300000, 34200000],
  U10: [187600000, 172800000, 168300000, 112400000, 105600000, 107200000, 124600000, 72300000, 45800000],
  U14: [96400000, 89200000, 86800000, 58200000, 55100000, 55900000, 65200000, 37200000, 23600000]
};

/* D2 物资管理指标 - 区块定义（SRS 5.2）
   混凝土(m³)：采购量/临建用量/措施用量/图纸同口径用量/图纸计算量 → 结余率(计算)
   钢筋(t)：采购量/调入/调出/库存量/实际用量/措施用量/临建用量 → 同口径用量(计算)/图纸量/节超量/节超率(计算) */
const D2_SECTIONS = [
  {
    key: 'hnt', title: '混凝土（m³）', fields: [
      { key: 'hnt_cgL',  label: '采购量',          type: 'number', unit: 'm³', required: true, tip: '当期混凝土采购总量（开累口径）' },
      { key: 'hnt_ljL',  label: '临建用量',        type: 'number', unit: 'm³', required: true, tip: '临建设施消耗量' },
      { key: 'hnt_csL',  label: '措施用量',        type: 'number', unit: 'm³', required: true, tip: '措施项目消耗量' },
      { key: 'hnt_tkL',  label: '图纸同口径用量',  type: 'number', unit: 'm³', required: true, tip: '与图纸口径一致的实际消耗量' },
      { key: 'hnt_tuL',  label: '图纸计算量',      type: 'number', unit: 'm³', required: true, tip: '按施工图计算量' },
      { key: 'hnt_jyl',  label: '结余率',          type: 'calc',   unit: '%',  formula: '（图纸同口径用量 − 图纸计算量）÷ 图纸计算量' }
    ]
  },
  {
    key: 'gj', title: '钢筋（t）', fields: [
      { key: 'gj_cgL', label: '采购量',     type: 'number', unit: 't', required: true, tip: '当期钢筋采购总量（开累口径）' },
      { key: 'gj_dr',  label: '调入',       type: 'number', unit: 't', required: true, tip: '调拨调入量' },
      { key: 'gj_dc',  label: '调出',       type: 'number', unit: 't', required: true, tip: '调拨调出量' },
      { key: 'gj_kc',  label: '库存量',     type: 'number', unit: 't', required: true, tip: '期末库存' },
      { key: 'gj_syL', label: '实际用量',   type: 'number', unit: 't', required: true, tip: '实际消耗总量' },
      { key: 'gj_csL', label: '措施用量',   type: 'number', unit: 't', required: true, tip: '措施项目钢筋消耗量' },
      { key: 'gj_ljL', label: '临建用量',   type: 'number', unit: 't', required: true, tip: '临建设施钢筋消耗量' },
      { key: 'gj_tkL', label: '同口径用量', type: 'calc',   unit: 't',  formula: '实际用量 − 措施用量 − 临建用量' },
      { key: 'gj_tuL', label: '图纸量',     type: 'number', unit: 't', required: true, tip: '钢筋图纸净用量' },
      { key: 'gj_jcl', label: '节超量',     type: 'calc',   unit: 't',  formula: '图纸量 − 同口径用量' },
      { key: 'gj_jclv', label: '节超率',   type: 'calc',   unit: '%',  formula: '节超量 ÷ 图纸量' }
    ]
  }
];

/* D2 填报值：[混凝土5项] + [钢筋8项(不含计算)] */
const D2_TUPLES = {
  U01: [128600, 3200, 8600, 115400, 113800, 42600, 1850, 2600, 4900, 39800, 3200, 1850, 35200],
  U02: [186400, 4800, 12600, 167200, 164800, 62500, 2600, 3500, 7800, 58200, 4600, 2700, 51600],
  U06: [98600, 2400, 6200, 88200, 86400, 33800, 1400, 2100, 4600, 31600, 2500, 1500, 28400],
  U11: [62400, 1500, 3900, 55800, 54600, 21600, 900, 1300, 2900, 20100, 1600, 950, 18200],
  U04: [84600, 2100, 5300, 75800, 74200, 29400, 1200, 1800, 3900, 27300, 2200, 1300, 24600],
  U09: [68200, 1700, 4300, 61200, 60100, 23800, 1000, 1500, 3300, 22100, 1750, 1050, 19800],
  U07: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  U03: [102400, 2600, 6800, 91800, 90200, 35600, 1500, 2200, 4700, 33100, 2600, 1600, 29800],
  U05: [56200, 1400, 3500, 50400, 49500, 19400, 800, 1200, 2600, 18000, 1450, 850, 16300],
  U10: [76800, 1900, 4800, 69000, 67600, 26600, 1100, 1700, 3600, 24700, 2000, 1200, 22300],
  U14: [42800, 1100, 2700, 38400, 37700, 14800, 600, 900, 2000, 13700, 1100, 650, 12400]
};

/* D3 物资损耗与资产管理指标 - 区块定义（SRS 5.3） */
const D3_SECTIONS = [
  {
    key: 'gj', title: '钢筋损耗（t）', fields: [
      { key: 'gj_cgL',  label: '钢筋采购总量',  type: 'number', unit: 't', required: true, tip: '当期钢筋采购总量' },
      { key: 'gj_tuL',  label: '钢筋图纸净用量', type: 'number', unit: 't', required: true, tip: '按施工图纸计算的净用量' },
      { key: 'gj_syL',  label: '钢筋实际用量',  type: 'number', unit: 't', required: true, tip: '实际消耗量' },
      { key: 'gj_shl',  label: '钢筋损耗率',     type: 'calc',   unit: '%', formula: '（实际用量 − 图纸净用量）÷ 图纸净用量' }
    ]
  },
  {
    key: 'hnt', title: '混凝土损耗（m³）', fields: [
      { key: 'hnt_ysL', label: '施工图预算量',   type: 'number', unit: 'm³', required: true, tip: '按施工图预算量' },
      { key: 'hnt_xhL', label: '实际消耗量',     type: 'number', unit: 'm³', required: true, tip: '当期混凝土实际消耗量' },
      { key: 'hnt_shl', label: '混凝土损耗率',   type: 'calc',   unit: '%',  formula: '（实际消耗量 − 施工图预算量）÷ 施工图预算量' }
    ]
  },
  {
    key: 'cz', title: '瓷砖损耗（m²）', fields: [
      { key: 'cz_ysL', label: '排版后施工图预算量', type: 'number', unit: 'm²', required: true, tip: '排版后的施工图预算量' },
      { key: 'cz_xhL', label: '实际消耗量',         type: 'number', unit: 'm²', required: true, tip: '当期瓷砖实际消耗量' },
      { key: 'cz_shl', label: '施工损耗率',         type: 'calc',   unit: '%',  formula: '（实际消耗量 − 排版预算量）÷ 排版预算量' }
    ]
  },
  {
    key: 'zc', title: '项目资产管理（元）', fields: [
      { key: 'zc_yz', label: '项目资产原值金额', type: 'number', unit: '元', required: true, tip: '项目在管资产原值合计' },
      { key: 'zc_dc', label: '调出资产原值金额', type: 'number', unit: '元', required: true, tip: '当期调出资产原值合计' },
      { key: 'zc_zzl', label: '项目资产周转率',   type: 'calc',   unit: '%',  formula: '调出资产原值 ÷ 项目资产原值' }
    ]
  }
];

/* D3 填报值：[钢筋3项, 混凝土2项, 瓷砖2项, 资产2项] */
const D3_TUPLES = {
  U01: [39800, 35200, 36150, 113800, 115620, 28600, 29240, 48600000, 5320000],
  U02: [58200, 51600, 52980, 164800, 166950, 41500, 42180, 76400000, 8940000],
  U06: [31600, 28400, 29150, 86400, 87300, 22300, 22680, 51200000, 5860000],
  U11: [20100, 18200, 18690, 54600, 55200, 14200, 14430, 34800000, 3720000],
  U04: [27300, 24600, 25230, 74200, 74900, 19100, 19420, 42600000, 4630000],
  U09: [22100, 19800, 20310, 60100, 60700, 15600, 15830, 35400000, 3810000],
  U07: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  U03: [33100, 29800, 30560, 90200, 91000, 23400, 23760, 51800000, 5650000],
  U05: [18000, 16300, 16720, 49500, 49900, 12800, 13010, 28600000, 3020000],
  U10: [24700, 22300, 22870, 67600, 68200, 17600, 17870, 39200000, 4250000],
  U14: [13700, 12400, 12730, 37700, 38000, 9800, 9940, 21600000, 2340000]
};
/* 瓷砖损耗率线下 #DIV/0! 的 6 家单位（分母为 0 → 线上显示"/"） */
const D3_ZERO_TILE_UNITS = ['U03', 'U05', 'U07', 'U09', 'U10', 'U14'];

/* ============================================================
   D4 采购及物资管理人员 - 明细行数据（SRS 5.4）
   ============================================================ */
const D4_COLUMNS = [
  { key: 'seq',       label: '序号',           width: '48px' },
  { key: 'dept',      label: '三级单位',        edit: true },
  { key: 'project',   label: '所在部门/项目名称', edit: true },
  { key: 'name',      label: '姓名',           edit: true },
  { key: 'empNo',     label: '员工编号',        edit: true, tip: 'A/Y/B/WG 开头；无编号填"/"' },
  { key: 'nationality', label: '国籍',         edit: true, enum: 'nationality' },
  { key: 'gender',    label: '性别',           edit: true, enum: 'gender' },
  { key: 'age',       label: '年龄',           edit: true },
  { key: 'education', label: '学历',           edit: true, enum: 'education' },
  { key: 'major',     label: '所学专业',        edit: true },
  { key: 'workStart', label: '参加工作起始时间',  edit: true, tip: 'yyyy/MM/dd' },
  { key: 'workYears', label: '工作年限',        calc: true, formula: '起始时间至报送截止日自动取整' },
  { key: 'joinStart', label: '入职本公司起始时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'joinYears', label: '本公司工作年限',   calc: true },
  { key: 'dutyStart', label: '从事采购/物资本职起始时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'dutyYears', label: '本职工作年限',     calc: true },
  { key: 'position',  label: '现任职务',        edit: true },
  { key: 'title',     label: '专业技术职称',    edit: true },
  { key: 'cert1',     label: '一级注册造价师',  check: true },
  { key: 'cert2',     label: '一级建造师',      check: true },
  { key: 'certOther', label: '持证-其它',       edit: true },
  { key: 'post',      label: '从事岗位',        edit: true, enum: 'post' },
  { key: 'fullTime',  label: '专职/兼职',       edit: true, enum: ['专职', '兼职'] },
  { key: 'mainJob',   label: '主职岗位',        edit: true, tip: '兼职时必填' },
  { key: 'phone',     label: '联系电话',        edit: true },
  { key: 'history',   label: '八局系统内工作履历', edit: true }
];

const D4_ROWS_U01 = [
  { id: 'R1', dept: '海外事业部', project: '迪拜绿地中心项目部', name: '张伟', empNo: 'Y20210086', nationality: '中国', gender: '男', age: 35, education: '本科', major: '工程管理', workStart: '2013/07/01', joinStart: '2015/03/12', dutyStart: '2013/07/01', position: '采购负责人', title: '工程师', cert1: false, cert2: true, certOther: '/', post: '采购管理', fullTime: '专职', phone: '13800138001', history: '2015年入职一公司，2019年调入海外公司' },
  { id: 'R2', dept: '国际工程公司', project: '利雅得地铁项目部', name: '李强', empNo: 'Y20180123', nationality: '中国', gender: '男', age: 41, education: '硕士', major: '土木工程', workStart: '2008/07/01', joinStart: '2010/07/01', dutyStart: '2008/07/01', position: '材料主管', title: '高级工程师', cert1: false, cert2: true, certOther: 'PMP', post: '物资管理', fullTime: '专职', phone: '13912340122', history: '2010年入职局总部，2016年外派沙特' },
  { id: 'R3', dept: '海外事业部', project: '开罗新行政首都项目', name: 'Fatima Al-Sayed', empNo: '/', nationality: '其他国家', gender: '女', age: 28, education: '本科', major: 'Business Administration', workStart: '2021/06/15', joinStart: '2022/02/01', dutyStart: '2021/06/15', position: '采购专员', title: '/', cert1: false, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '+20-100-1234567', history: '2022年属地化招聘' },
  { id: 'R4', dept: '国际工程公司', project: '吉隆坡CBD项目部', name: '王芳', empNo: 'Y20220045', nationality: '中国', gender: '女', age: 30, education: '硕士', major: '物流管理', workStart: '2019/07/01', joinStart: '2022/07/01', dutyStart: '2019/07/01', position: '材料工程师', title: '助理工程师', cert1: false, cert2: false, certOther: '/', post: '物资管理', fullTime: '兼职', mainJob: '项目商务经理', phone: '13711220033', history: '2022年入职，兼职物资管理' },
  { id: 'R5', dept: '海外事业部', project: '内罗毕商务中心项目', name: 'Michael Otieno', empNo: '/', nationality: '其他国家', gender: '男', age: 33, education: '专科及以下', major: 'Procurement', workStart: '2014/09/01', joinStart: '2020/05/20', dutyStart: '2014/09/01', position: '采购协调员', title: '/', cert1: false, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '+254-712-345678', history: '2020年属地化招聘' },
  { id: 'R6', dept: '国际工程公司', project: '曼谷智慧产业园项目', name: '陈磊', empNo: 'B20190210', nationality: '中国', gender: '男', age: 38, education: '本科', major: '机械工程', workStart: '2011/07/01', joinStart: '2013/01/15', dutyStart: '2011/07/01', position: '设备主管', title: '工程师', cert1: false, cert2: false, certOther: '工程师（设备）', post: '物资管理', fullTime: '专职', phone: '13655556666', history: '2013年入职三公司，2021年调入海外公司' },
  /* 预置校验问题行：R7 员工编号与 R1 重复（V-C02）；R8 联系电话格式错误（V-F03） */
  { id: 'R7', dept: '海外事业部', project: '迪拜港口物流园项目', name: '刘洋', empNo: 'Y20210086', nationality: '中国', gender: '男', age: 32, education: '本科', major: '国际经济与贸易', workStart: '2016/07/01', joinStart: '2018/09/01', dutyStart: '2016/07/01', position: '采购工程师', title: '助理工程师', cert1: false, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '13566778899', history: '' },
  { id: 'R8', dept: '国际工程公司', project: '雅加达住宅开发项目', name: 'Ahmed Hassan', empNo: '/', nationality: '其他国家', gender: '男', age: 36, education: '本科', major: 'Civil Engineering', workStart: '2012/03/01', joinStart: '2019/11/01', dutyStart: '2012/03/01', position: '物资协调员', title: '/', cert1: false, cert2: false, certOther: '/', post: '物资管理', fullTime: '专职', phone: '62-812-3456', history: '' }
];

const D4_ROWS_U02 = [
  { id: 'R1', dept: '海外工程分公司', project: '多哈展馆项目部', name: '赵鹏', empNo: 'A20150330', nationality: '中国', gender: '男', age: 43, education: '本科', major: '工程管理', workStart: '2006/07/01', joinStart: '2008/07/01', dutyStart: '2006/07/01', position: '采购经理', title: '高级工程师', cert1: true, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '13611112222', history: '' },
  { id: 'R2', dept: '海外工程分公司', project: '多哈展馆项目部', name: '钱进', empNo: 'A20200456', nationality: '中国', gender: '男', age: 31, education: '硕士', major: '材料科学', workStart: '2017/07/01', joinStart: '2020/07/01', dutyStart: '2017/07/01', position: '材料工程师', title: '助理工程师', cert1: false, cert2: false, certOther: '/', post: '物资管理', fullTime: '专职', phone: '13733334444', history: '' },
  { id: 'R3', dept: '国际事务部', project: '机关采购部', name: '孙悦', empNo: 'A20120789', nationality: '中国', gender: '女', age: 40, education: '本科', major: '国际贸易', workStart: '2009/07/01', joinStart: '2012/07/01', dutyStart: '2009/07/01', position: '采购主管', title: '经济师', cert1: false, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '13855556666', history: '' }
];

const D4_ROWS_U06 = [
  { id: 'R1', dept: '海外分公司', project: '胡志明市电厂项目', name: '周涛', empNo: 'Y20160890', nationality: '中国', gender: '男', age: 37, education: '本科', major: '机械设计', workStart: '2012/07/01', joinStart: '2014/07/01', dutyStart: '2012/07/01', position: '物资经理', title: '工程师', cert1: false, cert2: true, certOther: '/', post: '物资管理', fullTime: '专职', phone: '13977778888', history: '' },
  { id: 'R2', dept: '海外分公司', project: '金边商业广场项目', name: '吴敏', empNo: 'Y20210912', nationality: '中国', gender: '女', age: 29, education: '硕士', major: '供应链管理', workStart: '2020/07/01', joinStart: '2021/07/01', dutyStart: '2020/07/01', position: '采购工程师', title: '/', cert1: false, cert2: false, certOther: '/', post: '采购管理', fullTime: '专职', phone: '13099990000', history: '' }
];

FILL_STORE['T-2026H1']['U01'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U01));
FILL_STORE['T-2026H1']['U02'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U02));
FILL_STORE['T-2026H1']['U06'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U06));

/* ============================================================
   D5 合格分供商 - 明细行数据（SRS 5.5）
   ============================================================ */
const D5_COLUMNS = [
  { key: 'seq',      label: '序号',       width: '48px' },
  { key: 'type',     label: '供货类型',   edit: true, enum: 'supplyType' },
  { key: 'name',     label: '供应商名称', edit: true, tip: '企业全称，与 DSC 供应商主数据自动匹配关联编码' },
  { key: 'region',   label: '注册地',     edit: true, tip: '注册地址或所在国别' },
  { key: 'contact',  label: '联系人',     edit: true },
  { key: 'phone',    label: '联系电话',   edit: true, tip: '支持国际号码格式' },
  { key: 'email',    label: '电子邮箱',   edit: true },
  { key: 'inTime',   label: '入库时间',   edit: true, tip: 'yyyy/MM/dd' },
  { key: 'inspector', label: '考察人',    edit: true, tip: '多人用顿号分隔' },
  { key: 'biz',      label: '业务往来',   edit: true, tip: '如钢筋供应、泵车租赁、主体劳务等' },
  { key: 'category', label: '品类',       edit: true, enum: 'category' },
  { key: 'advDesc',  label: '优势与劣势描述', edit: true },
  { key: 'rating',   label: '供应商评级', edit: true, enum: 'rating' },
  { key: 'countries', label: '可供应国别', edit: true, enum: 'country', multi: true },
  { key: 'hq',       label: '总部地址',   edit: true, tip: '无则填"/"' },
  { key: 'center',   label: '所属共享中心', edit: true, enum: 'sharedCenter' }
];

/* 海外公司 D5 行（含预置查重问题行 R9：与 R1 同名同注册地 → V-C03 阻断） */
const D5_ROWS_U01 = [
  { id: 'R1', type: '物资', name: '中东建材贸易有限责任公司', region: '阿联酋·迪拜', contact: '王立新', phone: '+971-4-885-2121', email: 'sales@me-bm.ae', inTime: '2025/03/15', inspector: '张伟、李强', biz: '钢筋供应、水泥供应', category: '钢筋及钢材', advDesc: '供货稳定、账期灵活；高峰期运力紧张', rating: 'A级-推荐使用', countries: ['阿联酋', '沙特阿拉伯', '卡塔尔'], hq: '/', center: '中东共享中心' },
  { id: 'R2', type: '租赁', name: '迪拜环球设备租赁公司', region: '阿联酋·迪拜', contact: 'Omar', phone: '+971-50-662-1100', email: 'rent@dubai-eq.ae', inTime: '2024/11/02', inspector: '陈磊', biz: '塔吊、泵车租赁', category: '机械设备', advDesc: '设备保有量大、响应快', rating: 'B级-建议使用', countries: ['阿联酋'], hq: '/', center: '中东共享中心' },
  { id: 'R3', type: '物资', name: '沙特华新水泥制品厂', region: '沙特阿拉伯·利雅得', contact: 'Saleh', phone: '+966-11-461-5500', email: 'info@huaxin-sa.com', inTime: '2025/01/20', inspector: '李强', biz: '商品混凝土供应', category: '混凝土', advDesc: '利雅得周边 3 个搅拌站，夜间供应能力强', rating: 'A级-推荐使用', countries: ['沙特阿拉伯'], hq: '/', center: '中东共享中心' },
  { id: 'R4', type: '物资', name: '开罗尼罗河石材有限公司', region: '埃及·开罗', contact: 'Hassan', phone: '+20-2-3371-4200', email: 'hassan@nile-stone.eg', inTime: '2025/05/08', inspector: '王芳', biz: '瓷砖、大理石供应', category: '瓷砖及装饰材料', advDesc: '本地稀缺石材资源；价格偏高', rating: 'B级-建议使用', countries: ['埃及'], hq: '/', center: '非洲共享中心' },
  { id: 'R5', type: '劳务分包', name: '中埃建设劳务合作公司', region: '埃及·开罗', contact: '马建国', phone: '+20-2-2521-7800', email: 'mc@cn-eg.com', inTime: '2024/08/12', inspector: '张伟', biz: '主体劳务、砌筑劳务', category: '劳务', advDesc: '属地工人 800 余人，工种齐全', rating: 'A级-推荐使用', countries: ['埃及', '阿尔及利亚'], hq: '中国·北京', center: '非洲共享中心' },
  { id: 'R6', type: '服务', name: '吉隆坡快捷物流公司', region: '马来西亚·吉隆坡', contact: 'Lim Wei', phone: '+60-3-2181-4400', email: 'cs@kl-express.my', inTime: '2025/06/30', inspector: 'Michael Otieno', biz: '物流清关、仓储配送', category: '物流清关', advDesc: '清关时效快；单票费用高', rating: 'C级-审慎使用', countries: ['马来西亚', '泰国'], hq: '/', center: '东南亚共享中心' },
  { id: 'R7', type: '物资', name: '曼谷金桥木业有限公司', region: '泰国·曼谷', contact: 'Somchai', phone: '+66-2-329-1800', email: 'sale@goldbridge-th.co', inTime: '2025/02/14', inspector: '陈磊', biz: '木方、模板供应', category: '木方模板', advDesc: '价格低；含水率控制一般', rating: 'B级-建议使用', countries: ['泰国', '柬埔寨'], hq: '/', center: '东南亚共享中心' },
  { id: 'R9', type: '物资', name: '中东建材贸易有限责任公司', region: '阿联酋·迪拜', contact: '王立新', phone: '+971-4-885-2121', email: '', inTime: '2026/09/10', inspector: '张伟', biz: '钢筋供应', category: '钢筋及钢材', advDesc: '', rating: 'A级-推荐使用', countries: ['阿联酋'], hq: '/', center: '中东共享中心' }
];

const D5_ROWS_U02 = [
  { id: 'R1', type: '物资', name: '中东建材贸易有限责任公司', region: '阿联酋·迪拜', contact: '王立新', phone: '+971-4-885-2121', email: 'sales@me-bm.ae', inTime: '2025/03/15', inspector: '赵鹏', biz: '钢筋供应', category: '钢筋及钢材', advDesc: '跨单位共用供应商', rating: 'A级-推荐使用', countries: ['阿联酋', '卡塔尔'], hq: '/', center: '中东共享中心' },
  { id: 'R2', type: '设备', name: '多哈石油机械公司', region: '卡塔尔·多哈', contact: 'Ali', phone: '+974-4444-8800', email: 'ali@doha-mach.qa', inTime: '2024/09/25', inspector: '钱进', biz: '施工机械销售与维保', category: '机械设备', advDesc: '', rating: 'B级-建议使用', countries: ['卡塔尔'], hq: '/', center: '中东共享中心' },
  { id: 'R3', type: '专业分包', name: '新加坡精工机电安装公司', region: '新加坡', contact: 'Tan', phone: '+65-6222-3300', email: 'eng@sg-precision.sg', inTime: '2025/04/11', inspector: '孙悦', biz: '机电安装专业分包', category: '专业分包', advDesc: '技术能力强', rating: 'A级-推荐使用', countries: ['新加坡', '马来西亚'], hq: '/', center: '东南亚共享中心' },
  { id: 'R4', type: '物资', name: '俄罗斯西伯利亚木材集团', region: '俄罗斯·符拉迪沃斯托克', contact: 'Ivan', phone: '+7-423-222-5500', email: 'trade@sib-wood.ru', inTime: '2025/07/19', inspector: '赵鹏', biz: '木方、原木供应', category: '木方模板', advDesc: '', rating: 'B级-建议使用', countries: ['俄罗斯'], hq: '/', center: '国内共享中心' }
];

const D5_ROWS_U06 = [
  { id: 'R1', type: '物资', name: '胡志明市南方钢铁贸易公司', region: '越南·胡志明市', contact: 'Nguyen', phone: '+84-28-3822-1100', email: 'sales@vn-steel.vn', inTime: '2025/03/02', inspector: '周涛', biz: '螺纹钢、线材供应', category: '钢筋及钢材', advDesc: '', rating: 'A级-推荐使用', countries: ['越南'], hq: '/', center: '东南亚共享中心' },
  { id: 'R2', type: '物资', name: '曼谷金桥木业有限公司', region: '泰国·曼谷', contact: 'Somchai', phone: '+66-2-329-1800', email: 'sale@goldbridge-th.co', inTime: '2025/02/14', inspector: '吴敏', biz: '木方模板供应', category: '木方模板', advDesc: '与海外公司共用供应商', rating: 'B级-建议使用', countries: ['泰国'], hq: '/', center: '东南亚共享中心' },
  { id: 'R3', type: '服务', name: '金边德胜翻译服务中心', region: '柬埔寨·金边', contact: 'Sophea', phone: '+855-23-991-200', email: 'sophea@pp-lang.kh', inTime: '2025/08/05', inspector: '吴敏', biz: '翻译、商务代办', category: '生活物资', advDesc: '', rating: 'C级-审慎使用', countries: ['柬埔寨'], hq: '/', center: '东南亚共享中心' },
  { id: 'R4', type: '物资', name: '中东建材贸易有限责任公司', region: '阿联酋·迪拜', contact: '王立新', phone: '+971-4-885-2121', email: 'sales@me-bm.ae', inTime: '2025/03/15', inspector: '周涛', biz: '钢筋供应', category: '钢筋及钢材', advDesc: '与一公司共用供应商（跨单位重复，汇总自动去重）', rating: 'A级-推荐使用', countries: ['阿联酋'], hq: '/', center: '中东共享中心' }
];

const D5_ROWS_U09 = [
  { id: 'R1', type: '物资', name: '开罗尼罗河石材有限公司', region: '埃及·开罗', contact: 'Hassan', phone: '+20-2-3371-4200', email: 'hassan@nile-stone.eg', inTime: '2025/05/08', inspector: '马丽', biz: '石材供应', category: '瓷砖及装饰材料', advDesc: '与西南公司共用供应商', rating: 'B级-建议使用', countries: ['埃及'], hq: '/', center: '非洲共享中心' },
  { id: 'R2', type: '服务', name: '胡志明新港物流公司', region: '越南·胡志明市', contact: 'Trung', phone: '+84-28-3555-6600', email: 'ops@hcm-port.vn', inTime: '2025/09/18', inspector: '马丽', biz: '港口物流、仓储', category: '物流清关', advDesc: '', rating: 'B级-建议使用', countries: ['越南'], hq: '/', center: '东南亚共享中心' }
];

const D5_ROWS_U07 = [
  { id: 'R1', type: '物资', name: '开罗尼罗河石材有限公司', region: '埃及·开罗', contact: 'Hassan', phone: '+20-2-3371-4200', email: 'hassan@nile-stone.eg', inTime: '2025/05/08', inspector: '刘成', biz: '石材供应', category: '瓷砖及装饰材料', advDesc: '跨单位共用', rating: 'B级-建议使用', countries: ['埃及'], hq: '/', center: '非洲共享中心' }
];

FILL_STORE['T-2026H1']['U01'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U01));
FILL_STORE['T-2026H1']['U02'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U02));
FILL_STORE['T-2026H1']['U06'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U06));
FILL_STORE['T-2026H1']['U07'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U07));
FILL_STORE['T-2026H1']['U09'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U09));

/* ============================================================
   D6 不合格分供商 - 明细行数据（SRS 5.6）
   ============================================================ */
const D6_COLUMNS = [
  { key: 'seq',     label: '序号',         width: '48px' },
  { key: 'type',    label: '供货类型',     edit: true, enum: 'supplyType' },
  { key: 'name',    label: '供应商名称',   edit: true },
  { key: 'region',  label: '注册地',       edit: true },
  { key: 'contact', label: '联系人/联系电话', edit: true, tip: '支持国际号码' },
  { key: 'email',   label: '电子邮箱',     edit: true, tip: '无则填"/"' },
  { key: 'inTime',  label: '入库时间',     edit: true, tip: '无则填"/"' },
  { key: 'biz',     label: '业务往来',     edit: true },
  { key: 'category', label: '品类',        edit: true, enum: 'category' },
  { key: 'badDesc', label: '不良行为描述', edit: true, tip: '如配合度低、质量问题、违约等' },
  { key: 'banStart', label: '禁用起始时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'banMonths', label: '禁用期限（月）', edit: true },
  { key: 'banEnd', label: '禁用到期日',   calc: true, formula: '禁用起始时间 + 期限，到期自动提醒复核' },
  { key: 'hq',      label: '总部地址',     edit: true },
  { key: 'note',   label: '备注',         edit: true },
  { key: 'cross',  label: '关联警示',     calc: true }
];

/* 海外公司 D6 行（含预置交叉问题行 R3：与 D5 R4 同名同注册地 → 交叉提示） */
const D6_ROWS_U01 = [
  { id: 'R1', type: '专业分包', name: '利雅得城市装饰工程公司', region: '沙特阿拉伯·利雅得', contact: 'Faisal / +966-55-220-1166', email: '/', inTime: '2025/04/01', biz: '室内装饰专业分包', category: '专业分包', badDesc: '工期违约：节点延误 45 天，协商后仍未整改', banStart: '2025/06/01', banMonths: 12, hq: '/', note: '禁用期内不得参与投标' },
  { id: 'R2', type: '物资', name: '迪拜港快捷商贸公司', region: '阿联酋·迪拜', contact: 'Rashid / +971-55-110-2233', email: 'rashid@dkhtrade.ae', inTime: '2024/12/15', biz: '五金配件供应', category: '生活物资', badDesc: '质量问题：两批次配件材质证明文件造假', banStart: '2025/03/10', banMonths: 24, hq: '/', note: '' },
  { id: 'R3', type: '物资', name: '开罗尼罗河石材有限公司', region: '埃及·开罗', contact: 'Hassan / +20-2-3371-4200', email: 'hassan@nile-stone.eg', inTime: '2025/05/08', biz: '瓷砖、大理石供应', category: '瓷砖及装饰材料', badDesc: '配合度低：供货延迟且拒不开具履约保函', banStart: '2026/01/10', banMonths: 6, hq: '/', note: '与合格库记录冲突，提交前需处理' }
];

FILL_STORE['T-2026H1']['U01'].D6.rows = JSON.parse(JSON.stringify(D6_ROWS_U01));

/* ============================================================
   D1~D3 表单值注入 FILL_STORE
   ============================================================ */
(function () {
  const keys1 = ['wz_income', 'wz_cost', 'wz_purchase', 'lw_income', 'lw_cost', 'lw_purchase', 'zg_amount', 'jc_amount', 'dc_amount'];
  Object.keys(D1_TUPLES).forEach(uid => {
    const v = {};
    keys1.forEach((k, i) => { v[k] = D1_TUPLES[uid][i]; });
    const rec = FILL_STORE['T-2026H1'][uid].D1;
    if (!rec.values) rec.values = v;
  });
  const keys2 = ['hnt_cgL', 'hnt_ljL', 'hnt_csL', 'hnt_tkL', 'hnt_tuL', 'gj_cgL', 'gj_dr', 'gj_dc', 'gj_kc', 'gj_syL', 'gj_csL', 'gj_ljL', 'gj_tuL'];
  Object.keys(D2_TUPLES).forEach(uid => {
    const v = {};
    keys2.forEach((k, i) => { v[k] = D2_TUPLES[uid][i]; });
    const rec = FILL_STORE['T-2026H1'][uid].D2;
    if (!rec.values) rec.values = v;
  });
  const keys3 = ['gj_cgL', 'gj_tuL', 'gj_syL', 'hnt_ysL', 'hnt_xhL', 'cz_ysL', 'cz_xhL', 'zc_yz', 'zc_dc'];
  Object.keys(D3_TUPLES).forEach(uid => {
    const v = {};
    keys3.forEach((k, i) => { v[k] = D3_TUPLES[uid][i]; });
    /* 6 家单位瓷砖分母为 0：排版预算量与消耗量均为 0（线下 #DIV/0! → 线上"/"） */
    if (D3_ZERO_TILE_UNITS.indexOf(uid) >= 0) { v.cz_ysL = 0; v.cz_xhL = 0; }
    const rec = FILL_STORE['T-2026H1'][uid].D3;
    if (!rec.values) rec.values = v;
  });
})();

/* 二公司 D1 预置勾稽问题：劳务采购效益额与公式重算值偏差 +2.40 元（触发 V-G02 强校验退回） */
FILL_STORE['T-2026H1']['U03'].D1.values.lw_income = 158700000;
FILL_STORE['T-2026H1']['U03'].D1.values.lw_purchase = 151199997.6;

/* ============================================================
   指标字典（ZY-HY-TB-060，节选核心指标）
   ============================================================ */
const INDICATOR_DICT = [
  { code: 'D1-01', name: '物资设备采购对应业主收入', dataset: 'D1', unit: '元', type: '数值', source: '填报', required: '是', formula: '—', rules: 'V-F01' },
  { code: 'D1-04', name: '物资设备采购效益额', dataset: 'D1', unit: '元', type: '数值', source: '计算', required: '—', formula: '对应业主收入 − 采购总金额', rules: 'V-G02' },
  { code: 'D1-05', name: '物资设备采购效益率', dataset: 'D1', unit: '%', type: '数值', source: '计算', required: '—', formula: '效益额 ÷ 对应业主收入', rules: 'V-G03 / V-T01' },
  { code: 'D1-15', name: '采购总金额', dataset: 'D1', unit: '元', type: '数值', source: '计算', required: '—', formula: '物资设备采购总金额 + 劳务与专业分包采购总金额', rules: 'V-G01' },
  { code: 'D1-17', name: '综合采购效益率', dataset: 'D1', unit: '%', type: '数值', source: '计算', required: '—', formula: '效益总额 ÷ 对应业主收入合计', rules: 'V-G03 / V-T01' },
  { code: 'D1-21', name: '中国资源引入率', dataset: 'D1', unit: '%', type: '数值', source: '计算', required: '—', formula: '中国资源引用金额 ÷ 采购总金额', rules: 'V-G03 / V-T01' },
  { code: 'D2-06', name: '混凝土结余率', dataset: 'D2', unit: '%', type: '数值', source: '计算', required: '—', formula: '（图纸同口径用量 − 图纸计算量）÷ 图纸计算量', rules: 'V-G04 / V-T01' },
  { code: 'D2-16', name: '钢筋节超量', dataset: 'D2', unit: 't', type: '数值', source: '计算', required: '—', formula: '图纸量 − 同口径用量', rules: 'V-G04' },
  { code: 'D2-17', name: '钢筋节超率', dataset: 'D2', unit: '%', type: '数值', source: '计算', required: '—', formula: '节超量 ÷ 图纸量', rules: 'V-G04 / V-T01' },
  { code: 'D3-04', name: '钢筋损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', required: '—', formula: '（实际用量 − 图纸净用量）÷ 图纸净用量', rules: 'V-G05 / V-T01' },
  { code: 'D3-07', name: '混凝土损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', required: '—', formula: '（实际消耗量 − 施工图预算量）÷ 施工图预算量', rules: 'V-G05 / V-T01' },
  { code: 'D3-10', name: '瓷砖施工损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', required: '—', formula: '（实际消耗量 − 排版预算量）÷ 排版预算量', rules: 'V-G05 / V-T01' },
  { code: 'D3-13', name: '项目资产周转率', dataset: 'D3', unit: '%', type: '数值', source: '计算', required: '—', formula: '调出资产原值 ÷ 项目资产原值', rules: 'V-G05 / V-T01' },
  { code: 'D4-11', name: '工作年限', dataset: 'D4', unit: '年', type: '数值', source: '计算', required: '—', formula: '参加工作起始时间至报送截止日自动取整', rules: 'V-G06' },
  { code: 'D4-21', name: '从事岗位', dataset: 'D4', unit: '—', type: '枚举', source: '填报', required: '是', formula: '—', rules: 'V-E02', dict: '采购管理/物资管理/采购物资管理' },
  { code: 'D5-12', name: '供应商评级', dataset: 'D5', unit: '—', type: '枚举', source: '填报', required: '是', formula: '—', rules: 'V-E01', dict: 'A级-推荐使用/B级-建议使用/C级-审慎使用' },
  { code: 'D5-02', name: '供应商名称', dataset: 'D5', unit: '—', type: '文本', source: '填报', required: '是', formula: '—', rules: 'V-C03' },
  { code: 'D6-11', name: '禁用期限', dataset: 'D6', unit: '月', type: '数值', source: '填报', required: '是', formula: '—', rules: 'V-F01' },
  { code: 'D6-14', name: '关联警示', dataset: 'D6', unit: '—', type: '标签', source: '带出', required: '—', formula: '与 D5 合格库交叉比对', rules: 'V-C03' }
];

/* 枚举字典配置（枚举名 / 维护状态 / 待决事项标注） */
const ENUM_DICT_CONFIG = [
  { key: 'rating', name: '供应商评级', items: ENUMS.rating, status: '已启用', note: 'V-E01：替代线下"A/A级"混写' },
  { key: 'supplyType', name: '供货类型', items: ENUMS.supplyType, status: '已启用', note: '取自基础字典' },
  { key: 'category', name: '品类', items: ENUMS.category, status: '已启用', note: '取自基础字典，可维护扩展' },
  { key: 'country', name: '可供应国别', items: ENUMS.country, status: '已启用', note: '取自基础字典' },
  { key: 'education', name: '学历', items: ENUMS.education, status: '已启用', note: 'V-E02' },
  { key: 'post', name: '从事岗位', items: ENUMS.post, status: '待收敛', note: 'Q2：待业务确认"采购物资管理"归类后收敛为两类' },
  { key: 'sharedCenter', name: '所属共享中心', items: ENUMS.sharedCenter, status: '已启用', note: '按配置开放共享中心字段' },
  { key: 'gender', name: '性别', items: ENUMS.gender, status: '已启用', note: '' }
];

/* 期间配置 */
const PERIOD_CONFIG = [
  { period: '2026年上半年', type: '半年度', status: '填报中', deadline: '2026-09-25', task: 'T-2026H1' },
  { period: '2026年三季度', type: '季度（专项）', status: '未开始', deadline: '2026-10-20', task: 'T-2026Q3R' },
  { period: '2025年下半年', type: '半年度', status: '已截止', deadline: '2026-01-15', task: 'T-2025H2' },
  { period: '2025年上半年', type: '半年度', status: '已关闭', deadline: '2025-07-15', task: 'T-2025H1' }
];

/* ---------- 审计轨迹示例（海外公司 D1） ---------- */
const AUDIT_LOGS_U01_D1 = [
  { time: '2026-09-05 16:40', operator: '张伟（海外公司·填报人）', action: '提交填报单', detail: 'D1 采购管理指标提交审核，校验 4 类 18 条规则全部通过' },
  { time: '2026-09-06 09:15', operator: '陈国强（海外公司·审核人）', action: '单位审核通过', detail: '审核通过，提交局级复核' },
  { time: '2026-09-08 10:15', operator: '李秀芳（局物资管理部·复核人）', action: '局级复核通过', detail: '复核通过，数据锁定并纳入汇总' }
];

/* ---------- 站内信（顶栏消息） ---------- */
const MESSAGES = [
  { id: 1, type: '催办', title: '【催办】2026年上半年数据报送将于 09-25 截止', detail: '贵单位 D3/D4 已提交待审核，D2/D5/D6 填报中，请尽快处理。', time: '2026-09-11 09:00' },
  { id: 2, type: '退回', title: '二公司 D1 已被局级复核退回', detail: '退回原因：劳务与专业分包采购效益额勾稽偏差超阈值。', time: '2026-09-07 09:45' },
  { id: 3, type: '待办', title: '填报待办：D5 合格分供商', detail: '2026年上半年海外供应链数据报送任务进行中，点击进入填报。', time: '2026-08-28 09:00' },
  { id: 4, type: '通过', title: '海外公司 D1 已通过局级复核', detail: '数据已锁定并纳入汇总。', time: '2026-09-08 10:15' },
  { id: 5, type: '到期', title: '分供商禁用期到期提醒', detail: '利雅得城市装饰工程公司禁用期将于 2026-06-01 到期，请复核是否移出不合格库。', time: '2026-05-25 09:00' }
];
