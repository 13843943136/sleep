import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Download,
  Play,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BomLine,
  EquipmentRecord,
  MaterialRecord,
  ProdPlanLine,
  ProductionTask,
  SalesOrder,
  WorkHourRecord,
} from '../types/erp';
import {
  calculateProcessCapacity,
  explodeBomRequirements,
  generateProductionSchedule,
} from '../utils/manufacturing';
import { downloadCsvFile, StateTag } from '../components/UiPrimitives';

interface PlanViewProps {
  tasks: ProductionTask[];
  salesOrders: SalesOrder[];
  bomLines: BomLine[];
  materials: MaterialRecord[];
  workHours: WorkHourRecord[];
  equipments: EquipmentRecord[];
  scheduleLines: ProdPlanLine[];
  onAddTask: (task: ProductionTask) => void;
  onBatchAddTasks: (tasks: ProductionTask[]) => void;
  onRemoveTask: (taskId: string) => void;
  onSetScheduleLines: (lines: ProdPlanLine[]) => void;
  onLogAction: (action: '导出' | '修改' | '模型调用', objectType: string, objectId: string, detail: string) => void;
}

export const PlanView: React.FC<PlanViewProps> = ({
  tasks,
  salesOrders,
  bomLines,
  materials,
  workHours,
  equipments,
  scheduleLines,
  onAddTask,
  onBatchAddTasks,
  onRemoveTask,
  onSetScheduleLines,
  onLogAction,
}) => {
  const [activeStep, setActiveStep] = useState<'tasks' | 'materials' | 'capacity' | 'schedule'>('tasks');
  const [overtimeMode, setOvertimeMode] = useState(false);
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<string>('全部产线');
  const [scheduleViewMode, setScheduleViewMode] = useState<'table' | 'timeline'>('table');
  const [notice, setNotice] = useState<string | null>(null);

  // Add single task state
  const [newTask, setNewTask] = useState({
    partNo: 'SPL-J7-78201',
    qty: '180',
    deliveryDate: '2026-11-29',
    priority: '高' as '高' | '中' | '低',
  });

  // Paste Excel modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState(
    'SPL-J7-78201\t200\t2026-11-29\t高\nSPL-BYD-52104\t150\t2026-11-30\t中'
  );

  // Import from Kingdee Sales Orders modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(() =>
    salesOrders.filter((so) => so.status === '待排产').map((so) => so.id)
  );

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const materialRows = useMemo(
    () => explodeBomRequirements(tasks, bomLines, materials),
    [tasks, bomLines, materials]
  );

  const effectiveEquipments = useMemo(() => {
    if (!overtimeMode) return equipments;
    return equipments.map((eq) =>
      eq.process === '缝纫' ? { ...eq, shiftCount: Math.min(3, eq.shiftCount + 1) } : eq
    );
  }, [equipments, overtimeMode]);

  const capacityRows = useMemo(
    () => calculateProcessCapacity(tasks, workHours, effectiveEquipments, 5),
    [tasks, workHours, effectiveEquipments]
  );

  const handleRunMaterial = () => {
    setActiveStep('materials');
    showToast(`已完成 ${tasks.length} 项待产任务的 BOM 逐层算料（模拟库存）`);
  };

  const handleRunCapacity = () => {
    setActiveStep('capacity');
    showToast('已按最新工时定额与 72 台设备班次完成工序负荷测算');
  };

  const handleRunSchedule = () => {
    const generated = generateProductionSchedule(tasks, workHours, effectiveEquipments);
    onSetScheduleLines(generated);
    setActiveStep('schedule');
    onLogAction(
      '模型调用',
      'prod_plan',
      'PLAN-2026W48',
      `生成 ${generated.length} 条周排产行并调用 DeepSeek 生成排产理由`
    );
    showToast(`已生成 ${generated.length} 条周排产计划及 AI 排产理由`);
  };

  const handleBatchPaste = () => {
    const rows = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed: ProductionTask[] = [];
    rows.forEach((line, idx) => {
      const cols = line.split(/\t|,/).map((c) => c.trim());
      if (cols.length >= 2) {
        const partNo = cols[0];
        const qty = parseInt(cols[1], 10) || 100;
        const deliveryDate = cols[2] || '2026-11-30';
        const priority = (cols[3] === '高' || cols[3] === '低' ? cols[3] : '中') as '高' | '中' | '低';
        const matched = workHours.find((w) => w.partNo === partNo);
        parsed.push({
          id: `pt-${Date.now()}-${idx}`,
          orderNo: `SO-IMP-${String(idx + 1).padStart(3, '0')}`,
          partNo,
          partName: matched?.name ?? `${partNo} 座椅总成`,
          customer: partNo.includes('BYD') ? '比亚迪' : partNo.includes('GL') ? '吉利汽车' : '一汽解放',
          qty,
          deliveryDate,
          priority,
        });
      }
    });
    if (parsed.length > 0) {
      onBatchAddTasks(parsed);
      setShowPasteModal(false);
      showToast(`成功批量导入 ${parsed.length} 条待生产任务`);
    }
  };

  const moveScheduleRow = (id: string, dir: -1 | 1) => {
    const idx = scheduleLines.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= scheduleLines.length) return;
    const copy = [...scheduleLines];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onSetScheduleLines(copy);
  };

  const filteredSchedule = useMemo(() => {
    if (lineFilter === '全部产线') return scheduleLines;
    return scheduleLines.filter((s) => s.lineName === lineFilter);
  }, [scheduleLines, lineFilter]);

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#047857] flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navigation & Workflow Controls */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
          {[
            { key: 'tasks' as const, label: `1. 任务录入 (${tasks.length})` },
            { key: 'materials' as const, label: '2. 算料结果' },
            { key: 'capacity' as const, label: '3. 产能测算' },
            { key: 'schedule' as const, label: `4. 排产结果 (${scheduleLines.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveStep(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeStep === tab.key
                  ? 'bg-white text-[#111827] font-medium shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRunMaterial}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
          >
            执行算料
          </button>
          <button
            type="button"
            onClick={handleRunCapacity}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
          >
            产能测算
          </button>
          <button
            type="button"
            onClick={handleRunSchedule}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            生成周排产
          </button>
        </div>
      </div>

      {/* ==================== STEP 1: TASK INPUT ==================== */}
      {activeStep === 'tasks' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-semibold text-[#111827]">
                录入待生产任务（支持从销售订单导入或粘贴 Excel 区域）
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  从金蝶销售订单导入
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  粘贴 Excel 批量导入
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="block text-[#6B7280] mb-1">产品总成</label>
                <select
                  value={newTask.partNo}
                  onChange={(e) => setNewTask({ ...newTask, partNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                >
                  {workHours.slice(0, 4).map((w) => (
                    <option key={w.id} value={w.partNo}>
                      {w.partNo} · {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1">计划数量（台套）</label>
                <input
                  type="number"
                  value={newTask.qty}
                  onChange={(e) => setNewTask({ ...newTask, qty: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block text-[#6B7280] mb-1">要货交期</label>
                <input
                  type="date"
                  value={newTask.deliveryDate}
                  onChange={(e) => setNewTask({ ...newTask, deliveryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[#6B7280] mb-1">优先级</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({
                        ...newTask,
                        priority: e.target.value as '高' | '中' | '低',
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                  >
                    <option value="高">高</option>
                    <option value="中">中</option>
                    <option value="低">低</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const qty = parseInt(newTask.qty, 10);
                    if (!qty || qty <= 0) return;
                    const wh = workHours.find((w) => w.partNo === newTask.partNo);
                    onAddTask({
                      id: `pt-${Date.now()}`,
                      orderNo: `SO-202611-${String(tasks.length + 95).padStart(3, '0')}`,
                      partNo: newTask.partNo,
                      partName: wh?.name ?? newTask.partNo,
                      customer: newTask.partNo.includes('BYD')
                        ? '比亚迪'
                        : newTask.partNo.includes('GL')
                        ? '吉利汽车'
                        : newTask.partNo.includes('HL')
                        ? '华凌星马'
                        : '一汽解放',
                      qty,
                      deliveryDate: newTask.deliveryDate,
                      priority: newTask.priority,
                    });
                    showToast('已添加待生产任务');
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#111827] text-white font-medium hover:bg-[#1F2937] cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  录入
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                  <th className="py-3 px-4">订单单据号</th>
                  <th className="py-3 px-4">客户</th>
                  <th className="py-3 px-4">产品零件号与名称</th>
                  <th className="py-3 px-4 text-right">计划数量</th>
                  <th className="py-3 px-4">交期</th>
                  <th className="py-3 px-4">优先级</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-3 px-4 font-mono-tabular font-medium text-[#111827]">
                      {t.orderNo}
                    </td>
                    <td className="py-3 px-4 text-[#374151]">{t.customer}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#111827]">{t.partName}</div>
                      <div className="text-[11px] font-mono-tabular text-[#6B7280]">{t.partNo}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#111827]">
                      {t.qty.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-[#4B5563]">
                      {t.deliveryDate}
                    </td>
                    <td className="py-3 px-4">
                      <StateTag
                        label={t.priority}
                        tone={
                          t.priority === '高'
                            ? 'danger'
                            : t.priority === '中'
                            ? 'warning'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveTask(t.id)}
                        aria-label={`删除任务 ${t.orderNo}`}
                        className="p-1 rounded text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== STEP 2: BOM MATERIAL EXPLOSION (SIMULATED) ==================== */}
      {activeStep === 'materials' && (
        <div className="space-y-3">
          {/* Mandatory Red Notice Banner per Dev Doc */}
          <div
            role="alert"
            className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-center justify-between gap-3 text-xs text-[#991B1B]"
          >
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>
                模拟数据提示：金蝶 ERP 实时库存接口尚未接入，当前可用量（现存 − 已分配 − 在检 − 安全库存）与净需求为模拟测算结果，不可直接作为正式采购下单依据。
              </span>
            </div>
            <StateTag label="模拟算料" tone="danger" />
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                    <th className="py-3 px-4">物料编码</th>
                    <th className="py-3 px-3">物料名称与类别</th>
                    <th className="py-3 px-3 text-right">毛需求</th>
                    <th className="py-3 px-3 text-right">现存</th>
                    <th className="py-3 px-3 text-right">已分配/在检/安全</th>
                    <th className="py-3 px-3 text-right">可用量</th>
                    <th className="py-3 px-3 text-right">净需求（缺料）</th>
                    <th className="py-3 px-3 text-right">在途数量</th>
                    <th className="py-3 px-4">预计到货</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {materialRows.map((row) => (
                    <tr
                      key={row.materialCode}
                      className={row.isShortage ? 'bg-[#FEF2F2]/40' : 'hover:bg-[#FAFAFB]'}
                    >
                      <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#111827]">
                        {row.materialCode}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[#111827] font-medium">{row.materialName}</div>
                        <div className="text-[11px] text-[#6B7280]">
                          {row.partType} · 单位 {row.unit}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {row.grossDemand.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4B5563]">
                        {row.onHand}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#6B7280]">
                        {row.allocated} / {row.inspecting} / {row.safetyStock}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-[#111827]">
                        {row.availableQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {row.isShortage ? (
                          <span className="font-semibold text-[#DC2626]">
                            缺 {row.netDemand} {row.unit}
                          </span>
                        ) : (
                          <span className="text-[#047857]">齐套</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#374151]">
                        {row.inTransit}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-[#4B5563]">
                        {row.etaDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: CAPACITY CHECK ==================== */}
      {activeStep === 'capacity' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                周工序负荷与设备产能测算（裁剪 / 缝纫 / 装配）
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                规则：超出 90% 标黄预警，超出 100% 标红并标识为周排产瓶颈工序
              </p>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-[#111827] cursor-pointer select-none px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]">
              <input
                type="checkbox"
                checked={overtimeMode}
                onChange={(e) => setOvertimeMode(e.target.checked)}
              />
              试算缝纫车间加开 1 班（缓解瓶颈）
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {capacityRows.map((cap) => {
              const tone =
                cap.status === '瓶颈'
                  ? 'danger'
                  : cap.status === '预警'
                  ? 'warning'
                  : 'success';
              return (
                <div
                  key={cap.process}
                  className="rounded-xl border border-[#E5E7EB] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#111827]">
                      {cap.process}工序
                    </span>
                    <StateTag label={`${cap.loadRate.toFixed(1)}% · ${cap.status}`} tone={tone} />
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        cap.status === '瓶颈'
                          ? 'bg-[#DC2626]'
                          : cap.status === '预警'
                          ? 'bg-[#D97706]'
                          : 'bg-[#10A37F]'
                      }`}
                      style={{ width: `${Math.min(100, cap.loadRate)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono-tabular">
                    <div>
                      <div className="text-[#6B7280] text-[11px]">需求工时</div>
                      <div className="font-semibold text-[#111827]">{cap.requiredHours}h</div>
                    </div>
                    <div>
                      <div className="text-[#6B7280] text-[11px]">可用工时</div>
                      <div className="font-semibold text-[#111827]">{cap.availableHours}h</div>
                    </div>
                    <div>
                      <div className="text-[#6B7280] text-[11px]">可用设备</div>
                      <div className="font-semibold text-[#111827]">{cap.equipmentCount} 台</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== STEP 4: SCHEDULE TIMELINE & EXPORT ==================== */}
      {activeStep === 'schedule' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-[#111827]">
                周排产明细（按产线与交期排序）
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-[#F3F4F6] rounded-lg">
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('table')}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    scheduleViewMode === 'table'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  列表视图
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('timeline')}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    scheduleViewMode === 'timeline'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  产线时间轴视图
                </button>
              </div>
              <select
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value)}
                aria-label="筛选产线"
                className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white text-xs"
              >
                <option value="全部产线">全部产线</option>
                <option value="A1 自动裁剪线">A1 自动裁剪线</option>
                <option value="B2 精益缝纫线">B2 精益缝纫线</option>
                <option value="C1 总装及检线">C1 总装及检线</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                downloadCsvFile(
                  '思利普_W48周生产计划下发表.csv',
                  ['产线', '产品零件号', '产品名称', '工序', '计划数量', '标准工时(分/件)', '计划开始', '计划结束', '占用设备', '状态', '备注', '排产理由'],
                  scheduleLines.map((s) => [
                    s.lineName,
                    s.partNo,
                    s.partName,
                    s.process,
                    s.qty,
                    s.stdHourMin,
                    s.startTime,
                    s.endTime,
                    `${s.equipmentCode} ${s.equipmentName}`,
                    s.status,
                    s.note,
                    s.reason,
                  ])
                );
                onLogAction('导出', 'prod_plan', 'PLAN-2026W48', '导出周生产计划 Excel/CSV（对齐工厂周计划表）');
                showToast('已导出对齐工厂周计划表格式的排产文件');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出周计划表
            </button>
          </div>

          {scheduleViewMode === 'timeline' ? (
            <div className="p-4 space-y-4 overflow-x-auto">
              <div className="min-w-[780px] space-y-3">
                <div className="grid grid-cols-6 gap-2 text-[11px] font-mono-tabular text-[#6B7280] pb-2 border-b border-[#E5E7EB]">
                  <div className="font-sans font-medium text-[#111827]">产线通道</div>
                  <div className="text-center">11-24 周二</div>
                  <div className="text-center">11-25 周三</div>
                  <div className="text-center">11-26 周四</div>
                  <div className="text-center">11-27 周五</div>
                  <div className="text-center">11-28 周六</div>
                </div>
                {['A1 自动裁剪线', 'B2 精益缝纫线', 'C1 总装及检线']
                  .filter((ln) => lineFilter === '全部产线' || lineFilter === ln)
                  .map((lineName) => {
                    const lineTasks = filteredSchedule.filter((s) => s.lineName === lineName);
                    const days = ['11-24', '11-25', '11-26', '11-27', '11-28'];
                    return (
                      <div
                        key={lineName}
                        className="grid grid-cols-6 gap-2 items-stretch py-2 border-b border-[#F3F4F6] last:border-b-0"
                      >
                        <div className="pr-2 flex flex-col justify-center">
                          <div className="text-xs font-semibold text-[#111827]">{lineName}</div>
                          <div className="text-[11px] text-[#6B7280] font-mono-tabular">
                            {lineTasks.length} 个排程块
                          </div>
                        </div>
                        {days.map((day) => {
                          const dayItems = lineTasks.filter((t) => t.startTime.startsWith(day));
                          return (
                            <div
                              key={day}
                              className="rounded-lg bg-[#FAFAFB] border border-[#F3F4F6] p-1.5 space-y-1.5 min-h-[68px]"
                            >
                              {dayItems.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() =>
                                    setExpandedReasonId(expandedReasonId === item.id ? null : item.id)
                                  }
                                  className={`w-full text-left rounded-md border p-1.5 text-[11px] transition-colors cursor-pointer ${
                                    item.process === '缝纫'
                                      ? 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
                                      : item.process === '装配'
                                      ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
                                      : 'border-[#E5E7EB] bg-white text-[#111827]'
                                  }`}
                                >
                                  <div className="font-mono-tabular font-semibold truncate">
                                    {item.partNo} · {item.qty}台
                                  </div>
                                  <div className="font-mono-tabular text-[10px] opacity-80">
                                    {item.startTime.slice(6)}-{item.endTime.slice(6)}
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
              </div>
              {expandedReasonId && (() => {
                const found = scheduleLines.find((s) => s.id === expandedReasonId);
                if (!found) return null;
                return (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-xs text-[#374151]">
                    <span className="font-semibold text-[#111827]">
                      [{found.lineName}] {found.partNo} AI 排产理由：
                    </span>
                    {found.reason}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-white">
                  <th className="py-2.5 px-3 w-16">调序</th>
                  <th className="py-2.5 px-3">产线</th>
                  <th className="py-2.5 px-3">产品与零件号</th>
                  <th className="py-2.5 px-3">工序</th>
                  <th className="py-2.5 px-3 text-right">数量</th>
                  <th className="py-2.5 px-3">起止时间</th>
                  <th className="py-2.5 px-3">占用设备</th>
                  <th className="py-2.5 px-3">人工备注</th>
                  <th className="py-2.5 px-4 text-right">排产理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filteredSchedule.map((row) => {
                  const isOpen = expandedReasonId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr className="hover:bg-[#FAFAFB]">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveScheduleRow(row.id, -1)}
                              aria-label={`上移 ${row.partNo}`}
                              className="p-1 rounded border border-[#E5E7EB] hover:bg-[#F3F4F6] cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveScheduleRow(row.id, 1)}
                              aria-label={`下移 ${row.partNo}`}
                              className="p-1 rounded border border-[#E5E7EB] hover:bg-[#F3F4F6] cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-[#111827]">
                          {row.lineName}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-[#111827] font-medium">{row.partName}</div>
                          <div className="text-[11px] font-mono-tabular text-[#6B7280]">
                            {row.partNo}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StateTag label={row.process} tone="info" />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">
                          {row.qty}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-[#374151] whitespace-nowrap">
                          {row.startTime} ~ {row.endTime.slice(6)}
                        </td>
                        <td className="py-2.5 px-3 text-[#4B5563] whitespace-nowrap">
                          <span className="font-mono-tabular text-[#111827]">{row.equipmentCode}</span>{' '}
                          {row.equipmentName}
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => {
                              const val = e.target.value;
                              onSetScheduleLines(
                                scheduleLines.map((item) =>
                                  item.id === row.id ? { ...item, note: val } : item
                                )
                              );
                            }}
                            placeholder="插入车间备注..."
                            className="w-32 px-2 py-1 rounded border border-[#E5E7EB] text-xs"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedReasonId(isOpen ? null : row.id)
                            }
                            className="inline-flex items-center gap-1 text-[#0369A1] hover:underline cursor-pointer"
                          >
                            {isOpen ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                            查看理由
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[#F9FAFB]">
                          <td colSpan={9} className="px-6 py-2.5 text-xs text-[#374151]">
                            <span className="font-semibold text-[#111827]">AI 排产理由：</span>
                            {row.reason}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Paste Excel Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="粘贴 Excel 批量导入任务"
            className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">
                粘贴 Excel 区域批量导入待生产任务
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <p className="text-[#6B7280]">
                格式：每行一条，使用制表符（Excel 直接复制）或逗号分隔：
                <span className="font-mono-tabular text-[#111827]">
                  零件号, 数量, 交期(YYYY-MM-DD), 优先级(高/中/低)
                </span>
              </p>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                className="w-full p-3 rounded-lg border border-[#E5E7EB] font-mono-tabular text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleBatchPaste}
                  className="px-4 py-2 rounded-lg bg-[#111827] text-white font-medium cursor-pointer"
                >
                  解析并导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Import from Sales Orders Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="从金蝶销售订单导入"
            className="w-full max-w-2xl rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">从金蝶销售订单台账导入待排产任务</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  数据源：销售订单.xlsx · 已默认勾选状态为“待排产”的新增订单
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAFAFB] border-b border-[#E5E7EB] text-[#6B7280]">
                      <th className="py-2.5 px-3 w-10">选</th>
                      <th className="py-2.5 px-3">单据号</th>
                      <th className="py-2.5 px-3">客户</th>
                      <th className="py-2.5 px-3">产品总成</th>
                      <th className="py-2.5 px-3 text-right">数量</th>
                      <th className="py-2.5 px-3">交期</th>
                      <th className="py-2.5 px-3">订单状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {salesOrders.map((so) => {
                      const alreadyInPlan = tasks.some((t) => t.orderNo === so.docNo);
                      const checked = selectedOrderIds.includes(so.id);
                      return (
                        <tr key={so.id} className={alreadyInPlan ? 'opacity-50 bg-[#FAFAFB]' : 'hover:bg-[#FAFAFB]'}>
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              disabled={alreadyInPlan}
                              checked={checked && !alreadyInPlan}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedOrderIds((prev) => [...prev, so.id]);
                                } else {
                                  setSelectedOrderIds((prev) => prev.filter((id) => id !== so.id));
                                }
                              }}
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular font-medium text-[#111827]">{so.docNo}</td>
                          <td className="py-2.5 px-3 text-[#374151]">{so.customer}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-[#111827]">{so.materialName}</div>
                            <div className="text-[11px] font-mono-tabular text-[#6B7280]">{so.materialCode}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold">{so.qty}</td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[#4B5563]">{so.deliveryDate}</td>
                          <td className="py-2.5 px-3">
                            <StateTag
                              label={alreadyInPlan ? '已在任务池' : so.status}
                              tone={alreadyInPlan ? 'neutral' : so.status === '待排产' ? 'warning' : 'info'}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toAdd = salesOrders
                      .filter((so) => selectedOrderIds.includes(so.id) && !tasks.some((t) => t.orderNo === so.docNo))
                      .map((so) => ({
                        id: `pt-so-${so.id}-${Date.now()}`,
                        orderNo: so.docNo,
                        partNo: so.materialCode,
                        partName: so.materialName,
                        customer: so.customer,
                        qty: so.qty,
                        deliveryDate: so.deliveryDate,
                        priority: (so.qty >= 800 ? '高' : '中') as '高' | '中' | '低',
                      }));
                    if (toAdd.length > 0) {
                      onBatchAddTasks(toAdd);
                      showToast(`已从金蝶销售订单导入 ${toAdd.length} 项待排产任务`);
                    }
                    setShowOrderModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#111827] text-white font-medium cursor-pointer"
                >
                  导入所选订单
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
