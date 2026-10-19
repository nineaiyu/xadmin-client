import { describe, expect, it, vi } from "vitest";
import {
  buildMediaSyntax,
  collectDroppedFiles,
  collectPastedFiles,
  createDropState,
  DEFAULT_UPLOAD_SIZE,
  isFileDrag,
  partitionBySize,
  resolveUploadKind,
  runMarkdownUpload,
  uploadTexts,
  type UploadRunnerDeps
} from "../markdownUpload";

function makeFile(name: string, size: number, type = "text/plain") {
  return new File([new Uint8Array(size)], name, { type });
}

function makeDragEvent(files: File[] = [], types: string[] = ["Files"]) {
  return {
    dataTransfer: { files, types }
  } as unknown as DragEvent;
}

function makePasteEvent(items: Array<File | null>) {
  return {
    clipboardData: {
      items: items.map(file => ({
        kind: file ? "file" : "string",
        getAsFile: () => file
      }))
    },
    preventDefault: vi.fn()
  } as unknown as ClipboardEvent;
}

function makeDeps(overrides: Partial<UploadRunnerDeps> = {}) {
  const notify = vi.fn();
  const insert = vi.fn();
  const upload = vi.fn(async () => ({
    code: 1000,
    data: [{ filename: "a.png", access_url: "/media/a.png" }]
  }));
  const onStart = vi.fn();
  const onDone = vi.fn();
  const deps: UploadRunnerDeps = {
    canUpload: true,
    sizeLimit: DEFAULT_UPLOAD_SIZE,
    upload,
    insert,
    notify,
    texts: uploadTexts(key => key, DEFAULT_UPLOAD_SIZE),
    onStart,
    onDone,
    ...overrides
  };
  return { deps, notify, insert, upload, onStart, onDone };
}

describe("partitionBySize", () => {
  it("上限按 ≤ 判定，超限进入 rejected 且保持原顺序", () => {
    const exact = makeFile("exact.txt", 100);
    const over = makeFile("over.txt", 101);
    const small = makeFile("small.txt", 1);
    const { valid, rejected } = partitionBySize([over, exact, small], 100);
    expect(valid.map(file => file.name)).toEqual(["exact.txt", "small.txt"]);
    expect(rejected.map(file => file.name)).toEqual(["over.txt"]);
  });
});

describe("resolveUploadKind", () => {
  it("显式 kind 优先于 MIME 判定", () => {
    expect(
      resolveUploadKind(makeFile("a.png", 1, "image/png"), "attachment")
    ).toBe("attachment");
  });

  it("未显式指定时按 MIME 前缀判定", () => {
    expect(resolveUploadKind(makeFile("a.png", 1, "image/png"))).toBe("image");
    expect(resolveUploadKind(makeFile("a.pdf", 1, "application/pdf"))).toBe(
      "attachment"
    );
  });
});

describe("buildMediaSyntax", () => {
  it("图片生成内联语法，附件生成链接语法，URL 用尖括号包裹", () => {
    const record = { filename: "图 1.png", access_url: "/media/a b.png" };
    expect(buildMediaSyntax(record, "image", "fallback.png")).toBe(
      "![图 1.png](</media/a b.png>)"
    );
    expect(buildMediaSyntax(record, "attachment", "fallback.pdf")).toBe(
      "[图 1.png](</media/a b.png>)"
    );
  });

  it("无 filename 时回落到原始文件名，且剔除会截断链接文案的方括号", () => {
    expect(
      buildMediaSyntax({ access_url: "/media/x" }, "attachment", "a[1].txt")
    ).toBe("[a1.txt](</media/x>)");
  });
});

describe("isFileDrag / collectDroppedFiles / collectPastedFiles", () => {
  it("仅携带 Files 的拖拽进入上传态", () => {
    expect(isFileDrag(makeDragEvent([], ["Files"]))).toBe(true);
    expect(isFileDrag(makeDragEvent([], ["text/plain"]))).toBe(false);
    expect(isFileDrag({ dataTransfer: null } as unknown as DragEvent)).toBe(
      false
    );
  });

  it("拖拽取全部文件，粘贴只取文件项并滤掉 getAsFile 的空值", () => {
    const a = makeFile("a.txt", 2);
    const b = makeFile("b.txt", 2);
    expect(collectDroppedFiles(makeDragEvent([a, b]))).toEqual([a, b]);
    expect(collectPastedFiles(makePasteEvent([a, null, b]))).toEqual([a, b]);
    expect(
      collectDroppedFiles({ dataTransfer: null } as unknown as DragEvent)
    ).toEqual([]);
  });
});

describe("createDropState", () => {
  it("深度计数抵消子元素成对事件，reset 归零", () => {
    const state = createDropState(() => true);
    const event = makeDragEvent();
    state.onDragEnter(event);
    state.onDragEnter(event);
    expect(state.dragActive.value).toBe(true);
    state.onDragLeave();
    expect(state.dragActive.value).toBe(true);
    state.onDragLeave();
    expect(state.dragActive.value).toBe(false);
    state.onDragEnter(event);
    state.reset();
    expect(state.dragActive.value).toBe(false);
    // reset 后单次 leave 不会变负，也不会重新点亮
    state.onDragLeave();
    expect(state.dragActive.value).toBe(false);
  });

  it("无权限或拖拽非文件时不进入上传态", () => {
    const disabled = createDropState(() => false);
    disabled.onDragEnter(makeDragEvent());
    expect(disabled.dragActive.value).toBe(false);

    const enabled = createDropState(() => true);
    enabled.onDragEnter(makeDragEvent([], ["text/plain"]));
    expect(enabled.dragActive.value).toBe(false);
  });
});

describe("uploadTexts", () => {
  it("超大提示带可读的体积上限，失败提示拼接后端 detail", () => {
    const texts = uploadTexts(key => key, 1024);
    expect(texts.tooLarge).toContain("systemUploadFile.uploadTip");
    expect(texts.tooLarge).toContain("KB");
    expect(texts.failed("backend detail")).toContain("backend detail");
    expect(texts.failed()).toContain("results.failed");
  });
});

describe("runMarkdownUpload", () => {
  it("无上传权限时只提示，不发起请求", async () => {
    const { deps, notify, upload } = makeDeps({ canUpload: false });
    await runMarkdownUpload([makeFile("a.txt", 1)], deps);
    expect(notify).toHaveBeenCalledWith(
      "systemNotice.markdownUploadNoPermission",
      "warning"
    );
    expect(upload).not.toHaveBeenCalled();
  });

  it("超限文件被拦下并提示，仅上传合规文件", async () => {
    const { deps, notify, upload, onStart, onDone } = makeDeps({
      sizeLimit: 4
    });
    await runMarkdownUpload(
      [makeFile("big.txt", 5), makeFile("ok.txt", 4)],
      deps
    );
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("systemUploadFile.uploadTip"),
      "warning"
    );
    expect(upload).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(1);
    expect(onDone).toHaveBeenCalledWith(1);
  });

  it("全部超限时不计数、不请求", async () => {
    const { deps, upload, onStart, onDone } = makeDeps({ sizeLimit: 1 });
    await runMarkdownUpload([makeFile("big.txt", 2)], deps);
    expect(upload).not.toHaveBeenCalled();
    expect(onStart).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("上传成功按顺序插入 Markdown，类型按 MIME / 显式 kind 判定", async () => {
    const { deps, insert } = makeDeps();
    const image = makeFile("p.png", 1, "image/png");
    await runMarkdownUpload([image], deps);
    expect(insert).toHaveBeenCalledWith("![a.png](</media/a.png>)");

    await runMarkdownUpload([makeFile("p.pdf", 1)], deps, "attachment");
    expect(insert).toHaveBeenLastCalledWith("[a.png](</media/a.png>)");
  });

  it("业务码失败时提示后端 detail，且不插入语法", async () => {
    const { deps, notify, insert } = makeDeps({
      upload: vi.fn(async () => ({ code: 1001, detail: "无权限", data: [] }))
    });
    await runMarkdownUpload([makeFile("a.txt", 1)], deps);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("无权限"),
      "error"
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("请求抛错时提示失败，后续文件继续上传", async () => {
    const upload = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        code: 1000,
        data: [{ filename: "b.png", access_url: "/media/b.png" }]
      });
    const { deps, notify, insert, onDone } = makeDeps({ upload });
    await runMarkdownUpload(
      [makeFile("a.png", 1, "image/png"), makeFile("b.png", 1, "image/png")],
      deps
    );
    expect(notify).toHaveBeenCalledWith(
      "systemNotice.markdownUploadFailed",
      "error"
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(2);
  });
});
