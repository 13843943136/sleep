import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Clock,
  GitPullRequest,
  X,
} from 'lucide-react';
import type {
  BomLine,
  DeptReviewItem,
  MaterialExplosionRow,
  NavKey,
  ProcessCapacityRow,
  ProdPlanLine,
  ProductionTask,
  ReviewRecord,
  RfqProject,
  RfqRequirement,
  WorkHourRecord,
} from '../types/erp';
import {
  DASHBOARD_ORDER_DELIVERY_TREND,
  DASHBOARD_QUOTE_WIN_TREND,
} from '../data/seedData';
import {
  computeRfqProgress,
  computeWeeklyOrderProgress,
} from '../utils/manufacturing';
import { DualMetricChart, ProcessLoadBarChart } from '../components/Charts';
import { StateTag } from '../components/UiPrimitives';

interface DashboardViewProps {
  rfqProjects: RfqProject[];
  requirements: RfqRequirement[];
  deptReviews: DeptReviewItem[];
  bomLines: BomLine[];
  workHours: WorkHourRecord[];
  planTasks: ProductionTask[];
  scheduleLines: ProdPlanLine[];
  capacityRows: ProcessCapacityRow[];
  shortageRows: MaterialExplosionRow[];
  reviews: ReviewRecord[];
  onNavigate: (nav: NavKey) => void;
  onSelectRfq: (projectId: string) => void;
  onSendUrgeReminder: (targetDept: string, refCode: string, message: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rfqProjects,
  requirements,
  deptReviews,
  bomLines,
  workHours,
  planTasks,
  scheduleLines,
  capacityRows,
  shortageRows,
  reviews,
  onNavigate,
  onSelectRfq,
  onSendUrgeReminder,
}) => {
  const [urgedIds, setUrgedIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const rfqProgressList = useMemo(() => {
    return rfqProjects.map((proj) => {
      const wh = workHours.find((w) => w.partNo === proj.partNo) ?? workHours[0];
      return {
        project: proj,
        progress: computeRfqProgress(proj, requirements, deptReviews, bomLines, wh),
      };
    });
  }, [rfqProjects, requirements, deptReviews, bomLines, workHours]);

  const orderProgressList = useMemo(
    () => computeWeeklyOrderProgress(planTasks, scheduleLines, capacityRows),
    [planTasks, scheduleLines, capacityRows]
  );

  const activeRfqs = rfqProjects.filter((p) => p.status !== '已关闭').length;
  const pendingDeptReviews = reviews.filter((r) => r.status === '待审核');
  const abnormalCount =
    rfqProgressList.filter((x) => x.progress.isOverdue || x.progress.hasConflict).length +
    capacityRows.filter((c) => c.status === '瓶颈').length;

  const kpis = [
    {
      label: '在谈询价项目',
      value: `${activeRfqs}`,
      unit: '个',
      delta: `已报价 ${rfqProjects.filter((p) => p.status === '已报价').length} 个`,
      target: 'rfq' as NavKey,
    },
    {
      label: '本月报价金额',
      value: '1,045.80',
      unit: '万元',
      delta: '较上月 +8.9%',
      target: 'rfq' as NavKey,
    },
    {
      label: '准时交付率',
      value: '94.7%',
      unit: '近30天',
      delta: '目标基线 ≥95%',
      target: 'plan' as NavKey,
    },
    {
      label: '周计划达成率',
      value: '96.2%',
      unit: 'W47 实绩',
      delta: '较上周 +1.4%',
      target: 'plan' as NavKey,
    },
    {
      label: '报价偏差率',
      value: '+3.8%',
      unit: '含税vs目标',
      delta: '可控阈值 ±5%',
      target: 'rfq' as NavKey,
    },
    {
      label: '异常阻塞告警',
      value: `${abnormalCount}`,
      unit: '项',
      delta: `各部门在审 ${pendingDeptReviews.length} 单`,
      target: 'review' as NavKey,
    },
  ];

  const handleUrge = (id: string, dept: string, code: string) => {
    if (urgedIds.includes(id)) return;
    setUrgedIds((prev) => [...prev, id]);
    onSendUrgeReminder(dept, code, `总经理驾驶舱督办提醒：请 ${dept} 优先推进 ${code}`);
    setToast(`已向「${dept}」发送 ${code} 进度督办提醒并写入审计日志`);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#047857] flex items-center justify-between">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. 六张核心经营指标卡（只读全局视角） */}
      <section aria-label="核心经营指标">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {kpis.map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.target)}
              className="group text-left rounded-xl border border-[#E5E7EB] bg-white p-4 hover:border-[#111827]/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-xs text-[#6B7280]">
                <span className="truncate">{kpi.label}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#111827] shrink-0" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold tracking-tight text-[#111827] font-mono-tabular">
                  {kpi.value}
                </span>
                <span className="text-xs text-[#6B7280]">{kpi.unit}</span>
              </div>
              <div className="mt-2 text-[11px] text-[#6B7280] font-mono-tabular">
                {kpi.delta}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 2. 项目全链路推进进度看板 + 本周生产工单进度 */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left 7 cols: RFQ Project Pipeline Progress */}
        <div className="xl:col-span-7 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                询价项目全链路推进进度（各部门协同节点）
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                进度节点：SOR 解析 → 部门并行评审 → BOM 核算补价 → 部门复核 → 正式报价
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('rfq')}
              className="text-xs font-medium text-[#111827] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              进入询价列表 →
            </button>
          </div>

          <div className="divide-y divide-[#F3F4F6] text-xs">
            {rfqProgressList.map(({ project, progress }) => {
              const isUrged = urgedIds.includes(project.id);
              const barColor = progress.hasConflict || progress.isOverdue
                ? 'bg-[#DC2626]'
                : progress.percent === 100
                ? 'bg-[#10A37F]'
                : 'bg-[#111827]';

              return (
                <div
                  key={project.id}
                  className="px-5 py-3 hover:bg-[#FAFAFB] transition-colors flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-[240px] flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRfq(project.id);
                          onNavigate('rfq');
                        }}
                        className="font-mono-tabular font-semibold text-[#111827] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {project.code}
                      </button>
                      <span className="font-medium text-[#111827] truncate">
                        {project.customer} · {project.partName}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#6B7280]">
                      <span>责任节点：{progress.actionDept}</span>
                      {progress.reviewTotal > 0 && (
                        <span>
                          · 部门评审 {progress.reviewDone}/{progress.reviewTotal}
                        </span>
                      )}
                      {progress.blockers.length > 0 && (
                        <span className="text-[#B91C1C]">
                          · 卡点：{progress.blockers[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar & Deadline */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-36">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-medium text-[#374151]">{progress.stageLabel}</span>
                        <span className="font-mono-tabular font-semibold text-[#111827]">
                          {progress.percent}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-24 text-right font-mono-tabular">
                      {progress.percent === 100 ? (
                        <StateTag label="已闭环" tone="success" />
                      ) : progress.isOverdue ? (
                        <StateTag label={`逾期 ${Math.abs(progress.daysToDeadline)} 天`} tone="danger" />
                      ) : (
                        <span
                          className={
                            progress.daysToDeadline <= 3
                              ? 'text-[#B45309] font-medium'
                              : 'text-[#6B7280]'
                          }
                        >
                          剩 {progress.daysToDeadline} 天
                        </span>
                      )}
                    </div>

                    {progress.percent < 100 ? (
                      <button
                        type="button"
                        disabled={isUrged}
                        onClick={() => handleUrge(project.id, progress.actionDept, project.code)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] whitespace-nowrap cursor-pointer ${
                          isUrged
                            ? 'border-[#E5E7EB] bg-[#F3F4F6] text-[#9CA3AF] cursor-default'
                            : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        <Bell className="w-3 h-3" />
                        {isUrged ? '已督办' : '督办'}
                      </button>
                    ) : (
                      <span className="w-[54px]" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 5 cols: Weekly Production Order Progress */}
        <div className="xl:col-span-5 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                本周生产工单工序进度（W48）
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                按裁剪 / 缝纫 / 装配三段工时节拍追踪交付风险
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('plan')}
              className="text-xs font-medium text-[#111827] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              排产详情 →
            </button>
          </div>

          <div className="divide-y divide-[#F3F4F6] text-xs flex-1">
            {orderProgressList.map((ord) => (
              <div key={ord.orderNo} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono-tabular font-semibold text-[#111827]">
                      {ord.orderNo}
                    </span>
                    <span className="ml-2 text-[#374151] font-medium truncate">
                      {ord.customer} · {ord.qty.toLocaleString()} 台
                    </span>
                  </div>
                  <StateTag
                    label={ord.riskLevel}
                    tone={
                      ord.riskLevel === '延期风险'
                        ? 'danger'
                        : ord.riskLevel === '关注'
                        ? 'warning'
                        : 'success'
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono-tabular text-[#4B5563]">
                  <div>
                    裁剪 <span className="text-[#111827] font-semibold">{ord.cutPct}%</span>
                  </div>
                  <div>
                    缝纫 <span className="text-[#111827] font-semibold">{ord.sewPct}%</span>
                  </div>
                  <div>
                    装配 <span className="text-[#111827] font-semibold">{ord.asmPct}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        ord.riskLevel === '延期风险' ? 'bg-[#D97706]' : 'bg-[#10A37F]'
                      }`}
                      style={{ width: `${ord.overallPct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono-tabular text-[#6B7280] shrink-0">
                    交期 {ord.deliveryDate}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 近六个月经营趋势双图 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DualMetricChart
          title="近六个月销售订单量与实际交付量"
          subtitle="单位：台套 · 数据来源：金蝶销售订单与发运台账"
          unit="台"
          seriesALabel="订单需求量"
          seriesBLabel="准时交付量"
          colorA="#111827"
          colorB="#10A37F"
          kind="line"
          data={DASHBOARD_ORDER_DELIVERY_TREND.map((d) => ({
            label: d.month,
            seriesA: d.orderQty,
            seriesB: d.deliveryQty,
          }))}
        />
        <DualMetricChart
          title="近六个月对外报价金额与中标金额"
          subtitle="单位：万元（含税口径） · 数据来源：报价单与定点台账"
          unit="万元"
          seriesALabel="累计报价额"
          seriesBLabel="定点中标额"
          colorA="#374151"
          colorB="#0EA5E9"
          kind="bar"
          data={DASHBOARD_QUOTE_WIN_TREND.map((d) => ({
            label: d.month,
            seriesA: d.quoteAmountWan,
            seriesB: d.winAmountWan,
          }))}
        />
      </section>

      {/* 4. 工序负荷瓶颈与各部门异常/积压只读汇总 */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5">
          <ProcessLoadBarChart
            rows={capacityRows}
            onInspectPlan={() => onNavigate('plan')}
          />
        </div>

        <div className="xl:col-span-7 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                异常问题与各部门协同积压监控（只读督办）
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                汇总评审矛盾、缺料预警及各部门内部流转待审单据，具体审批由对应职能部门主责执行
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#F3F4F6] text-xs">
            {/* 部门评审冲突与逾期 */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827]">
                  <Clock className="w-3.5 h-3.5 text-[#DC2626]" />
                  跨部门冲突与逾期告警
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('rfq')}
                  className="text-[#4B5563] hover:text-[#111827] hover:underline cursor-pointer"
                >
                  查看项目明细 →
                </button>
              </div>
              <div className="space-y-1.5">
                {rfqProgressList
                  .filter((x) => x.progress.isOverdue || x.progress.hasConflict)
                  .map(({ project, progress }) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-[#FEF2F2]/60"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-mono-tabular font-semibold text-[#111827]">
                          {project.code}
                        </span>
                        <span className="ml-2 text-[#374151]">
                          {project.customer} · {progress.hasConflict ? '部门评审结论矛盾' : '已过报价截止期'}
                        </span>
                      </div>
                      <span className="text-[#B91C1C] font-medium shrink-0">
                        卡点：{progress.actionDept}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* 缺料预警 */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                  缺料预警物料（{shortageRows.filter((s) => s.isShortage).length} 项 · 模拟库存口径）
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('plan')}
                  className="text-[#4B5563] hover:text-[#111827] hover:underline cursor-pointer"
                >
                  算料明细 →
                </button>
              </div>
              <div className="space-y-1.5">
                {shortageRows
                  .filter((s) => s.isShortage)
                  .slice(0, 2)
                  .map((s) => (
                    <div
                      key={s.materialCode}
                      className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-[#FAFAFB]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-tabular text-[#111827] shrink-0">
                          {s.materialCode}
                        </span>
                        <span className="text-[#374151] truncate">{s.materialName}</span>
                      </div>
                      <span className="font-mono-tabular text-[#DC2626] font-medium shrink-0">
                        净缺 {s.netDemand} {s.unit} · ETA {s.etaDate}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* 各部门在审单据进度（非总经理审批） */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#111827]">
                  <GitPullRequest className="w-3.5 h-3.5 text-[#10A37F]" />
                  各部门流转待审进度（{pendingDeptReviews.length}）
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('review')}
                  className="text-[#4B5563] hover:text-[#111827] hover:underline cursor-pointer"
                >
                  查看审批进度 →
                </button>
              </div>
              {pendingDeptReviews.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[#047857] py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>各部门在审单据均已处理完成。</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pendingDeptReviews.map((rv) => (
                    <div
                      key={rv.id}
                      className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-[#FAFAFB]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StateTag label={rv.objectType} tone="info" />
                        <span className="text-[#111827] font-medium truncate">{rv.title}</span>
                      </div>
                      <span className="text-[#6B7280] shrink-0">
                        当前审核主责：<strong className="text-[#111827]">{rv.reviewer}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
