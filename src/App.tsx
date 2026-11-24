import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarClock,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from 'lucide-react';
import type {
  AgentConfig,
  AgentRunRecord,
  AuditLogEntry,
  BomLine,
  DeptReviewItem,
  MissingRequirementItem,
  NavKey,
  ProdPlanLine,
  ProductionTask,
  QuoteTemplateCode,
  RejectReasonCategory,
  ReviewRecord,
  RfqProject,
  RfqRequirement,
  RoleCode,
  UserProfile,
} from './types/erp';
import {
  SEED_AGENTS,
  SEED_AGENT_RUNS,
  SEED_AUDIT_LOGS,
  SEED_BOM_HEADERS,
  SEED_BOM_LINES,
  SEED_DEPTS,
  SEED_DEPT_REVIEWS,
  SEED_EQUIPMENTS,
  SEED_MATERIALS,
  SEED_MATERIAL_STANDARDS,
  SEED_MISSING_ITEMS,
  SEED_PLAN_TASKS,
  SEED_PRICES,
  SEED_REVIEWS,
  SEED_RFQ_PROJECTS,
  SEED_REQUIREMENTS,
  SEED_SALES_ORDERS,
  SEED_USERS,
  SEED_WORK_HOURS,
} from './data/seedData';
import {
  calculateProcessCapacity,
  explodeBomRequirements,
  generateProductionSchedule,
} from './utils/manufacturing';
import { DashboardView } from './views/DashboardView';
import { RfqView } from './views/RfqView';
import { PlanView } from './views/PlanView';
import { ReviewView } from './views/ReviewView';
import { DataView } from './views/DataView';
import { AdminView } from './views/AdminView';
import { AgentsView } from './views/AgentsView';

interface NavDef {
  key: NavKey;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: RoleCode[];
}

const NAV_ITEMS: NavDef[] = [
  { key: 'dashboard', label: '驾驶舱', path: '/dashboard', icon: LayoutDashboard, roles: ['GM'] },
  { key: 'rfq', label: '询价中心', path: '/rfq', icon: FileSpreadsheet, roles: ['GM', 'DEPT_ADMIN', 'STAFF'] },
  { key: 'plan', label: '生产计划', path: '/plan', icon: CalendarClock, roles: ['GM', 'DEPT_ADMIN', 'STAFF'] },
  { key: 'review', label: '审核中心', path: '/review', icon: ClipboardCheck, roles: ['GM', 'DEPT_ADMIN', 'STAFF'] },
  { key: 'data', label: '数据与知识', path: '/data', icon: Database, roles: ['GM', 'DEPT_ADMIN', 'STAFF', 'OPS'] },
  { key: 'admin', label: '系统管理', path: '/admin', icon: Settings, roles: ['GM', 'OPS'] },
  { key: 'agents', label: '智能体管理', path: '/agents', icon: Bot, roles: ['GM', 'OPS'] },
];

const ROLE_SWITCH_OPTIONS: {
  account: string;
  roleCode: RoleCode;
  userName: string;
  roleLabel: string;
  dept: string;
}[] = [
  { account: 'zhou.my', roleCode: 'GM', userName: '周明远', roleLabel: '总经理（只读督办）', dept: '总经办' },
  { account: 'sun.lh', roleCode: 'DEPT_ADMIN', userName: '孙丽华', roleLabel: '财务主管理员', dept: '财务核算部' },
  { account: 'chen.zq', roleCode: 'DEPT_ADMIN', userName: '陈志强', roleLabel: '技术主管理员', dept: '技术研发部' },
  { account: 'lin.zy', roleCode: 'DEPT_ADMIN', userName: '林致远', roleLabel: '销售主管理员', dept: '销售与市场部' },
  { account: 'wang.jg', roleCode: 'STAFF', userName: '王建国', roleLabel: '普通员工（计划员）', dept: '生产制造部' },
  { account: 'wu.l', roleCode: 'OPS', userName: '吴磊', roleLabel: '系统运维', dept: '系统运维组' },
];

const STORAGE_KEY = 'slp_erp_v1_1_state';

function loadPersisted<T>(field: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed[field] !== undefined ? parsed[field] : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeAccountKey, setActiveAccountKey] = useState<string>(() =>
    loadPersisted<string>('activeAccountKey', 'zhou.my')
  );
  const [activeNav, setActiveNav] = useState<NavKey>(() =>
    loadPersisted<NavKey>('activeNav', 'dashboard')
  );
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);

  // Core Business States
  const [rfqProjects, setRfqProjects] = useState<RfqProject[]>(() =>
    loadPersisted('rfqProjects', SEED_RFQ_PROJECTS)
  );
  const [requirements, setRequirements] = useState<RfqRequirement[]>(() =>
    loadPersisted('requirements', SEED_REQUIREMENTS)
  );
  const [missingItemsMap, setMissingItemsMap] = useState<Record<string, MissingRequirementItem[]>>(
    () => loadPersisted('missingItemsMap', SEED_MISSING_ITEMS)
  );
  const [deptReviews, setDeptReviews] = useState<DeptReviewItem[]>(() =>
    loadPersisted('deptReviews', SEED_DEPT_REVIEWS)
  );
  const [bomLines, setBomLines] = useState<BomLine[]>(() =>
    loadPersisted('bomLines', SEED_BOM_LINES)
  );
  const [planTasks, setPlanTasks] = useState<ProductionTask[]>(() =>
    loadPersisted('planTasks', SEED_PLAN_TASKS)
  );
  const [scheduleLines, setScheduleLines] = useState<ProdPlanLine[]>(() =>
    loadPersisted(
      'scheduleLines',
      generateProductionSchedule(SEED_PLAN_TASKS, SEED_WORK_HOURS, SEED_EQUIPMENTS)
    )
  );
  const [reviews, setReviews] = useState<ReviewRecord[]>(() =>
    loadPersisted('reviews', SEED_REVIEWS)
  );
  const [users, setUsers] = useState<UserProfile[]>(() =>
    loadPersisted('users', SEED_USERS)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    loadPersisted('auditLogs', SEED_AUDIT_LOGS)
  );
  const [agents, setAgents] = useState<AgentConfig[]>(() =>
    loadPersisted('agents', SEED_AGENTS)
  );
  const [agentRuns, setAgentRuns] = useState<AgentRunRecord[]>(() =>
    loadPersisted('agentRuns', SEED_AGENT_RUNS)
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          activeAccountKey,
          activeNav,
          rfqProjects,
          requirements,
          missingItemsMap,
          deptReviews,
          bomLines,
          planTasks,
          scheduleLines,
          reviews,
          users,
          auditLogs,
          agents,
          agentRuns,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [
    activeAccountKey,
    activeNav,
    rfqProjects,
    requirements,
    missingItemsMap,
    deptReviews,
    bomLines,
    planTasks,
    scheduleLines,
    reviews,
    users,
    auditLogs,
    agents,
    agentRuns,
  ]);

  const currentAccount =
    ROLE_SWITCH_OPTIONS.find((r) => r.account === activeAccountKey) ?? ROLE_SWITCH_OPTIONS[0];
  const activeRole = currentAccount.roleCode;

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(activeRole)),
    [activeRole]
  );

  // Ensure activeNav is always permitted for activeRole
  useEffect(() => {
    if (!visibleNavItems.some((item) => item.key === activeNav)) {
      setActiveNav(visibleNavItems[0]?.key ?? 'data');
    }
  }, [activeRole, activeNav, visibleNavItems]);

  const appendAuditLog = (
    action: AuditLogEntry['action'],
    objectType: string,
    objectId: string,
    detail: string
  ) => {
    const entry: AuditLogEntry = {
      id: `al-${Date.now()}`,
      ts: new Date().toISOString().replace('T', ' ').slice(0, 19),
      userName: currentAccount.userName,
      roleName: currentAccount.roleLabel,
      action,
      objectType,
      objectId,
      detail,
    };
    setAuditLogs((prev) => [entry, ...prev]);
  };

  // Live capacity & shortage computed for Dashboard and Plan
  const capacityRows = useMemo(
    () => calculateProcessCapacity(planTasks, SEED_WORK_HOURS, SEED_EQUIPMENTS, 5),
    [planTasks]
  );
  const shortageRows = useMemo(
    () => explodeBomRequirements(planTasks, bomLines, SEED_MATERIALS),
    [planTasks, bomLines]
  );

  const pendingReviewCount =
    activeRole === 'GM'
      ? reviews.filter((r) => r.status === '待审核').length
      : reviews.filter((r) => r.status === '待审核' && r.reviewer === currentAccount.userName).length;
  const activeNavMeta = NAV_ITEMS.find((n) => n.key === activeNav) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-[#F7F7F8] text-[#111827]">
      {/* Codex-style Fixed Left Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-[248px]' : 'w-[68px]'
        } shrink-0 border-r border-[#E5E7EB] bg-[#F7F7F8] flex flex-col justify-between transition-all duration-150 sticky top-0 h-screen`}
      >
        <div>
          {/* Brand Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-[#E5E7EB]">
            {sidebarOpen ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#111827] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  S
                </div>
                <span className="text-sm font-semibold tracking-tight text-[#111827] truncate">
                  思利普智能管理
                </span>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#111827] text-white flex items-center justify-center text-xs font-bold mx-auto">
                S
              </div>
            )}
            {sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="收起侧边栏"
                className="p-1 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/60 cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {!sidebarOpen && (
            <div className="px-2 pt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="展开侧边栏"
                className="p-1.5 rounded-md text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/60 cursor-pointer"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 7 Navigation Links */}
          <nav aria-label="主导航" className="p-2.5 space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.key);
                    if (item.key !== 'rfq') setSelectedRfqId(null);
                  }}
                  title={!sidebarOpen ? item.label : undefined}
                  className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#111827] font-medium border border-[#E5E7EB] shadow-2xs'
                      : 'text-[#4B5563] hover:text-[#111827] hover:bg-[#EFEFF1]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#111827]' : 'text-[#6B7280]'
                      }`}
                    />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                  </span>
                  {sidebarOpen && item.key === 'review' && pendingReviewCount > 0 && (
                    <span className="font-mono-tabular text-[11px] font-semibold text-[#111827] bg-[#E5E7EB] px-1.5 py-0.5 rounded">
                      {pendingReviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Codex-style Role & Profile Switcher */}
        <div className="p-3 border-t border-[#E5E7EB]">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-medium shrink-0">
                  {currentAccount.userName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#111827] truncate">
                    {currentAccount.userName}
                  </div>
                  <div className="text-[11px] text-[#6B7280] truncate">
                    {currentAccount.dept} · {currentAccount.roleLabel}
                  </div>
                </div>
              </div>
              <select
                value={activeAccountKey}
                onChange={(e) => {
                  const nextAcc = e.target.value;
                  const nextMeta =
                    ROLE_SWITCH_OPTIONS.find((r) => r.account === nextAcc) ?? ROLE_SWITCH_OPTIONS[0];
                  setActiveAccountKey(nextAcc);
                  appendAuditLog(
                    '登录',
                    'role_switch',
                    nextMeta.account,
                    `切换登录角色视角为 ${nextMeta.userName}（${nextMeta.roleLabel}）`
                  );
                }}
                aria-label="切换登录角色"
                className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] cursor-pointer"
              >
                {ROLE_SWITCH_OPTIONS.map((opt) => (
                  <option key={opt.account} value={opt.account}>
                    视角：{opt.userName} ({opt.roleLabel})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div
              title={`${currentAccount.userName} · ${currentAccount.roleLabel}`}
              className="w-8 h-8 rounded-full bg-[#111827] text-white flex items-center justify-center text-xs font-medium mx-auto"
            >
              {currentAccount.userName.slice(0, 1)}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Contextual Breadcrumb + Single-line Action */}
        <header className="h-14 px-6 border-b border-[#E5E7EB] bg-white flex items-center justify-between gap-8 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="text-[#6B7280] whitespace-nowrap">思利普智能管理系统</span>
            <span className="text-[#D1D5DB]">/</span>
            <span className="font-semibold text-[#111827] whitespace-nowrap">
              {activeNavMeta.label}
            </span>
            <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#9CA3AF] ml-1">
              {activeNavMeta.path}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeRole === 'GM' && (
              <span className="text-xs text-[#047857] whitespace-nowrap">
                总经理只读督办视角：全局追踪项目进度、产线负荷与异常告警
              </span>
            )}
            {activeRole === 'STAFF' && (
              <span className="text-xs text-[#B45309] whitespace-nowrap">
                普通员工视图：已隐藏采购底价与毛利敏感字段
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload();
              }}
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] hover:bg-[#F3F4F6] whitespace-nowrap shrink-0 cursor-pointer"
            >
              重置演示数据
            </button>
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeNav === 'dashboard' && (
            <DashboardView
              rfqProjects={rfqProjects}
              requirements={requirements}
              deptReviews={deptReviews}
              bomLines={bomLines}
              workHours={SEED_WORK_HOURS}
              planTasks={planTasks}
              scheduleLines={scheduleLines}
              capacityRows={capacityRows}
              shortageRows={shortageRows}
              reviews={reviews}
              onNavigate={setActiveNav}
              onSelectRfq={(id) => setSelectedRfqId(id)}
              onSendUrgeReminder={(targetDept, refCode, message) =>
                appendAuditLog('修改', 'gm_urge_reminder', `${targetDept}:${refCode}`, message)
              }
            />
          )}

          {activeNav === 'rfq' && (
            <RfqView
              projects={rfqProjects}
              selectedProjectId={selectedRfqId}
              onSelectProject={setSelectedRfqId}
              requirements={requirements}
              missingItemsMap={missingItemsMap}
              reviews={deptReviews}
              bomHeaders={SEED_BOM_HEADERS}
              bomLines={bomLines}
              workHours={SEED_WORK_HOURS}
              currentUserName={currentAccount.userName}
              currentDeptName={currentAccount.dept}
              canViewCostMargin={activeRole !== 'STAFF'}
              onCreateProject={(proj, autoReqs) => {
                setRfqProjects((prev) => [proj, ...prev]);
                setRequirements((prev) => [...prev, ...autoReqs]);
                appendAuditLog('模型调用', 'rfq_project', proj.code, `新建询价项目并自动解析 ${autoReqs.length} 条 SOR 需求`);
              }}
              onUpdateRequirement={(updated) => {
                setRequirements((prev) =>
                  prev.map((r) => (r.id === updated.id ? updated : r))
                );
                appendAuditLog('修改', 'rfq_requirement', updated.id, `修订需求条目 #${updated.seq}（状态：${updated.status}）`);
              }}
              onAddRequirement={(newReq) => {
                setRequirements((prev) => [...prev, newReq]);
                appendAuditLog('修改', 'rfq_requirement', newReq.id, `新增需求条目：${newReq.content.slice(0, 24)}`);
              }}
              onMergeRequirements={(projectId, ids) => {
                const targets = requirements.filter((r) => ids.includes(r.id));
                if (targets.length < 2) return;
                const mergedContent = targets.map((t) => t.content).join('；');
                const first = targets[0];
                const merged: RfqRequirement = {
                  ...first,
                  content: mergedContent,
                  status: '已确认',
                  confidence: 1,
                };
                setRequirements((prev) => [
                  ...prev.filter((r) => !ids.includes(r.id)),
                  merged,
                ]);
                appendAuditLog('修改', 'rfq_project', projectId, `合并 ${ids.length} 条需求条目`);
              }}
              onAdoptMissingItem={(projectId, missingId) => {
                const list = missingItemsMap[projectId] ?? [];
                const target = list.find((m) => m.id === missingId);
                if (!target) return;
                setMissingItemsMap((prev) => ({
                  ...prev,
                  [projectId]: list.map((m) =>
                    m.id === missingId ? { ...m, adopted: true } : m
                  ),
                }));
                const nextSeq =
                  requirements.filter((r) => r.projectId === projectId).length + 1;
                setRequirements((prev) => [
                  ...prev,
                  {
                    id: `req-miss-${Date.now()}`,
                    projectId,
                    seq: nextSeq,
                    category: target.category,
                    content: target.title,
                    sourcePage: 1,
                    sourceText: '缺失项比对自动补充',
                    deptName: '技术研发部',
                    mandatory: true,
                    confidence: 0.9,
                    status: '待确认',
                  },
                ]);
              }}
              onLockRequirements={(projectId) => {
                setRfqProjects((prev) =>
                  prev.map((p) =>
                    p.id === projectId
                      ? { ...p, lockedVersion: 'V1.3', status: '待评审' }
                      : p
                  )
                );
                // Ensure dept review items exist for every requirement
                const projReqs = requirements.filter((r) => r.projectId === projectId);
                setDeptReviews((prev) => {
                  const existingKeys = new Set(
                    prev
                      .filter((r) => r.projectId === projectId)
                      .map((r) => `${r.requirementId}-${r.deptName}`)
                  );
                  const additions: DeptReviewItem[] = [];
                  for (const req of projReqs) {
                    const key = `${req.id}-${req.deptName}`;
                    if (!existingKeys.has(key)) {
                      additions.push({
                        id: `rev-${Date.now()}-${req.seq}`,
                        projectId,
                        requirementId: req.id,
                        requirementSeq: req.seq,
                        requirementSummary: req.content,
                        deptName: req.deptName,
                        reviewerName: '待指派',
                        conclusion: '待回复',
                        comment: '',
                        updatedAt: '-',
                      });
                    }
                  }
                  return [...prev, ...additions];
                });
                appendAuditLog('修改', 'rfq_project', projectId, '锁定需求版本 V1.3 并分派各部门评审');
              }}
              onUpdateDeptReview={(updatedRev) => {
                setDeptReviews((prev) =>
                  prev.map((r) => (r.id === updatedRev.id ? updatedRev : r))
                );
                appendAuditLog('修改', 'rfq_review', updatedRev.id, `${updatedRev.deptName} 更新评审结论为 ${updatedRev.conclusion}`);
              }}
              onUpdateBomLinePrice={(lineId, newPrice) => {
                setBomLines((prev) =>
                  prev.map((l) =>
                    l.id === lineId
                      ? { ...l, unitPrice: newPrice, priceSource: '人工录入' }
                      : l
                  )
                );
                appendAuditLog('修改', 'bom_line', lineId, `人工补录 BOM 子件单价 ¥${newPrice.toFixed(2)}`);
              }}
              onSubmitQuoteForReview={(project, templateCode: QuoteTemplateCode, exclTax, inclTax) => {
                const newRev: ReviewRecord = {
                  id: `rv-${Date.now()}`,
                  title: `${project.customer} ${project.partName} 报价单（${templateCode}）`,
                  objectType: '报价单',
                  objectCode: `QT-${project.code.slice(-3)}-V1.0`,
                  submitter: currentAccount.userName,
                  reviewer: '孙丽华',
                  deptName: currentAccount.dept,
                  prevVersion: '草稿',
                  currVersion: 'V1.0',
                  status: '待审核',
                  submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                  summaryPoints: [
                    `模板：${templateCode}；不含税单价 ¥${exclTax.toFixed(2)}，含税单价 ¥${inclTax.toFixed(2)}。`,
                    `客户目标价 ¥${project.targetPrice.toFixed(2)}，四项报价就绪检查均已通过，待财务核算部复核毛利基线。`,
                  ],
                  diffRows: [
                    { field: '状态', before: '待报价', after: '冻结待审核 V1.0' },
                    { field: '含税报价', before: '-', after: `¥${inclTax.toFixed(2)}` },
                  ],
                };
                setReviews((prev) => [newRev, ...prev]);
                setRfqProjects((prev) =>
                  prev.map((p) =>
                    p.id === project.id ? { ...p, status: '已报价' } : p
                  )
                );
                appendAuditLog('修改', 'quote_header', newRev.objectCode, `冻结并提交财务核算部复核（含税 ¥${inclTax.toFixed(2)}）`);
              }}
              onLogAction={(action, objType, objId, detail) =>
                appendAuditLog(action, objType, objId, detail)
              }
            />
          )}

          {activeNav === 'plan' && (
            <PlanView
              tasks={planTasks}
              salesOrders={SEED_SALES_ORDERS}
              bomLines={bomLines}
              materials={SEED_MATERIALS}
              workHours={SEED_WORK_HOURS}
              equipments={SEED_EQUIPMENTS}
              scheduleLines={scheduleLines}
              onAddTask={(t) => {
                setPlanTasks((prev) => [t, ...prev]);
                appendAuditLog('修改', 'prod_plan_task', t.orderNo, `录入待生产任务 ${t.partNo} × ${t.qty}`);
              }}
              onBatchAddTasks={(list) => {
                setPlanTasks((prev) => [...list, ...prev]);
                appendAuditLog('修改', 'prod_plan_task', 'BATCH', `批量导入 ${list.length} 条待生产任务`);
              }}
              onRemoveTask={(id) => {
                setPlanTasks((prev) => prev.filter((t) => t.id !== id));
              }}
              onSetScheduleLines={setScheduleLines}
              onLogAction={(action, objType, objId, detail) =>
                appendAuditLog(action, objType, objId, detail)
              }
            />
          )}

          {activeNav === 'review' && (
            <ReviewView
              reviews={reviews}
              currentUserName={currentAccount.userName}
              currentRole={activeRole}
              onApprove={(id, comment) => {
                setReviews((prev) =>
                  prev.map((r) =>
                    r.id === id
                      ? {
                          ...r,
                          status: '已通过',
                          comment,
                          reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                        }
                      : r
                  )
                );
                appendAuditLog('审核与驳回', 'review_record', id, `部门复核通过：${comment}`);
              }}
              onReject={(id, category: RejectReasonCategory, comment) => {
                setReviews((prev) =>
                  prev.map((r) =>
                    r.id === id
                      ? {
                          ...r,
                          status: '已驳回',
                          rejectCategory: category,
                          comment,
                          reviewedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                        }
                      : r
                  )
                );
                appendAuditLog('审核与驳回', 'review_record', id, `部门驳回（${category}）：${comment}`);
              }}
              onTransfer={(id, targetReviewer) => {
                setReviews((prev) =>
                  prev.map((r) =>
                    r.id === id ? { ...r, reviewer: targetReviewer, status: '待审核' } : r
                  )
                );
                appendAuditLog('审核与驳回', 'review_record', id, `转交审核人至 ${targetReviewer}`);
              }}
              onUrgeReview={(id, targetReviewer, objectCode) => {
                appendAuditLog('修改', 'gm_urge_reminder', objectCode, `总经理催办提醒：请 ${targetReviewer} 加快复核单据 ${id}`);
              }}
            />
          )}

          {activeNav === 'data' && (
            <DataView
              materials={SEED_MATERIALS}
              materialStandards={SEED_MATERIAL_STANDARDS}
              bomHeaders={SEED_BOM_HEADERS}
              bomLines={bomLines}
              prices={SEED_PRICES}
              workHours={SEED_WORK_HOURS}
              equipments={SEED_EQUIPMENTS}
              onLogAction={(action, objType, objId, detail) =>
                appendAuditLog(action, objType, objId, detail)
              }
            />
          )}

          {activeNav === 'admin' && (
            <AdminView
              depts={SEED_DEPTS}
              users={users}
              auditLogs={auditLogs}
              onToggleUserStatus={(uid) => {
                setUsers((prev) =>
                  prev.map((u) =>
                    u.id === uid
                      ? { ...u, status: u.status === '启用' ? '停用' : '启用' }
                      : u
                  )
                );
                appendAuditLog('修改', 'user', uid, '切换账号启用/停用状态');
              }}
              onAddUser={(u) => {
                setUsers((prev) => [...prev, u]);
                appendAuditLog('修改', 'user', u.account, `新建用户账号 ${u.name}（${u.roleName}）`);
              }}
              onLogAction={(action, objType, objId, detail) =>
                appendAuditLog(action, objType, objId, detail)
              }
            />
          )}

          {activeNav === 'agents' && (
            <AgentsView
              agents={agents}
              runs={agentRuns}
              currentUserName={currentAccount.userName}
              onToggleEnabled={(code) => {
                setAgents((prev) =>
                  prev.map((a) =>
                    a.code === code ? { ...a, enabled: !a.enabled } : a
                  )
                );
                appendAuditLog('修改', 'agent_config', code, '切换智能体启用状态');
              }}
              onSaveHarness={(code, newText, note) => {
                setAgents((prev) =>
                  prev.map((a) => {
                    if (a.code !== code) return a;
                    const verNum = a.versions.length + 1;
                    const nextVer = `v1.${verNum + 3}`;
                    return {
                      ...a,
                      currentVersion: nextVer,
                      harnessText: newText,
                      versions: [
                        {
                          version: nextVer,
                          updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
                          updatedBy: currentAccount.userName,
                          note,
                          harnessText: newText,
                        },
                        ...a.versions,
                      ],
                    };
                  })
                );
                appendAuditLog('修改', 'agent_config', code, `保存 Harness 新版本：${note}`);
              }}
              onRollbackHarness={(code, version) => {
                setAgents((prev) =>
                  prev.map((a) => {
                    if (a.code !== code) return a;
                    const target = a.versions.find((v) => v.version === version);
                    if (!target) return a;
                    return {
                      ...a,
                      currentVersion: target.version,
                      harnessText: target.harnessText,
                    };
                  })
                );
                appendAuditLog('修改', 'agent_config', code, `回滚 Harness 至 ${version}`);
              }}
              onAddRunRecord={(run) => {
                setAgentRuns((prev) => [run, ...prev]);
                appendAuditLog(
                  '模型调用',
                  'agent_run',
                  run.agentCode,
                  `试运行（${run.tokens} tokens，${run.latencyMs}ms）`
                );
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
