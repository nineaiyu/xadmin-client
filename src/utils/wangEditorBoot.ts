import type { IModuleConf } from "@wangeditor/editor";

/**
 * 附件菜单插件（uploadAttachment / downloadAttachment）的懒注册入口。
 *
 * 该插件是 webpack 产出的 UMD 包，CJS 导出为 `{ __esModule: true, default: module }`：
 * - Vite 5（esbuild 预打包）会按 __esModule 解包，默认导入即真模块；
 * - Vite 8（rolldown 预打包）不再解包，默认导入拿到 `{ default: module }` 外壳，
 *   传给 Boot.registerModule 会因读不到 menus 而静默跳过注册（不抛错、难排查），
 *   编辑器工具栏随后抛 "Not found menu item factory by key 'uploadAttachment'"，
 *   表现为通知公告等富文本表单的创建页报错。
 * 这里按「取含 menus 的那一层」解包，两种打包行为都可用。
 *
 * 注册时机：必须在创建编辑器之前、且全局只注册一次（HMR 重入时静默跳过）。
 * wangeditor 全量约 1MB，若在应用入口（App.vue）静态注册会整体进入首屏闭包；
 * 这里改为由编辑器的异步组件在挂载前 await 本方法，使编辑器栈整体留在懒加载 chunk。
 */
type AttachmentModuleShape = {
  menus?: unknown;
  default?: unknown;
};

function unwrapAttachmentModule(rawExport: unknown): Partial<IModuleConf> {
  let candidate: unknown = rawExport;
  // 逐层沿 default 链向下找到含 menus 的那一层（最多 4 层，防异常输入死循环）：
  //   import(...)          -> { default: { __esModule: true, default: <真模块> } }
  //   import X from "..."  -> { __esModule: true, default: <真模块> }
  // 动态导入比静态导入多一层 default，固定层级假设曾在联调中失效（附件菜单静默不注册）。
  for (let depth = 0; depth < 4; depth += 1) {
    if (!candidate || typeof candidate !== "object") break;
    const shape = candidate as AttachmentModuleShape;
    if (shape.menus) return candidate as Partial<IModuleConf>;
    if (!shape.default) break;
    candidate = shape.default;
  }
  return candidate as Partial<IModuleConf>;
}

let bootPromise: Promise<void> | undefined;

/** 确保附件插件已注册（幂等；并发调用共享同一次注册） */
export function ensureWangEditorBoot(): Promise<void> {
  bootPromise ??= (async () => {
    const [{ Boot }, attachmentModuleExport] = await Promise.all([
      import("@wangeditor/editor"),
      import("@wangeditor/plugin-upload-attachment")
    ]);
    const attachmentModule = unwrapAttachmentModule(attachmentModuleExport);
    if (!attachmentModule?.menus) {
      // 解包失败必须显式失败：历史上该插件静默跳过注册，表现为工具栏报
      // "Not found menu item factory by key 'uploadAttachment'"，极难定位
      throw new Error(
        "wangeditor 附件插件解包失败：未找到 menus（检查 UMD 互操作层级）"
      );
    }
    try {
      Boot.registerModule(attachmentModule);
    } catch (e) {
      // 重复注册等场景静默跳过（与入口静态注册时期的行为一致）
      console.log(e);
    }
  })();
  return bootPromise;
}
