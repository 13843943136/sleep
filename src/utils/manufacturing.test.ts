import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateActualQty,
  calculateAvailableQty,
  calculateProcessCapacity,
  calculateQuoteTotals,
  checkQuoteReadiness,
  computeRfqProgress,
  computeWeeklyOrderProgress,
  detectReviewConflicts,
  estimateEarlyCostRange,
  explodeBomRequirements,
  synthesizeReviewSummary,
} from './manufacturing';
import type {
  BomLine,
  DeptReviewItem,
  EquipmentRecord,
  MaterialRecord,
  ProdPlanLine,
  ProductionTask,
  RfqProject,
  WorkHourRecord,
} from '../types/erp';

test('calculateActualQty applies net / (1 - lossRate)', () => {
  assert.equal(calculateActualQty(100, 0), 100);
  assert.equal(calculateActualQty(95, 5), 100);
});

test('calculateAvailableQty subtracts allocated, inspecting, and safety stock', () => {
  assert.equal(
    calculateAvailableQty({
      onHand: 500,
      allocated: 120,
      inspecting: 30,
      safetyStock: 100,
    }),
    250
  );
});

test('checkQuoteReadiness blocks when a BOM line has null price or review is pending', () => {
  const project: RfqProject = {
    id: 'p1',
    code: 'RFQ-001',
    customer: '一汽解放',
    vehicle: 'J7',
    partNo: 'P-100',
    partName: '主驾气囊座椅总成',
    annualVolume: 20000,
    targetPrice: 1450,
    deadline: '2026-12-05',
    owner: '张工',
    status: '评审完成',
    bomHeaderId: 'b1',
    lockedVersion: 'V1.2',
    sorPages: [],
    attachments: [],
    updatedAt: '2026-11-23',
  };
  const bom: BomLine[] = [
    {
      id: 'l0',
      headerId: 'b1',
      level: 0,
      partNo: 'P-100',
      name: '总成',
      partType: '总成',
      qty: 1,
      unit: '套',
      netWeight: 18,
      lossRate: 0,
      actualQty: 1,
      supplierName: '自制',
      unitPrice: null,
      priceSource: '待确认',
      taxIncluded: false,
    },
    {
      id: 'l1',
      headerId: 'b1',
      level: 1,
      partNo: 'M-1',
      name: '骨架',
      partType: '金属件',
      qty: 1,
      unit: '件',
      netWeight: 8,
      lossRate: 2,
      actualQty: 1.0204,
      supplierName: '华凌金属',
      unitPrice: null,
      priceSource: '待确认',
      taxIncluded: false,
    },
  ];
  const wh: WorkHourRecord = {
    id: 'w1',
    partNo: 'P-100',
    name: '主驾气囊座椅总成',
    category: '总成',
    tCut: 10,
    tSew: 20,
    tAssemble: 15,
    updatedAt: '2026-11-23',
  };
  const reviews: DeptReviewItem[] = [
    {
      id: 'r1',
      projectId: 'p1',
      requirementId: 'req1',
      requirementSeq: 1,
      requirementSummary: '阻燃等级要求',
      deptName: '技术部',
      reviewerName: '李工',
      conclusion: '可行',
      comment: '满足标准',
      updatedAt: '2026-11-23',
    },
  ];

  const blocked = checkQuoteReadiness(project, bom, wh, reviews);
  assert.equal(blocked.ready, false);
  assert.equal(blocked.checks.find((c) => c.key === 'price')?.passed, false);

  bom[1].unitPrice = 320;
  bom[1].priceSource = '价格库';
  const ready = checkQuoteReadiness(project, bom, wh, reviews);
  assert.equal(ready.ready, true);
});

test('calculateQuoteTotals separates excl-tax and incl-tax accurately', () => {
  const bom: BomLine[] = [
    {
      id: 'l1',
      headerId: 'b1',
      level: 1,
      partNo: 'M-1',
      name: '面料',
      partType: '面料',
      qty: 2,
      unit: '米',
      netWeight: 1.2,
      lossRate: 0,
      actualQty: 2,
      supplierName: '宏达面料',
      unitPrice: 50,
      priceSource: '价格库',
      taxIncluded: false,
    },
  ];
  const wh: WorkHourRecord = {
    id: 'w1',
    partNo: 'P-100',
    name: '座椅',
    category: '总成',
    tCut: 15,
    tSew: 30,
    tAssemble: 15,
    updatedAt: '2026-11-23',
  };
  const result = calculateQuoteTotals(bom, wh, 'FAW_TOTAL', 10000, {
    hourlyRateYuan: 60,
    toolingTotalYuan: 100000,
    testFeePerUnit: 5,
    packagingFeePerUnit: 10,
    logisticsFeePerUnit: 15,
    mgmtRatePct: 10,
    taxRatePct: 13,
  });

  assert.equal(result.materialCost, 100);
  assert.equal(result.laborCost, 60);
  assert.equal(result.toolingCost, 10);
  assert.equal(result.otherCost, 46);
  assert.equal(result.subtotalExclTax, 216);
  assert.equal(result.totalInclTax, 244.08);
});

test('calculateProcessCapacity flags >90% warning and >100% bottleneck', () => {
  const tasks: ProductionTask[] = [
    {
      id: 't1',
      orderNo: 'SO-1',
      partNo: 'P-1',
      partName: '座椅',
      customer: '吉利',
      qty: 600,
      deliveryDate: '2026-11-28',
      priority: '高',
    },
  ];
  const workHours: WorkHourRecord[] = [
    {
      id: 'w1',
      partNo: 'P-1',
      name: '座椅',
      category: '总成',
      tCut: 5,
      tSew: 15,
      tAssemble: 9.8,
      updatedAt: '2026-11-23',
    },
  ];
  const equipments: EquipmentRecord[] = [
    {
      id: 'e1',
      code: 'C1',
      name: '裁剪机',
      model: 'X1',
      area: '裁剪车间',
      process: '裁剪',
      capacityPerHour: 20,
      shiftCount: 3,
      status: '运行中',
    },
    {
      id: 'e2',
      code: 'S1',
      name: '缝纫机',
      model: 'S1',
      area: '缝纫车间',
      process: '缝纫',
      capacityPerHour: 10,
      shiftCount: 3,
      status: '运行中',
    },
    {
      id: 'e3',
      code: 'A1',
      name: '装配线',
      model: 'A1',
      area: '装配车间',
      process: '装配',
      capacityPerHour: 15,
      shiftCount: 3,
      status: '运行中',
    },
  ];

  const cap = calculateProcessCapacity(tasks, workHours, equipments, 5);
  assert.equal(cap.find((c) => c.process === '裁剪')?.status, '正常');
  assert.equal(cap.find((c) => c.process === '缝纫')?.status, '瓶颈');
  assert.equal(cap.find((c) => c.process === '装配')?.status, '预警');
});

test('explodeBomRequirements computes shortages and detectReviewConflicts flags contradictions', () => {
  const tasks: ProductionTask[] = [
    {
      id: 't1',
      orderNo: 'SO-1',
      partNo: 'P-1',
      partName: '座椅',
      customer: '吉利',
      qty: 100,
      deliveryDate: '2026-11-29',
      priority: '中',
    },
  ];
  const bom: BomLine[] = [
    {
      id: 'l1',
      headerId: 'b1',
      level: 1,
      partNo: 'MAT-01',
      name: '阻燃面料',
      partType: '面料',
      qty: 2,
      unit: '米',
      netWeight: 0.8,
      lossRate: 0,
      actualQty: 2,
      supplierName: '宏达',
      unitPrice: 40,
      priceSource: '价格库',
      taxIncluded: false,
    },
  ];
  const mats: MaterialRecord[] = [
    {
      id: 'm1',
      code: 'MAT-01',
      name: '阻燃面料',
      spec: '1.4m宽',
      grade: 'FR-8410',
      unit: '米',
      sourceType: '外购',
      tempMaster: false,
      onHand: 180,
      allocated: 40,
      inspecting: 10,
      safetyStock: 30,
      inTransit: 100,
      inProgress: 0,
      etaDate: '2026-11-27',
    },
  ];
  const explosion = explodeBomRequirements(tasks, bom, mats);
  assert.equal(explosion[0].availableQty, 100);
  assert.equal(explosion[0].netDemand, 100);
  assert.equal(explosion[0].isShortage, true);

  const conflicts = detectReviewConflicts([
    {
      id: 'r1',
      projectId: 'p1',
      requirementId: 'req-1',
      requirementSeq: 1,
      requirementSummary: '交期',
      deptName: '采购部',
      reviewerName: '王',
      conclusion: '可行',
      comment: '',
      updatedAt: '',
    },
    {
      id: 'r2',
      projectId: 'p1',
      requirementId: 'req-1',
      requirementSeq: 1,
      requirementSummary: '交期',
      deptName: '生产部',
      reviewerName: '陈',
      conclusion: '不可行',
      comment: '',
      updatedAt: '',
    },
  ]);
  assert.equal(conflicts.has('req-1'), true);
});

test('computeRfqProgress detects overdue & conflict stage accurately', () => {
  const proj: RfqProject = {
    id: 'p2',
    code: 'RFQ-002',
    customer: '比亚迪',
    vehicle: '海狮07',
    partNo: 'P-200',
    partName: '电动座椅',
    annualVolume: 40000,
    targetPrice: 1120,
    deadline: '2026-11-20',
    owner: '林致远',
    status: '待评审',
    bomHeaderId: 'b1',
    lockedVersion: 'V1.0',
    sorPages: [],
    attachments: [],
    updatedAt: '2026-11-23',
  };
  const revs: DeptReviewItem[] = [
    {
      id: 'r1',
      projectId: 'p2',
      requirementId: 'req-1',
      requirementSeq: 1,
      requirementSummary: 'OTS 交期',
      deptName: '生产制造部',
      reviewerName: '王建国',
      conclusion: '不可行',
      comment: '模具周期不足',
      updatedAt: '2026-11-23',
    },
    {
      id: 'r2',
      projectId: 'p2',
      requirementId: 'req-1',
      requirementSeq: 1,
      requirementSummary: 'OTS 交期',
      deptName: '销售与市场部',
      reviewerName: '林致远',
      conclusion: '可行',
      comment: '手工样件先交付',
      updatedAt: '2026-11-23',
    },
  ];

  const progress = computeRfqProgress(proj, [], revs, [], undefined, '2026-11-23');
  assert.equal(progress.hasConflict, true);
  assert.equal(progress.isOverdue, true);
  assert.equal(progress.stageLabel, '评审冲突待协调');

  const summary = synthesizeReviewSummary(revs);
  assert.equal(summary.conflictCount, 1);

  const est = estimateEarlyCostRange(40000, 1130, '比亚迪');
  assert.ok(est.lowExclTax < est.highExclTax);
  assert.equal(est.recommendedMarginPct, 14.5);

  const orderProgress = computeWeeklyOrderProgress(
    [
      {
        id: 't1',
        orderNo: 'SO-1',
        partNo: 'P-200',
        partName: '电动座椅',
        customer: '比亚迪',
        qty: 500,
        deliveryDate: '2026-11-28',
        priority: '高',
      },
    ],
    [] as ProdPlanLine[],
    [
      {
        process: '缝纫',
        requiredHours: 200,
        availableHours: 180,
        loadRate: 111.1,
        equipmentCount: 10,
        status: '瓶颈',
      },
    ]
  );
  assert.equal(orderProgress[0].riskLevel, '延期风险');
});

