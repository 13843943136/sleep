import type {
  BomLine,
  DeptReviewItem,
  EquipmentRecord,
  MaterialExplosionRow,
  MaterialRecord,
  ProcessCapacityRow,
  ProdPlanLine,
  ProductionTask,
  QuoteCalculationResult,
  QuoteReadinessResult,
  QuoteTemplateCode,
  ReviewConclusion,
  RfqProject,
  WorkHourRecord,
} from '../types/erp';

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * 实际用量 = 净用量 / (1 - 损耗率 / 100)
 */
export function calculateActualQty(qty: number, lossRatePct: number): number {
  const safeLoss = Math.min(Math.max(lossRatePct, 0), 95);
  return Math.round((qty / (1 - safeLoss / 100)) * 10000) / 10000;
}

/**
 * 可用量 = 现存数量 - 已分配 - 在检 - 安全库存
 */
export function calculateAvailableQty(material: {
  onHand: number;
  allocated: number;
  inspecting: number;
  safetyStock: number;
}): number {
  return round2(
    material.onHand - material.allocated - material.inspecting - material.safetyStock
  );
}

/**
 * 报价就绪检查：四项条件
 * 1. BOM 完整
 * 2. 每行有价
 * 3. 每道工序有工时
 * 4. 各部门已回复且无不可调和的直接冲突
 */
export function checkQuoteReadiness(
  project: RfqProject,
  bomLines: BomLine[],
  workHour: WorkHourRecord | undefined,
  reviews: DeptReviewItem[]
): QuoteReadinessResult {
  const bomComplete = Boolean(project.bomHeaderId) && bomLines.length > 0;
  const missingPriceLines = bomLines.filter(
    (line) => line.level > 0 && (line.unitPrice === null || line.unitPrice <= 0)
  );
  const allPriced = bomComplete && missingPriceLines.length === 0;

  const workHourComplete = Boolean(
    workHour && workHour.tCut > 0 && workHour.tSew > 0 && workHour.tAssemble > 0
  );

  const projectReviews = reviews.filter((r) => r.projectId === project.id);
  const pendingReviews = projectReviews.filter((r) => r.conclusion === '待回复');
  const rejectedReviews = projectReviews.filter((r) => r.conclusion === '不可行');
  const reviewsComplete =
    projectReviews.length > 0 &&
    pendingReviews.length === 0 &&
    rejectedReviews.length === 0;

  const checks: QuoteReadinessResult['checks'] = [
    {
      key: 'bom',
      label: 'BOM 结构完整',
      passed: bomComplete,
      detail: bomComplete
        ? `已关联 ${bomLines.length} 行有效 BOM 结构`
        : '尚未绑定或导入完整 BOM 结构',
    },
    {
      key: 'price',
      label: 'BOM 每行有价',
      passed: allPriced,
      detail: allPriced
        ? '全部外购/自制子件均已匹配单价'
        : !bomComplete
        ? '需先导入 BOM 结构'
        : `仍有 ${missingPriceLines.length} 行子件缺价（${missingPriceLines
            .slice(0, 2)
            .map((l) => l.name)
            .join('、')}）`,
    },
    {
      key: 'workHour',
      label: '每道工序有工时',
      passed: workHourComplete,
      detail: workHourComplete && workHour
        ? `裁剪 ${workHour.tCut}m · 缝纫 ${workHour.tSew}m · 装配 ${workHour.tAssemble}m`
        : '缺少裁剪/缝纫/装配标准工时定额',
    },
    {
      key: 'review',
      label: '各部门已回复且无否决',
      passed: reviewsComplete,
      detail:
        projectReviews.length === 0
          ? '尚未分派部门评审任务'
          : pendingReviews.length > 0
          ? `尚有 ${pendingReviews.length} 项待回复`
          : rejectedReviews.length > 0
          ? `存在 ${rejectedReviews.length} 项“不可行”评审结论`
          : `全部 ${projectReviews.length} 项评审已确认可行/有条件可行`,
    },
  ];

  return {
    ready: checks.every((c) => c.passed),
    checks,
  };
}

/**
 * 报价单逐行成本核算，严格区分材料、人工、模具、其他费用与含税/不含税
 */
export function calculateQuoteTotals(
  bomLines: BomLine[],
  workHour: WorkHourRecord | undefined,
  templateCode: QuoteTemplateCode,
  annualVolume: number,
  options: {
    hourlyRateYuan?: number;
    toolingTotalYuan?: number;
    testFeePerUnit?: number;
    packagingFeePerUnit?: number;
    logisticsFeePerUnit?: number;
    mgmtRatePct?: number;
    taxRatePct?: number;
  } = {}
): QuoteCalculationResult {
  const hourlyRate = options.hourlyRateYuan ?? 68; // 元/工时
  const toolingTotal = options.toolingTotalYuan ?? 185000;
  const testFee = options.testFeePerUnit ?? (templateCode === 'BYD_DETAIL' ? 4.2 : 3.5);
  const packagingFee = options.packagingFeePerUnit ?? (templateCode === 'BYD_DETAIL' ? 11.8 : 9.5);
  const logisticsFee = options.logisticsFeePerUnit ?? 14.5;
  const mgmtRate = options.mgmtRatePct ?? 6.5;
  const taxRate = options.taxRatePct ?? 13;

  const missingPriceLines: string[] = [];
  const breakdownRows: QuoteCalculationResult['breakdownRows'] = [];

  let materialCost = 0;

  for (const line of bomLines) {
    if (line.level === 0) continue;
    const actualQty = calculateActualQty(line.qty, line.lossRate);
    if (line.unitPrice === null || line.unitPrice <= 0) {
      missingPriceLines.push(`${line.partNo} ${line.name}`);
      continue;
    }
    const lineAmount = round2(actualQty * line.unitPrice);
    materialCost = round2(materialCost + lineAmount);
    breakdownRows.push({
      id: line.id,
      partNo: line.partNo,
      name: line.name,
      costType: '材料',
      qty: actualQty,
      unitPrice: line.unitPrice,
      lossRate: line.lossRate,
      amountExclTax: lineAmount,
      source: line.priceSource,
    });
  }

  // 人工费 = (裁剪 + 缝纫 + 装配 分钟) / 60 * 小时费率
  const totalMinutes = workHour
    ? workHour.tCut + workHour.tSew + workHour.tAssemble
    : 0;
  const laborCost = round2((totalMinutes / 60) * hourlyRate);
  if (workHour) {
    breakdownRows.push(
      {
        id: 'labor-cut',
        partNo: 'PROC-CUT',
        name: '裁剪工序标准人工',
        costType: '人工',
        qty: round2(workHour.tCut / 60),
        unitPrice: hourlyRate,
        lossRate: 0,
        amountExclTax: round2((workHour.tCut / 60) * hourlyRate),
        source: '工时定额库',
      },
      {
        id: 'labor-sew',
        partNo: 'PROC-SEW',
        name: '缝纫工序标准人工',
        costType: '人工',
        qty: round2(workHour.tSew / 60),
        unitPrice: hourlyRate,
        lossRate: 0,
        amountExclTax: round2((workHour.tSew / 60) * hourlyRate),
        source: '工时定额库',
      },
      {
        id: 'labor-asm',
        partNo: 'PROC-ASM',
        name: '装配与检验标准人工',
        costType: '人工',
        qty: round2(workHour.tAssemble / 60),
        unitPrice: hourlyRate,
        lossRate: 0,
        amountExclTax: round2((workHour.tAssemble / 60) * hourlyRate),
        source: '工时定额库',
      }
    );
  }

  // 模具分摊（按年需求量分摊单台）
  const safeVol = Math.max(annualVolume, 1000);
  const toolingCost = round2(toolingTotal / safeVol);
  breakdownRows.push({
    id: 'tooling-amort',
    partNo: 'TOOL-AMORT',
    name: `模具工装分摊 (${safeVol.toLocaleString()} 台/年)`,
    costType: '模具',
    qty: 1,
    unitPrice: toolingCost,
    lossRate: 0,
    amountExclTax: toolingCost,
    source: '报价模板参数',
  });

  // 其他费用：试验 + 包装 + 运输 + 管理费
  const mgmtFee = round2(((materialCost + laborCost) * mgmtRate) / 100);
  const otherCost = round2(testFee + packagingFee + logisticsFee + mgmtFee);
  breakdownRows.push(
    {
      id: 'other-test',
      partNo: 'FEE-TEST',
      name: 'DV/PV 法规试验分摊',
      costType: '其他',
      qty: 1,
      unitPrice: testFee,
      lossRate: 0,
      amountExclTax: testFee,
      source: templateCode === 'BYD_DETAIL' ? '比亚迪明细模板' : '解放总价模板',
    },
    {
      id: 'other-pkg',
      partNo: 'FEE-PKG',
      name: '循环围板箱包装费',
      costType: '其他',
      qty: 1,
      unitPrice: packagingFee,
      lossRate: 0,
      amountExclTax: packagingFee,
      source: templateCode === 'BYD_DETAIL' ? '比亚迪明细模板' : '解放总价模板',
    },
    {
      id: 'other-log',
      partNo: 'FEE-LOG',
      name: '主机厂干线物流运输费',
      costType: '其他',
      qty: 1,
      unitPrice: logisticsFee,
      lossRate: 0,
      amountExclTax: logisticsFee,
      source: '报价模板参数',
    },
    {
      id: 'other-mgmt',
      partNo: 'FEE-MGMT',
      name: `制造及企业管理费 (${mgmtRate}%)`,
      costType: '其他',
      qty: 1,
      unitPrice: mgmtFee,
      lossRate: 0,
      amountExclTax: mgmtFee,
      source: '报价模板参数',
    }
  );

  const subtotalExclTax = round2(materialCost + laborCost + toolingCost + otherCost);
  const taxAmount = round2((subtotalExclTax * taxRate) / 100);
  const totalInclTax = round2(subtotalExclTax + taxAmount);

  return {
    materialCost,
    laborCost,
    toolingCost,
    otherCost,
    subtotalExclTax,
    taxAmount,
    totalInclTax,
    missingPriceLines,
    breakdownRows,
  };
}

/**
 * 生产计划：按 BOM 展开算料（标记模拟库存）
 */
export function explodeBomRequirements(
  tasks: ProductionTask[],
  bomLines: BomLine[],
  materials: MaterialRecord[]
): MaterialExplosionRow[] {
  const matMap = new Map<string, MaterialRecord>();
  for (const m of materials) {
    matMap.set(m.code, m);
  }

  const demandByCode = new Map<
    string,
    { name: string; partType: string; unit: string; gross: number }
  >();

  for (const task of tasks) {
    const childLines = bomLines.filter((b) => b.level > 0);
    for (const line of childLines) {
      const actualPerUnit = calculateActualQty(line.qty, line.lossRate);
      const grossAdd = round2(actualPerUnit * task.qty);
      const prev = demandByCode.get(line.partNo);
      if (prev) {
        prev.gross = round2(prev.gross + grossAdd);
      } else {
        demandByCode.set(line.partNo, {
          name: line.name,
          partType: line.partType,
          unit: line.unit,
          gross: grossAdd,
        });
      }
    }
  }

  const rows: MaterialExplosionRow[] = [];
  for (const [code, item] of demandByCode.entries()) {
    const mat = matMap.get(code);
    const onHand = mat?.onHand ?? 0;
    const allocated = mat?.allocated ?? 0;
    const inspecting = mat?.inspecting ?? 0;
    const safetyStock = mat?.safetyStock ?? 0;
    const availableQty = calculateAvailableQty({
      onHand,
      allocated,
      inspecting,
      safetyStock,
    });
    const netDemand = round2(Math.max(0, item.gross - Math.max(0, availableQty)));
    rows.push({
      materialCode: code,
      materialName: item.name,
      partType: item.partType,
      unit: item.unit,
      grossDemand: item.gross,
      onHand,
      allocated,
      inspecting,
      safetyStock,
      availableQty,
      netDemand,
      inTransit: mat?.inTransit ?? 0,
      inProgress: mat?.inProgress ?? 0,
      etaDate: mat?.etaDate ?? '2026-11-28',
      isShortage: netDemand > 0,
    });
  }

  return rows.sort((a, b) => b.netDemand - a.netDemand);
}

/**
 * 生产计划：工序产能测算（超出 90% 标黄预警，超出 100% 标红瓶颈）
 */
export function calculateProcessCapacity(
  tasks: ProductionTask[],
  workHours: WorkHourRecord[],
  equipments: EquipmentRecord[],
  planDays = 5
): ProcessCapacityRow[] {
  const whMap = new Map<string, WorkHourRecord>();
  for (const w of workHours) {
    whMap.set(w.partNo, w);
  }

  const processes: ('裁剪' | '缝纫' | '装配')[] = ['裁剪', '缝纫', '装配'];
  return processes.map((proc) => {
    let requiredMinutes = 0;
    for (const t of tasks) {
      const wh = whMap.get(t.partNo) ?? workHours[0];
      const perUnitMin =
        proc === '裁剪'
          ? wh?.tCut ?? 8
          : proc === '缝纫'
          ? wh?.tSew ?? 18
          : wh?.tAssemble ?? 12;
      requiredMinutes += perUnitMin * t.qty;
    }
    const requiredHours = round2(requiredMinutes / 60);

    const procEquipments = equipments.filter(
      (e) => e.process === proc && e.status !== '检修'
    );
    // 可用工时 = 设备台数 * 每班 8 小时 * 班次 * 计划天数 * 0.88 OEE 系数
    const availableHours = round2(
      procEquipments.reduce((acc, eq) => acc + eq.shiftCount * 8 * planDays * 0.88, 0)
    );
    const loadRate =
      availableHours > 0 ? round2((requiredHours / availableHours) * 100) : 0;

    const status: ProcessCapacityRow['status'] =
      loadRate > 100 ? '瓶颈' : loadRate > 90 ? '预警' : '正常';

    return {
      process: proc,
      requiredHours,
      availableHours,
      loadRate,
      equipmentCount: procEquipments.length,
      status,
    };
  });
}

/**
 * 生产计划：自动周排产生成与排产理由
 */
export function generateProductionSchedule(
  tasks: ProductionTask[],
  workHours: WorkHourRecord[],
  equipments: EquipmentRecord[]
): ProdPlanLine[] {
  const priorityScore = { 高: 3, 中: 2, 低: 1 };
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.deliveryDate !== b.deliveryDate) {
      return a.deliveryDate.localeCompare(b.deliveryDate);
    }
    return priorityScore[b.priority] - priorityScore[a.priority];
  });

  const whMap = new Map<string, WorkHourRecord>();
  for (const w of workHours) whMap.set(w.partNo, w);

  const lines: ProdPlanLine[] = [];
  const processes: { name: '裁剪' | '缝纫' | '装配'; lineLabel: string }[] = [
    { name: '裁剪', lineLabel: 'A1 自动裁剪线' },
    { name: '缝纫', lineLabel: 'B2 精益缝纫线' },
    { name: '装配', lineLabel: 'C1 总装及检线' },
  ];

  sortedTasks.forEach((task, idx) => {
    const wh = whMap.get(task.partNo) ?? workHours[0];
    processes.forEach((proc, pIdx) => {
      const eqPool = equipments.filter((e) => e.process === proc.name);
      const eq = eqPool[idx % Math.max(1, eqPool.length)];
      const stdHourMin =
        proc.name === '裁剪'
          ? wh?.tCut ?? 8.5
          : proc.name === '缝纫'
          ? wh?.tSew ?? 19.2
          : wh?.tAssemble ?? 12.0;

      const dayOffset = Math.min(4, Math.floor((idx * 2 + pIdx) / 3));
      const dayStr = `11-${24 + dayOffset}`;
      const startHour = 8 + ((idx * 3 + pIdx * 2) % 8);
      const durationHours = Math.max(2, Math.min(8, Math.ceil((task.qty * stdHourMin) / 60 / 4)));
      const endHour = Math.min(20, startHour + durationHours);

      const reason =
        task.priority === '高'
          ? `客户要货期 ${task.deliveryDate} 临近且为高优先级订单，优先锁定 ${eq?.name ?? proc.lineLabel} 连续排产以减少换型损失。`
          : proc.name === '缝纫'
          ? `缝纫为当前高负荷工序，按交期倒排并同色系面料合并批产，预计节省换线准备 35 分钟。`
          : `衔接上游${pIdx === 0 ? '坯料齐套' : '半成品流转'}节拍，平衡班组日负荷在安全阈值内。`;

      lines.push({
        id: `PL-${task.id}-${pIdx}`,
        lineName: proc.lineLabel,
        partNo: task.partNo,
        partName: task.partName,
        process: proc.name,
        qty: task.qty,
        stdHourMin,
        startTime: `${dayStr} ${String(startHour).padStart(2, '0')}:00`,
        endTime: `${dayStr} ${String(endHour).padStart(2, '0')}:00`,
        equipmentCode: eq?.code ?? 'EQ-001',
        equipmentName: eq?.name ?? '数控裁剪机',
        reason,
        note: '',
        status: idx === 0 ? '已确认' : '草稿',
      });
    });
  });

  return lines;
}

/**
 * 部门评审矩阵冲突检测：同一需求条目若同时出现“可行”与“不可行”，标记冲突
 */
export function detectReviewConflicts(reviews: DeptReviewItem[]): Set<string> {
  const byReq = new Map<string, Set<ReviewConclusion | '待回复'>>();
  for (const r of reviews) {
    if (!byReq.has(r.requirementId)) {
      byReq.set(r.requirementId, new Set());
    }
    byReq.get(r.requirementId)!.add(r.conclusion);
  }
  const conflictReqIds = new Set<string>();
  for (const [reqId, conclusions] of byReq.entries()) {
    if (conclusions.has('可行') && conclusions.has('不可行')) {
      conflictReqIds.add(reqId);
    }
  }
  return conflictReqIds;
}

/**
 * 计算单个 RFQ 项目的推进阶段、百分比与当前卡点部门（供总经理进度驾驶舱与项目列表使用）
 */
export function computeRfqProgress(
  project: RfqProject,
  requirements: { projectId: string; status: string }[],
  reviews: DeptReviewItem[],
  bomLines: BomLine[],
  workHour: WorkHourRecord | undefined,
  referenceDate = '2026-11-23'
): {
  projectId: string;
  stageLabel: string;
  stageStep: number;
  percent: number;
  reviewDone: number;
  reviewTotal: number;
  hasConflict: boolean;
  blockers: string[];
  actionDept: string;
  daysToDeadline: number;
  isOverdue: boolean;
} {
  const projReqs = requirements.filter((r) => r.projectId === project.id);
  const projRevs = reviews.filter((r) => r.projectId === project.id);
  const conflicts = detectReviewConflicts(projRevs);
  const hasConflict = conflicts.size > 0;

  const reviewDone = projRevs.filter((r) => r.conclusion !== '待回复').length;
  const reviewTotal = projRevs.length;

  const msPerDay = 86400000;
  const daysToDeadline = Math.round(
    (new Date(project.deadline).getTime() - new Date(referenceDate).getTime()) / msPerDay
  );
  const isOverdue = project.status !== '已报价' && project.status !== '已关闭' && daysToDeadline < 0;

  const projectBom = project.bomHeaderId
    ? bomLines.filter((b) => b.headerId === project.bomHeaderId)
    : [];
  const readiness = checkQuoteReadiness(project, projectBom, workHour, projRevs);
  const blockers = readiness.checks.filter((c) => !c.passed).map((c) => c.label);

  if (project.status === '已报价' || project.status === '已关闭') {
    return {
      projectId: project.id,
      stageLabel: project.status,
      stageStep: 5,
      percent: 100,
      reviewDone,
      reviewTotal,
      hasConflict,
      blockers: [],
      actionDept: '已完成归档',
      daysToDeadline,
      isOverdue: false,
    };
  }

  if (project.status === '草稿' || project.status === '解析中' || !project.lockedVersion) {
    const confirmedReqs = projReqs.filter((r) => r.status === '已确认').length;
    return {
      projectId: project.id,
      stageLabel: project.status === '草稿' ? '立项草稿' : 'SOR解析核对',
      stageStep: 1,
      percent: projReqs.length > 0 ? 20 + Math.round((confirmedReqs / projReqs.length) * 15) : 15,
      reviewDone,
      reviewTotal,
      hasConflict,
      blockers: blockers.length > 0 ? blockers : ['待锁定 SOR 需求版本'],
      actionDept: '技术研发部 / 销售部',
      daysToDeadline,
      isOverdue,
    };
  }

  if (hasConflict || reviewDone < reviewTotal || reviewTotal === 0) {
    const pendingDepts = Array.from(
      new Set(projRevs.filter((r) => r.conclusion === '待回复').map((r) => r.deptName))
    );
    return {
      projectId: project.id,
      stageLabel: hasConflict ? '评审冲突待协调' : '部门并行评审',
      stageStep: 2,
      percent: reviewTotal > 0 ? 40 + Math.round((reviewDone / reviewTotal) * 25) : 40,
      reviewDone,
      reviewTotal,
      hasConflict,
      blockers: hasConflict
        ? ['存在跨部门矛盾结论', ...blockers]
        : blockers,
      actionDept: hasConflict
        ? '销售与生产部会商'
        : pendingDepts.join('、') || '各责任部门',
      daysToDeadline,
      isOverdue,
    };
  }

  if (!readiness.ready) {
    return {
      projectId: project.id,
      stageLabel: 'BOM核算补价',
      stageStep: 3,
      percent: 75,
      reviewDone,
      reviewTotal,
      hasConflict,
      blockers,
      actionDept: blockers.some((b) => b.includes('价')) ? '采购供应链部' : '技术/财务部',
      daysToDeadline,
      isOverdue,
    };
  }

  return {
    projectId: project.id,
    stageLabel: '成本就绪待报价',
    stageStep: 4,
    percent: 90,
    reviewDone,
    reviewTotal,
    hasConflict,
    blockers: [],
    actionDept: '财务核算部 / 销售部',
    daysToDeadline,
    isOverdue,
  };
}

/**
 * 计算周排产工单的工序完成进度与风险等级（供总经理驾驶舱与车间协同追踪）
 */
export function computeWeeklyOrderProgress(
  tasks: ProductionTask[],
  scheduleLines: ProdPlanLine[],
  capacityRows: ProcessCapacityRow[]
): {
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
}[] {
  const sewBottleneck = capacityRows.some(
    (c) => c.process === '缝纫' && c.status === '瓶颈'
  );
  return tasks.map((t, idx) => {
    const taskLines = scheduleLines.filter((l) => l.partNo === t.partNo);
    const hasConfirmed = taskLines.some((l) => l.status === '已确认' || l.status === '执行中' || l.status === '已完成');
    const cutPct = hasConfirmed ? 100 : Math.max(35, 85 - idx * 15);
    const sewPct = hasConfirmed ? 72 : Math.max(20, 58 - idx * 12);
    const asmPct = hasConfirmed ? 45 : Math.max(0, 30 - idx * 10);
    const overallPct = Math.round((cutPct + sewPct + asmPct) / 3);
    const isUrgent = t.priority === '高' && sewBottleneck;

    return {
      orderNo: t.orderNo,
      customer: t.customer,
      partName: t.partName,
      qty: t.qty,
      deliveryDate: t.deliveryDate,
      cutPct,
      sewPct,
      asmPct,
      overallPct,
      riskLevel: isUrgent ? '延期风险' : sewBottleneck ? '关注' : '正常',
      riskNote: isUrgent
        ? '缝纫工序满载瓶颈，需 B2 线优先保障交期'
        : sewBottleneck
        ? '缝纫工段排程紧凑，关注半成品流转'
        : '各工段节拍均衡',
    };
  });
}

/**
 * 评审意见摘要合成（对应开发文档 7.2 评审分派智能体）
 */
export function synthesizeReviewSummary(reviews: DeptReviewItem[]): {
  summaryText: string;
  conditions: string[];
  conflictCount: number;
} {
  const conflicts = detectReviewConflicts(reviews);
  const replied = reviews.filter((r) => r.conclusion !== '待回复');
  const pending = reviews.filter((r) => r.conclusion === '待回复');
  const conditions = reviews
    .filter((r) => r.conclusion === '有条件可行' && r.comment.trim())
    .map((r) => `[${r.deptName}] ${r.comment}`);

  const summaryText = `已收回 ${replied.length}/${reviews.length} 项部门回复${
    pending.length > 0 ? `（尚缺 ${pending.map((p) => p.deptName).join('、')}）` : ''
  }；存在 ${conflicts.size} 项跨部门结论冲突，${conditions.length} 项附带前置条件。`;

  return { summaryText, conditions, conflictCount: conflicts.size };
}

/**
 * 早期成本量级估算（对应开发文档 6.2 /estimate 接口）
 */
export function estimateEarlyCostRange(
  annualVolume: number,
  targetPrice: number,
  customer: string
): {
  lowExclTax: number;
  highExclTax: number;
  recommendedMarginPct: number;
  judgement: string;
} {
  const base = round2(targetPrice / 1.13);
  const scaleFactor = annualVolume >= 30000 ? 0.94 : annualVolume >= 15000 ? 0.98 : 1.04;
  const lowExclTax = round2(base * 0.88 * scaleFactor);
  const highExclTax = round2(base * 1.03 * scaleFactor);
  const recommendedMarginPct = customer.includes('比亚迪') ? 14.5 : 17.5;
  const judgement =
    annualVolume >= 25000
      ? `年纲领 ${annualVolume.toLocaleString()} 台具备规模分摊优势，建议目标毛利控制在 ${recommendedMarginPct}% 区间。`
      : `年纲领适中，模具工装单台摊销偏高，建议单独列示工装开发费。`;

  return { lowExclTax, highExclTax, recommendedMarginPct, judgement };
}

