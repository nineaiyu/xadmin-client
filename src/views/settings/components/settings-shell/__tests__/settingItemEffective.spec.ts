import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getColumnData: vi.fn(),
  retrieve: vi.fn()
}));

vi.mock("@/components/RePlusPage", () => ({
  useBaseColumns: () => ({ getColumnData: state.getColumnData }),
  handleOperation: vi.fn()
}));
vi.mock("plus-pro-components", () => ({
  PlusForm: { name: "PlusForm", template: "<form><slot /></form>" }
}));
vi.mock("@vueuse/core", () => ({ useMediaQuery: () => false }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      key + (params?.name ? `:${String(params.name)}` : "")
  })
}));

import SettingItem from "../SettingItem.vue";

/**
 * 设置项「实际生效状态」诊断横幅:retrieve/保存响应携带 effective 时渲染
 * 生效/未生效告警;诊断是保留键,不得混入表单 formData(否则随保存回传)。
 */
const api = {
  columns: vi.fn(),
  create: vi.fn(),
  retrieve: state.retrieve,
  partialUpdate: vi.fn()
};

const mountItem = () =>
  mount(SettingItem, {
    props: {
      api: api as never,
      auth: { retrieve: true, partialUpdate: true },
      localeName: "settingA"
    },
    global: {
      stubs: {
        "el-button": true,
        "el-alert": {
          props: ["type"],
          template: `<div class="alert-stub" :class="'el-alert--' + type">
            <div class="alert-stub__title"><slot name="title" /></div>
            <slot />
          </div>`
        }
      }
    }
  });

beforeEach(() => {
  vi.clearAllMocks();
  state.retrieve.mockResolvedValue({ code: 1000, data: {} });
  // retrieve 的处理链挂在列元数据回调内(两请求并行后汇合),mock 必须回调
  state.getColumnData.mockImplementation(
    (
      _api: unknown,
      _params: unknown,
      callback: (payload: {
        addOrEditRules: { value: Record<string, never> };
        addOrEditColumns: { value: unknown[] };
        addOrEditDefaultValue: { value: Record<string, never> };
      }) => void
    ) => {
      callback({
        addOrEditRules: { value: {} },
        addOrEditColumns: { value: [] },
        addOrEditDefaultValue: { value: {} }
      });
      return Promise.resolve();
    }
  );
});

describe("SettingItem 实际生效状态诊断", () => {
  it("未下发 effective:不渲染告警", async () => {
    const wrapper = mountItem();
    await flushPromises();

    expect(wrapper.find('[data-testid="setting-effective"]').exists()).toBe(
      false
    );
  });

  it("未生效:warning 告警带原因;诊断键不混入表单", async () => {
    state.retrieve.mockResolvedValue({
      code: 1000,
      data: {
        SECURITY_REGISTER_ACCESS_ENABLED: true,
        effective: {
          items: [
            {
              title: "注册",
              enabled: false,
              reasons: ["邮件服务未开启"],
              notices: []
            }
          ]
        }
      }
    });
    const wrapper = mountItem();
    await flushPromises();

    const alert = wrapper.find('[data-testid="setting-effective"]');
    expect(alert.exists()).toBe(true);
    expect(alert.classes()).toContain("el-alert--warning");
    expect(alert.text()).toContain("setting.effectiveBlocked:注册");
    expect(alert.text()).toContain("邮件服务未开启");
    // 保留键不进表单载荷
    expect(JSON.stringify(wrapper.find("form").html())).not.toContain(
      "effective"
    );
  });

  it("已生效且无风险:success 告警", async () => {
    state.retrieve.mockResolvedValue({
      code: 1000,
      data: {
        effective: { items: [{ title: "注册", enabled: true, notices: [] }] }
      }
    });
    const wrapper = mountItem();
    await flushPromises();

    const alert = wrapper.find('[data-testid="setting-effective"]');
    expect(alert.classes()).toContain("el-alert--success");
    expect(alert.text()).toContain("setting.effectiveOk:注册");
  });

  it("已生效但有风险提示:warning 告警展示 notices", async () => {
    state.retrieve.mockResolvedValue({
      code: 1000,
      data: {
        effective: {
          items: [
            {
              title: "邮件服务",
              enabled: true,
              reasons: [],
              notices: ["SMTP 服务器地址（EMAIL_HOST）未配置"]
            }
          ]
        }
      }
    });
    const wrapper = mountItem();
    await flushPromises();

    const alert = wrapper.find('[data-testid="setting-effective"]');
    expect(alert.classes()).toContain("el-alert--warning");
    expect(alert.text()).toContain("setting.effectiveOk:邮件服务");
    expect(alert.text()).toContain("EMAIL_HOST");
  });

  it("refreshKey 变化只重取诊断并刷新横幅", async () => {
    state.retrieve
      .mockResolvedValueOnce({
        code: 1000,
        data: {
          effective: {
            items: [{ title: "短信服务", enabled: false, reasons: ["未开启"] }]
          }
        }
      })
      .mockResolvedValueOnce({
        code: 1000,
        data: {
          effective: {
            items: [{ title: "短信服务", enabled: true, notices: [] }]
          }
        }
      });
    const wrapper = mountItem();
    await flushPromises();
    expect(
      wrapper.find('[data-testid="setting-effective"]').classes()
    ).toContain("el-alert--warning");

    await wrapper.setProps({ refreshKey: 1 });
    await flushPromises();

    expect(state.retrieve).toHaveBeenCalledTimes(2);
    expect(
      wrapper.find('[data-testid="setting-effective"]').classes()
    ).toContain("el-alert--success");
  });
});
