import React, { useMemo, useState } from 'react';
import { Play, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react';
import type { AgentConfig, AgentRunRecord } from '../types/erp';
import { StateTag } from '../components/UiPrimitives';

interface AgentsViewProps {
  agents: AgentConfig[];
  runs: AgentRunRecord[];
  currentUserName: string;
  onToggleEnabled: (code: string) => void;
  onSaveHarness: (code: string, newText: string, note: string) => void;
  onRollbackHarness: (code: string, version: string) => void;
  onAddRunRecord: (run: AgentRunRecord) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  agents,
  runs,
  onToggleEnabled,
  onSaveHarness,
  onRollbackHarness,
  onAddRunRecord,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(agents[0]?.code ?? 'SOR_PARSER');
  const activeAgent = useMemo(
    () => agents.find((a) => a.code === selectedCode) ?? agents[0],
    [agents, selectedCode]
  );

  const [draftHarness, setDraftHarness] = useState<string>(activeAgent?.harnessText ?? '');
  const [versionNote, setVersionNote] = useState('');
  const [testInput, setTestInput] = useState(
    '第 4 页 4.1 气囊悬浮行程须满足 ≥110mm，静态漏气量保压 24 小时压降 ≤0.02MPa。'
  );
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSelectAgent = (agent: AgentConfig) => {
    setSelectedCode(agent.code);
    setDraftHarness(agent.harnessText);
    setTestOutput(null);
  };

  const agentRuns = useMemo(
    () => runs.filter((r) => r.agentCode === activeAgent.code),
    [runs, activeAgent]
  );

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleDryRun = () => {
    const start = Date.now();
    const simulatedJson =
      activeAgent.code === 'SOR_PARSER'
        ? JSON.stringify(
            [
              {
                category: '技术',
                content: '气囊悬浮行程 ≥110mm，0.8MPa 保压 24h 压降 ≤0.02MPa',
                source_page: 4,
                source_text: testInput.slice(0, 48),
                dept_name: '技术研发部',
                mandatory: true,
                confidence: 0.95,
              },
            ],
            null,
            2
          )
        : JSON.stringify(
            {
              agent: activeAgent.code,
              model: activeAgent.model,
              status: 'schema_verified',
              summary: `已完成试运行推理（输入 ${testInput.length} 字），输出符合结构化 JSON 约束。`,
            },
            null,
            2
          );

    const latencyMs = 680 + (Date.now() - start) + Math.floor(testInput.length * 4.5);
    const tokens = 420 + testInput.length * 2;
    setTestOutput(simulatedJson);
    onAddRunRecord({
      id: `run-${Date.now()}`,
      agentCode: activeAgent.code,
      ts: '2026-11-23 19:32:10',
      inputSummary: `[试运行] ${testInput.slice(0, 42)}...`,
      outputSummary: 'JSON Schema 校验通过，返回结构化结果',
      tokens,
      latencyMs,
      status: '成功',
    });
    showToast(`已完成试运行（耗时 ${latencyMs}ms · ${tokens} tokens）`);
  };

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

      {/* Codex-style Split: Left Agent Roster + Right Harness Editor & Runs */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left: Agent List */}
        <div className="xl:col-span-4 rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex items-center justify-between text-xs">
            <span className="font-semibold text-[#111827]">
              已注册智能体（{agents.length}）
            </span>
            <span className="font-mono-tabular text-[#6B7280]">DeepSeek V4.1 Flash</span>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {agents.map((ag) => {
              const selected = ag.code === activeAgent.code;
              return (
                <div
                  key={ag.code}
                  className={`p-4 transition-colors ${
                    selected ? 'bg-[#F3F4F6]/80' : 'hover:bg-[#FAFAFB]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAgent(ag)}
                      className="text-left flex-1 cursor-pointer"
                    >
                      <div className="text-xs font-semibold text-[#111827]">{ag.name}</div>
                      <div className="mt-0.5 text-[11px] font-mono-tabular text-[#6B7280]">
                        {ag.code} · {ag.currentVersion} · T={ag.temperature}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleEnabled(ag.code)}
                      className="cursor-pointer shrink-0"
                    >
                      <StateTag
                        label={ag.enabled ? '已启用' : '已停用'}
                        tone={ag.enabled ? 'success' : 'neutral'}
                      />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#4B5563] line-clamp-2">{ag.purpose}</p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#6B7280] font-mono-tabular">
                    <span>近 7 次成功率：{ag.recentSevenSuccessRate}%</span>
                    <span>模型：{ag.model}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Harness Editor, Dry Run & Logs */}
        <div className="xl:col-span-8 space-y-4">
          {/* Harness Editor Card */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <SlidersHorizontal className="w-4 h-4 text-[#111827]" />
                <span className="font-semibold text-[#111827]">
                  {activeAgent.name} · Harness 行为定义
                </span>
                <StateTag label={activeAgent.currentVersion} tone="info" />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  placeholder="版本修改说明..."
                  className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white text-xs w-44"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSaveHarness(
                      activeAgent.code,
                      draftHarness,
                      versionNote.trim() || '微调结构化输出约束'
                    );
                    setVersionNote('');
                    showToast('已保存 Harness 新版本并写入审计留痕');
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  保存新版本
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4 text-xs">
              <textarea
                rows={8}
                value={draftHarness}
                onChange={(e) => setDraftHarness(e.target.value)}
                aria-label="Harness 提示词与输出约束"
                className="w-full p-3.5 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] focus:bg-white focus:border-[#111827] focus:outline-none font-mono-tabular text-xs leading-relaxed text-[#111827]"
              />

              {/* Version History & Rollback */}
              <div>
                <div className="font-semibold text-[#111827] mb-2">版本历史（支持回滚）</div>
                <div className="space-y-1.5">
                  {activeAgent.versions.map((ver) => (
                    <div
                      key={ver.version}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono-tabular font-semibold text-[#111827]">
                          {ver.version}
                        </span>
                        <span className="text-[#374151]">{ver.note}</span>
                        <span className="font-mono-tabular text-[#6B7280]">
                          · {ver.updatedBy} @ {ver.updatedAt}
                        </span>
                      </div>
                      {ver.version === activeAgent.currentVersion ? (
                        <StateTag label="当前生效" tone="success" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onRollbackHarness(activeAgent.code, ver.version);
                            setDraftHarness(ver.harnessText);
                            showToast(`已回滚至 ${ver.version}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          回滚到此版
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Dry-Run Console */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#111827]">在线试运行调试</h3>
              <button
                type="button"
                onClick={handleDryRun}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10A37F] text-white font-medium hover:bg-[#0E8F6F] cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                执行试运行
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-[#6B7280] mb-1">输入测试文本</div>
                <textarea
                  rows={4}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#E5E7EB] font-mono-tabular text-xs"
                />
              </div>
              <div>
                <div className="text-[#6B7280] mb-1">结构化 JSON 输出校验</div>
                <pre className="w-full h-[98px] overflow-auto whitespace-pre-wrap break-words p-2.5 rounded-lg border border-[#E5E7EB] bg-[#111827] text-[#E5E7EB] font-mono-tabular text-[11px]">
                  {testOutput ?? '点击右上角“执行试运行”查看 DeepSeek V4.1 Flash 结构化 JSON 返回'}
                </pre>
              </div>
            </div>
          </div>

          {/* Call History */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] text-xs font-semibold text-[#111827]">
              最近调用记录与令牌耗时统计
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[#6B7280] bg-white">
                    <th className="py-2.5 px-4 whitespace-nowrap">调用时间</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">输入摘要</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">输出摘要</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Tokens</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">耗时</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {agentRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                        当前智能体暂无调用记录，可点击上方“执行试运行”生成记录。
                      </td>
                    </tr>
                  ) : (
                    agentRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-[#FAFAFB]">
                        <td className="py-2.5 px-4 font-mono-tabular text-[#6B7280] whitespace-nowrap">
                          {run.ts}
                        </td>
                        <td className="py-2.5 px-3 text-[#374151] max-w-[160px] truncate">
                          {run.inputSummary}
                        </td>
                        <td className="py-2.5 px-3 text-[#111827] max-w-[180px] truncate">
                          {run.outputSummary}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                          {run.tokens.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-[#4B5563] whitespace-nowrap">
                          {run.latencyMs}ms
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <StateTag
                            label={run.status}
                            tone={
                              run.status === '成功'
                                ? 'success'
                                : run.status === '重试成功'
                                ? 'warning'
                                : 'danger'
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
