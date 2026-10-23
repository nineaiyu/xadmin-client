import { message } from "@/utils/message";
import type { ScreenLayoutPane } from "@/api/dataset/analysis";
import { readFreeLayout } from "./freeLayout";
import { clearCloudClipboard, fetchCloudClipboard } from "./serverTemplates";
import type { TranslateFn } from "./types";

/** 跨设备云剪贴板：读取/清空服务端槽位；粘贴仍复用画布插入链路 */
export function createFreeCloudClipboard({
  t,
  insert
}: {
  t: TranslateFn;
  insert: (panes: ScreenLayoutPane[]) => number;
}) {
  async function pasteFromCloud(): Promise<number> {
    const slot = await fetchCloudClipboard();
    const payload = readFreeLayout(slot?.free_layout ?? null);
    if (payload.panes.length === 0) {
      message(t("dataScreen.clipboardCloudEmpty"), { type: "warning" });
      return 0;
    }
    return insert(payload.panes);
  }

  async function clearCloud(): Promise<boolean> {
    const slot = await fetchCloudClipboard();
    if (!slot) {
      message(t("dataScreen.clipboardCloudEmpty"), { type: "warning" });
      return false;
    }
    const ok = await clearCloudClipboard(slot.pk);
    message(
      t(
        ok
          ? "dataScreen.clipboardCloudCleared"
          : "dataScreen.clipboardCloudClearFailed"
      ),
      { type: ok ? "success" : "warning" }
    );
    return ok;
  }

  return { pasteFromCloud, clearCloud };
}
