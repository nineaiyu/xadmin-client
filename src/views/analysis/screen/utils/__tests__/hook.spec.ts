import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { RecordType } from "plus-pro-components";
import type { ButtonsCallBackParams } from "@/components/RePlusPage/src/components/ButtonOperation/src/types";

vi.mock("vue-i18n", async importOriginal => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, te: () => false })
  };
});

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/router/utils", () => ({
  hasAuth: () => true,
  usePageAuth: () => ({ create: false, update: false, partialUpdate: false })
}));

vi.mock("@/api/dataset/analysis", () => ({
  screenApi: {
    list: vi.fn(),
    create: vi.fn(),
    partialUpdate: vi.fn(),
    command: vi.fn()
  },
  listDashboards: vi.fn().mockResolvedValue([{ pk: "d1", name: "可见仪表盘" }])
}));

vi.mock("@/components/ReDialog", () => ({
  addDialog: vi.fn(),
  closeDialog: vi.fn()
}));
vi.mock("@/components/ReDialog/size", () => ({ dialogSize: (v: string) => v }));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/utils/dict", () => ({
  choiceValue: (v: unknown) => v,
  statusTagProps: () => ({})
}));
vi.mock("@/components/RePlusPage", () => ({
  formatPageColumns: (cols: unknown) => cols
}));

vi.mock("../components/ScreenForm.vue", () => ({
  default: { name: "ScreenForm", render: () => null }
}));
vi.mock("../components/ScreenControlForm.vue", () => ({
  default: { name: "ScreenControlForm", render: () => null }
}));

import { addDialog } from "@/components/ReDialog";
import { useScreen } from "../hook";

/** 用最小宿主组件承载 composable（onMounted 需要组件上下文） */
async function setup() {
  const { createApp, defineComponent, h } = await import("vue");
  const bag: Record<string, unknown> = {};
  const host = defineComponent({
    setup(_, { expose }) {
      const api = useScreen(ref());
      bag.api = api;
      expose(api);
      return () => h("div");
    }
  });
  const root = document.createElement("div");
  const app = createApp(host);
  app.mount(root);
  await nextTick();
  app.unmount();
  return bag.api as ReturnType<typeof useScreen>;
}

/** 行内「远程控制」按钮触发后，弹窗内容组件收到的 dashboards 映射 */
async function controlDashboardsOf(row: RecordType) {
  const { operationButtonsProps } = await setup();
  const button = (operationButtonsProps.value.buttons ?? []).find(
    item => item.code === "command"
  );
  expect(button, "command button should exist").toBeTruthy();
  button!.onClick!({
    e: new MouseEvent("click"),
    row,
    loading: { value: false },
    buttonRow: button!
  } satisfies ButtonsCallBackParams);
  expect(addDialog).toHaveBeenCalledTimes(1);
  const options = (addDialog as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
    contentRenderer: () => { props: { dashboards: { pk: string }[] } };
  };
  return options.contentRenderer().props.dashboards;
}

describe("useScreen 远程控制弹窗的仪表盘名称映射", () => {
  it("可见仪表盘映射名称，不可见仪表盘回落显式占位文案（不裸出 pk）", async () => {
    vi.mocked(addDialog).mockClear();
    const dashboards = await controlDashboardsOf({
      pk: "s1",
      name: "大屏",
      dashboards: ["d1", "d-missing"]
    });
    expect(dashboards).toEqual([
      { pk: "d1", name: "可见仪表盘" },
      { pk: "d-missing", name: "dataScreen.dashboardHidden" }
    ]);
  });
});
