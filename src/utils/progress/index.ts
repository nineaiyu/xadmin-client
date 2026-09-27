/**
 * 顶栏加载进度条（自实现，替代已停止维护的 nprogress）。
 *
 * 对外 API 与用法保持不变（`start / done / set / inc / configure`），
 * 实现为一个延迟创建的 `#app-progress` 元素 + rAF 递减递增：
 * - `start`：从 minimum 起跑，并启动 trickle 自动递增（上限 90%）；
 * - `done`：直接推到 100% 并淡出（随后隐藏）；
 * - 主题色随 element-plus 的 `--el-color-primary`（含暗色主题），无额外样式文件。
 *
 * 之所以自实现：nprogress 0.2.0 于 2015 年后停更（无类型、无维护），
 * 而本项目只需要「顶栏细进度条」这一点能力，替换成本远低于长期依赖风险。
 */

type ProgressOptions = {
  /** 初始化时的最小百分比（0-1） */
  minimum?: number;
  /** 自动递增间隔（毫秒） */
  trickleSpeed?: number;
  /** 是否显示右上角转圈（兼容 nprogress 配置，当前实现恒不显示） */
  showSpinner?: boolean;
};

const DEFAULTS: Required<ProgressOptions> = {
  minimum: 0.08,
  trickleSpeed: 200,
  showSpinner: false
};

const MAX_TRICKLE = 0.9;
const DONE_FADE_DELAY = 200;

let options: Required<ProgressOptions> = { ...DEFAULTS };
let bar: HTMLDivElement | null = null;
let status = 0;
let trickleTimer: ReturnType<typeof setInterval> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensureBar(): HTMLDivElement {
  if (bar) return bar;
  const el = document.createElement("div");
  el.id = "app-progress";
  // 内联样式：组件库主题变量在运行期可读，无需额外样式文件与构建期顺序假设
  el.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:100%",
    "height:2px",
    "z-index:9999",
    "pointer-events:none",
    "background:transparent",
    "opacity:0",
    "transition:opacity 200ms linear"
  ].join(";");
  const inner = document.createElement("div");
  inner.className = "app-progress-bar";
  inner.style.cssText = [
    "height:100%",
    "width:0%",
    "background-color:var(--el-color-primary, #409eff)",
    "transition:width 200ms ease",
    "box-shadow:0 0 10px var(--el-color-primary, #409eff), 0 0 5px var(--el-color-primary, #409eff)"
  ].join(";");
  el.appendChild(inner);
  document.body.appendChild(el);
  bar = el;
  return el;
}

function render() {
  if (!bar) return;
  const inner = bar.querySelector<HTMLDivElement>(".app-progress-bar");
  if (inner) inner.style.width = `${Math.max(0, Math.min(status, 1)) * 100}%`;
}

function clearTimers() {
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function start() {
  clearTimers();
  const el = ensureBar();
  el.style.transition = "opacity 200ms linear";
  el.style.opacity = "1";
  status = Math.max(options.minimum, 0);
  render();
  trickleTimer = setInterval(() => {
    if (!bar) return;
    // 自动递增：越接近上限步长越小（与 nprogress 的观感一致）
    const remaining = MAX_TRICKLE - status;
    status += Math.max(0.005, remaining * 0.08);
    render();
  }, options.trickleSpeed);
}

function done() {
  clearTimers();
  if (!bar) return;
  status = 1;
  render();
  const el = bar;
  hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    hideTimer = setTimeout(() => {
      status = 0;
      render();
    }, DONE_FADE_DELAY);
  }, DONE_FADE_DELAY);
}

function set(value: number) {
  status = Math.max(0, Math.min(Number(value) || 0, 1));
  if (status > 0) ensureBar().style.opacity = "1";
  render();
}

function inc(amount = 0.01) {
  set(status + amount);
}

function configure(next: ProgressOptions = {}) {
  options = { ...options, ...next };
  return api;
}

const api = { start, done, set, inc, configure };

export default api;
