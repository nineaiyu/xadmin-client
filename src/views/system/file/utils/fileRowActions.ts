import { h } from "vue";
import { addDrawer } from "@/components/ReDrawer";
import AccessLogPanel from "../components/AccessLogPanel.vue";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { systemUploadFileApi } from "@/api/file/file";
import type { UnwrapNestedRefs } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import type { useTagAssign } from "@/views/system/components/useTagAssign";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 访问记录抽屉（上传 / 下载 / 预览 / 删除留痕） */
export function openAccessLogsDrawer({
  t,
  row
}: {
  t: TFunction;
  row: RecordType;
}) {
  addDrawer({
    title: t("fileAccess.accessLogsTitle", { name: row?.filename ?? "" }),
    size: "50%",
    destroyOnClose: true,
    hideFooter: true,
    props: { row },
    contentRenderer: () => h(AccessLogPanel)
  });
}

/**
 * 文件列表行操作按钮（自 hook.tsx 抽出）：下载（受鉴权端点，服务端记访问
 * 审计）/ 访问记录 / 行内打标。
 *
 * 前两者无页面级权限点：属行级能力（服务端 get_object 数据权限 fail-closed +
 * 访问审计），能看到该行即可操作；打标按全局 assign:Tag 权限点显示，
 * 对象级 update 权限由后端逐对象复核。
 */
export function buildFileRowButtons({
  t,
  api,
  canAssignTags,
  openTagDialog
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof systemUploadFileApi>;
  canAssignTags: boolean;
  openTagDialog: ReturnType<typeof useTagAssign>["openTagDialog"];
}): OperationButtonsRow[] {
  return [
    {
      text: t("fileAccess.download"),
      code: "download",
      props: { type: "success", link: true },
      onClick: async ({ row }) => {
        // 下载走受鉴权端点（服务端记访问审计），不再使用 /media/ 直链
        await api.download(row?.pk, row?.filename);
      },
      show: true
    },
    {
      text: t("fileAccess.accessLogs"),
      code: "accessLogs",
      props: { type: "info", link: true },
      onClick: ({ row }) => openAccessLogsDrawer({ t, row: row as RecordType }),
      show: true
    },
    {
      // 行内打标：单对象全量替换语义（弹窗内可选标签/就地新建）
      text: t("tag.assignTitle"),
      code: "assignTags",
      props: { type: "warning", link: true },
      onClick: ({ row }) =>
        openTagDialog({
          resource: TAGGABLE_RESOURCE.file,
          row: row as RecordType
        }),
      show: canAssignTags
    }
  ];
}
