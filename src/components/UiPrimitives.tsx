import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type SemanticTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_MAP: Record<SemanticTone, string> = {
  neutral: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
  success: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
  warning: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  danger: 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]',
  info: 'bg-[#F0F9FF] text-[#0369A1] border-[#BAE6FD]',
};

export const StateTag: React.FC<{
  label: string;
  tone?: SemanticTone;
}> = ({ label, tone = 'neutral' }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium whitespace-nowrap shrink-0 ${TONE_MAP[tone]}`}
  >
    {label}
  </span>
);

export const PaginationBar: React.FC<{
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}> = ({ total, page, pageSize, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFAFB] text-xs text-[#6B7280] rounded-b-xl">
      <div className="tabular-nums">
        显示第 <span className="font-medium text-[#111827]">{start}</span> -{' '}
        <span className="font-medium text-[#111827]">{end}</span> 条，共{' '}
        <span className="font-medium text-[#111827]">{total}</span> 条记录（每页{' '}
        {pageSize} 条）
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="上一页"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          上一页
        </button>
        <span className="px-2.5 py-1 font-mono-tabular text-[#111827]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="下一页"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          下一页
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
