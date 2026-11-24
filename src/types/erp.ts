export type NavKey =
  | 'dashboard'
  | 'rfq'
  | 'plan'
  | 'review'
  | 'data'
  | 'admin'
  | 'agents';

export type RoleCode = 'GM' | 'DEPT_ADMIN' | 'STAFF' | 'OPS';

export interface UserProfile {
  id: string;
  account: string;
  name: string;
  deptId: string;
  deptName: string;
  roleCode: RoleCode;
  roleName: string;
  status: '启用' | '停用';
  lastLogin: string;
}

export interface DeptNode {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  managerName: string;
  memberCount: number;
}

export type RfqStatus =
  | '草稿'
  | '解析中'
  | '待评审'
  | '评审完成'
  | '已报价'
  | '已关闭';

export type RequirementCategory =
  | '商务'
  | '技术'
  | '质量'
  | '物流包装'
  | '法规认证';

export type RequirementStatus = '待确认' | '已确认' | '已驳回';

export type ReviewConclusion = '可行' | '不可行' | '有条件可行';

export type QuoteTemplateCode = 'FAW_TOTAL' | 'BYD_DETAIL';

export interface SorPageContent {
  page: number;
  title: string;
  paragraphs: {
    id: string;
    text: string;
    highlightRef?: string;
  }[];
}

export interface RfqRequirement {
  id: string;
  projectId: string;
  seq: number;
  category: RequirementCategory;
  content: string;
  sourcePage: number;
  sourceText: string;
  sourceHighlightId?: string;
  deptName: string;
  mandatory: boolean;
  confidence: number;
  status: RequirementStatus;
}

export interface MissingRequirementItem {
  id: string;
  category: RequirementCategory;
  title: string;
  reason: string;
  adopted: boolean;
}

export interface DeptReviewItem {
  id: string;
  projectId: string;
  requirementId: string;
  requirementSeq: number;
  requirementSummary: string;
  deptName: string;
  reviewerName: string;
  conclusion: ReviewConclusion | '待回复';
  comment: string;
  updatedAt: string;
}

export interface BomHeader {
  id: string;
  partNo: string;
  name: string;
  version: string;
  customer: string;
  sourceFile: string;
  status: '有效' | '草稿' | '已锁定';
  lineCount: number;
  updatedAt: string;
}

export interface BomLine {
  id: string;
  headerId: string;
  level: 0 | 1 | 2;
  partNo: string;
  name: string;
  partType: '总成' | '金属件' | '面料' | '海绵' | '标准件' | '辅料';
  qty: number;
  unit: '件' | '米' | '千克' | '套';
  netWeight: number;
  lossRate: number; // percentage e.g. 3.5
  actualQty: number;
  supplierName: string;
  unitPrice: number | null; // null means missing price
  priceSource: '价格库' | '报价模板' | '人工录入' | '待确认';
  taxIncluded: boolean;
}

export interface RfqAttachment {
  id: string;
  name: string;
  type: 'PDF' | 'DOCX' | 'XLSX' | 'PNG';
  size: string;
  uploadedAt: string;
  uploader: string;
}

export interface RfqProject {
  id: string;
  code: string;
  customer: string;
  vehicle: string;
  partNo: string;
  partName: string;
  annualVolume: number;
  targetPrice: number;
  deadline: string;
  owner: string;
  status: RfqStatus;
  bomHeaderId: string | null;
  lockedVersion: string | null;
  sorPages: SorPageContent[];
  attachments: RfqAttachment[];
  updatedAt: string;
}

export interface WorkHourRecord {
  id: string;
  partNo: string;
  name: string;
  category: string;
  tCut: number; // minutes
  tSew: number; // minutes
  tAssemble: number; // minutes
  updatedAt: string;
}

export interface EquipmentRecord {
  id: string;
  code: string;
  name: string;
  model: string;
  area: '裁剪车间' | '缝纫车间' | '装配车间';
  process: '裁剪' | '缝纫' | '装配';
  capacityPerHour: number;
  shiftCount: number;
  status: '运行中' | '待机' | '检修';
}

export interface MaterialRecord {
  id: string;
  code: string;
  name: string;
  spec: string;
  grade: string;
  unit: '件' | '米' | '千克' | '套';
  sourceType: '自制' | '外购';
  tempMaster: boolean;
  onHand: number;
  allocated: number;
  inspecting: number;
  safetyStock: number;
  inTransit: number;
  inProgress: number;
  etaDate: string;
}

export interface PriceRecord {
  id: string;
  materialCode: string;
  materialName: string;
  supplierName: string;
  priceExclTax: number;
  priceInclTax: number;
  taxRate: number;
  effectiveDate: string;
  source: '价格库' | '报价模板' | '人工录入';
  confirmed: boolean;
}

export interface ProductionTask {
  id: string;
  orderNo: string;
  partNo: string;
  partName: string;
  customer: string;
  qty: number;
  deliveryDate: string;
  priority: '高' | '中' | '低';
}

export interface MaterialExplosionRow {
  materialCode: string;
  materialName: string;
  partType: string;
  unit: string;
  grossDemand: number;
  onHand: number;
  allocated: number;
  inspecting: number;
  safetyStock: number;
  availableQty: number;
  netDemand: number;
  inTransit: number;
  inProgress: number;
  etaDate: string;
  isShortage: boolean;
}

export interface ProcessCapacityRow {
  process: '裁剪' | '缝纫' | '装配';
  requiredHours: number;
  availableHours: number;
  loadRate: number; // percentage e.g. 94.2
  equipmentCount: number;
  status: '正常' | '预警' | '瓶颈';
}

export interface ProdPlanLine {
  id: string;
  lineName: string;
  partNo: string;
  partName: string;
  process: '裁剪' | '缝纫' | '装配';
  qty: number;
  stdHourMin: number;
  startTime: string;
  endTime: string;
  equipmentCode: string;
  equipmentName: string;
  reason: string;
  note: string;
  status: '草稿' | '已确认' | '执行中' | '已完成';
}

export type RejectReasonCategory =
  | '数据错'
  | '规则缺'
  | '约束未告知'
  | '表述不清';

export interface ReviewRecord {
  id: string;
  title: string;
  objectType: '报价单' | '需求锁定' | '周生产计划' | 'BOM变更';
  objectCode: string;
  submitter: string;
  reviewer: string;
  deptName: string;
  prevVersion: string;
  currVersion: string;
  status: '待审核' | '已通过' | '已驳回' | '已转交';
  submittedAt: string;
  reviewedAt?: string;
  rejectCategory?: RejectReasonCategory;
  comment?: string;
  summaryPoints: string[];
  diffRows: { field: string; before: string; after: string }[];
}

export interface AuditLogEntry {
  id: string;
  ts: string;
  userName: string;
  roleName: string;
  action: '登录' | '查看敏感单据' | '导出' | '修改' | '审核与驳回' | '权限变更' | '模型调用';
  objectType: string;
  objectId: string;
  detail: string;
}

export interface HarnessVersion {
  version: string;
  updatedAt: string;
  updatedBy: string;
  note: string;
  harnessText: string;
}

export interface AgentRunRecord {
  id: string;
  agentCode: string;
  ts: string;
  inputSummary: string;
  outputSummary: string;
  tokens: number;
  latencyMs: number;
  status: '成功' | '重试成功' | '规则兜底';
}

export interface AgentConfig {
  code: string;
  name: string;
  purpose: string;
  model: string;
  temperature: number;
  enabled: boolean;
  recentSevenSuccessRate: number; // e.g. 100 or 85.7
  currentVersion: string;
  harnessText: string;
  versions: HarnessVersion[];
}

export interface QuoteReadinessResult {
  ready: boolean;
  checks: {
    key: 'bom' | 'price' | 'workHour' | 'review';
    label: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface QuoteCalculationResult {
  materialCost: number;
  laborCost: number;
  toolingCost: number;
  otherCost: number;
  subtotalExclTax: number;
  taxAmount: number;
  totalInclTax: number;
  missingPriceLines: string[];
  breakdownRows: {
    id: string;
    partNo: string;
    name: string;
    costType: '材料' | '人工' | '模具' | '其他';
    qty: number;
    unitPrice: number;
    lossRate: number;
    amountExclTax: number;
    source: string;
  }[];
}

export interface SalesOrder {
  id: string;
  docNo: string;
  customer: string;
  materialCode: string;
  materialName: string;
  qty: number;
  deliveryDate: string;
  status: '待排产' | '排产中' | '生产中' | '已发运';
}

export interface MaterialStandardRecord {
  id: string;
  materialName: string;
  testItem: string;
  standardCode: string;
  requirement: string;
}

export interface RfqProgressSummary {
  projectId: string;
  stageLabel: string;
  stageStep: number; // 1..5
  percent: number;
  reviewDone: number;
  reviewTotal: number;
  hasConflict: boolean;
  blockers: string[];
  actionDept: string;
  daysToDeadline: number;
  isOverdue: boolean;
}

export interface OrderProgressSummary {
  orderNo: string;
  customer: string;
  partName: string;
  qty: number;
  deliveryDate: string;
  cutPct: number;
  sewPct: number;
  asmPct: number;
  overallPct: number;
  riskLevel: '正常' | '关注' | '延期风险';
  riskNote: string;
}

