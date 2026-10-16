import { afterEach, beforeEach, vi } from "vitest";

// jsdom 中缺失的浏览器 API（element-plus / responsive-storage 依赖），统一补齐
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

class ResizeObserverMock {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  observe(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  unobserve(): void {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserverMock;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
