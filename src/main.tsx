import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center p-6 text-[#111827]">
          <div className="max-w-md w-full rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-3 text-xs">
            <h1 className="text-sm font-semibold text-[#111827]">
              页面初始化异常
            </h1>
            <p className="text-[#4B5563]">
              可能由于本地缓存数据版本不兼容或浏览器拦截脚本导致，请点击下方按钮重置缓存后重试。
            </p>
            <pre className="p-2.5 rounded-lg bg-[#FAFAFB] border border-[#E5E7EB] text-[11px] text-[#B91C1C] overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="px-3.5 py-2 rounded-lg bg-[#111827] text-white font-medium cursor-pointer"
            >
              重置本地缓存并刷新
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
