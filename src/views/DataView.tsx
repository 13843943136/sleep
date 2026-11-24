import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  History,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type {
  BomHeader,
  BomLine,
  EquipmentRecord,
  MaterialRecord,
  MaterialStandardRecord,
  PriceRecord,
  WorkHourRecord,
} from '../types/erp';
import { downloadCsvFile, PaginationBar, StateTag } from '../components/UiPrimitives';

interface DataViewProps {
  materials: MaterialRecord[];
  materialStandards: MaterialStandardRecord[];
  bomHeaders: BomHeader[];
  bomLines: BomLine[];
  prices: PriceRecord[];
  workHours: WorkHourRecord[];
  equipments: EquipmentRecord[];
  onLogAction: (action: '导出' | '修改', objectType: string, objectId: string, detail: string) => void;
}

type DataTabKey = 'material' | 'bom' | 'price' | 'workHour' | 'equipment' | 'knowledge';

export const DataView: React.FC<DataViewProps> = ({
  materials,
  materialStandards,
  bomHeaders,
  bomLines,
  prices,
  workHours,
  equipments,
  onLogAction,
}) => {
  const [activeTab, setActiveTab] = useState<DataTabKey>('bom');
  const [materialSubTab, setMaterialSubTab] = useState<'master' | 'standards'>('master');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedBomId, setSelectedBomId] = useState<string>(bomHeaders[0]?.id ?? 'bom-1');
  const [areaFilter, setAreaFilter] = useState<string>('全部车间');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importDoneReport, setImportDoneReport] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const pageSize = 20;

  const switchTab = (tab: DataTabKey) => {
    setActiveTab(tab);
    setSearch('');
    setPage(1);
  };

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter(
      (m) =>
        !q ||
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.grade.toLowerCase().includes(q)
    );
  }, [materials, search]);

  const filteredStandards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materialStandards.filter(
      (s) =>
        !q ||
        s.materialName.toLowerCase().includes(q) ||
        s.testItem.toLowerCase().includes(q) ||
        s.standardCode.toLowerCase().includes(q)
    );
  }, [materialStandards, search]);

  const activeBomLines = useMemo(
    () => bomLines.filter((l) => l.headerId === selectedBomId),
    [bomLines, selectedBomId]
  );

  const filteredPrices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prices.filter(
      (p) =>
        !q ||
        p.materialCode.toLowerCase().includes(q) ||
        p.materialName.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q)
    );
  }, [prices, search]);

  const filteredWorkHours = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workHours.filter(
      (w) =>
        !q ||
        w.partNo.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
    );
  }, [workHours, search]);

  const filteredEquipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipments.filter((eq) => {
      if (areaFilter !== '全部车间' && eq.area !== areaFilter) return false;
      return (
        !q ||
        eq.code.toLowerCase().includes(q) ||
        eq.name.toLowerCase().includes(q) ||
        eq.model.toLowerCase().includes(q)
      );
    });
  }, [equipments, areaFilter, search]);

  const handleExportCurrent = () => {
    if (activeTab === 'workHour') {
      downloadCsvFile(
        '工时定额_全量导出.csv',
        ['零件号', '产品名称', '存货类别', '裁剪(分)', '缝纫(分)', '装配(分)'],
        filteredWorkHours.map((w) => [w.partNo, w.name, w.category, w.tCut, w.tSew, w.tAssemble])
      );
    } else if (activeTab === 'equipment') {
      downloadCsvFile(
        '设备台账_72台导出.csv',
        ['设备编号', '设备名称', '型号', '车间区域', '工序', '产能(件/小时)', '班次', '状态'],
        filteredEquipments.map((e) => [
          e.code,
          e.name,
          e.model,
          e.area,
          e.process,
          e.capacityPerHour,
          e.shiftCount,
          e.status,
        ])
      );
    } else if (activeTab === 'bom') {
      downloadCsvFile(
        `BOM_${selectedBomId}_导出.csv`,
        ['层级', '零件号', '名称', '类型', '用量', '单位', '净重(kg)', '损耗率%', '实际用量', '供应商'],
        activeBomLines.map((b) => [
          b.level,
          b.partNo,
          b.name,
          b.partType,
          b.qty,
          b.unit,
          b.netWeight,
          b.lossRate,
          b.actualQty,
          b.supplierName,
        ])
      );
    } else if (activeTab === 'price') {
      downloadCsvFile(
        '价格库_导出.csv',
        ['物料编码', '物料名称', '供应商', '不含税单价', '含税单价', '生效日期', '来源'],
        filteredPrices.map((p) => [
          p.materialCode,
          p.materialName,
          p.supplierName,
          p.priceExclTax,
          p.priceInclTax,
          p.effectiveDate,
          p.source,
        ])
      );
    } else if (activeTab === 'material' && materialSubTab === 'standards') {
      downloadCsvFile(
        '材料牌号与执行标准_导出.csv',
        ['材料名称', '检测项目', '执行标准编号', '合格判定指标'],
        filteredStandards.map((s) => [s.materialName, s.testItem, s.standardCode, s.requirement])
      );
    } else {
      downloadCsvFile(
        '物料主数据_导出.csv',
        ['编码', '名称', '规格', '材料牌号', '单位', '自制外购'],
        filteredMaterials.map((m) => [m.code, m.name, m.spec, m.grade, m.unit, m.sourceType])
      );
    }
    onLogAction('导出', 'master_data', activeTab, `导出 ${activeTab} 主数据 CSV`);
  };

  return (
    <div className="space-y-4">
      {/* 6 Sub-tabs + Search & Import/Export Toolbar */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
            {[
              { key: 'material' as const, label: `物料 (${materials.length})` },
              { key: 'bom' as const, label: `BOM (${bomHeaders.length} 套)` },
              { key: 'price' as const, label: `价格库 (${prices.length})` },
              { key: 'workHour' as const, label: `工时定额 (${workHours.length})` },
              { key: 'equipment' as const, label: `设备 (${equipments.length})` },
              { key: 'knowledge' as const, label: '知识条目 (V2)' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchTab(tab.key)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-white text-[#111827] font-medium shadow-xs'
                    : 'text-[#6B7280] hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              变更历史
            </button>
            <button
              type="button"
              onClick={() => {
                setImportDoneReport(null);
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs text-[#111827] font-medium hover:bg-[#F3F4F6] cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              导入 Excel
            </button>
            <button
              type="button"
              onClick={handleExportCurrent}
              disabled={activeTab === 'knowledge'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              导出当前表
            </button>
          </div>
        </div>

        {activeTab !== 'knowledge' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="输入编码、名称、型号或供应商快速检索..."
                aria-label="检索主数据"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] focus:bg-white focus:outline-none focus:border-[#111827] w-72"
              />
            </div>

            {activeTab === 'equipment' && (
              <select
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="筛选车间"
                className="px-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-white"
              >
                <option value="全部车间">全部车间 (72 台)</option>
                <option value="裁剪车间">裁剪车间 (14 台)</option>
                <option value="缝纫车间">缝纫车间 (36 台)</option>
                <option value="装配车间">装配车间 (22 台)</option>
              </select>
            )}

            {activeTab === 'material' && (
              <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                <button
                  type="button"
                  onClick={() => setMaterialSubTab('master')}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    materialSubTab === 'master'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  物料主数据 ({filteredMaterials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMaterialSubTab('standards')}
                  className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                    materialSubTab === 'standards'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  材料牌号与执行标准 ({filteredStandards.length})
                </button>
              </div>
            )}

            {activeTab === 'bom' && (
              <div className="flex flex-wrap items-center gap-2">
                {bomHeaders.map((bh) => (
                  <button
                    key={bh.id}
                    type="button"
                    onClick={() => setSelectedBomId(bh.id)}
                    className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                      selectedBomId === bh.id
                        ? 'border-[#111827] bg-[#111827] text-white font-medium'
                        : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {bh.customer} · {bh.partNo} ({bh.version})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== TAB CONTENT ==================== */}
      {activeTab === 'material' && materialSubTab === 'master' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A] text-xs text-[#92400E]">
            数据说明：正式主数据以金蝶 ERP 为准；第一版先基于已导入的 4 套 BOM 构建临时物料主数据（标记“临时主数据”的条目待 ERP 对接后同步覆盖）。
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">物料编码</th>
                <th className="py-3 px-3">物料名称</th>
                <th className="py-3 px-3">规格参数</th>
                <th className="py-3 px-3">材料牌号 / 执行标准</th>
                <th className="py-3 px-3">单位</th>
                <th className="py-3 px-3">属性</th>
                <th className="py-3 px-4">主数据来源</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredMaterials.map((m) => (
                <tr key={m.id} className="hover:bg-[#FAFAFB]">
                  <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#111827]">
                    {m.code}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#111827]">{m.name}</td>
                  <td className="py-2.5 px-3 text-[#4B5563]">{m.spec}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[#374151]">{m.grade}</td>
                  <td className="py-2.5 px-3">{m.unit}</td>
                  <td className="py-2.5 px-3">
                    <StateTag label={m.sourceType} tone="neutral" />
                  </td>
                  <td className="py-2.5 px-4">
                    <StateTag
                      label={m.tempMaster ? '临时主数据' : 'BOM 校验归档'}
                      tone={m.tempMaster ? 'warning' : 'success'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'material' && materialSubTab === 'standards' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-[#FAFAFB] border-b border-[#E5E7EB] text-xs text-[#4B5563]">
            数据源：材料牌号与执行标准.xls（供 SOR 合规比对、质量评审与面料/金属采购标准校验）
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">材料名称</th>
                <th className="py-3 px-3">检测与考核项目</th>
                <th className="py-3 px-3">执行标准编号</th>
                <th className="py-3 px-4">合格判定指标</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredStandards.map((s) => (
                <tr key={s.id} className="hover:bg-[#FAFAFB]">
                  <td className="py-3 px-4 font-medium text-[#111827]">{s.materialName}</td>
                  <td className="py-3 px-3 text-[#374151]">{s.testItem}</td>
                  <td className="py-3 px-3 font-mono-tabular text-[#0369A1] font-medium">
                    {s.standardCode}
                  </td>
                  <td className="py-3 px-4 text-[#111827]">{s.requirement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bom' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-[#111827]">
              {bomHeaders.find((b) => b.id === selectedBomId)?.name}
            </div>
            <div className="text-[#6B7280] font-mono-tabular">
              源文件：{bomHeaders.find((b) => b.id === selectedBomId)?.sourceFile} · 注：技术部另 2 套历史 xls 文件已损坏未导入
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-white">
                  <th className="py-2.5 px-4">层级</th>
                  <th className="py-2.5 px-3">零件号</th>
                  <th className="py-2.5 px-3">子件名称</th>
                  <th className="py-2.5 px-3">零件分类</th>
                  <th className="py-2.5 px-3 text-right">单台净用量</th>
                  <th className="py-2.5 px-3 text-right">净重 (kg)</th>
                  <th className="py-2.5 px-3 text-right">损耗率</th>
                  <th className="py-2.5 px-3 text-right">实际用量</th>
                  <th className="py-2.5 px-4">供应商</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {activeBomLines.map((line) => (
                  <tr key={line.id} className={line.level === 0 ? 'bg-[#F9FAFB] font-medium' : 'hover:bg-[#FAFAFB]'}>
                    <td className="py-2.5 px-4 font-mono-tabular">
                      <span
                        className="inline-block"
                        style={{ paddingLeft: `${line.level * 14}px` }}
                      >
                        L{line.level}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#111827]">
                      {line.partNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#111827]">{line.name}</td>
                    <td className="py-2.5 px-3">
                      <StateTag label={line.partType} tone="neutral" />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {line.qty} {line.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4B5563]">
                      {line.netWeight.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4B5563]">
                      {line.lossRate.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#111827]">
                      {line.actualQty}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151]">{line.supplierName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'price' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">物料编码</th>
                <th className="py-3 px-3">物料名称</th>
                <th className="py-3 px-3">供应商</th>
                <th className="py-3 px-3 text-right">不含税单价</th>
                <th className="py-3 px-3 text-right">含税单价 (13%)</th>
                <th className="py-3 px-3">生效日期</th>
                <th className="py-3 px-3">来源</th>
                <th className="py-3 px-4">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredPrices.map((p) => (
                <tr key={p.id} className="hover:bg-[#FAFAFB]">
                  <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#111827]">
                    {p.materialCode}
                  </td>
                  <td className="py-2.5 px-3 text-[#111827]">{p.materialName}</td>
                  <td className="py-2.5 px-3 text-[#374151]">{p.supplierName}</td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular font-medium">
                    ¥{p.priceExclTax.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4B5563]">
                    ¥{p.priceInclTax.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[#6B7280]">
                    {p.effectiveDate}
                  </td>
                  <td className="py-2.5 px-3 text-[#4B5563]">{p.source}</td>
                  <td className="py-2.5 px-4">
                    <StateTag
                      label={p.confirmed ? '已确认' : '待确认'}
                      tone={p.confirmed ? 'success' : 'warning'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'workHour' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">产品零件号</th>
                <th className="py-3 px-3">产品名称</th>
                <th className="py-3 px-3">存货类别</th>
                <th className="py-3 px-3 text-right">裁剪工时 (分)</th>
                <th className="py-3 px-3 text-right">缝纫工时 (分)</th>
                <th className="py-3 px-3 text-right">装配工时 (分)</th>
                <th className="py-3 px-4 text-right">单台合计 (分)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredWorkHours
                .slice((page - 1) * pageSize, page * pageSize)
                .map((w) => (
                  <tr key={w.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#111827]">
                      {w.partNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#111827]">{w.name}</td>
                    <td className="py-2.5 px-3 text-[#6B7280]">{w.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{w.tCut.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{w.tSew.toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {w.tAssemble.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-[#111827]">
                      {(w.tCut + w.tSew + w.tAssemble).toFixed(1)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <PaginationBar
            total={filteredWorkHours.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">设备编码</th>
                <th className="py-3 px-3">设备名称</th>
                <th className="py-3 px-3">规格型号</th>
                <th className="py-3 px-3">所在区域</th>
                <th className="py-3 px-3">对应工序</th>
                <th className="py-3 px-3 text-right">标准产能 (件/h)</th>
                <th className="py-3 px-3 text-right">班次</th>
                <th className="py-3 px-4">运行状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredEquipments
                .slice((page - 1) * pageSize, page * pageSize)
                .map((eq) => (
                  <tr key={eq.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-2.5 px-4 font-mono-tabular font-medium text-[#111827]">
                      {eq.code}
                    </td>
                    <td className="py-2.5 px-3 text-[#111827]">{eq.name}</td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#4B5563]">{eq.model}</td>
                    <td className="py-2.5 px-3 text-[#374151]">{eq.area}</td>
                    <td className="py-2.5 px-3">{eq.process}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {eq.capacityPerHour}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {eq.shiftCount} 班
                    </td>
                    <td className="py-2.5 px-4">
                      <StateTag
                        label={eq.status}
                        tone={
                          eq.status === '运行中'
                            ? 'success'
                            : eq.status === '检修'
                            ? 'danger'
                            : 'warning'
                        }
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <PaginationBar
            total={filteredEquipments.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-[#F3F4F6] flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#4B5563]" />
          </div>
          <h3 className="text-sm font-semibold text-[#111827]">
            知识库条目（第一版暂空 · 第二版接入标准与历史评审意见）
          </h3>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto leading-relaxed">
            按第一版开发范围约定，当前模块已预留分类、正文、适用车型范围及版本数据结构，待第二版录入《汽车座椅设计标准规范》与历史客户评审沉淀知识。
          </p>
        </div>
      )}

      {/* Import Wizard Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="数据导入通道"
            className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">
                原始资料导入与字段映射校验
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-3 space-y-1.5">
                <div className="font-semibold text-[#111827]">支持的标准源文件格式（开发文档 8.2 六类基础文件）</div>
                <div className="text-[#4B5563]">
                  • 产品-工序-工时.xlsx → work_hour（845 条裁剪/缝纫/装配分钟）
                </div>
                <div className="text-[#4B5563]">
                  • 设备清单.xlsx → equipment（72 台设备区域、型号与班次）
                </div>
                <div className="text-[#4B5563]">
                  • 技术部 BOM.xls → bom_header / bom_line（保留原文件于 data/files）
                </div>
                <div className="text-[#4B5563]">
                  • 材料牌号与执行标准.xls → material_standard（阻燃/VOC/耐久标准库）
                </div>
                <div className="text-[#4B5563]">
                  • 客户报价模板.xlsx / 销售订单.xlsx → 报价模板与待排产订单导入
                </div>
              </div>

              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#D1D5DB] py-4 px-4 cursor-pointer hover:border-[#111827]">
                <Upload className="w-4 h-4 text-[#6B7280]" />
                <span>选择本地 .xlsx / .xls / .csv 文件以执行校验与导入预览</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportDoneReport(
                        `已校验文件「${file.name}」：共扫描 48 行，成功校验入库 46 行，拒收 2 行（原因：第 19 行零件号为空；第 34 行工时为 0 需人工复核）。原文件已归档至 data/files。`
                      );
                    }
                  }}
                />
              </label>

              {importDoneReport && (
                <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[#047857]">
                  {importDoneReport}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#111827] text-white font-medium cursor-pointer"
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="主数据变更历史"
            className="w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">数据变更追溯日志</h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 text-xs">
              <div className="p-3 rounded-lg bg-[#FAFAFB] border border-[#E5E7EB]">
                <div className="font-mono-tabular text-[#6B7280]">2026-11-21 15:20 · 陈志强</div>
                <div className="mt-1 text-[#111827]">
                  导入 BOM_BYD海狮07前排_V1.8.xls（8 行有效，1 行单价待确认）
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAFAFB] border border-[#E5E7EB]">
                <div className="font-mono-tabular text-[#6B7280]">2026-11-18 11:04 · 王建国</div>
                <div className="mt-1 text-[#111827]">
                  全量校核《产品-工序-工时.xlsx》845 条记录，单位统一换算为分钟
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
