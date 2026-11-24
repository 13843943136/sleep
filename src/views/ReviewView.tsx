import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Eye,
  Forward,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import type { RejectReasonCategory, ReviewRecord, RoleCode } from '../types/erp';
import { StateTag } from '../components/UiPrimitives';

interface ReviewViewProps {
  reviews: ReviewRecord[];
  currentUserName: string;
  currentRole: RoleCode;
  onApprove: (id: string, comment: string) => void;
  onReject: (id: string, category: RejectReasonCategory, comment: string) => void;
  onTransfer: (id: string, targetReviewer: string) => void;
  onUrgeReview?: (id: string, targetReviewer: string, objectCode: string) => void;
}

const REJECT_CATEGORIES: RejectReasonCategory[] = [
  '数据错',
  '规则缺',
  '约束未告知',
  '表述不清',
];

export const ReviewView: React.FC<ReviewViewProps> = ({
  reviews,
  currentUserName,
  currentRole,
  onApprove,
  onReject,
  onTransfer,
  onUrgeReview,
}) => {
  const isGm = currentRole === 'GM';
  const [activeTab, setActiveTab] = useState<'todo' | 'mine' | 'all'>('todo');
  const [selectedId, setSelectedId] = useState<string | null>(reviews[0]?.id ?? null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectCategory, setRejectCategory] = useState<RejectReasonCategory>('数据错');
  const [rejectReasonText, setRejectReasonText] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [transferTarget, setTransferTarget] = useState('陈志强');
  const [approveComment, setApproveComment] = useState('');
  const [urgedIds, setUrgedIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const myTodoReviews = useMemo(() => {
    if (isGm) {
      return reviews.filter((r) => r.status === '待审核');
    }
    return reviews.filter((r) => r.status === '待审核' && r.reviewer === currentUserName);
  }, [reviews, isGm, currentUserName]);

  const mySubmittedReviews = useMemo(
    () => reviews.filter((r) => r.submitter === currentUserName),
    [reviews, currentUserName]
  );

  const filtered = useMemo(() => {
    if (activeTab === 'todo') {
      return myTodoReviews;
    }
    if (activeTab === 'mine' && !isGm) {
      return mySubmittedReviews;
    }
    return reviews;
  }, [reviews, activeTab, isGm, myTodoReviews, mySubmittedReviews]);

  const activeRecord = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalId) return;
    if (!rejectReasonText.trim()) {
      setRejectError('驳回操作必须填写具体说明，便于提交人修订。');
      return;
    }
    onReject(rejectModalId, rejectCategory, rejectReasonText.trim());
    setRejectModalId(null);
    setRejectReasonText('');
    setRejectError(null);
    showToast(`已驳回单据（原因分类：${rejectCategory}）`);
  };

  const canActOnRecord =
    !isGm &&
    activeRecord !== null &&
    activeRecord.status === '待审核' &&
    activeRecord.reviewer === currentUserName &&
    activeRecord.submitter !== currentUserName;

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

      {isGm && (
        <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFB] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#374151]">
            <ShieldAlert className="w-4 h-4 text-[#111827] shrink-0" />
            <span>
              <strong className="text-[#111827]">总经理只读督办视角：</strong>
              具体单据复核由财务核算部、技术研发部、销售与市场部等部门主管理员主责确认；您可查看跨部门流转进度或发送催办提醒。
            </span>
          </div>
          <StateTag label="不参与业务审批" tone="info" />
        </div>
      )}

      {/* Top Filter Tabs */}
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
          {(isGm
            ? [
                {
                  key: 'todo' as const,
                  label: `各部门待审汇总 (${myTodoReviews.length})`,
                },
                { key: 'all' as const, label: `全部流转记录 (${reviews.length})` },
              ]
            : [
                {
                  key: 'todo' as const,
                  label: `待我审核 (${myTodoReviews.length})`,
                },
                {
                  key: 'mine' as const,
                  label: `我提交的 (${mySubmittedReviews.length})`,
                },
                { key: 'all' as const, label: `全部记录 (${reviews.length})` },
              ]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === t.key
                  ? 'bg-white text-[#111827] font-medium shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-[#6B7280]">
          部门分权确认制 · 当前账号：{currentUserName} · 提交人与审核人不可为同一人
        </div>
      </div>

      {/* Split Layout: Left List + Right Slide-over Preview Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-7 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                  <th className="py-3 px-4 whitespace-nowrap">产物名称与单号</th>
                  <th className="py-3 px-3 whitespace-nowrap">类型</th>
                  <th className="py-3 px-3 whitespace-nowrap">版本变更</th>
                  <th className="py-3 px-3 whitespace-nowrap">提交人 / 审核主责</th>
                  <th className="py-3 px-3 whitespace-nowrap">状态</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">预览</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-[#6B7280]">
                      当前页签暂无需要「{currentUserName}」处理的审核单据，可切换至“全部记录”或左上/左下切换对应部门审核人。
                    </td>
                  </tr>
                ) : (
                  filtered.map((rv) => {
                    const selected = activeRecord?.id === rv.id;
                    return (
                      <tr
                        key={rv.id}
                        className={
                          selected ? 'bg-[#F3F4F6]/80' : 'hover:bg-[#FAFAFB] transition-colors'
                        }
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#111827]">{rv.title}</div>
                          <div className="text-[11px] font-mono-tabular text-[#6B7280] mt-0.5">
                            {rv.objectCode} · {rv.submittedAt}
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StateTag label={rv.objectType} tone="info" />
                        </td>
                        <td className="py-3 px-3 font-mono-tabular whitespace-nowrap text-[#374151]">
                          {rv.prevVersion} → {rv.currVersion}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-[#374151]">
                          <div>{rv.submitter}</div>
                          <div className="text-[11px] text-[#6B7280]">审：{rv.reviewer}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StateTag
                            label={rv.status}
                            tone={
                              rv.status === '已通过'
                                ? 'success'
                                : rv.status === '已驳回'
                                ? 'danger'
                                : rv.status === '已转交'
                                ? 'info'
                                : 'warning'
                            }
                          />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedId(rv.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Slide-Over Style Artifact Inspector Panel */}
        <div className="xl:col-span-5 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          {!activeRecord ? (
            <div className="p-10 text-center text-xs text-[#6B7280]">
              请在左侧选择一条审核单据以查看产物内容与前后版本差异。
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB] text-xs">
              <div className="p-4 bg-[#FAFAFB]">
                <div className="flex items-center justify-between gap-2">
                  <StateTag label={activeRecord.objectType} tone="info" />
                  <span className="font-mono-tabular text-[#6B7280]">
                    {activeRecord.prevVersion} → {activeRecord.currVersion}
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-[#111827]">
                  {activeRecord.title}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-[#6B7280]">
                  <span>
                    提交人：{activeRecord.submitter}（{activeRecord.deptName}）
                  </span>
                  <span>·</span>
                  <span>指定审核人：{activeRecord.reviewer}</span>
                </div>
              </div>

              {/* AI Review Summary */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-[#111827]">变更要点与风险摘要</div>
                <ul className="space-y-1.5 text-[#374151] list-disc pl-4">
                  {activeRecord.summaryPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>

              {/* Version Diff Table */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-[#111827]">前后版本对比明细</div>
                <div className="rounded-lg border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-[#FAFAFB] border-b border-[#E5E7EB] text-[#6B7280]">
                        <th className="py-2 px-3">变更项</th>
                        <th className="py-2 px-3">变更前 ({activeRecord.prevVersion})</th>
                        <th className="py-2 px-3">变更后 ({activeRecord.currVersion})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {activeRecord.diffRows.map((d, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium text-[#111827]">{d.field}</td>
                          <td className="py-2 px-3 text-[#6B7280] font-mono-tabular">{d.before}</td>
                          <td className="py-2 px-3 text-[#047857] font-mono-tabular font-medium">
                            {d.after}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Existing Review Outcome or Action Controls */}
              {activeRecord.status === '待审核' ? (
                isGm ? (
                  <div className="p-4 bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[#4B5563]">
                      当前等待 <strong className="text-[#111827]">{activeRecord.reviewer}</strong> 复核确认
                    </div>
                    <button
                      type="button"
                      disabled={urgedIds.includes(activeRecord.id)}
                      onClick={() => {
                        setUrgedIds((prev) => [...prev, activeRecord.id]);
                        onUrgeReview?.(activeRecord.id, activeRecord.reviewer, activeRecord.objectCode);
                        showToast(`已向 ${activeRecord.reviewer} 发送 ${activeRecord.objectCode} 督办提醒`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] font-medium hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      {urgedIds.includes(activeRecord.id) ? '已发送督办' : '发送督办提醒'}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 space-y-3 bg-[#FAFAFB]">
                    {activeRecord.submitter === currentUserName ? (
                      <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[#B45309]">
                        权限校验提示：当前登录账号与提交人相同，按制度要求不可自审。
                      </div>
                    ) : activeRecord.reviewer !== currentUserName ? (
                      <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-[#4B5563]">
                        当前单据指定审核人为「<strong className="text-[#111827]">{activeRecord.reviewer}</strong>」，请切换至对应部门审核人执行确认。
                      </div>
                    ) : null}

                    <input
                      type="text"
                      value={approveComment}
                      onChange={(e) => setApproveComment(e.target.value)}
                      disabled={!canActOnRecord}
                      placeholder="填写部门复核意见（通过可选填，驳回需选填四类原因）..."
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs disabled:bg-[#F3F4F6]"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <select
                          value={transferTarget}
                          onChange={(e) => setTransferTarget(e.target.value)}
                          aria-label="选择转交人"
                          disabled={!canActOnRecord}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs disabled:opacity-50"
                        >
                          <option value="陈志强">陈志强（技术研发部）</option>
                          <option value="孙丽华">孙丽华（财务核算部）</option>
                          <option value="林致远">林致远（销售与市场部）</option>
                          <option value="王建国">王建国（生产制造部）</option>
                        </select>
                        <button
                          type="button"
                          disabled={!canActOnRecord}
                          onClick={() => {
                            onTransfer(activeRecord.id, transferTarget);
                            showToast(`已将审批单转交至 ${transferTarget}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 cursor-pointer"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          转交
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canActOnRecord}
                          onClick={() => {
                            setRejectModalId(activeRecord.id);
                            setRejectError(null);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#FECACA] bg-white text-[#B91C1C] hover:bg-[#FEF2F2] disabled:opacity-40 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          驳回
                        </button>
                        <button
                          type="button"
                          disabled={!canActOnRecord}
                          onClick={() => {
                            onApprove(
                              activeRecord.id,
                              approveComment.trim() || '部门复核通过并锁定版本'
                            );
                            setApproveComment('');
                            showToast(`已通过 ${activeRecord.objectCode}`);
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#10A37F] text-white font-medium hover:bg-[#0E8F6F] disabled:opacity-40 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          通过
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="p-4 bg-[#FAFAFB] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#111827]">审批结果记录</span>
                    <span className="font-mono-tabular text-[#6B7280]">
                      {activeRecord.reviewedAt ?? '-'}
                    </span>
                  </div>
                  {activeRecord.rejectCategory && (
                    <div className="text-[#B91C1C]">
                      驳回分类：<span className="font-semibold">{activeRecord.rejectCategory}</span>
                    </div>
                  )}
                  <p className="text-[#374151]">
                    意见：{activeRecord.comment ?? '已记录审批操作'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal (4 required categories) */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="驳回原因确认"
            className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">填写驳回原因</h3>
              <button
                type="button"
                onClick={() => setRejectModalId(null)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="p-5 space-y-4 text-xs">
              {rejectError && (
                <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[#B91C1C]">
                  {rejectError}
                </div>
              )}
              <div>
                <label className="block font-medium text-[#374151] mb-2">
                  问题归类（必选）
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {REJECT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setRejectCategory(cat)}
                      className={`py-2 px-3 rounded-lg border text-left cursor-pointer ${
                        rejectCategory === cat
                          ? 'border-[#111827] bg-[#111827] text-white font-medium'
                          : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-medium text-[#374151] mb-1">
                  具体修改要求 *
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonText}
                  onChange={(e) => setRejectReasonText(e.target.value)}
                  placeholder="请说明需核对的数据行号或缺失约束..."
                  className="w-full p-2.5 rounded-lg border border-[#E5E7EB]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalId(null)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#DC2626] text-white font-medium hover:bg-[#B91C1C] cursor-pointer"
                >
                  确认驳回
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
