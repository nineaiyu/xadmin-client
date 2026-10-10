import { describe, expect, it } from "vitest";

import {
  eventToShortcut,
  formatShortcut,
  isEditableTarget,
  isReservedShortcut,
  matchShortcut,
  parseShortcut,
  sameShortcut
} from "../shortcutKeys";

/** 构造按键事件（jsdom 支持 code 与各修饰位） */
function keydown(
  key: string,
  options: {
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    repeat?: boolean;
    target?: EventTarget;
  } = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code: options.code ?? "",
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    repeat: options.repeat ?? false,
    bubbles: true
  });
  if (options.target) {
    Object.defineProperty(event, "target", { value: options.target });
  }
  return event;
}

describe("parseShortcut", () => {
  it("解析 alt 组合", () => {
    expect(parseShortcut("alt+l")).toMatchObject({ key: "l", alt: true });
  });

  it("大小写不敏感", () => {
    expect(parseShortcut("Alt+L")).toMatchObject({ key: "l", alt: true });
  });

  it("mod 为平台归一修饰键", () => {
    expect(parseShortcut("mod+k")).toMatchObject({ key: "k", mod: true });
  });

  it("解析多修饰键与标点主键", () => {
    expect(parseShortcut("mod+shift+,")).toMatchObject({
      key: ",",
      mod: true,
      shift: true
    });
    expect(parseShortcut("ctrl+alt+delete")).toMatchObject({
      key: "delete",
      ctrl: true,
      alt: true
    });
  });

  it("空串与未知修饰词返回 null", () => {
    expect(parseShortcut("")).toBeNull();
    expect(parseShortcut(undefined)).toBeNull();
    expect(parseShortcut("foo+l")).toBeNull();
  });
});

describe("matchShortcut", () => {
  it("命中完全一致的组合", () => {
    const parsed = parseShortcut("alt+l");
    expect(matchShortcut(keydown("l", { altKey: true }), parsed)).toBe(true);
  });

  it("修饰键多一个或少一个都不命中", () => {
    const parsed = parseShortcut("alt+l");
    expect(
      matchShortcut(keydown("l", { altKey: true, shiftKey: true }), parsed)
    ).toBe(false);
    expect(matchShortcut(keydown("l"), parsed)).toBe(false);
  });

  it("mod 同时接受 Ctrl 与 ⌘", () => {
    const parsed = parseShortcut("mod+k");
    expect(matchShortcut(keydown("k", { ctrlKey: true }), parsed)).toBe(true);
    expect(matchShortcut(keydown("k", { metaKey: true }), parsed)).toBe(true);
    expect(matchShortcut(keydown("k"), parsed)).toBe(false);
  });

  it("shift 组合按大写事件键命中", () => {
    const parsed = parseShortcut("mod+shift+l");
    expect(
      matchShortcut(
        keydown("L", { code: "KeyL", ctrlKey: true, shiftKey: true }),
        parsed
      )
    ).toBe(true);
  });

  it("macOS Option 改写 event.key 时用物理键位兜底", () => {
    const parsed = parseShortcut("alt+l");
    // Option+L 在 macOS 上 event.key 是 "¬"，code 仍是 KeyL
    expect(
      matchShortcut(keydown("¬", { code: "KeyL", altKey: true }), parsed)
    ).toBe(true);
  });

  it("按住不松开的重复事件忽略", () => {
    const parsed = parseShortcut("alt+l");
    expect(
      matchShortcut(keydown("l", { altKey: true, repeat: true }), parsed)
    ).toBe(false);
  });

  it("空解析结果不命中", () => {
    expect(matchShortcut(keydown("l", { altKey: true }), null)).toBe(false);
    expect(
      matchShortcut(keydown("l", { altKey: true }), parseShortcut(""))
    ).toBe(false);
  });
});

describe("eventToShortcut", () => {
  it("Ctrl 组合归一为 mod", () => {
    expect(eventToShortcut(keydown("L", { code: "KeyL", ctrlKey: true }))).toBe(
      "mod+l"
    );
    expect(eventToShortcut(keydown("L", { code: "KeyL", metaKey: true }))).toBe(
      "mod+l"
    );
  });

  it("Alt/Shift 依次追加", () => {
    expect(
      eventToShortcut(
        keydown("L", {
          code: "KeyL",
          ctrlKey: true,
          altKey: true,
          shiftKey: true
        })
      )
    ).toBe("mod+alt+shift+l");
  });

  it("无修饰键返回 null（纯字符键不录制）", () => {
    expect(eventToShortcut(keydown("l", { code: "KeyL" }))).toBeNull();
    expect(
      eventToShortcut(keydown("Shift", { code: "ShiftLeft", shiftKey: true }))
    ).toBeNull();
  });

  it("标点键取 event.key", () => {
    expect(
      eventToShortcut(keydown(",", { code: "Comma", ctrlKey: true }))
    ).toBe("mod+,");
  });

  it("macOS Option 特殊字符用 code 归一", () => {
    expect(eventToShortcut(keydown("¬", { code: "KeyL", altKey: true }))).toBe(
      "alt+l"
    );
  });

  it("特殊键名可录制", () => {
    expect(
      eventToShortcut(keydown("ArrowUp", { code: "ArrowUp", ctrlKey: true }))
    ).toBe("mod+arrowup");
  });
});

describe("isReservedShortcut", () => {
  it("mod + 危险单键为保留键", () => {
    expect(isReservedShortcut(parseShortcut("mod+s"))).toBe(true);
    expect(isReservedShortcut(parseShortcut("mod+l"))).toBe(true);
    expect(isReservedShortcut(parseShortcut("ctrl+q"))).toBe(true);
  });

  it("带 alt/shift 或非保留键放行", () => {
    expect(isReservedShortcut(parseShortcut("mod+shift+l"))).toBe(false);
    expect(isReservedShortcut(parseShortcut("mod+alt+s"))).toBe(false);
    expect(isReservedShortcut(parseShortcut("alt+l"))).toBe(false);
    expect(isReservedShortcut(parseShortcut("mod+k"))).toBe(false);
  });

  it("空键位视为保留（不可保存）", () => {
    expect(isReservedShortcut(parseShortcut(""))).toBe(true);
  });
});

describe("sameShortcut", () => {
  it("大小写与别名差异视为等价", () => {
    expect(sameShortcut("mod+k", "MOD+K")).toBe(true);
    expect(sameShortcut("alt+l", "Alt+L")).toBe(true);
  });

  it("不同组合不等价", () => {
    expect(sameShortcut("alt+l", "alt+s")).toBe(false);
    expect(sameShortcut("mod+k", "mod+shift+k")).toBe(false);
  });

  it("空串不参与等价判定", () => {
    expect(sameShortcut("", "")).toBe(false);
    expect(sameShortcut(undefined, "alt+l")).toBe(false);
  });
});

describe("formatShortcut", () => {
  it("非 macOS 平台用 + 连接", () => {
    expect(formatShortcut("mod+shift+l", { mac: false })).toBe("Ctrl+Shift+L");
    expect(formatShortcut("alt+l", { mac: false })).toBe("Alt+L");
  });

  it("macOS 平台用符号串", () => {
    expect(formatShortcut("mod+shift+l", { mac: true })).toBe("⌘⇧L");
    expect(formatShortcut("alt+s", { mac: true })).toBe("⌥S");
  });

  it("标点键原样展示，空串返回空文本", () => {
    expect(formatShortcut("mod+,", { mac: false })).toBe("Ctrl+,");
    expect(formatShortcut("", { mac: false })).toBe("");
  });
});

describe("isEditableTarget", () => {
  it("输入控件与可编辑区域返回 true", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(isEditableTarget(keydown("l", { target: input }))).toBe(true);
    expect(isEditableTarget(keydown("l", { target: textarea }))).toBe(true);
    expect(isEditableTarget(keydown("l", { target: editable }))).toBe(true);
  });

  it("普通元素返回 false", () => {
    const div = document.createElement("div");
    expect(isEditableTarget(keydown("l", { target: div }))).toBe(false);
    expect(isEditableTarget(keydown("l"))).toBe(false);
  });
});
