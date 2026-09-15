/* ============================================================
   海外项目数据集指标填报 - Mock 数据层
   依据《DSC-需求规格说明书-海外项目数据集指标填报-V1.0》第五章数据集定义编制
   ------------------------------------------------------------
   V1.1 实装说明（依据 PRD v1.1 第 7.1 / 7.2 / 7.3 / 10 / 11 节裁定，逐项可回溯）：
   ① W3 集采跟踪表补齐 7 项字段、W6 项目供应链风险全景表补齐 5 项字段（PRD 7.1 字段级结构）；
   ② 一致性校验基准改为 W6「按二级单位真实汇总」（金额求和、率类按采购总额加权，规则 13/18），
      并区分金额类（月报<周报阻断）与率类（偏差>±5% 仅提示核对，PRD 7.3）；
   ③ D5 供货类型由周报 W4「供应类型」带出（裁定：供货类型取自周报），
      故 D5 = 带出 13 项 + 另行补填 3 项（PRD 7.2 D5 行「15=12+3」需同步修订为 16=13+3）；
   ④ D2 钢筋同口径用量改为需填报（PRD 7.2 D2 行 17 = 需填报 14 + 系统自动算 3）。
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
    desc: '任务创建下发、六状态进度看板、在线催办' },
  { key: 'my-fill',     name: '数据填报',     breadcrumb: '数据填报',      icon: 'fill',
    desc: '六类数据集在线填报、批量导入、草稿暂存' },
  { key: 'review',      name: '审核与退回',   breadcrumb: '审核与退回',    icon: 'review',
    desc: '单位审核、局级复核、退回留痕、审计轨迹' },
  { key: 'summary',     name: '汇总统计与报表', breadcrumb: '汇总统计与报表', icon: 'summary',
    desc: '自动汇总、率类重算、分供商去重、报表导出' },
  { key: 'config',      name: '填报基础配置',  breadcrumb: '填报基础配置',  icon: 'config',
    desc: '指标字典、枚举字典、期间与单位配置' }
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

/* ---------- 数据集定义（D1~D6 月报，每月底填报；粒度：每单位每月） ---------- */
const DATASET_ORDER = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'];
const DATASETS = {
  D1: { code: 'D1', name: '采购管理指标',            mode: 'form', unit: '元',  fillFreq: '月度',
        desc: '物资设备采购、劳务与专业分包采购、采购汇总与资源结构，每单位每月一条；集采引用金额自动取自周报 W3' },
  D2: { code: 'D2', name: '物资管理指标（混凝土/钢筋）', mode: 'form', unit: 'm³/t', fillFreq: '月度',
        desc: '混凝土、钢筋消耗与结余节超指标，每单位每月一条；周报 W6 汇总损耗率作一致性校验基准' },
  D3: { code: 'D3', name: '物资损耗与资产管理指标',   mode: 'form', unit: 't/m³/m²/元', fillFreq: '月度',
        desc: '钢筋/混凝土/瓷砖损耗率与项目资产周转率，每单位每月一条；调出资产原值自动取自周报 W5' },
  D4: { code: 'D4', name: '采购及物资管理人员',       mode: 'rows', unit: '人', fillFreq: '月度',
        desc: '逐人明细行填报，姓名/所在单位/职务/是否专职自动取自周报 W2；工作年限系统自动计算' },
  D5: { code: 'D5', name: '合格分供商',              mode: 'rows', unit: '家', fillFreq: '月度',
        desc: '名录 12 项自动取自周报 W4，仅补填优势劣势/总部地址/共享中心；按"供应商名称+注册地"查重' },
  D6: { code: 'D6', name: '不合格分供商',            mode: 'rows', unit: '家', fillFreq: '月度',
        desc: '周报无对应内容，全部需填报；禁用期限结构化，与合格库交叉校验' }
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
  nationality: ['中国', '其他国家'],
  /* V1.1 新增枚举（W4 分供方资源库） */
  resourceOrigin: ['属地', '属地中国', '中国企业国外办厂', '国内产品出口企业'],
  paymentTerm:    ['预付', '货到付款', '月结 30 天', '月结 60 天', '月结 90 天', '按节点结算']
};

/* 校验配置（Q4：勾稽偏差阈值，可配置） */
const VALIDATE_CONFIG = {
  deviation: { amount: 1, rate: 0.0001 },   // ±1 元 / ±0.01%
  importMaxRows: 10000
};

/* ---------- 报送任务（V1.1 双频：周报每周五 / 月报每月底） ---------- */
const TASKS = [
  {
    id: 'T-2026W38', name: '2026年9月第3周周报', status: '进行中', freq: '周报',
    year: 2026, period: '2026年9月第3周', deadline: '2026-09-18',
    scope: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], unitScope: '各共享中心、区域总部、二级单位（项目）',
    createdBy: '王建国', createdAt: '2026-09-12 09:00', publishTime: '2026-09-12 09:00',
    desc: '每周五 17:00 前完成周报填报并提交：W1~W5 由各共享中心/区域总部填报，W6 项目供应链风险全景表由各二级单位（项目）填报。截止前 1 天系统自动催办未提交主体。'
  },
  {
    id: 'T-2026M09', name: '2026年9月海外供应链数据月报', status: '进行中', freq: '月报',
    year: 2026, period: '2026年9月', deadline: '2026-09-30',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2026-08-26 10:12', publishTime: '2026-08-28 09:00',
    desc: '月报数据进入时自动带出当月周报数据（置灰并标注来源期次），核对确认后补填周报未覆盖字段；每月底后 5 个工作日内齐套。'
  },
  {
    id: 'T-2026M09RY', name: '2026年9月人员专项摸底（临时）', status: '草稿', freq: '月报',
    year: 2026, period: '2026年9月（专项）', deadline: '2026-10-20',
    scope: ['D4'], unitScope: '海外业务相关单位（10家）',
    createdBy: '王建国', createdAt: '2026-09-09 15:40',
    desc: '应局人力资源部门要求，临时发起的人员专项摸底任务，尚未下发。'
  },
  {
    id: 'T-2026W37', name: '2026年9月第2周周报', status: '已关闭', freq: '周报',
    year: 2026, period: '2026年9月第2周', deadline: '2026-09-11',
    scope: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], unitScope: '各共享中心、区域总部、二级单位（项目）',
    createdBy: '王建国', createdAt: '2026-09-05 09:00', publishTime: '2026-09-05 09:00',
    desc: '当周周报全部主体已提交并归档，作为 9 月月报取数来源之一（默认取当月最后一个已提交周报）。'
  },
  {
    id: 'T-2026W36', name: '2026年9月第1周周报', status: '已关闭', freq: '周报',
    year: 2026, period: '2026年9月第1周', deadline: '2026-09-04',
    scope: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'], unitScope: '各共享中心、区域总部、二级单位（项目）',
    createdBy: '王建国', createdAt: '2026-08-29 09:00', publishTime: '2026-08-29 09:00',
    desc: '9 月首个周报期次，已归档；用于「周报周度明细报表区」月内周趋势对比。'
  },
  {
    id: 'T-2025M12', name: '2025年12月海外供应链数据月报', status: '已截止', freq: '月报',
    year: 2025, period: '2025年12月', deadline: '2026-01-15',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2025-12-20 09:30', publishTime: '2025-12-22 09:00',
    desc: '该期东北公司、发展建设公司部分数据集逾期未报，已按规则标记并登记未报送原因。'
  },
  {
    id: 'T-2025M06', name: '2025年6月海外供应链数据月报', status: '已关闭', freq: '月报',
    year: 2025, period: '2025年6月', deadline: '2025-07-15',
    scope: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'], unitScope: '全部二级单位（14家）',
    createdBy: '王建国', createdAt: '2025-06-01 11:00', publishTime: '2025-06-05 09:00',
    desc: '全部单位已通过并完成汇总归档，任务关联填报单已只读。'
  }
];

/* ---------- 周报填报主体：共享中心 / 区域总部（V1.1 第 7.1 节） ---------- */
const SHARED_CENTERS = [
  { id: 'SC1', name: '中东共享中心', countries: '阿联酋、沙特、卡塔尔等' },
  { id: 'SC2', name: '东南亚共享中心', countries: '马来西亚、泰国、越南、柬埔寨等' },
  { id: 'SC3', name: '非洲共享中心', countries: '埃及、埃塞俄比亚、肯尼亚等' },
  { id: 'SC4', name: '国内共享中心', countries: '国内集采与出口业务' },
  { id: 'RH1', name: '海外区域总部', countries: '区域统筹（仅报 W1 工作总结区）' }
];
const SC_MAP = {};
SHARED_CENTERS.forEach(s => { SC_MAP[s.id] = s.name; });

/* ---------- 周报数据集 W1~W6（每周五填报） ---------- */
const W_DATASET_ORDER = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];
const W_DATASETS = {
  W1: { code: 'W1', name: '共享中心/区域总部汇总表', mode: 'form', subject: '各共享中心、区域总部',
        desc: '在建项目与集采推进数值区 + 周工作总结区，主体×期间每周一条' },
  W2: { code: 'W2', name: '人员配备表', mode: 'rows', subject: '各共享中心',
        desc: '人员基础信息明细行，自动带出至月报 D4（同一指标全系统仅填报一次）' },
  W3: { code: 'W3', name: '集采跟踪表', mode: 'rows', subject: '各共享中心',
        desc: '集采品类跟踪明细行，集采金额按单位汇总后自动带出至月报 D1' },
  W4: { code: 'W4', name: '分供方资源库', mode: 'rows', subject: '各共享中心',
        desc: '分供方资源明细行，名录自动带出至月报 D5 合格分供商' },
  W5: { code: 'W5', name: '调拨台账', mode: 'rows', subject: '各共享中心',
        desc: '物资调拨明细行，调入价格按调入组织汇总后自动带出至月报 D3 调出资产原值' },
  W6: { code: 'W6', name: '项目供应链风险全景表', mode: 'rows', subject: '各二级单位（项目）',
        desc: '项目级风险全景明细行，率类按单位汇总后作为月报 D1/D2 一致性校验基准' }
};

/* ============================================================
   填报数据仓库（唯一真值：进度看板、审核、汇总均从此读取）
   FILL_STORE[任务][单位][数据集] = { status, zero, values|rows, ... }
   状态机：未开始 → 填报中 → 已提交 →（已退回↔填报中）→ 已通过；逾期为并行标记
   ============================================================ */
const FILL_STORE = {
  'T-2026M09': {
    /* ---- 海外公司（填报人视角主数据，可交互演示：带出/覆盖/一致性校验） ---- */
    'U01': {
      D1: { status: '填报中', zero: false },
      D2: { status: '填报中', zero: false },
      D3: { status: '填报中', zero: false },
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
  /* ---- T-2025M12：已截止任务，含已逾期状态演示 ---- */
  'T-2025M12': {},
  'T-2025M06': {}
};

/* T-2025M12：11 家全部通过，3 家逾期未报 */
(function () {
  const store = FILL_STORE['T-2025M12'];
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

/* T-2025M06：全部通过（已关闭） */
(function () {
  const store = FILL_STORE['T-2025M06'];
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
      { key: 'jc_amount', label: '物资设备集采引用金额', type: 'fetched', unit: '元', from: 'W3', tip: '纳入局/公司集采的物资设备金额；自动取自周报 W3 集采跟踪表按单位汇总（允许覆盖留痕）' },
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
      /* 裁定④（PRD 7.2 D2 行 17 = 需填报 14 + 系统自动算 3）：同口径用量为需填报字段，系统按口径核对 */
      { key: 'gj_tkL', label: '同口径用量', type: 'number', unit: 't', required: true, tip: '与图纸口径一致的实际消耗量（口径参考：实际用量 − 措施用量 − 临建用量）' },
      { key: 'gj_tuL', label: '图纸量',     type: 'number', unit: 't', required: true, tip: '钢筋图纸净用量' },
      { key: 'gj_jcl', label: '节超量',     type: 'calc',   unit: 't',  formula: '图纸量 − 同口径用量' },
      { key: 'gj_jclv', label: '节超率',   type: 'calc',   unit: '%',  formula: '节超量 ÷ 图纸量' }
    ]
  }
];

/* D2 填报值：[混凝土5项] + [钢筋8项(不含计算与同口径用量)]；钢筋「同口径用量」按裁定④为需填报字段，
   Mock 按口径参考值预置（见下方注入逻辑），系统仅按 V-G04 口径核对提示 */
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
      { key: 'zc_dc', label: '调出资产原值金额', type: 'fetched', unit: '元', from: 'W5', tip: '当期调出资产原值合计；自动取自周报 W5 调拨台账按调入组织汇总（允许覆盖留痕）' },
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
  { key: 'dept',      label: '三级单位',        edit: true, fetched: 'W2', tip: '自动取自周报 W2 人员配备表·所在单位' },
  { key: 'project',   label: '所在部门/项目名称', edit: true },
  { key: 'name',      label: '姓名',           edit: true, fetched: 'W2', tip: '自动取自周报 W2 人员配备表' },
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
  { key: 'position',  label: '现任职务',        edit: true, fetched: 'W2', tip: '自动取自周报 W2 人员配备表·职务' },
  { key: 'title',     label: '专业技术职称',    edit: true },
  { key: 'cert1',     label: '一级注册造价师',  check: true },
  { key: 'cert2',     label: '一级建造师',      check: true },
  { key: 'certOther', label: '持证-其它',       edit: true },
  { key: 'post',      label: '从事岗位',        edit: true, enum: 'post' },
  { key: 'fullTime',  label: '专职/兼职',       edit: true, enum: ['专职', '兼职'], fetched: 'W2', tip: '自动取自周报 W2 人员配备表·是否专职' },
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

FILL_STORE['T-2026M09']['U01'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U01));
FILL_STORE['T-2026M09']['U02'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U02));
FILL_STORE['T-2026M09']['U06'].D4.rows = JSON.parse(JSON.stringify(D4_ROWS_U06));

/* ============================================================
   D5 合格分供商 - 明细行数据（SRS 5.5）
   ============================================================ */
const D5_COLUMNS = [
  { key: 'seq',      label: '序号',       width: '48px' },
  /* 裁定③：供货类型取自周报（W4 分供方资源库·供应类型），不再手工填报 */
  { key: 'type',     label: '供货类型',   edit: true, enum: 'supplyType', fetched: 'W4', tip: '自动取自周报 W4 分供方资源库·供应类型（无手工录入入口，修改需覆盖留痕）' },
  /* —— 以下 12 项（连同上方「供货类型」共 13 项）自动取自周报 W4（无手工录入入口，A14；修改需覆盖留痕） —— */
  { key: 'name',     label: '供应商名称', edit: true, fetched: 'W4', tip: '自动取自周报 W4 分供方资源库' },
  { key: 'region',   label: '注册地',     edit: true, fetched: 'W4' },
  { key: 'contact',  label: '联系人',     edit: true, fetched: 'W4' },
  { key: 'phone',    label: '联系电话',   edit: true, fetched: 'W4', tip: '自动取自 W4，支持国际号码格式' },
  { key: 'email',    label: '电子邮箱',   edit: true, fetched: 'W4' },
  { key: 'inTime',   label: '入库时间',   edit: true, fetched: 'W4' },
  { key: 'inspector', label: '考察人',    edit: true, fetched: 'W4' },
  { key: 'biz',      label: '业务往来',   edit: true, fetched: 'W4' },
  { key: 'category', label: '品类',       edit: true, enum: 'category', fetched: 'W4' },
  { key: 'rating',   label: '供应商评级', edit: true, enum: 'rating', fetched: 'W4' },
  { key: 'countries', label: '可供应国别', edit: true, enum: 'country', multi: true, fetched: 'W4' },
  { key: 'paymentTerm', label: '账期',    edit: true, enum: 'paymentTerm', fetched: 'W4' },
  /* —— 以下 3 项为月报另行补填（周报未覆盖） —— */
  { key: 'advDesc',  label: '优势与劣势描述', edit: true, manual: true },
  { key: 'hq',       label: '总部地址',   edit: true, manual: true, tip: '无则填"/"' },
  { key: 'center',   label: '所属共享中心', edit: true, enum: 'sharedCenter', manual: true }
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

FILL_STORE['T-2026M09']['U01'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U01));
FILL_STORE['T-2026M09']['U02'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U02));
FILL_STORE['T-2026M09']['U06'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U06));
FILL_STORE['T-2026M09']['U07'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U07));
FILL_STORE['T-2026M09']['U09'].D5.rows = JSON.parse(JSON.stringify(D5_ROWS_U09));

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

FILL_STORE['T-2026M09']['U01'].D6.rows = JSON.parse(JSON.stringify(D6_ROWS_U01));

/* ============================================================
   周报数据集 W1~W6（V1.1 第 7.1 节）— 每周五填报
   ============================================================ */

/* W1 共享中心/区域总部汇总表：数值区 + 工作总结区（单记录表单） */
const W1_SECTIONS = [
  {
    key: 'num', title: '数值区', fields: [
      { key: 'projCount', label: '在建项目数量', type: 'number', unit: '个', required: true, tip: '本共享中心/区域总部在建海外项目数量' },
      { key: 'catPlanCount', label: '年度集采品类个数', type: 'number', unit: '个', required: true, tip: '年度集采计划品类总数' },
      { key: 'catStarted', label: '已发起集采品类个数', type: 'number', unit: '个', required: true },
      { key: 'catDone', label: '已完成集采品类个数', type: 'number', unit: '个', required: true },
      { key: 'doneCoverProj', label: '已完成品类覆盖项目数', type: 'number', unit: '个', required: true },
      { key: 'saveAmount', label: '采购成本降低额', type: 'number', unit: '元', required: true, tip: '当期集采累计降低额（分子）' },
      { key: 'jcAmountSum', label: '集采金额合计', type: 'fetched', unit: '元', from: 'W3', tip: '按 W3 集采跟踪表本主体金额汇总（自动带出，允许覆盖留痕）' },
      { key: 'saveRate', label: '采购成本降低率', type: 'calc', unit: '%', formula: '采购成本降低额 ÷ 集采金额合计' }
    ]
  },
  {
    key: 'text', title: '工作总结区', fields: [
      { key: 'weekSummary', label: '周工作总结', type: 'text', long: true, required: true, tip: '本周集采推进、资源拓展、存在问题的简要总结' },
      { key: 'keyProject', label: '重点项目采购与长周期设备情况', type: 'text', long: true, tip: '长周期设备招采进展与风险提示' }
    ]
  }
];

/* W2 人员配备表（→ 月报 D4 基础信息） */
const W2_COLUMNS = [
  { key: 'seq', label: '序号', width: '48px' },
  { key: 'name', label: '姓名', edit: true },
  { key: 'unitName', label: '所在单位', edit: true },
  { key: 'position', label: '职务', edit: true },
  { key: 'center', label: '所属共享中心', edit: true, enum: 'sharedCenter' },
  { key: 'fullTime', label: '是否专职', edit: true, enum: ['专职', '兼职'] }
];
const W2_ROWS_SC1 = [
  { id: 'W2-1', name: '刘志强', unitName: '中东共享中心', position: '集采专员', center: '中东共享中心', fullTime: '专职' },
  { id: 'W2-2', name: '马晓东', unitName: '中东共享中心', position: '采购主管', center: '中东共享中心', fullTime: '专职' },
  { id: 'W2-3', name: 'Hassan Ali', unitName: '中东共享中心', position: '属地采购协调员', center: '中东共享中心', fullTime: '专职' }
];
const W2_ROWS_SC2 = [
  { id: 'W2-1', name: '林伟', unitName: '东南亚共享中心', position: '集采负责人', center: '东南亚共享中心', fullTime: '专职' },
  { id: 'W2-2', name: '陈美玲', unitName: '东南亚共享中心', position: '物资专员', center: '东南亚共享中心', fullTime: '兼职' }
];

/* W3 集采跟踪表（→ 月报 D1 集采引用金额分子） */
const W3_COLUMNS = [
  { key: 'seq', label: '序号', width: '48px' },
  { key: 'category', label: '集采品类', edit: true, tip: '如钢筋、混凝土、电缆等' },
  { key: 'level', label: '集采层级', edit: true, enum: ['局级集采', '公司级集采', '区域集采'] },
  { key: 'leadUnit', label: '牵头单位', edit: true },
  { key: 'owner', label: '负责人', edit: true },
  { key: 'inPlan', label: '是否年初计划内', edit: true, enum: ['是', '否'] },
  { key: 'unit', label: '单位', edit: true, tip: '集采需求归口单位' },
  { key: 'volume', label: '预计体量', edit: true },
  { key: 'coverProj', label: '覆盖项目', edit: true },
  { key: 'amount', label: '金额（元）', edit: true, tip: '自动带出至月报 D1 集采引用金额' },
  { key: 'saveAmount', label: '预计集采降本额（元）', edit: true },
  { key: 'bidStartTime', label: '招采发起时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'bidEndTime', label: '预计完成时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'stage', label: '当前阶段', edit: true, enum: ['需求汇总', '招标文件编制', '发标', '评标', '定标', '合同签订', '执行中'] },
  { key: 'progress', label: '本周进展', edit: true },
  { key: 'nextPlan', label: '下周计划', edit: true, tip: '下周拟推进事项' },
  { key: 'purchaseNo', label: '采购编号', edit: true, tip: '招采/采购编号，尚未生成填"/"' },
  { key: 'highlight', label: '亮点', edit: true, tip: '可复用于 W1 周工作总结' },
  { key: 'overdue', label: '是否超期（>50天）', edit: true, enum: ['否', '是'] },
  { key: 'firstResource', label: '是否首次资源配置', edit: true, enum: ['是', '否'], tip: '首次资源配置须在备注说明资源类型' },
  { key: 'note', label: '备注', edit: true }
];
const W3_ROWS_SC1 = [
  { id: 'W3-1', category: '钢筋', level: '局级集采', leadUnit: '局采购管理部', owner: '王建国', inPlan: '是', unit: '中东共享中心', volume: '12 万吨', coverProj: '迪拜绿地中心等 5 个项目', amount: 86000000, saveAmount: 5200000, bidStartTime: '2026/08/05', bidEndTime: '2026/10/20', stage: '评标', progress: '完成 3 家入围单位考察，本周开标', nextPlan: '完成定标评审并上报定标报告', purchaseNo: 'JC-2026-DB-001', highlight: '3 家入围单位均通过工厂考察，报价较概算低 6%', overdue: '否', firstResource: '是', note: '长协锁价一个季度，首次资源配置为属地钢材加工' },
  { id: 'W3-2', category: '商品混凝土', level: '区域集采', leadUnit: '中东共享中心', owner: '刘志强', inPlan: '是', unit: '中东共享中心', volume: '48 万 m³', coverProj: '利雅得地铁等 4 个项目', amount: 42000000, saveAmount: 2100000, bidStartTime: '2026/07/20', bidEndTime: '2026/09/30', stage: '合同签订', progress: '主合同条款谈判完成', nextPlan: '主合同用印并启用首批供货', purchaseNo: 'JC-2026-DB-002', highlight: '区域集采单价同比下降 4.8%', overdue: '否', firstResource: '否', note: '' },
  { id: 'W3-3', category: '电缆', level: '公司级集采', leadUnit: '局采购管理部', owner: '马晓东', inPlan: '否', unit: '中东共享中心', volume: '360 km', coverProj: '开罗新行政首都项目', amount: 28500000, saveAmount: 1650000, bidStartTime: '2026/09/01', bidEndTime: '2026/11/15', stage: '发标', progress: '标书已发出，等待回标', nextPlan: '组织回标与评标', purchaseNo: '/', highlight: '国产替代方案通过技术评审', overdue: '是', firstResource: '是', note: '发标超期 50 天以上，需专项推进' }
];
const W3_ROWS_SC2 = [
  { id: 'W3-1', category: '木方模板', level: '区域集采', leadUnit: '东南亚共享中心', owner: '林伟', inPlan: '是', unit: '东南亚共享中心', volume: '9.6 万 m³', coverProj: '吉隆坡 CBD 等 3 个项目', amount: 23800000, saveAmount: 1450000, bidStartTime: '2026/06/15', bidEndTime: '2026/09/25', stage: '执行中', progress: '首批到货验收完成', nextPlan: '跟踪第二批到货与验收', purchaseNo: 'JC-2026-SEA-001', highlight: '木方周转 3 次以上，损耗率低于 2%', overdue: '否', firstResource: '否', note: '' },
  { id: 'W3-2', category: '周转材料租赁', level: '公司级集采', leadUnit: '东南亚共享中心', owner: '陈美玲', inPlan: '是', unit: '东南亚共享中心', volume: '—', coverProj: '曼谷智慧产业园项目', amount: 12600000, saveAmount: 830000, bidStartTime: '2026/07/01', bidEndTime: '2026/10/10', stage: '定标', progress: '定标报告审批中', nextPlan: '定标结果公示并签订租赁框架协议', purchaseNo: 'JC-2026-SEA-002', highlight: '租赁单价较上年度下降 9%', overdue: '否', firstResource: '否', note: '' }
];

/* W4 分供方资源库（→ 月报 D5 合格分供商 12 项带出） */
const W4_COLUMNS = [
  { key: 'seq', label: '序号', width: '48px' },
  { key: 'supplyType', label: '供应类型', edit: true, enum: 'supplyType' },
  { key: 'name', label: '分供方名称', edit: true },
  { key: 'region', label: '注册地', edit: true },
  { key: 'contact', label: '联系人', edit: true },
  { key: 'phone', label: '电话', edit: true },
  { key: 'email', label: '邮箱', edit: true },
  { key: 'inTime', label: '入库时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'inspector', label: '考察人', edit: true },
  { key: 'biz', label: '业务往来', edit: true },
  { key: 'category', label: '分供品类', edit: true, enum: 'category' },
  { key: 'mainContent', label: '供应主要内容', edit: true },
  { key: 'advDesc', label: '优势与劣势', edit: true },
  { key: 'rating', label: '评级', edit: true, enum: 'rating' },
  { key: 'countries', label: '可供应国别区域', edit: true, enum: 'country', multi: true },
  { key: 'resourceOrigin', label: '资源所属国别', edit: true, enum: 'resourceOrigin' },
  { key: 'paymentTerm', label: '账期', edit: true, enum: 'paymentTerm' },
  { key: 'reporter', label: '填报人', edit: true }
];
const W4_ROWS_SC1 = [
  { id: 'W4-1', supplyType: '物资', name: '中东建材贸易有限责任公司', region: '阿联酋·迪拜', contact: '王立新', phone: '+971-4-885-2121', email: 'sales@me-bm.ae', inTime: '2025/03/15', inspector: '刘志强', biz: '钢筋供应、水泥供应', category: '钢筋及钢材', mainContent: '螺纹钢、盘螺、水泥', advDesc: '供货稳定、账期灵活；高峰期运力紧张', rating: 'A级-推荐使用', countries: ['阿联酋', '沙特阿拉伯', '卡塔尔'], resourceOrigin: '国内产品出口企业', paymentTerm: '月结 60 天', reporter: '刘志强' },
  { id: 'W4-2', supplyType: '租赁', name: '迪拜环球设备租赁公司', region: '阿联酋·迪拜', contact: 'Omar', phone: '+971-50-662-1100', email: 'rent@dubai-eq.ae', inTime: '2024/11/02', inspector: '马晓东', biz: '塔吊、泵车租赁', category: '机械设备', mainContent: '塔吊 12 台、泵车 6 台', advDesc: '设备保有量大、响应快', rating: 'B级-建议使用', countries: ['阿联酋'], resourceOrigin: '属地', paymentTerm: '按节点结算', reporter: '马晓东' },
  { id: 'W4-3', supplyType: '物资', name: '沙特华新水泥制品厂', region: '沙特阿拉伯·利雅得', contact: 'Saleh', phone: '+966-11-461-5500', email: 'info@huaxin-sa.com', inTime: '2025/01/20', inspector: '刘志强', biz: '商品混凝土供应', category: '混凝土', mainContent: 'C30~C60 商品混凝土', advDesc: '利雅得周边 3 个搅拌站，夜间供应能力强', rating: 'A级-推荐使用', countries: ['沙特阿拉伯'], resourceOrigin: '中国企业国外办厂', paymentTerm: '月结 30 天', reporter: '刘志强' },
  { id: 'W4-4', supplyType: '劳务分包', name: '中埃建设劳务合作公司', region: '埃及·开罗', contact: '马建国', phone: '+20-2-2521-7800', email: 'mc@cn-eg.com', inTime: '2024/08/12', inspector: 'Hassan Ali', biz: '主体劳务、砌筑劳务', category: '劳务', mainContent: '主体结构劳务 800 人', advDesc: '属地工人 800 余人，工种齐全', rating: 'A级-推荐使用', countries: ['埃及', '阿尔及利亚'], resourceOrigin: '属地中国', paymentTerm: '月结 30 天', reporter: 'Hassan Ali' }
];
const W4_ROWS_SC2 = [
  { id: 'W4-1', supplyType: '物资', name: '曼谷金桥木业有限公司', region: '泰国·曼谷', contact: 'Somchai', phone: '+66-2-329-1800', email: 'sale@goldbridge-th.co', inTime: '2025/02/14', inspector: '林伟', biz: '木方、模板供应', category: '木方模板', mainContent: '木方、覆膜模板', advDesc: '价格低；含水率控制一般', rating: 'B级-建议使用', countries: ['泰国', '柬埔寨'], resourceOrigin: '属地', paymentTerm: '货到付款', reporter: '林伟' },
  { id: 'W4-2', supplyType: '服务', name: '吉隆坡快捷物流公司', region: '马来西亚·吉隆坡', contact: 'Lim Wei', phone: '+60-3-2181-4400', email: 'cs@kl-express.my', inTime: '2025/06/30', inspector: '陈美玲', biz: '物流清关、仓储配送', category: '物流清关', mainContent: '清关、仓储、内陆运输', advDesc: '清关时效快；单票费用高', rating: 'C级-审慎使用', countries: ['马来西亚', '泰国'], resourceOrigin: '属地', paymentTerm: '月结 30 天', reporter: '陈美玲' }
];

/* W5 调拨台账（→ 月报 D3 调出资产原值金额） */
const W5_COLUMNS = [
  { key: 'seq', label: '序号', width: '48px' },
  { key: 'outProject', label: '调出项目', edit: true },
  { key: 'outCountry', label: '调出国家', edit: true },
  { key: 'outOrg', label: '调出组织', edit: true },
  { key: 'inProject', label: '调入项目', edit: true },
  { key: 'inCountry', label: '调入国家', edit: true },
  { key: 'inOrg', label: '调入组织', edit: true, tip: '按调入组织汇总 → 月报 D3 调出资产原值' },
  { key: 'material', label: '材料名称', edit: true },
  { key: 'spec', label: '规格型号', edit: true },
  { key: 'newPrice', label: '若新购采购金额（元）', edit: true },
  { key: 'inPrice', label: '调入价格（元）', edit: true },
  { key: 'transferTime', label: '调拨时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'note', label: '备注', edit: true }
];
const W5_ROWS_SC1 = [
  { id: 'W5-1', outProject: '迪拜港口物流园项目', outCountry: '阿联酋', outOrg: '中建八局海外公司', inProject: '利雅得地铁项目部', inCountry: '沙特阿拉伯', inOrg: '中建八局海外公司', material: '塔式起重机', spec: 'QTZ80', newPrice: 3860000, inPrice: 2900000, transferTime: '2026/09/16', note: '设备完好，附检测报告' },
  { id: 'W5-2', outProject: '多哈展馆项目部', outCountry: '卡塔尔', outOrg: '中建八局一公司', inProject: '迪拜绿地中心项目部', inCountry: '阿联酋', inOrg: '中建八局一公司', material: '施工电梯', spec: 'SC200/200', newPrice: 2680000, inPrice: 2420000, transferTime: '2026/09/17', note: '' }
];
const W5_ROWS_SC2 = [
  { id: 'W5-1', outProject: '曼谷智慧产业园项目', outCountry: '泰国', outOrg: '中建八局三公司', inProject: '胡志明市电厂项目', inCountry: '越南', inOrg: '中建八局华南公司', material: '发电机', spec: '500kW', newPrice: 1520000, inPrice: 1180000, transferTime: '2026/09/15', note: '' }
];

/* W6 项目供应链风险全景表（率类按单位汇总 → 月报 D1/D2 一致性校验基准） */
const W6_COLUMNS = [
  { key: 'seq', label: '序号', width: '48px' },
  { key: 'project', label: '项目名称', edit: true },
  { key: 'country', label: '项目国别', edit: true },
  { key: 'address', label: '项目地址', edit: true },
  { key: 'contractAmount', label: '合同额（元）', edit: true },
  { key: 'output', label: '自施产值（元）', edit: true },
  { key: 'purchaseTotal', label: '采购总额（元）', edit: true, tip: '月报 D1 采购金额类一致性校验基准' },
  { key: 'materialPurchase', label: '其中：物资设备采购（元）', edit: true, tip: '采购总额中的物资设备分项' },
  { key: 'laborPurchase', label: '其中：劳务分包采购（元）', edit: true },
  { key: 'reduceRate', label: '综合采购成本降低率', calc: true, formula: '系统计算；按单位汇总后作月报校验基准' },
  { key: 'benefitRate', label: '综合采购效益率', calc: true, formula: '系统计算；按单位汇总后作月报校验基准' },
  { key: 'gjLossRate', label: '钢筋损耗率', calc: true, formula: '系统计算；作月报 D2 校验基准' },
  { key: 'hntLossRate', label: '混凝土损耗率', calc: true, formula: '系统计算；作月报 D2 校验基准' },
  { key: 'localSupplierRate', label: '属地分供商占比', edit: true },
  { key: 'localPurchaseRate', label: '属地采购占比', edit: true },
  { key: 'centralRate', label: '集中采购率', edit: true },
  { key: 'hasRisk', label: '是否有风险', edit: true, enum: ['否', '是'] },
  { key: 'riskType', label: '风险类型', edit: true, tip: '如供应中断、价格波动、合规风险' },
  { key: 'riskLevel', label: '风险等级', edit: true, enum: ['低', '中', '高'] },
  { key: 'riskDesc', label: '风险描述', edit: true, tip: '风险具体表现与影响（有风险时必填）' },
  { key: 'estLoss', label: '预计损失（元）', edit: true, tip: '无风险填"/"' },
  { key: 'strategy', label: '应对策略', edit: true },
  { key: 'resolveTime', label: '化解时间', edit: true, tip: 'yyyy/MM/dd' },
  { key: 'owner', label: '责任部门/责任人', edit: true }
];
const W6_ROWS_U01 = [
  { id: 'W6-1', project: '迪拜绿地中心项目', country: '阿联酋', address: '阿联酋迪拜杰贝阿里自贸区', contractAmount: 1860000000, output: 1240000000, purchaseTotal: 186000000, materialPurchase: 54000000, laborPurchase: 132000000, reduceRate: '2.90%', benefitRate: '11.80%', gjLossRate: '2.70%', hntLossRate: '1.60%', localSupplierRate: '62.00%', localPurchaseRate: '48.00%', centralRate: '41.00%', hasRisk: '是', riskType: '价格波动', riskLevel: '中', riskDesc: '钢筋价格季度波动超 8%，属地供应半径受限', estLoss: 3200000, strategy: '锁定季度长协价，增加备选供应商', resolveTime: '2026/12/31', owner: '项目物资部 / 李强' },
  { id: 'W6-2', project: '内罗毕商务中心项目', country: '肯尼亚', address: '肯尼亚内罗毕西部商业区', contractAmount: 620000000, output: 380000000, purchaseTotal: 119000000, materialPurchase: 48000000, laborPurchase: 71000000, reduceRate: '1.10%', benefitRate: '9.60%', gjLossRate: '2.90%', hntLossRate: '1.80%', localSupplierRate: '71.00%', localPurchaseRate: '59.00%', centralRate: '33.00%', hasRisk: '否', riskType: '', riskLevel: '低', riskDesc: '', estLoss: '/', strategy: '', resolveTime: '/', owner: '项目物资部 / Michael Otieno' }
];
const W6_ROWS_U02 = [
  { id: 'W6-1', project: '多哈展馆项目', country: '卡塔尔', address: '卡塔尔多哈西湾中央商务区', contractAmount: 980000000, output: 660000000, purchaseTotal: 448600000, materialPurchase: 149900000, laborPurchase: 298700000, reduceRate: '3.60%', benefitRate: '14.30%', gjLossRate: '2.50%', hntLossRate: '1.40%', localSupplierRate: '55.00%', localPurchaseRate: '42.00%', centralRate: '46.00%', hasRisk: '否', riskType: '', riskLevel: '低', riskDesc: '', estLoss: '/', strategy: '', resolveTime: '/', owner: '项目物资部 / 赵鹏' }
];

/* ---------- 周报填报数据仓库 WEEKLY_STORE[任务][主体][数据集] ---------- */
const WEEKLY_STORE = {
  'T-2026W38': {
    SC1: {
      W1: { status: '已提交', zero: false, lastSubmit: '2026-09-17 16:20',
            values: { projCount: 12, catPlanCount: 18, catStarted: 15, catDone: 11, doneCoverProj: 34, saveAmount: 8950000, jcAmountSum: 156500000,
                    weekSummary: '本周完成钢筋集采评标并发出中标通知，混凝土合同条款谈判完成；电缆集采发标后仅 2 家回标，需扩大寻源。',
                    keyProject: '利雅得地铁项目盾构机主轴承采购周期 26 周，已锁定产能；迪拜绿地中心幕墙单元件长周期设备排产至 12 月。' } },
      W2: { status: '已提交', zero: false, lastSubmit: '2026-09-17 16:22', rows: JSON.parse(JSON.stringify(W2_ROWS_SC1)) },
      W3: { status: '填报中', zero: false, rows: JSON.parse(JSON.stringify(W3_ROWS_SC1)) },
      W4: { status: '已提交', zero: false, lastSubmit: '2026-09-17 16:30', rows: JSON.parse(JSON.stringify(W4_ROWS_SC1)) },
      W5: { status: '已通过', zero: false, lastSubmit: '2026-09-17 16:35', passedBy: '王建国', passedTime: '2026-09-18 09:10', rows: JSON.parse(JSON.stringify(W5_ROWS_SC1)) },
      W6: { status: '-', zero: false }
    },
    SC2: {
      W1: { status: '已通过', zero: false, lastSubmit: '2026-09-17 11:05', passedBy: '王建国', passedTime: '2026-09-17 15:00',
            values: { projCount: 9, catPlanCount: 14, catStarted: 12, catDone: 10, doneCoverProj: 21, saveAmount: 5340000, jcAmountSum: 36400000,
                    weekSummary: '本周木方模板区域集采首批到货验收完成；周转材料租赁定标报告审批中，预计下周定标。',
                    keyProject: '胡志明市电厂项目汽轮机长周期设备已签订供货协议，预计 2027 年 3 月到货。' } },
      W2: { status: '已提交', zero: false, lastSubmit: '2026-09-17 11:08', rows: JSON.parse(JSON.stringify(W2_ROWS_SC2)) },
      W3: { status: '已提交', zero: false, lastSubmit: '2026-09-17 11:12', rows: JSON.parse(JSON.stringify(W3_ROWS_SC2)) },
      W4: { status: '已提交', zero: false, lastSubmit: '2026-09-17 11:15', rows: JSON.parse(JSON.stringify(W4_ROWS_SC2)) },
      W5: { status: '已提交', zero: false, lastSubmit: '2026-09-17 11:18', rows: JSON.parse(JSON.stringify(W5_ROWS_SC2)) },
      W6: { status: '-', zero: false }
    },
    SC3: {
      W1: { status: '填报中', zero: false },
      W2: { status: '填报中', zero: false, rows: [{ id: 'W2-1', name: '周建军', unitName: '非洲共享中心', position: '采购经理', center: '非洲共享中心', fullTime: '专职' }] },
      W3: { status: '填报中', zero: false, rows: [] },
      W4: { status: '未开始', zero: false },
      W5: { status: '未开始', zero: false },
      W6: { status: '-', zero: false }
    },
    SC4: {
      W1: { status: '已通过', zero: false, lastSubmit: '2026-09-17 17:00', passedBy: '王建国', passedTime: '2026-09-18 09:12',
            values: { projCount: 6, catPlanCount: 20, catStarted: 18, catDone: 16, doneCoverProj: 28, saveAmount: 12400000, jcAmountSum: 268000000,
                    weekSummary: '钢材出口集采第二批次集港完成，累计发运 16 万吨；本周新增 2 家出口供应商准入考察。',
                    keyProject: '海外 9 个项目钢材统一集采，单价较属地采购低约 11%，年度预计节约 1240 万元。' } },
      W2: { status: '已提交', zero: false, lastSubmit: '2026-09-17 17:02', rows: [{ id: 'W2-1', name: '徐涛', unitName: '国内共享中心', position: '集采负责人', center: '国内共享中心', fullTime: '专职' }] },
      W3: { status: '已提交', zero: false, lastSubmit: '2026-09-17 17:05', rows: [{ id: 'W3-1', category: '钢材出口集采', level: '局级集采', leadUnit: '局采购管理部', owner: '王建国', inPlan: '是', unit: '国内共享中心', volume: '24 万吨', coverProj: '海外 9 个项目', amount: 268000000, saveAmount: 12400000, bidStartTime: '2026/05/10', bidEndTime: '2026/12/31', stage: '执行中', progress: '第二批次集港完成', nextPlan: '第三批次集港及报关', purchaseNo: 'JC-2026-CN-001', highlight: '国内集采出海，单价较属地采购低 11%', overdue: '否', firstResource: '否', note: '' }] },
      W4: { status: '已通过', zero: false, lastSubmit: '2026-09-17 17:08', passedBy: '王建国', passedTime: '2026-09-18 09:20', rows: [] },
      W5: { status: '已通过', zero: false, lastSubmit: '2026-09-17 17:10', passedBy: '王建国', passedTime: '2026-09-18 09:20', rows: [] },
      W6: { status: '-', zero: false }
    },
    RH1: {
      W1: { status: '填报中', zero: false },
      W2: { status: '-', zero: false }, W3: { status: '-', zero: false },
      W4: { status: '-', zero: false }, W5: { status: '-', zero: false }, W6: { status: '-', zero: false }
    },
    /* W6 由各二级单位（项目）填报 */
    U01: { W1: { status: '-' }, W2: { status: '-' }, W3: { status: '-' }, W4: { status: '-' }, W5: { status: '-' },
           W6: { status: '已提交', zero: false, lastSubmit: '2026-09-17 15:40', rows: JSON.parse(JSON.stringify(W6_ROWS_U01)) } },
    U02: { W1: { status: '-' }, W2: { status: '-' }, W3: { status: '-' }, W4: { status: '-' }, W5: { status: '-' },
           W6: { status: '已提交', zero: false, lastSubmit: '2026-09-17 14:20', rows: JSON.parse(JSON.stringify(W6_ROWS_U02)) } },
    U03: { W1: { status: '-' }, W2: { status: '-' }, W3: { status: '-' }, W4: { status: '-' }, W5: { status: '-' }, W6: { status: '未开始', zero: false } },
    U06: { W1: { status: '-' }, W2: { status: '-' }, W3: { status: '-' }, W4: { status: '-' }, W5: { status: '-' },
           W6: { status: '已通过', zero: false, lastSubmit: '2026-09-17 10:00', passedBy: '李秀芳', passedTime: '2026-09-17 16:00', rows: [{ id: 'W6-1', project: '胡志明市电厂项目', country: '越南', address: '越南胡志明市第七郡', contractAmount: 780000000, output: 520000000, purchaseTotal: 259100000, materialPurchase: 90200000, laborPurchase: 168900000, reduceRate: '2.10%', benefitRate: '12.40%', gjLossRate: '2.60%', hntLossRate: '1.50%', localSupplierRate: '66.00%', localPurchaseRate: '51.00%', centralRate: '38.00%', hasRisk: '是', riskType: '供应中断', riskLevel: '中', riskDesc: '属地砂石供应中断，雨季运输受限', estLoss: 1800000, strategy: '启用备选供应商，加严库存预警', resolveTime: '2026/11/30', owner: '项目物资部 / 周涛' }] } }
  }
};
/* 历史周报任务（已关闭，仅作归档展示）
   第1/2周数据以第3周为基准按周回退（集采推进类递减），形成可对比的月内周趋势；
   历史周记录统一置为"已通过"（展示规则 24：历史周只读、不回写） */
WEEKLY_STORE['T-2026W37'] = JSON.parse(JSON.stringify(WEEKLY_STORE['T-2026W38']));
WEEKLY_STORE['T-2026W36'] = JSON.parse(JSON.stringify(WEEKLY_STORE['T-2026W38']));

/* 周次期次配置（PRD 6.1 ②：期次选择器按「年度+周次」切换，支持按月展示该月全部周次） */
const WEEK_MONTH = '2026年9月';
const WEEK_PERIODS = [
  { period: '2026年9月第1周', month: WEEK_MONTH, weekNo: 1, taskId: 'T-2026W36', status: '已关闭' },
  { period: '2026年9月第2周', month: WEEK_MONTH, weekNo: 2, taskId: 'T-2026W37', status: '已关闭' },
  { period: '2026年9月第3周', month: WEEK_MONTH, weekNo: 3, taskId: 'T-2026W38', status: '进行中' },
  { period: '2026年9月第4周', month: WEEK_MONTH, weekNo: 4, taskId: 'T-2026W39', status: '未开始' }
];
(function buildWeeklyHistory() {
  const backfill = {
    'T-2026W37': { t: '2026-09-11 09:30', catDone: -2, catStarted: -1, coverProj: -6, saveFactor: 0.78, jcFactor: 0.72 },
    'T-2026W36': { t: '2026-09-04 09:30', catDone: -4, catStarted: -3, coverProj: -12, saveFactor: 0.55, jcFactor: 0.45 }
  };
  Object.keys(backfill).forEach(tid => {
    const d = backfill[tid];
    const clone = JSON.parse(JSON.stringify(WEEKLY_STORE['T-2026W38']));
    ['SC1', 'SC2', 'SC4'].forEach(id => {
      const w1 = clone[id] && clone[id].W1;
      if (w1 && w1.values) {
        const v = w1.values;
        v.catDone = Math.max(0, v.catDone + d.catDone);
        v.catStarted = Math.max(0, v.catStarted + d.catStarted);
        v.doneCoverProj = Math.max(0, v.doneCoverProj + d.coverProj);
        v.saveAmount = Math.round(v.saveAmount * d.saveFactor);
        v.jcAmountSum = Math.round(v.jcAmountSum * d.jcFactor);
      }
      const w3 = clone[id] && clone[id].W3;
      if (w3 && w3.rows) w3.rows.forEach(r => {
        r.amount = Math.round((Number(r.amount) || 0) * d.jcFactor);
        r.saveAmount = Math.round((Number(r.saveAmount) || 0) * d.saveFactor);
      });
      ['W1', 'W2', 'W3', 'W4', 'W5'].forEach(w => {
        const rec = clone[id][w];
        if (rec && rec.status !== '-') {
          rec.status = '已通过'; rec.lastSubmit = d.t;
          rec.passedBy = '王建国'; rec.passedTime = d.t.replace('09:30', '15:00');
        }
      });
    });
    ['U01', 'U02', 'U06'].forEach(id => {
      const rec = clone[id] && clone[id].W6;
      if (rec && rec.status !== '-') {
        rec.status = '已通过'; rec.lastSubmit = d.t;
        rec.passedBy = '李秀芳'; rec.passedTime = d.t.replace('09:30', '16:00');
      }
    });
    WEEKLY_STORE[tid] = clone;
  });
})();
/* 周度报表仅展示"已提交/已通过"的周报数据（展示规则 24） */
function weekReportable(rec) { return !!rec && (rec.status === '已提交' || rec.status === '已通过'); }
/* 周次趋势：从各周 W1 数值汇总（率类按分子/分母重算，规则 18） */
function weekTrend(week) {
  const store = WEEKLY_STORE[week.taskId] || {};
  let projCount = 0, catDone = 0, saveAmount = 0, jcAmountSum = 0, reported = 0;
  SHARED_CENTERS.forEach(sc => {
    const rec = (store[sc.id] || {}).W1;
    if (!weekReportable(rec)) return;
    reported++;
    const v = rec.values || {};
    projCount += Number(v.projCount) || 0;
    catDone += Number(v.catDone) || 0;
    saveAmount += Number(v.saveAmount) || 0;
    jcAmountSum += Number(v.jcAmountSum) || 0;
  });
  return { projCount: projCount, catDone: catDone, saveAmount: saveAmount, jcAmountSum: jcAmountSum, rate: pctDisp(saveAmount, jcAmountSum), reported: reported };
}

/* ---------- 月报 ← 周报 取数映射（ZY-HY-TB-070，V1.1 第 7.2 / 10.8~10.14 节） ---------- */
const FETCH_SOURCES = {
  weekTaskId: 'T-2026W38',
  weekLabel: '2026年9月第3周周报',        // 当月最后一个已提交周报（Q6 默认口径）
  map: {
    W1: { jcAmountSum: { from: 'W3', desc: 'W3 集采跟踪表按主体汇总' } },
    D1: {
      jc_amount: { from: 'W3', desc: '集采跟踪表按单位汇总（W3 汇总自 SC1 中东共享中心）', coverable: true }
    },
    D3: {
      zc_dc: { from: 'W5', desc: '调拨台账按调入组织汇总', coverable: true }
    },
    D4: {
      name: { from: 'W2', desc: '人员配备表' }, dept: { from: 'W2', desc: '人员配备表·所在单位' },
      position: { from: 'W2', desc: '人员配备表·职务' }, fullTime: { from: 'W2', desc: '人员配备表·是否专职' }
    },
    D5: {
      /* 裁定③：供货类型取自周报（W4 供应类型），D5 带出项由 12 项增至 13 项 */
      type: { from: 'W4', field: 'supplyType', desc: 'W4 分供方资源库·供应类型' },
      name: { from: 'W4' }, region: { from: 'W4' }, contact: { from: 'W4' }, phone: { from: 'W4' },
      email: { from: 'W4' }, inTime: { from: 'W4' }, inspector: { from: 'W4' }, biz: { from: 'W4' },
      category: { from: 'W4' }, rating: { from: 'W4' }, countries: { from: 'W4' }, paymentTerm: { from: 'W4' }
    }
  },
  /* 月报另行填报项（周报未覆盖） */
  manual: { D5: ['advDesc', 'hq', 'center'] }
};

/* 月报带出值（按单位）：值 + 来源期次标注 */
const MONTHLY_FETCHED = {
  U01: {
    D1: { jc_amount: { value: 142600000, source: '取自 2026年9月第3周周报 W3（中东共享中心汇总）' } },
    D3: { zc_dc: { value: 5320000, source: '取自 2026年9月第3周周报 W5（按调入组织汇总）' } }
  },
  U02: {
    D1: { jc_amount: { value: 198800000, source: '取自 2026年9月第3周周报 W3' } },
    D3: { zc_dc: { value: 8940000, source: '取自 2026年9月第3周周报 W5' } }
  }
};

/* 月报与周报一致性校验基准：W6 按二级单位「真实汇总」（业务规则 11/13/14，PRD 7.2/7.3）
   金额类：项目行求和；率类：按各项目采购总额加权（规则 18 禁止对率直接平均）；
   单位当月无已提交 W6（A13 缺失兜底）→ 返回 null，取数链路转手工填报并在汇总标注数据来源。 */
function w6Baseline(uid) {
  const store = (WEEKLY_STORE[FETCH_SOURCES.weekTaskId] || {})[uid] || {};
  const rows = (store.W6 && store.W6.rows) || [];
  if (!rows.length) return null;
  const pct = v => {
    const n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[%,\s]/g, ''));
    return isNaN(n) ? null : n;
  };
  const sumOf = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const wAvg = k => {
    let num = 0, den = 0;
    rows.forEach(r => {
      const v = pct(r[k]);
      const w = Number(r.purchaseTotal) || 0;
      if (v !== null && w) { num += v * w; den += w; }
    });
    return den ? num / den : null;
  };
  return {
    purchaseTotal: sumOf('purchaseTotal'),
    materialPurchase: sumOf('materialPurchase'),
    laborPurchase: sumOf('laborPurchase'),
    reduceRate: wAvg('reduceRate'),
    benefitRate: wAvg('benefitRate'),
    gjLossRate: wAvg('gjLossRate'),
    hntLossRate: wAvg('hntLossRate'),
    centralRate: wAvg('centralRate'),
    rowCount: rows.length,
    note: '取自 ' + FETCH_SOURCES.weekLabel + ' W6 按单位汇总（' + rows.length + ' 个项目行；金额求和、率类按采购总额加权）'
  };
}
/* 当月无已提交周报的单位（A13 缺失兜底：转手工填报并在汇总标注数据来源） */
const WEEKLY_MISSING_UNITS = ['U03', 'U05', 'U08', 'U12', 'U13', 'U14'];
const CONSISTENCY_CONFIG = { deviationWarn: 0.05 };   // ±5% 提示核对（可配置）

/* ============================================================
   D1~D3 表单值注入 FILL_STORE
   ============================================================ */
(function () {
  const keys1 = ['wz_income', 'wz_cost', 'wz_purchase', 'lw_income', 'lw_cost', 'lw_purchase', 'zg_amount', 'jc_amount', 'dc_amount'];
  Object.keys(D1_TUPLES).forEach(uid => {
    const v = {};
    keys1.forEach((k, i) => { v[k] = D1_TUPLES[uid][i]; });
    const rec = FILL_STORE['T-2026M09'][uid].D1;
    if (!rec.values) rec.values = v;
  });
  const keys2 = ['hnt_cgL', 'hnt_ljL', 'hnt_csL', 'hnt_tkL', 'hnt_tuL', 'gj_cgL', 'gj_dr', 'gj_dc', 'gj_kc', 'gj_syL', 'gj_csL', 'gj_ljL', 'gj_tuL'];
  Object.keys(D2_TUPLES).forEach(uid => {
    const v = {};
    keys2.forEach((k, i) => { v[k] = D2_TUPLES[uid][i]; });
    /* 裁定④：钢筋同口径用量为需填报字段，Mock 按其口径预置（实际用量 − 措施用量 − 临建用量） */
    v.gj_tkL = v.gj_syL - v.gj_csL - v.gj_ljL;
    const rec = FILL_STORE['T-2026M09'][uid].D2;
    if (!rec.values) rec.values = v;
  });
  const keys3 = ['gj_cgL', 'gj_tuL', 'gj_syL', 'hnt_ysL', 'hnt_xhL', 'cz_ysL', 'cz_xhL', 'zc_yz', 'zc_dc'];
  Object.keys(D3_TUPLES).forEach(uid => {
    const v = {};
    keys3.forEach((k, i) => { v[k] = D3_TUPLES[uid][i]; });
    /* 6 家单位瓷砖分母为 0：排版预算量与消耗量均为 0（线下 #DIV/0! → 线上"/"） */
    if (D3_ZERO_TILE_UNITS.indexOf(uid) >= 0) { v.cz_ysL = 0; v.cz_xhL = 0; }
    const rec = FILL_STORE['T-2026M09'][uid].D3;
    if (!rec.values) rec.values = v;
  });
})();

/* 二公司 D1 预置勾稽问题：导入行携带的线下手工计算值「劳务采购效益额 7,500,000.00 元」
   与系统按公式重算值 7,500,002.40 元偏差 +2.40 元（超 V-G02 容差 ±1 元）→ 提交时阻断，
   可修正数据或走「尾差放行」（填报端留痕申请 → 局级复核书面确认放行，业务规则 4/20）。 */
FILL_STORE['T-2026M09']['U03'].D1.values.lw_income = 158700000;
FILL_STORE['T-2026M09']['U03'].D1.values.lw_purchase = 151199997.6;
FILL_STORE['T-2026M09']['U03'].D1.importedCalc = { lw_benefit: 7500000, source: '线下《月报-26采购指标》导入计算列' };

/* 海外公司 D1 预置一致性校验问题（A13 演示路径，基准＝W6 按单位汇总）：
   ① 劳务与专业分包采购总金额月报值 200,600,000.00 元 ＜ 周报 W6 汇总值 203,000,000.00 元
      （U01 两个项目行劳务分包采购合计）→ 触发 V-G07 阻断，可填写差异说明留痕放行；
   ② 物资设备采购总金额 331,200,000.00 元 与 W6 汇总采购总额 305,000,000.00 元 偏差 +8.6% → V-G08 提示核对（不阻断）；
   ③ 率类：综合采购成本降低率月报重算值与 W6 按采购总额加权的汇总率偏差超 ±5% → V-G08 提示（率类不阻断）。 */
FILL_STORE['T-2026M09']['U01'].D1.values.lw_purchase = 200600000;

/* ============================================================
   指标字典（ZY-HY-TB-060，节选核心指标）
   ============================================================ */
const INDICATOR_DICT = [
  { code: 'D1-01', name: '物资设备采购对应业主收入', dataset: 'D1', unit: '元', type: '数值', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-F01' },
  { code: 'D1-04', name: '物资设备采购效益额', dataset: 'D1', unit: '元', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '对应业主收入 − 采购总金额', rules: 'V-G02' },
  { code: 'D1-05', name: '物资设备采购效益率', dataset: 'D1', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '效益额 ÷ 对应业主收入', rules: 'V-G03 / V-T01' },
  { code: 'D1-15', name: '采购总金额', dataset: 'D1', unit: '元', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '物资设备采购总金额 + 劳务与专业分包采购总金额；两个分项与周报 W6 按单位汇总值比对（月报＜周报 → V-G07 阻断；偏差＞±5% → V-G08 提示）', rules: 'V-G01 / V-G07 / V-G08' },
  { code: 'D1-17', name: '综合采购效益率', dataset: 'D1', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '效益总额 ÷ 对应业主收入合计', rules: 'V-G03 / V-T01 / V-G08' },
  { code: 'D1-21', name: '中国资源引入率', dataset: 'D1', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '中国资源引用金额 ÷ 采购总金额', rules: 'V-G03 / V-T01' },
  { code: 'D1-23', name: '综合采购成本降低率', dataset: 'D1', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '降低总额 ÷ 标准成本合计；W6 汇总降低率为校验基准', rules: 'V-G03 / V-G08' },
  { code: 'D2-06', name: '混凝土结余率', dataset: 'D2', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '（图纸同口径用量 − 图纸计算量）÷ 图纸计算量', rules: 'V-G04 / V-T01' },
  { code: 'D2-16', name: '钢筋节超量', dataset: 'D2', unit: 't', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '图纸量 − 同口径用量', rules: 'V-G04' },
  { code: 'D2-17', name: '钢筋节超率', dataset: 'D2', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '节超量 ÷ 图纸量', rules: 'V-G04 / V-T01' },
  { code: 'D3-04', name: '钢筋损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '（实际用量 − 图纸净用量）÷ 图纸净用量；W6 汇总损耗率为校验基准', rules: 'V-G05 / V-T01 / V-G08' },
  { code: 'D3-07', name: '混凝土损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '（实际消耗量 − 施工图预算量）÷ 施工图预算量；W6 汇总损耗率为校验基准', rules: 'V-G05 / V-T01 / V-G08' },
  { code: 'D3-10', name: '瓷砖施工损耗率', dataset: 'D3', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '（实际消耗量 − 排版预算量）÷ 排版预算量', rules: 'V-G05 / V-T01' },
  { code: 'D3-13', name: '项目资产周转率', dataset: 'D3', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '调出资产原值 ÷ 项目资产原值', rules: 'V-G05 / V-T01' },
  { code: 'D4-11', name: '工作年限', dataset: 'D4', unit: '年', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '参加工作起始时间至报送截止日自动取整', rules: 'V-G06' },
  { code: 'D4-21', name: '从事岗位', dataset: 'D4', unit: '—', type: '枚举', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-E02', dict: '采购管理/物资管理/采购物资管理' },
  { code: 'D5-12', name: '供应商评级', dataset: 'D5', unit: '—', type: '枚举', source: '带出', way: '自动取自周报', required: '是', formula: 'W4 分供方资源库·评级', rules: 'V-E01', dict: 'A级-推荐使用/B级-建议使用/C级-审慎使用' },
  { code: 'D5-02', name: '供应商名称', dataset: 'D5', unit: '—', type: '文本', source: '带出', way: '自动取自周报', required: '是', formula: 'W4 分供方资源库', rules: 'V-C03' },
  { code: 'D6-11', name: '禁用期限', dataset: 'D6', unit: '月', type: '数值', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-F01' },
  { code: 'D6-14', name: '关联警示', dataset: 'D6', unit: '—', type: '标签', source: '带出', way: '系统自动算', required: '—', formula: '与 D5 合格库交叉比对', rules: 'V-C03' },
  /* —— V1.1 新增：周月衔接（自动取自周报）与周报指标 —— */
  { code: 'D1-22', name: '物资设备集采引用金额', dataset: 'D1', unit: '元', type: '数值', source: '带出', way: '自动取自周报', required: '是', formula: 'W3 集采跟踪表按单位汇总', rules: 'A11 / A12' },
  { code: 'D2-15', name: '钢筋同口径用量', dataset: 'D2', unit: 't', type: '数值', source: '填报', way: '需填报', required: '是', formula: '口径参考：实际用量 − 措施用量 − 临建用量（系统按口径核对）', rules: 'V-G04' },
  { code: 'D3-12', name: '调出资产原值金额', dataset: 'D3', unit: '元', type: '数值', source: '带出', way: '自动取自周报', required: '是', formula: 'W5 调拨台账按调入组织汇总', rules: 'A11 / A12' },
  { code: 'D4-01', name: '姓名/所在单位/职务/是否专职', dataset: 'D4', unit: '—', type: '文本', source: '带出', way: '自动取自周报', required: '是', formula: 'W2 人员配备表', rules: 'V-C02' },
  { code: 'D5-00', name: '供货类型', dataset: 'D5', unit: '—', type: '枚举', source: '带出', way: '自动取自周报', required: '是', formula: 'W4 分供方资源库·供应类型（裁定：供货类型取自周报）', rules: 'V-E03', dict: '物资/租赁/服务/劳务分包' },
  { code: 'D5-01', name: '分供商名录（13 项）', dataset: 'D5', unit: '—', type: '文本', source: '带出', way: '自动取自周报', required: '是', formula: 'W4 分供方资源库（供货类型/名称/注册地/联系人/电话/邮箱/入库时间/考察人/业务往来/品类/评级/可供应国别/账期）', rules: 'V-C03' },
  { code: 'W1-07', name: '集采金额合计', dataset: 'W1', unit: '元', type: '数值', source: '带出', way: '自动取自周报', required: '是', formula: 'W3 集采跟踪表按主体汇总', rules: 'V-F01' },
  { code: 'W1-08', name: '采购成本降低率', dataset: 'W1', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '采购成本降低额 ÷ 集采金额合计', rules: 'V-T01' },
  { code: 'W3-09', name: '集采金额', dataset: 'W3', unit: '元', type: '数值', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-F01' },
  { code: 'W3-13', name: '招采发起时间 / 预计完成时间', dataset: 'W3', unit: '—', type: '日期', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-F02' },
  { code: 'W3-14', name: '下周计划 / 采购编号 / 亮点 / 备注', dataset: 'W3', unit: '—', type: '文本', source: '填报', way: '需填报', required: '否', formula: '—', rules: 'V-F02' },
  { code: 'W3-20', name: '是否首次资源配置', dataset: 'W3', unit: '—', type: '枚举', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-E03', dict: '是/否' },
  { code: 'W4-16', name: '账期', dataset: 'W4', unit: '—', type: '枚举', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-E03', dict: '预付/货到付款/月结30天/月结60天/月结90天/按节点结算' },
  { code: 'W4-15', name: '资源所属国别', dataset: 'W4', unit: '—', type: '枚举', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-E03', dict: '属地/属地中国/中国企业国外办厂/国内产品出口企业' },
  { code: 'W6-02', name: '项目地址', dataset: 'W6', unit: '—', type: '文本', source: '填报', way: '需填报', required: '是', formula: '—', rules: 'V-F02' },
  { code: 'W6-05', name: '其中：物资设备采购', dataset: 'W6', unit: '元', type: '数值', source: '填报', way: '需填报', required: '是', formula: '采购总额中的物资设备分项', rules: 'V-F01' },
  { code: 'W6-08', name: '综合采购成本降低率', dataset: 'W6', unit: '%', type: '数值', source: '计算', way: '系统自动算', required: '—', formula: '项目级率类，按采购总额加权汇总后作月报 D1 校验基准（偏差>±5% 仅提示核对）', rules: 'V-G08' },
  { code: 'W6-18', name: '风险描述 / 预计损失 / 化解时间', dataset: 'W6', unit: '—', type: '文本', source: '填报', way: '需填报', required: '条件必填', formula: '有风险时必填，无风险填"/"', rules: 'V-F01' }
];

/* 枚举字典配置（枚举名 / 维护状态 / 待决事项标注） */
const ENUM_DICT_CONFIG = [
  { key: 'rating', name: '供应商评级', items: ENUMS.rating, status: '已启用', note: 'V-E01：替代线下"A/A级"混写' },
  { key: 'supplyType', name: '供货类型', items: ENUMS.supplyType, status: '已启用', note: '取自基础字典' },
  { key: 'category', name: '品类', items: ENUMS.category, status: '已启用', note: '取自基础字典，可维护扩展' },
  { key: 'country', name: '可供应国别', items: ENUMS.country, status: '已启用', note: '取自基础字典' },
  { key: 'education', name: '学历', items: ENUMS.education, status: '已启用', note: 'V-E02' },
  { key: 'post', name: '从事岗位', items: ENUMS.post, status: '待收敛', note: '待业务确认"采购物资管理"归类后收敛为两类' },
  { key: 'sharedCenter', name: '所属共享中心', items: ENUMS.sharedCenter, status: '已启用', note: '按配置开放共享中心字段' },
  { key: 'gender', name: '性别', items: ENUMS.gender, status: '已启用', note: '' },
  /* V1.1 新增（W4 分供方资源库） */
  { key: 'resourceOrigin', name: '资源所属国别', items: ENUMS.resourceOrigin, status: '已启用', note: '新增：属地/属地中国/中国企业国外办厂/国内产品出口企业' },
  { key: 'paymentTerm', name: '账期', items: ENUMS.paymentTerm, status: '已启用', note: '新增：W4 填报 → 自动带出至月报 D5' }
];

/* 期间与频率配置（V1.1 双频：周报每周五 / 月报每月底） */
const PERIOD_CONFIG = [
  { period: '2026年9月第3周', freq: '周报', type: '周（每周五）', status: '填报中', deadline: '2026-09-18', task: 'T-2026W38' },
  { period: '2026年9月', freq: '月报', type: '月（每月底）', status: '填报中', deadline: '2026-09-30', task: 'T-2026M09' },
  { period: '2026年9月（专项）', freq: '月报', type: '月（专项）', status: '未开始', deadline: '2026-10-20', task: 'T-2026M09RY' },
  { period: '2026年9月第2周', freq: '周报', type: '周（每周五）', status: '已关闭', deadline: '2026-09-11', task: 'T-2026W37' },
  { period: '2026年9月第1周', freq: '周报', type: '周（每周五）', status: '已关闭', deadline: '2026-09-04', task: 'T-2026W36' },
  { period: '2025年12月', freq: '月报', type: '月（每月底）', status: '已截止', deadline: '2026-01-15', task: 'T-2025M12' },
  { period: '2025年6月', freq: '月报', type: '月（每月底）', status: '已关闭', deadline: '2025-07-15', task: 'T-2025M06' }
];

/* ---------- 审计轨迹示例（海外公司 D4，含周报带出说明） ---------- */
const AUDIT_LOGS_U01_D4 = [
  { time: '2026-09-10 14:35', operator: '张伟（海外公司·填报人）', action: '提交填报单', detail: 'D4 采购及物资管理人员提交审核；姓名/所在单位/职务/是否专职 4 项自动取自 W2 人员配备表，校验通过' },
  { time: '2026-09-11 09:20', operator: '陈国强（海外公司·审核人）', action: '单位审核通过', detail: '审核通过，提交局级复核' }
];

/* ---------- 站内信（顶栏消息，V1.1 双频） ---------- */
const MESSAGES = [
  { id: 1, type: '催办', title: '【催办】周报（9月第3周）将于 09-18 截止', detail: '截止前 1 天自动催办：中东共享中心 W3 填报中，非洲共享中心 W2~W5 未报齐，请尽快处理。', time: '2026-09-17 09:00' },
  { id: 2, type: '待办', title: '月报待办：2026年9月海外供应链数据月报', detail: '已自动带出 2026年9月第3周周报数据（D1 集采金额、D3 调出资产原值、D4 基础信息、D5 名录），请核对确认后补填剩余字段。', time: '2026-09-14 09:00' },
  { id: 3, type: '退回', title: '二公司 D1 已被局级复核退回', detail: '退回原因：劳务与专业分包采购效益额勾稽偏差超阈值。', time: '2026-09-07 09:45' },
  { id: 4, type: '覆盖', title: '自动带出值覆盖已留痕', detail: '海外公司 张伟 覆盖 D1「物资设备集采引用金额」带出值：原因"周报集采金额口径与月报月度归属差异"。', time: '2026-09-14 10:30' },
  { id: 5, type: '到期', title: '分供商禁用期到期提醒', detail: '利雅得城市装饰工程公司禁用期将于 2026-06-01 到期，请复核是否移出不合格库。', time: '2026-05-25 09:00' }
];
