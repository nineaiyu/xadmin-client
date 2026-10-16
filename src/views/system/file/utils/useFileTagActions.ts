import { ref } from "vue";
import { hasAuth } from "@/router/utils";
import { useTagAssign } from "@/views/system/components/useTagAssign";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";
import type { RecordType } from "plus-pro-components";
import type { Ref } from "vue";

/**
 * 文件通用标签动作：行内打标（单对象全量替换）与工具栏批量打标（追加语义）。
 * 自 useSystemUploadFile 拆出（行为不变）：共用同一弹窗；入口按全局 assign:Tag
 * 权限点显示，对象级 update 权限由后端逐对象复核。
 */
export function useFileTagActions({ tableRef }: { tableRef: Ref }) {
  const canAssignTags = hasAuth("assign:Tag");
  const { openTagDialog } = useTagAssign(tableRef);
  const selectedNum = ref(0);
  const manySelectData = ref<RecordType[]>([]);
  const selectionChange = (rows: RecordType[]) => {
    manySelectData.value = rows;
    selectedNum.value = rows.length ?? 0;
  };

  /** 批量打标（追加语义，避免覆盖各文件既有标签） */
  const handleBatchTags = () => {
    openTagDialog({
      resource: TAGGABLE_RESOURCE.file,
      pks: manySelectData.value.map(item => String(item.pk))
    });
  };

  return {
    canAssignTags,
    openTagDialog,
    selectedNum,
    handleBatchTags,
    selectionChange
  };
}
