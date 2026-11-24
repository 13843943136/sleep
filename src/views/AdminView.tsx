import React, { useMemo, useState } from 'react';
import { Plus, Search, Shield, X } from 'lucide-react';
import type { AuditLogEntry, DeptNode, RoleCode, UserProfile } from '../types/erp';
import { StateTag } from '../components/UiPrimitives';

interface AdminViewProps {
  depts: DeptNode[];
  users: UserProfile[];
  auditLogs: AuditLogEntry[];
  onToggleUserStatus: (userId: string) => void;
  onAddUser: (user: UserProfile) => void;
  onLogAction: (action: '权限变更' | '修改', objectType: string, objectId: string, detail: string) => void;
}

type AdminTab = 'dept' | 'user' | 'role' | 'permission' | 'audit';

const ROLE_DEFS: {
  code: RoleCode;
  name: string;
  scope: string;
  desc: string;
}[] = [
  { code: 'GM', name: '总经理', scope: '全公司', desc: '驾驶舱、全部业务数据、最终裁定、审计日志查询' },
  { code: 'DEPT_ADMIN', name: '部门主管理员', scope: '本部门 + 参与项目', desc: '本部门人员管理、产物审核、本部门数据维护' },
  { code: 'STAFF', name: '普通员工', scope: '本人 + 参与项目', desc: '本人任务、经手单据、提交审核（底价字段默认隐藏）' },
  { code: 'OPS', name: '系统运维', scope: '系统配置', desc: '账号与集成配置、智能体参数与日志巡检，不查看业务底价' },
];

export const AdminView: React.FC<AdminViewProps> = ({
  depts,
  users,
  auditLogs,
  onToggleUserStatus,
  onAddUser,
  onLogAction,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('user');
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('全部');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    account: '',
    name: '',
    deptId: 'd-03',
    roleCode: 'STAFF' as RoleCode,
  });

  // Permission matrix state
  const [permMatrix, setPermMatrix] = useState<Record<string, Record<RoleCode, boolean>>>({
    '驾驶舱经营总览': { GM: true, DEPT_ADMIN: false, STAFF: false, OPS: false },
    'RFQ 报价生成与导出': { GM: true, DEPT_ADMIN: true, STAFF: false, OPS: false },
    '查看采购底价与毛利': { GM: true, DEPT_ADMIN: true, STAFF: false, OPS: false },
    '生产周排产下发': { GM: true, DEPT_ADMIN: true, STAFF: true, OPS: false },
    '审核中心批准/驳回': { GM: true, DEPT_ADMIN: true, STAFF: false, OPS: false },
    '智能体 Harness 调试': { GM: true, DEPT_ADMIN: false, STAFF: false, OPS: true },
    '审计日志全量查询': { GM: true, DEPT_ADMIN: false, STAFF: false, OPS: true },
  });

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    return auditLogs.filter((l) => {
      if (logActionFilter !== '全部' && l.action !== logActionFilter) return false;
      return (
        !q ||
        l.userName.toLowerCase().includes(q) ||
        l.objectId.toLowerCase().includes(q) ||
        l.detail.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, logSearch, logActionFilter]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.account.trim() || !newUserForm.name.trim()) return;
    const dept = depts.find((d) => d.id === newUserForm.deptId);
    const role = ROLE_DEFS.find((r) => r.code === newUserForm.roleCode);
    onAddUser({
      id: `u-${Date.now()}`,
      account: newUserForm.account.trim(),
      name: newUserForm.name.trim(),
      deptId: newUserForm.deptId,
      deptName: dept?.name ?? '技术研发部',
      roleCode: newUserForm.roleCode,
      roleName: role?.name ?? '普通员工',
      status: '启用',
      lastLogin: '尚未登录（首次需改密）',
    });
    setShowAddUser(false);
    setNewUserForm({ account: '', name: '', deptId: 'd-03', roleCode: 'STAFF' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg">
          {[
            { key: 'dept' as const, label: `部门 (${depts.length})` },
            { key: 'user' as const, label: `用户 (${users.length})` },
            { key: 'role' as const, label: '角色 (4 类)' },
            { key: 'permission' as const, label: '权限矩阵' },
            { key: 'audit' as const, label: `审计日志 (${auditLogs.length})` },
          ].map((t) => (
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

        {activeTab === 'user' && (
          <button
            type="button"
            onClick={() => setShowAddUser(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-medium hover:bg-[#1F2937] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新建用户账号
          </button>
        )}
      </div>

      {/* 1. Departments (Two-level) */}
      {activeTab === 'dept' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">层级与部门名称</th>
                <th className="py-3 px-3">部门编码</th>
                <th className="py-3 px-3">上级部门</th>
                <th className="py-3 px-3">主管理员</th>
                <th className="py-3 px-4 text-right">编制人数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {depts.map((d) => {
                const parent = depts.find((p) => p.id === d.parentId);
                return (
                  <tr key={d.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-3 px-4 font-medium text-[#111827]">
                      <span className={d.parentId ? 'pl-5 text-[#374151]' : 'font-semibold'}>
                        {d.parentId ? `└ ${d.name}` : d.name}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono-tabular text-[#6B7280]">{d.code}</td>
                    <td className="py-3 px-3 text-[#4B5563]">{parent?.name ?? '一级总部'}</td>
                    <td className="py-3 px-3 text-[#111827]">{d.managerName}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular">{d.memberCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Users (Toggleable enable/disable, never delete) */}
      {activeTab === 'user' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                <th className="py-3 px-4">登录账号</th>
                <th className="py-3 px-3">姓名</th>
                <th className="py-3 px-3">所属部门</th>
                <th className="py-3 px-3">分配角色</th>
                <th className="py-3 px-3">最近登录</th>
                <th className="py-3 px-3">账号状态</th>
                <th className="py-3 px-4 text-right">管理操作（可停用不可删除）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FAFAFB]">
                  <td className="py-3 px-4 font-mono-tabular font-medium text-[#111827]">
                    {u.account}
                  </td>
                  <td className="py-3 px-3 font-medium text-[#111827]">{u.name}</td>
                  <td className="py-3 px-3 text-[#374151]">{u.deptName}</td>
                  <td className="py-3 px-3 text-[#374151]">{u.roleName}</td>
                  <td className="py-3 px-3 font-mono-tabular text-[#6B7280]">{u.lastLogin}</td>
                  <td className="py-3 px-3">
                    <StateTag
                      label={u.status}
                      tone={u.status === '启用' ? 'success' : 'danger'}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleUserStatus(u.id)}
                      className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
                    >
                      {u.status === '启用' ? '停用账号' : '恢复启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. Roles */}
      {activeTab === 'role' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLE_DEFS.map((r) => (
            <div key={r.code} className="rounded-xl border border-[#E5E7EB] bg-white p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#111827]">{r.name}</span>
                <StateTag label={`数据范围：${r.scope}`} tone="info" />
              </div>
              <div className="font-mono-tabular text-[#6B7280]">ROLE_CODE: {r.code}</div>
              <p className="text-[#374151] leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* 4. Permission Matrix */}
      {activeTab === 'permission' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB] flex items-center gap-2 text-xs text-[#374151]">
            <Shield className="w-4 h-4 text-[#10A37F]" />
            <span>按功能点与敏感数据范围两层配置，所有权限变更实时写入审计日志。</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[#6B7280]">
                <th className="py-3 px-4">功能点 / 数据权限项</th>
                {ROLE_DEFS.map((r) => (
                  <th key={r.code} className="py-3 px-4 text-center">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {Object.entries(permMatrix).map(([permName, roleMap]) => (
                <tr key={permName} className="hover:bg-[#FAFAFB]">
                  <td className="py-3 px-4 font-medium text-[#111827]">{permName}</td>
                  {ROLE_DEFS.map((r) => (
                    <td key={r.code} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={roleMap[r.code]}
                        aria-label={`${r.name} - ${permName}`}
                        onChange={(e) => {
                          const nextVal = e.target.checked;
                          setPermMatrix((prev) => ({
                            ...prev,
                            [permName]: { ...prev[permName], [r.code]: nextVal },
                          }));
                          onLogAction(
                            '权限变更',
                            'role_permission',
                            r.code,
                            `${nextVal ? '开启' : '关闭'}「${r.name}」的「${permName}」权限`
                          );
                        }}
                        className="cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. Audit Logs */}
      {activeTab === 'audit' && (
        <div className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="按操作人、单据号、变更详情检索..."
                  aria-label="检索审计日志"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-64"
                />
              </div>
              <select
                value={logActionFilter}
                onChange={(e) => setLogActionFilter(e.target.value)}
                aria-label="筛选行为类型"
                className="px-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-white"
              >
                <option value="全部">全部 7 类行为</option>
                <option value="登录">登录</option>
                <option value="查看敏感单据">查看敏感单据</option>
                <option value="导出">导出</option>
                <option value="修改">修改</option>
                <option value="审核与驳回">审核与驳回</option>
                <option value="权限变更">权限变更</option>
                <option value="模型调用">模型调用</option>
              </select>
            </div>
            <span className="text-xs text-[#6B7280]">不可删除 · 仅总经理与系统运维可查</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAFAFB] text-[#6B7280]">
                  <th className="py-2.5 px-4">时间</th>
                  <th className="py-2.5 px-3">操作人</th>
                  <th className="py-2.5 px-3">行为类别</th>
                  <th className="py-2.5 px-3">对象</th>
                  <th className="py-2.5 px-4">留痕详情（含前后值/Token）</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-2.5 px-4 font-mono-tabular text-[#6B7280] whitespace-nowrap">
                      {log.ts}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-medium text-[#111827]">{log.userName}</span>
                      <span className="text-[#6B7280] ml-1">({log.roleName})</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StateTag
                        label={log.action}
                        tone={
                          log.action === '审核与驳回' || log.action === '权限变更'
                            ? 'warning'
                            : log.action === '模型调用'
                            ? 'info'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#374151] whitespace-nowrap">
                      {log.objectType}:{log.objectId}
                    </td>
                    <td className="py-2.5 px-4 text-[#374151]">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="新建用户"
            className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#111827]">新建系统账号（一人一号）</h3>
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="p-1 rounded hover:bg-[#F3F4F6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-[#374151] mb-1">登录账号 *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.account}
                  onChange={(e) => setNewUserForm({ ...newUserForm, account: e.target.value })}
                  placeholder="例如：zhao.min"
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium text-[#374151] mb-1">员工姓名 *</label>
                <input
                  type="text"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="例如：赵敏"
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#374151] mb-1">部门</label>
                  <select
                    value={newUserForm.deptId}
                    onChange={(e) => setNewUserForm({ ...newUserForm, deptId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                  >
                    {depts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#374151] mb-1">角色</label>
                  <select
                    value={newUserForm.roleCode}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, roleCode: e.target.value as RoleCode })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white"
                  >
                    {ROLE_DEFS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#111827] text-white font-medium cursor-pointer"
                >
                  创建账号
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
