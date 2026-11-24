import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSearch,
  FileText,
  GitMerge,
  Lock,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import type {
  BomHeader,
  BomLine,
  DeptReviewItem,
  MissingRequirementItem,
  QuoteTemplateCode,
  RequirementCategory,
  ReviewConclusion,
  RfqProject,
  RfqRequirement,
  RfqStatus,
  WorkHourRecord,
} from '../types/erp';
import {
  calculateQuoteTotals,
  checkQuoteReadiness,
  computeRfqProgress,
  detectReviewConflicts,
  estimateEarlyCostRange,
  synthesizeReviewSummary,
} from '../utils/manufacturing';
import { downloadCsvFile, PaginationBar, StateTag } from '../components/UiPrimitives';

interface RfqViewProps {
  projects: RfqProject[];
  selectedProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  requirements: RfqRequirement[];
  missingItemsMap: Record<string, MissingRequirementItem[]>;
  reviews: DeptReviewItem[];
  bomHeaders: BomHeader[];
  bomLines: BomLine[];
  workHours: WorkHourRecord[];
  currentUserName: string;
  currentDeptName: string;
  canViewCostMargin: boolean;
  onCreateProject: (project: RfqProject, autoReqs: RfqRequirement[]) => void;
  onUpdateRequirement: (req: RfqRequirement) => void;
  onAddRequirement: (req: RfqRequirement) => void;
  onMergeRequirements: (projectId: string, ids: string[]) => void;
  onAdoptMissingItem: (projectId: string, missingId: string) => void;
  onLockRequirements: (projectId: string) => void;
  onUpdateDeptReview: (review: DeptReviewItem) => void;
  onUpdateBomLinePrice: (lineId: string, newPrice: number) => void;
  onSubmitQuoteForReview: (
    project: RfqProject,
    templateCode: QuoteTemplateCode,
    exclTax: number,
    inclTax: number
  ) => void;
  onLogAction: (action: '导出' | '修改' | '模型调用', objectType: string, objectId: string, detail: string) => void;
}

const STATUS_TONE: Record<RfqStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  草稿: 'neutral',
  解析中: 'info',
  待评审: 'warning',
  评审完成: 'success',
  已报价: 'success',
  已关闭: 'neutral',
};

const CATEGORIES: RequirementCategory[] = ['商务', '技术', '质量', '物流包装', '法规认证'];

export const RfqView: React.FC<RfqViewProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  requirements,
  missingItemsMap,
  reviews,
  bomHeaders,
  bomLines,
  workHours,
  currentUserName,
  currentDeptName,
  canViewCostMargin,
  onCreateProject,
  onUpdateRequirement,
  onAddRequirement,
  onMergeRequirements,
  onAdoptMissingItem,
  onLockRequirements,
  onUpdateDeptReview,
  onUpdateBomLinePrice,
  onSubmitQuoteForReview,
  onLogAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [customerFilter, setCustomerFilter] = useState<string>('全部');
  const [page, setPage] = useState(1);

  // Detail sub-tabs
  const [detailTab, setDetailTab] = useState<'parse' | 'review' | 'quote'>('parse');
  const [activeSorPage, setActiveSorPage] = useState<number>(1);
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(null);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newReqContent, setNewReqContent] = useState('');
  const [newReqCat, setNewReqCat] = useState<RequirementCategory>('技术');
  const [showAddReq, setShowAddReq] = useState(false);

  // Review sub-view
  const [reviewMode, setReviewMode] = useState<'list' | 'matrix'>('matrix');
  const [onlyMyDeptReviews, setOnlyMyDeptReviews] = useState(false);

  // Quote sub-view
  const [quoteTemplate, setQuoteTemplate] = useState<QuoteTemplateCode>('FAW_TOTAL');
  const [editingPriceLineId, setEditingPriceLineId] = useState<string | null>(null);
  const [tempPriceInput, setTempPriceInput] = useState('');
  const [quotePreviewOpen, setQuotePreviewOpen] = useState(false);
  const [noticeText, setNoticeText] = useState<string | null>(null);

  // New RFQ Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState({
    customer: '一汽解放',
    vehicle: '',
    partNo: '',
    partName: '',
    annualVolume: '20000',
    targetPrice: '1250',
    deadline: '2026-12-15',
    owner: currentUserName,
  });
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([
    '客户技术规范书_SOR.pdf',
    '产品三维边界图.png',
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const customers = useMemo(
    () => ['全部', ...Array.from(new Set(projects.map((p) => p.customer)))],
    [projects]
  );

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== '全部' && p.status !== statusFilter) return false;
      if (customerFilter !== '全部' && p.customer !== customerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.code.toLowerCase().includes(q) ||
          p.partName.toLowerCase().includes(q) ||
          p.vehicle.toLowerCase().includes(q) ||
          p.customer.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, statusFilter, customerFilter, searchQuery]);

  const pageSize = 10;
  const pagedProjects = filteredProjects.slice((page - 1) * pageSize, page * pageSize);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const projectReqs = useMemo(
    () =>
      requirements
        .filter((r) => r.projectId === activeProject?.id)
        .sort((a, b) => a.seq - b.seq),
    [requirements, activeProject]
  );

  const projectMissing = activeProject ? missingItemsMap[activeProject.id] ?? [] : [];
  const projectReviews = useMemo(
    () => reviews.filter((r) => r.projectId === activeProject?.id),
    [reviews, activeProject]
  );

  const conflictReqIds = useMemo(
    () => detectReviewConflicts(projectReviews),
    [projectReviews]
  );

  const activeBomLines = useMemo(() => {
    if (!activeProject?.bomHeaderId) return [];
    return bomLines.filter((b) => b.headerId === activeProject.bomHeaderId);
  }, [activeProject, bomLines]);

  const activeWorkHour = useMemo(() => {
    if (!activeProject) return undefined;
    return workHours.find((w) => w.partNo === activeProject.partNo) ?? workHours[0];
  }, [activeProject, workHours]);

  const readiness = useMemo(() => {
    if (!activeProject) return null;
    return checkQuoteReadiness(activeProject, activeBomLines, activeWorkHour, projectReviews);
  }, [activeProject, activeBomLines, activeWorkHour, projectReviews]);

  const quoteCalc = useMemo(() => {
    if (!activeProject) return null;
    return calculateQuoteTotals(
      activeBomLines,
      activeWorkHour,
      quoteTemplate,
      activeProject.annualVolume
    );
  }, [activeProject, activeBomLines, activeWorkHour, quoteTemplate]);

  const showToast = (msg: string) => {
    setNoticeText(msg);
    setTimeout(() => setNoticeText(null), 3500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.vehicle.trim() || !newForm.partNo.trim() || !newForm.partName.trim()) {
      setFormError('请完整填写车型、零件号与零件名称。');
      return;
    }
    const id = `rfq-${Date.now()}`;
    const code = `RFQ-2026-${String(projects.length + 48).padStart(3, '0')}`;
    const newProj: RfqProject = {
      id,
      code,
      customer: newForm.customer,
      vehicle: newForm.vehicle.trim(),
      partNo: newForm.partNo.trim().toUpperCase(),
      partName: newForm.partName.trim(),
      annualVolume: Number(newForm.annualVolume) || 10000,
      targetPrice: Number(newForm.targetPrice) || 1000,
      deadline: newForm.deadline,
      owner: newForm.owner,
      status: '待评审',
      bomHeaderId: 'bom-1',
      lockedVersion: null,
      updatedAt: '2026-11-23 19:30',
      attachments: uploadedFiles.map((f, i) => ({
        id: `att-${id}-${i}`,
        name: f,
        type: f.endsWith('.png') ? 'PNG' : f.endsWith('.xlsx') ? 'XLSX' : 'PDF',
        size: '2.4 MB',
        uploadedAt: '2026-11-23 19:30',
        uploader: currentUserName,
      })),
      sorPages: [
        {
          page: 1,
          title: '第 1 页 · 客户技术及交付总纲',
          paragraphs: [
            {
              id: `${id}-p1`,
              text: `1.1 本项目适用于 ${newForm.customer} ${newForm.vehicle} ${newForm.partName}（${newForm.partNo}），年需求 ${Number(newForm.annualVolume).toLocaleString()} 台。`,
            },
            {
              id: `${id}-p2`,
              text: '1.2 非金属内饰件须满足 GB 8410 阻燃标准及主机厂 VOC 散发限值要求，循环包装入库结算。',
            },
          ],
        },
      ],
    };

    const autoReqs: RfqRequirement[] = [
      {
        id: `req-${id}-1`,
        projectId: id,
        seq: 1,
        category: '商务',
        content: `年需求纲领 ${Number(newForm.annualVolume).toLocaleString()} 台，按期交付 PPAP 样件`,
        sourcePage: 1,
        sourceText: `年需求 ${Number(newForm.annualVolume).toLocaleString()} 台`,
        sourceHighlightId: `${id}-p1`,
        deptName: '生产制造部',
        mandatory: true,
        confidence: 0.94,
        status: '待确认',
      },
      {
        id: `req-${id}-2`,
        projectId: id,
        seq: 2,
        category: '法规认证',
        content: '内饰材料需通过 GB 8410 燃烧特性测试及主机厂 VOC 限值认证',
        sourcePage: 1,
        sourceText: '满足 GB 8410 阻燃标准及主机厂 VOC 散发限值要求',
        sourceHighlightId: `${id}-p2`,
        deptName: '质量保证部',
        mandatory: true,
        confidence: 0.66,
        status: '待确认',
      },
    ];

    onCreateProject(newProj, autoReqs);
    setShowNewModal(false);
    setFormError(null);
    setNewForm({
      customer: '一汽解放',
      vehicle: '',
      partNo: '',
      partName: '',
      annualVolume: '20000',
      targetPrice: '1250',
      deadline: '2026-12-15',
      owner: currentUserName,
    });
    onSelectProject(id);
    setDetailTab('parse');
    setActiveSorPage(1);
    showToast(`已创建询价项目 ${code}，并完成 SOR 首轮智能抽取`);
  };

  // ==================== PROJECT LIST VIEW ====================
  if (!activeProject) {
    return (
      <div className="space-y-4">
        {noticeText && (
          <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#047857] flex items-center justify-between">
            <span>{noticeText}</span>
            <button type="button" onClick={() => setNoticeText(null)} className="cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter & Action Toolbar */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索项目号、车型、零件名称..."
                aria-label="搜索询价项目"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] focus:bg-white focus:outline-none focus:border-[#111827] w-60"
              />
            </div>

            <select
              value={customerFilter}
              onChange={(e) => {
                setCustomerFilter(e.target.value);
                setPage(1);
              }}
              aria-label="按客户筛选"
              className="px-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-white text-[#374151] focus:outline-none focus:border-[#111827]"
            >
              {customers.map((c) => (
                <option key={c} value={c}>
                  客户：{c}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
              {['全部', '草稿', '解析中', '待评审', '评审完成', '已报价', '已关闭'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新建询价项目
          </button>
        </div>

        {/* RFQ Table */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280] font-medium">
                  <th className="py-3 px-4 whitespace-nowrap">项目编号</th>
                  <th className="py-3 px-4 whitespace-nowrap">客户</th>
                  <th className="py-3 px-4 whitespace-nowrap">车型平台</th>
                  <th className="py-3 px-4 whitespace-nowrap">零件号与名称</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">年需求量</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">目标价（含税）</th>
                  <th className="py-3 px-4 whitespace-nowrap">推进进度</th>
                  <th className="py-3 px-4 whitespace-nowrap">报价截止</th>
                  <th className="py-3 px-4 whitespace-nowrap">负责人</th>
                  <th className="py-3 px-4 whitespace-nowrap">状态</th>
                  <th className="py-3 px-4 whitespace-nowrap text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {pagedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-[#6B7280]">
                      暂无匹配的询价项目，可调整筛选条件或新建项目。
                    </td>
                  </tr>
                ) : (
                  pagedProjects.map((p) => {
                    const wh = workHours.find((w) => w.partNo === p.partNo) ?? workHours[0];
                    const prog = computeRfqProgress(p, requirements, reviews, bomLines, wh);
                    return (
                    <tr key={p.id} className="hover:bg-[#FAFAFB] transition-colors">
                      <td className="py-3 px-4 font-mono-tabular font-medium text-[#111827] whitespace-nowrap">
                        {p.code}
                      </td>
                      <td className="py-3 px-4 text-[#111827] whitespace-nowrap">{p.customer}</td>
                      <td className="py-3 px-4 text-[#4B5563] whitespace-nowrap">{p.vehicle}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#111827]">{p.partName}</div>
                        <div className="text-[11px] font-mono-tabular text-[#6B7280]">{p.partNo}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#374151]">
                        {p.annualVolume.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-[#111827]">
                        {canViewCostMargin ? `¥${p.targetPrice.toFixed(2)}` : '权限受限'}
                      </td>
                      <td className="py-3 px-4 min-w-[155px]">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-[#374151]">{prog.stageLabel}</span>
                          <span className="font-mono-tabular font-semibold text-[#111827]">
                            {prog.percent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              prog.hasConflict || prog.isOverdue
                                ? 'bg-[#DC2626]'
                                : prog.percent === 100
                                ? 'bg-[#10A37F]'
                                : 'bg-[#111827]'
                            }`}
                            style={{ width: `${prog.percent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-[#4B5563] whitespace-nowrap">
                        {p.deadline}
                      </td>
                      <td className="py-3 px-4 text-[#374151] whitespace-nowrap">{p.owner}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StateTag label={p.status} tone={STATUS_TONE[p.status]} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectProject(p.id);
                            setDetailTab('parse');
                            setActiveSorPage(p.sorPages[0]?.page ?? 1);
                            if (p.customer === '比亚迪') setQuoteTemplate('BYD_DETAIL');
                            else setQuoteTemplate('FAW_TOTAL');
                          }}
                          className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#111827] font-medium hover:bg-[#F3F4F6] cursor-pointer"
                        >
                          进入作业
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            total={filteredProjects.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>

        {/* New Project Modal */}
        {showNewModal && (
          <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="新建询价项目"
              className="w-full max-w-xl rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">新建询价项目与上传资料</h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    支持多选上传 SOR 技术规范书与图纸（pdf / docx / xlsx / png），提交后自动进入解析队列
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  aria-label="关闭弹窗"
                  className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
                {formError && (
                  <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[#B91C1C]">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">客户名称</label>
                    <select
                      value={newForm.customer}
                      onChange={(e) => setNewForm({ ...newForm, customer: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                    >
                      <option value="一汽解放">一汽解放</option>
                      <option value="比亚迪">比亚迪</option>
                      <option value="吉利汽车">吉利汽车</option>
                      <option value="华凌星马">华凌星马</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">车型平台 *</label>
                    <input
                      type="text"
                      value={newForm.vehicle}
                      onChange={(e) => setNewForm({ ...newForm, vehicle: e.target.value })}
                      placeholder="例如：J7 2027 款"
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">零件号 *</label>
                    <input
                      type="text"
                      value={newForm.partNo}
                      onChange={(e) => setNewForm({ ...newForm, partNo: e.target.value })}
                      placeholder="例如：SPL-J7-78209"
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">零件名称 *</label>
                    <input
                      type="text"
                      value={newForm.partName}
                      onChange={(e) => setNewForm({ ...newForm, partName: e.target.value })}
                      placeholder="例如：副驾减震座椅总成"
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">年需求量（台）</label>
                    <input
                      type="number"
                      value={newForm.annualVolume}
                      onChange={(e) => setNewForm({ ...newForm, annualVolume: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">目标含税价（元）</label>
                    <input
                      type="number"
                      value={newForm.targetPrice}
                      onChange={(e) => setNewForm({ ...newForm, targetPrice: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">报价截止日期</label>
                    <input
                      type="date"
                      value={newForm.deadline}
                      onChange={(e) => setNewForm({ ...newForm, deadline: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[#374151] font-medium mb-1">项目负责人</label>
                    <input
                      type="text"
                      value={newForm.owner}
                      onChange={(e) => setNewForm({ ...newForm, owner: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[#374151] font-medium mb-1.5">
                    SOR 文件与图纸附件（已就绪 {uploadedFiles.length} 个）
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#D1D5DB] bg-[#FAFAFB] py-3 px-4 cursor-pointer hover:border-[#111827] transition-colors">
                    <Upload className="w-4 h-4 text-[#6B7280]" />
                    <span className="text-[#4B5563]">
                      选择本地 pdf / docx / xlsx / png 文件（支持多选）
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.png"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []).map((f) => f.name);
                        if (files.length > 0) {
                          setUploadedFiles((prev) => Array.from(new Set([...prev, ...files])));
                        }
                      }}
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#4B5563]">
                    {uploadedFiles.map((fn) => (
                      <span
                        key={fn}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#F3F4F6] font-mono-tabular"
                      >
                        <FileText className="w-3 h-3" />
                        {fn}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E5E7EB]">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#111827] text-white font-medium hover:bg-[#1F2937] cursor-pointer"
                  >
                    提交并触发 SOR 解析
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== PROJECT DETAIL WORKSPACE ====================
  const currentSorPageObj =
    activeProject.sorPages.find((p) => p.page === activeSorPage) ??
    activeProject.sorPages[0];

  const deptsInReview = Array.from(
    new Set(projectReviews.map((r) => r.deptName))
  );
  const reqsInReview = Array.from(
    new Map(
      projectReviews.map((r) => [
        r.requirementId,
        { id: r.requirementId, seq: r.requirementSeq, summary: r.requirementSummary },
      ])
    ).values()
  ).sort((a, b) => a.seq - b.seq);

  return (
    <div className="space-y-4">
      {noticeText && (
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#047857] flex items-center justify-between">
          <span>{noticeText}</span>
          <button type="button" onClick={() => setNoticeText(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Project Summary Header */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs text-[#374151] hover:bg-[#F3F4F6] cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回列表
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono-tabular text-sm font-semibold text-[#111827]">
                {activeProject.code}
              </span>
              <span className="text-sm font-semibold text-[#111827] truncate">
                {activeProject.customer} · {activeProject.partName}
              </span>
              <StateTag label={activeProject.status} tone={STATUS_TONE[activeProject.status]} />
              {activeProject.lockedVersion && (
                <StateTag label={`需求已锁定 ${activeProject.lockedVersion}`} tone="info" />
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#6B7280] font-mono-tabular">
              <span>车型：{activeProject.vehicle}</span>
              <span>·</span>
              <span>图号：{activeProject.partNo}</span>
              <span>·</span>
              <span>年纲领：{activeProject.annualVolume.toLocaleString()} 台</span>
              <span>·</span>
              <span>截止：{activeProject.deadline}</span>
            </div>
          </div>
        </div>

        {/* Segmented workflow tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg shrink-0">
          {[
            { key: 'parse' as const, label: '1. 解析结果与核对' },
            { key: 'review' as const, label: '2. 部门评审矩阵' },
            { key: 'quote' as const, label: '3. 成本核算与报价' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDetailTab(t.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                detailTab === t.key
                  ? 'bg-white text-[#111827] font-medium shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ==================== TAB 1: SOR PARSE SPLIT-PANE ==================== */}
      {detailTab === 'parse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Left Pane: SOR Original Document Preview */}
            <div className="xl:col-span-4 rounded-xl border border-[#E5E7EB] bg-white flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#111827] truncate">
                  SOR 原文定位预览（{activeProject.attachments[0]?.name ?? '标准文档.pdf'}）
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {activeProject.sorPages.map((sp) => (
                    <button
                      key={sp.page}
                      type="button"
                      onClick={() => setActiveSorPage(sp.page)}
                      className={`px-2 py-1 rounded text-[11px] font-mono-tabular cursor-pointer ${
                        activeSorPage === sp.page
                          ? 'bg-[#111827] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#4B5563] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      P{sp.page}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 flex-1 space-y-3 text-xs leading-relaxed overflow-y-auto max-h-[520px]">
                {!currentSorPageObj ? (
                  <p className="text-[#6B7280] py-8 text-center">
                    该项目暂未上传可预览的原文分页文本。
                  </p>
                ) : (
                  <>
                    <div className="text-[11px] font-medium text-[#6B7280] pb-2 border-b border-[#F3F4F6]">
                      {currentSorPageObj.title}
                    </div>
                    {currentSorPageObj.paragraphs.map((para) => {
                      const isHighlighted = activeHighlightId === para.id;
                      return (
                        <div
                          key={para.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            isHighlighted
                              ? 'bg-[#FEF9C3] border-[#FACC15] text-[#111827]'
                              : 'bg-[#FAFAFB] border-[#F3F4F6] text-[#374151]'
                          }`}
                        >
                          {para.text}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            {/* Right Pane: Extracted Requirement Entries */}
            <div className="xl:col-span-8 rounded-xl border border-[#E5E7EB] bg-white flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[#111827]">
                    结构化需求条目（{projectReqs.length} 条）
                  </span>
                  <span className="text-[#6B7280]">· 置信度 &lt; 0.70 标黄待人工确认</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedReqIds.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        onMergeRequirements(activeProject.id, selectedReqIds);
                        setSelectedReqIds([]);
                        showToast('已合并所选需求条目');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-xs text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      合并选中 ({selectedReqIds.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAddReq((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-xs text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新增条目
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onLockRequirements(activeProject.id);
                      showToast('已锁定需求版本，并同步生成各责任部门评审任务单');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    确认并锁定版本
                  </button>
                </div>
              </div>

              {showAddReq && (
                <div className="p-3 border-b border-[#E5E7EB] bg-[#F9FAFB] flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={newReqCat}
                    onChange={(e) => setNewReqCat(e.target.value as RequirementCategory)}
                    className="px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newReqContent}
                    onChange={(e) => setNewReqContent(e.target.value)}
                    placeholder="输入人工补充的需求条款内容..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newReqContent.trim()) return;
                      onAddRequirement({
                        id: `req-${Date.now()}`,
                        projectId: activeProject.id,
                        seq: projectReqs.length + 1,
                        category: newReqCat,
                        content: newReqContent.trim(),
                        sourcePage: activeSorPage,
                        sourceText: '人工补充条款',
                        deptName: '技术研发部',
                        mandatory: true,
                        confidence: 1.0,
                        status: '已确认',
                      });
                      setNewReqContent('');
                      setShowAddReq(false);
                      showToast('已新增需求条目');
                    }}
                    className="px-3 py-1.5 rounded-md bg-[#111827] text-white font-medium cursor-pointer"
                  >
                    添加
                  </button>
                </div>
              )}

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-white">
                      <th className="py-2.5 px-3 w-8 whitespace-nowrap">选</th>
                      <th className="py-2.5 px-2 w-8 whitespace-nowrap">#</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">类别</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">归类内容与原文定位</th>
                      <th className="py-2.5 px-2 whitespace-nowrap">责任部门</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">置信度</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">状态操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {projectReqs.map((req) => {
                      const lowConf = req.confidence < 0.7;
                      const isEditing = editingReqId === req.id;
                      return (
                        <tr
                          key={req.id}
                          className={lowConf ? 'bg-[#FFFBEB]/60' : 'hover:bg-[#FAFAFB]'}
                        >
                          <td className="py-2.5 px-3 align-top">
                            <input
                              type="checkbox"
                              checked={selectedReqIds.includes(req.id)}
                              aria-label={`选择第 ${req.seq} 条`}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedReqIds((prev) => [...prev, req.id]);
                                } else {
                                  setSelectedReqIds((prev) =>
                                    prev.filter((id) => id !== req.id)
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="py-2.5 px-2 align-top font-mono-tabular text-[#6B7280]">
                            {req.seq}
                          </td>
                          <td className="py-2.5 px-2 align-top whitespace-nowrap">
                            <span className="font-medium text-[#374151]">{req.category}</span>
                            <div className="text-[11px] text-[#6B7280]">
                              {req.mandatory ? '强制' : '建议'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 align-top">
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <textarea
                                  rows={2}
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  className="w-full p-2 rounded border border-[#111827] bg-white text-xs"
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onUpdateRequirement({ ...req, content: editContent });
                                      setEditingReqId(null);
                                    }}
                                    className="px-2 py-0.5 rounded bg-[#111827] text-white cursor-pointer"
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingReqId(null)}
                                    className="px-2 py-0.5 rounded border border-[#E5E7EB] cursor-pointer"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-[#111827] font-medium">{req.content}</div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-[#6B7280]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSorPage(req.sourcePage);
                                      setActiveHighlightId(req.sourceHighlightId ?? null);
                                    }}
                                    className="font-mono-tabular text-[#0369A1] hover:underline cursor-pointer shrink-0"
                                  >
                                    定位 P{req.sourcePage}
                                  </button>
                                  <span className="truncate max-w-[260px]" title={req.sourceText}>
                                    “{req.sourceText}”
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 align-top whitespace-nowrap text-[#374151]">
                            {req.deptName}
                          </td>
                          <td className="py-2.5 px-2 align-top text-right font-mono-tabular whitespace-nowrap">
                            <span
                              className={
                                lowConf ? 'text-[#B45309] font-semibold' : 'text-[#374151]'
                              }
                            >
                              {(req.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <StateTag
                                label={req.status}
                                tone={
                                  req.status === '已确认'
                                    ? 'success'
                                    : req.status === '已驳回'
                                    ? 'danger'
                                    : 'warning'
                                }
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReqId(req.id);
                                  setEditContent(req.content);
                                }}
                                className="text-[#4B5563] hover:text-[#111827] hover:underline cursor-pointer"
                              >
                                编辑
                              </button>
                              {req.status !== '已确认' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateRequirement({ ...req, status: '已确认' })
                                  }
                                  className="text-[#047857] font-medium hover:underline cursor-pointer"
                                >
                                  确认
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Block: Missing Items Comparison */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-[#10A37F]" />
                <h3 className="text-xs font-semibold text-[#111827]">
                  缺失项比对检查（对照同类汽车座椅标准规范）
                </h3>
              </div>
              <span className="text-xs text-[#6B7280]">
                共识别 {projectMissing.length} 项本次文档未明确要求但同类产品常规必选条款
              </span>
            </div>

            {projectMissing.length === 0 ? (
              <p className="text-xs text-[#6B7280]">未发现显著缺失的常规技术或商务条目。</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectMissing.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#111827]">
                        [{m.category}] {m.title}
                      </div>
                      <p className="text-[#6B7280] mt-1">{m.reason}</p>
                    </div>
                    <button
                      type="button"
                      disabled={m.adopted}
                      onClick={() => {
                        onAdoptMissingItem(activeProject.id, m.id);
                        showToast('已将该缺失项采纳并追加至需求条目表');
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs shrink-0 whitespace-nowrap cursor-pointer ${
                        m.adopted
                          ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] cursor-default'
                          : 'bg-white border border-[#E5E7EB] text-[#111827] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      {m.adopted ? '已采纳' : '采纳为需求'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: DEPT REVIEW MATRIX ==================== */}
      {detailTab === 'review' && (() => {
        const reviewSynthesis = synthesizeReviewSummary(projectReviews);
        const visibleDeptTasks = onlyMyDeptReviews
          ? projectReviews.filter((r) => r.deptName === currentDeptName)
          : projectReviews;
        return (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-[#111827]">部门评审协同</span>
              {conflictReqIds.size > 0 && (
                <span className="inline-flex items-center gap-1 text-[#B91C1C] font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  发现 {conflictReqIds.size} 条需求存在跨部门矛盾结论（已标红提示）
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {reviewMode === 'list' && (
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-[#FAFAFB] text-xs text-[#374151] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyMyDeptReviews}
                    onChange={(e) => setOnlyMyDeptReviews(e.target.checked)}
                  />
                  只看本部门（{currentDeptName}）
                </label>
              )}
              <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                <button
                  type="button"
                  onClick={() => setReviewMode('matrix')}
                  className={`px-3 py-1 text-xs rounded-md cursor-pointer ${
                    reviewMode === 'matrix'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  矩阵汇总视图
                </button>
                <button
                  type="button"
                  onClick={() => setReviewMode('list')}
                  className={`px-3 py-1 text-xs rounded-md cursor-pointer ${
                    reviewMode === 'list'
                      ? 'bg-white text-[#111827] font-medium shadow-xs'
                      : 'text-[#6B7280]'
                  }`}
                >
                  部门任务单回复
                </button>
              </div>
            </div>
          </div>

          {projectReviews.length > 0 && (
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] text-xs space-y-1">
              <div className="font-medium text-[#111827]">
                智能体评审摘要与前置条件提炼（REVIEW_DISPATCHER）：
                <span className="font-normal text-[#374151] ml-1">{reviewSynthesis.summaryText}</span>
              </div>
              {reviewSynthesis.conditions.length > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#4B5563]">
                  {reviewSynthesis.conditions.map((cond, idx) => (
                    <span key={idx}>• {cond}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {projectReviews.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B7280]">
              请先在“1. 解析结果与核对”页签点击“确认并锁定版本”，系统将自动按责任部门分派评审任务单。
            </div>
          ) : reviewMode === 'matrix' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                    <th className="py-3 px-4 whitespace-nowrap">部门 \ 需求条目</th>
                    {reqsInReview.map((req) => {
                      const hasConflict = conflictReqIds.has(req.id);
                      return (
                        <th
                          key={req.id}
                          className={`py-3 px-3 min-w-[160px] ${
                            hasConflict ? 'bg-[#FEF2F2] text-[#B91C1C]' : ''
                          }`}
                        >
                          <div className="font-mono-tabular font-semibold">
                            #{req.seq} {hasConflict ? '· 结论矛盾' : ''}
                          </div>
                          <div className="font-normal text-[11px] truncate max-w-[180px]">
                            {req.summary}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {deptsInReview.map((dept) => (
                    <tr key={dept}>
                      <td className="py-3 px-4 font-medium text-[#111827] whitespace-nowrap bg-[#FAFAFB]">
                        {dept}
                      </td>
                      {reqsInReview.map((req) => {
                        const cell = projectReviews.find(
                          (r) => r.deptName === dept && r.requirementId === req.id
                        );
                        const hasConflict = conflictReqIds.has(req.id);
                        return (
                          <td
                            key={req.id}
                            className={`py-3 px-3 align-top ${
                              hasConflict && cell ? 'bg-[#FEF2F2]/70' : ''
                            }`}
                          >
                            {!cell ? (
                              <span className="text-[#D1D5DB]">—</span>
                            ) : (
                              <div className="space-y-1">
                                <StateTag
                                  label={cell.conclusion}
                                  tone={
                                    cell.conclusion === '可行'
                                      ? 'success'
                                      : cell.conclusion === '不可行'
                                      ? 'danger'
                                      : cell.conclusion === '有条件可行'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                />
                                {cell.comment && (
                                  <p className="text-[11px] text-[#4B5563] line-clamp-2">
                                    {cell.comment}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {visibleDeptTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#6B7280]">
                  当前项目下暂无分配给「{currentDeptName}」的评审任务单，可取消“只看本部门”查看全部。
                </div>
              ) : (
                visibleDeptTasks.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 flex flex-wrap items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#111827]">{rev.deptName}</span>
                      <span className="text-[#6B7280]">· 评审人：{rev.reviewerName}</span>
                      <span className="font-mono-tabular text-[#6B7280]">
                        · 条目 #{rev.requirementSeq}
                      </span>
                    </div>
                    <div className="text-[#374151]">{rev.requirementSummary}</div>
                    <input
                      type="text"
                      value={rev.comment}
                      onChange={(e) =>
                        onUpdateDeptReview({ ...rev, comment: e.target.value })
                      }
                      placeholder="填写部门评审前置条件或技术说明..."
                      className="mt-1.5 w-full md:w-[460px] px-3 py-1.5 rounded-md border border-[#E5E7EB] text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(['可行', '有条件可行', '不可行'] as ReviewConclusion[]).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          onUpdateDeptReview({
                            ...rev,
                            conclusion: opt,
                            updatedAt: '2026-11-23 19:30',
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-md border text-xs cursor-pointer ${
                          rev.conclusion === opt
                            ? opt === '不可行'
                              ? 'bg-[#DC2626] text-white border-[#DC2626]'
                              : opt === '有条件可行'
                              ? 'bg-[#D97706] text-white border-[#D97706]'
                              : 'bg-[#10A37F] text-white border-[#10A37F]'
                            : 'bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                ))
              )}
            </div>
          )}
        </div>
        );
      })()}

      {/* ==================== TAB 3: BOM COSTING & QUOTE ==================== */}
      {detailTab === 'quote' && readiness && quoteCalc && (() => {
        const earlyEstimate = estimateEarlyCostRange(
          activeProject.annualVolume,
          activeProject.targetPrice,
          activeProject.customer
        );
        return (
        <div className="space-y-4">
          {canViewCostMargin && (
            <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-[#111827]">
                  早期成本量级参考（COST_ESTIMATOR）：
                </span>
                <span className="font-mono-tabular text-[#111827] ml-1">
                  不含税估算区间 ¥{earlyEstimate.lowExclTax.toFixed(0)} ~ ¥{earlyEstimate.highExclTax.toFixed(0)}
                </span>
                <span className="text-[#6B7280] ml-2">· {earlyEstimate.judgement}</span>
              </div>
              <span className="font-mono-tabular text-[#047857] font-medium shrink-0">
                参考毛利率：{earlyEstimate.recommendedMarginPct}%
              </span>
            </div>
          )}

          {/* Readiness Gate Card */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-xs font-semibold text-[#111827]">
                  报价就绪检查（全部 4 项通过后方可生成对外报价单）
                </h3>
                <p className="text-[11px] text-[#6B7280] mt-0.5">
                  当前关联 BOM：
                  {bomHeaders.find((b) => b.id === activeProject.bomHeaderId)?.name ?? '未绑定'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQuoteTemplate('FAW_TOTAL')}
                    className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                      quoteTemplate === 'FAW_TOTAL'
                        ? 'bg-white text-[#111827] font-medium shadow-xs'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    解放总价模板 (FAW_TOTAL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteTemplate('BYD_DETAIL')}
                    className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                      quoteTemplate === 'BYD_DETAIL'
                        ? 'bg-white text-[#111827] font-medium shadow-xs'
                        : 'text-[#6B7280]'
                    }`}
                  >
                    比亚迪明细模板 (BYD_DETAIL)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {readiness.checks.map((ck) => (
                <div
                  key={ck.key}
                  className={`rounded-lg border p-3 text-xs ${
                    ck.passed
                      ? 'border-[#A7F3D0] bg-[#ECFDF5]/60'
                      : 'border-[#FECACA] bg-[#FEF2F2]/70'
                  }`}
                >
                  <div className="flex items-center justify-between font-medium">
                    <span className={ck.passed ? 'text-[#047857]' : 'text-[#B91C1C]'}>
                      {ck.label}
                    </span>
                    {ck.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#10A37F]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#DC2626]" />
                    )}
                  </div>
                  <p className="text-[11px] text-[#4B5563] mt-1">{ck.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3-Block Cost Details & Summary */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-[#111827]">
                逐行成本核算明细（{quoteTemplate === 'FAW_TOTAL' ? '一汽解放总价格式' : '比亚迪明细分解格式'}）
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!readiness.ready}
                  onClick={() => setQuotePreviewOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  预览报价单
                </button>
                <button
                  type="button"
                  disabled={!readiness.ready}
                  onClick={() => {
                    downloadCsvFile(
                      `${activeProject.code}_${quoteTemplate}_报价单.csv`,
                      ['成本类型', '编码/零件号', '名称', '实际用量', '损耗率%', '不含税单价(元)', '不含税金额(元)', '取价来源'],
                      quoteCalc.breakdownRows.map((r) => [
                        r.costType,
                        r.partNo,
                        r.name,
                        r.qty,
                        r.lossRate,
                        r.unitPrice.toFixed(2),
                        r.amountExclTax.toFixed(2),
                        r.source,
                      ])
                    );
                    onLogAction('导出', 'quote_header', activeProject.code, `导出 ${quoteTemplate} 报价单`);
                    showToast('已导出报价单 CSV 文件');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  导出 Excel/CSV
                </button>
                <button
                  type="button"
                  disabled={!readiness.ready}
                  onClick={() => {
                    onSubmitQuoteForReview(
                      activeProject,
                      quoteTemplate,
                      quoteCalc.subtotalExclTax,
                      quoteCalc.totalInclTax
                    );
                    showToast('报价单已冻结版本并推送财务核算部（孙丽华）复核');
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  冻结并提交审核
                </button>
              </div>
            </div>

            {/* Material, Labor, Tooling, Other rows */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-white">
                    <th className="py-2.5 px-4">费用分类</th>
                    <th className="py-2.5 px-3">零件号 / 费用项</th>
                    <th className="py-2.5 px-3">名称</th>
                    <th className="py-2.5 px-3 text-right">实际用量</th>
                    <th className="py-2.5 px-3 text-right">损耗率</th>
                    <th className="py-2.5 px-3 text-right">不含税单价</th>
                    <th className="py-2.5 px-3 text-right">不含税金额</th>
                    <th className="py-2.5 px-4">取价来源</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {/* Missing price BOM lines shown first so user can fix blockers directly */}
                  {activeBomLines
                    .filter((l) => l.level > 0 && (l.unitPrice === null || l.unitPrice <= 0))
                    .map((missingLine) => (
                      <tr key={missingLine.id} className="bg-[#FEF2F2]">
                        <td className="py-2.5 px-4">
                          <StateTag label="缺价卡点" tone="danger" />
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular text-[#111827]">
                          {missingLine.partNo}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-[#111827]">
                          {missingLine.name}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {missingLine.actualQty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {missingLine.lossRate}%
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {editingPriceLineId === missingLine.id ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={tempPriceInput}
                                onChange={(e) => setTempPriceInput(e.target.value)}
                                placeholder="输入单价"
                                className="w-20 px-2 py-1 rounded border border-[#111827] bg-white text-right font-mono-tabular"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const val = parseFloat(tempPriceInput);
                                  if (!isNaN(val) && val > 0) {
                                    onUpdateBomLinePrice(missingLine.id, val);
                                    setEditingPriceLineId(null);
                                    showToast(`已补录 ${missingLine.partNo} 单价 ¥${val.toFixed(2)}`);
                                  }
                                }}
                                className="px-2 py-1 rounded bg-[#111827] text-white cursor-pointer"
                              >
                                保存
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPriceLineId(missingLine.id);
                                setTempPriceInput('85.00');
                              }}
                              className="px-2.5 py-1 rounded bg-[#DC2626] text-white font-medium hover:bg-[#B91C1C] cursor-pointer"
                            >
                              人工补价
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-[#B91C1C]">
                          待核算
                        </td>
                        <td className="py-2.5 px-4 text-[#B91C1C]">待确认</td>
                      </tr>
                    ))}

                  {quoteCalc.breakdownRows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FAFAFB]">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <StateTag
                          label={row.costType}
                          tone={
                            row.costType === '材料'
                              ? 'neutral'
                              : row.costType === '人工'
                              ? 'info'
                              : row.costType === '模具'
                              ? 'warning'
                              : 'neutral'
                          }
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono-tabular text-[#374151]">
                        {row.partNo}
                      </td>
                      <td className="py-2.5 px-3 text-[#111827] font-medium">{row.name}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#374151]">
                        {row.qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#6B7280]">
                        {row.lossRate}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#374151]">
                        {canViewCostMargin ? `¥${row.unitPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-[#111827]">
                        {canViewCostMargin ? `¥${row.amountExclTax.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-[#6B7280]">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom Summary Strip (Excl vs Incl Tax strictly separated) */}
            <div className="px-5 py-4 border-t border-[#E5E7EB] bg-[#FAFAFB] grid grid-cols-2 md:grid-cols-6 gap-4 text-xs">
              <div>
                <div className="text-[#6B7280]">材料费合计</div>
                <div className="mt-1 font-mono-tabular text-sm font-semibold text-[#111827]">
                  ¥{quoteCalc.materialCost.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">人工制造费</div>
                <div className="mt-1 font-mono-tabular text-sm font-semibold text-[#111827]">
                  ¥{quoteCalc.laborCost.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">模具摊销 + 其他</div>
                <div className="mt-1 font-mono-tabular text-sm font-semibold text-[#111827]">
                  ¥{(quoteCalc.toolingCost + quoteCalc.otherCost).toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">合计单价（不含税）</div>
                <div className="mt-1 font-mono-tabular text-base font-semibold text-[#111827]">
                  ¥{quoteCalc.subtotalExclTax.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">增值税（13%）</div>
                <div className="mt-1 font-mono-tabular text-sm font-semibold text-[#4B5563]">
                  ¥{quoteCalc.taxAmount.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[#6B7280]">对外报价（含税）</div>
                <div className="mt-1 font-mono-tabular text-base font-bold text-[#10A37F]">
                  ¥{quoteCalc.totalInclTax.toFixed(2)}
                  <span className="ml-2 text-[11px] font-normal text-[#6B7280]">
                    目标 ¥{activeProject.targetPrice.toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quote Preview Modal */}
          {quotePreviewOpen && (
            <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-label="报价单预览"
                className="w-full max-w-2xl rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#111827]">
                    {quoteTemplate === 'FAW_TOTAL'
                      ? '一汽解放总价格式报价单预览'
                      : '比亚迪明细分解格式报价单预览'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setQuotePreviewOpen(false)}
                    className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#FAFAFB] border border-[#E5E7EB]">
                    <div>客户：{activeProject.customer}</div>
                    <div>车型：{activeProject.vehicle}</div>
                    <div>零件名称：{activeProject.partName}</div>
                    <div className="font-mono-tabular">零件号：{activeProject.partNo}</div>
                    <div className="font-mono-tabular">年纲领：{activeProject.annualVolume.toLocaleString()} 台</div>
                    <div className="font-mono-tabular">报价有效期：2026-12-31</div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-3 rounded-lg border border-[#E5E7EB]">
                      <div className="text-[#6B7280]">材料费</div>
                      <div className="mt-1 font-mono-tabular font-semibold text-[#111827]">
                        ¥{quoteCalc.materialCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#E5E7EB]">
                      <div className="text-[#6B7280]">人工费</div>
                      <div className="mt-1 font-mono-tabular font-semibold text-[#111827]">
                        ¥{quoteCalc.laborCost.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#E5E7EB]">
                      <div className="text-[#6B7280]">模具及其他</div>
                      <div className="mt-1 font-mono-tabular font-semibold text-[#111827]">
                        ¥{(quoteCalc.toolingCost + quoteCalc.otherCost).toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#10A37F]/40 bg-[#ECFDF5]">
                      <div className="text-[#047857]">含税总价</div>
                      <div className="mt-1 font-mono-tabular font-bold text-[#047857]">
                        ¥{quoteCalc.totalInclTax.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
};
