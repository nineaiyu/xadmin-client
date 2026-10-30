import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/dataset/analysis", () => ({
  screenApi: { partialUpdate: vi.fn() }
}));
vi.mock("@/utils/message", () => ({ message: vi.fn() }));
vi.mock("@/hooks/useConfirm", () => ({ useConfirm: () => async () => true }));

import {
  screenApi,
  type ScreenItem,
  type ScreenLayoutPane
} from "@/api/dataset/analysis";
import type { DetailResult } from "@/api/types";
import { message } from "@/utils/message";
import { useScreenPersistence } from "../useScreenPersistence";

/**
 * 设计器落库动作：保存的 dirty 竞态防护与空 URL 媒体窗格预检。
 *
 * - dirty 竞态：保存往返期间的新编辑未进载荷，成功回调不得清 dirty
 *   （否则离开拦截失效 → RTT 内编辑被静默判已存）；
 * - 空 URL 预检：媒体窗格（image/video/html）未填地址时服务端必拒，
 *   保存载荷剔除之并提示，画布保留该窗格供继续编辑。
 */

const pane = (extra: Partial<ScreenLayoutPane> = {}): ScreenLayoutPane =>
  ({
    pk: "p1",
    type: "text",
    x: 0,
    y: 0,
    w: 6,
    h: 2,
    text: "标题",
    ...extra
  }) as ScreenLayoutPane;

const okResponse: DetailResult<null> = { code: 1000, detail: "", data: null };

/** 组装被测 hook：editSeq 由本地计数器驱动（与 designer.vue 的 markDirty 口径一致） */
function setup(
  initialPanes: ScreenLayoutPane[],
  isFree = false,
  layoutVersion?: number
) {
  let seq = 0;
  const dirty = ref(false);
  const screen = ref<ScreenItem>({
    pk: "s1",
    name: "大屏",
    dashboards: [],
    interval: 0,
    refresh: 0,
    visibility: "personal",
    ...(layoutVersion !== undefined ? { layout_version: layoutVersion } : {})
  });
  const gridPanes = ref<ScreenLayoutPane[]>(isFree ? [] : initialPanes);
  const freePanes = ref<ScreenLayoutPane[]>(isFree ? initialPanes : []);
  const freePayloadReceived: ScreenLayoutPane[][] = [];
  const api = useScreenPersistence({
    t: key => key,
    screen,
    saving: ref(false),
    dirty,
    readonly: ref(false),
    preview: ref(false),
    isFree: ref(isFree),
    activePanes: isFree ? freePanes : gridPanes,
    gridPanes,
    freePanes,
    theme: () => ({ theme: "dark", theme_color: "" }),
    freePayload: panes => {
      freePayloadReceived.push(panes);
      return { design_w: 1920, design_h: 1080, panes };
    },
    editSeq: () => seq,
    pushHistory: vi.fn(),
    resetCoalesce: vi.fn(),
    clearSelection: vi.fn()
  });
  return {
    api,
    dirty,
    screen,
    gridPanes,
    freePayloadReceived,
    /** 模拟 designer.vue 的 markDirty：标脏 + 编辑序号前进 */
    markDirty: () => {
      dirty.value = true;
      seq += 1;
    }
  };
}

const savePayload = () =>
  vi.mocked(screenApi.partialUpdate).mock.calls[0][1] as {
    layout?: ScreenLayoutPane[];
    free_layout?: { panes: ScreenLayoutPane[] };
    base_version?: number;
  };

describe("useScreenPersistence：保存与 dirty 竞态", () => {
  it("保存成功且期间无新编辑 → 清 dirty", async () => {
    const { api, dirty } = setup([pane()]);
    vi.mocked(screenApi.partialUpdate).mockResolvedValue(okResponse);
    await api.save();
    expect(dirty.value).toBe(false);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.layoutSaved",
      expect.anything()
    );
  });

  it("保存请求在途期间的新编辑不被清掉 dirty（慢请求 + 保存期间改动）", async () => {
    const { api, dirty, markDirty } = setup([pane()]);
    let resolveSave: (value: DetailResult<null>) => void = () => undefined;
    vi.mocked(screenApi.partialUpdate).mockImplementation(
      () =>
        new Promise<DetailResult<null>>(resolve => {
          resolveSave = resolve;
        })
    );
    const pending = api.save();
    // 保存发起后（载荷已快照）用户继续编辑：dirty 置位 + 编辑序号前进
    markDirty();
    expect(dirty.value).toBe(true);
    resolveSave(okResponse);
    await pending;
    // 成功回调只清「发起时已入载荷」的 dirty：在途编辑必须保留
    expect(dirty.value).toBe(true);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.layoutSaved",
      expect.anything()
    );
  });

  it("保存携带布局版本基线，成功后回写服务端新版本", async () => {
    const { api, screen } = setup([pane()], false, 3);
    vi.mocked(screenApi.partialUpdate).mockResolvedValue({
      code: 1000,
      detail: "",
      data: { ...screen.value, layout_version: 4 }
    });
    await api.save();
    expect(savePayload().base_version).toBe(3);
    expect(screen.value.layout_version).toBe(4);
  });

  it("保存失败不清 dirty", async () => {
    const { api, dirty, markDirty } = setup([pane()]);
    markDirty();
    vi.mocked(screenApi.partialUpdate).mockResolvedValue({
      code: 1001,
      detail: "Value field is required",
      data: null
    });
    await api.save();
    expect(dirty.value).toBe(true);
  });
});

describe("useScreenPersistence：空 URL 媒体窗格保存预检", () => {
  it("未填地址的媒体窗格被剔除出载荷并提示，已填与非媒体窗格保留", async () => {
    const { api, dirty, gridPanes } = setup([
      pane({ pk: "p-filled", type: "image", url: "/media/a.png" }),
      pane({ pk: "p-empty", type: "image", url: "" }),
      pane({ pk: "p-blank", type: "video", url: "   " }),
      pane({ pk: "p-text" })
    ]);
    vi.mocked(screenApi.partialUpdate).mockResolvedValue(okResponse);
    await api.save();
    expect(savePayload().layout?.map(item => item.pk)).toEqual([
      "p-filled",
      "p-text"
    ]);
    expect(vi.mocked(message)).toHaveBeenCalledWith(
      "dataScreen.mediaPanesDropped",
      expect.objectContaining({ type: "warning" })
    );
    // 预检只在载荷层剔除：画布数据原样（窗格保留供继续补地址）
    expect(gridPanes.value).toHaveLength(4);
    expect(dirty.value).toBe(false);
  });

  it("自由模式：预检后的窗格清单传给自由载荷组装", async () => {
    const { api, freePayloadReceived } = setup(
      [pane({ pk: "f-empty", type: "html", url: "" })],
      true
    );
    vi.mocked(screenApi.partialUpdate).mockResolvedValue(okResponse);
    await api.save();
    expect(freePayloadReceived).toHaveLength(1);
    expect(freePayloadReceived[0]).toEqual([]);
    expect(savePayload().free_layout?.panes).toEqual([]);
  });
});
