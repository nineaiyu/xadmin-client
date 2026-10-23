import { h } from "vue";
import { hasAuth } from "@/router/utils";
import { addDrawer } from "@/components/ReDrawer";
import AccessLogPanel from "../components/AccessLogPanel.vue";
import { TAGGABLE_RESOURCE } from "@/api/system/tag";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Download from "~icons/ri/download-2-line";
import History from "~icons/ri/history-line";
import Tag from "~icons/ri/price-tag-3-line";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { systemUploadFileApi } from "@/api/file/file";
import type { UnwrapNestedRefs } from "vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import type { useTagAssign } from "@/views/system/components/useTagAssign";

import { drawerSize } from "@/components/ReDialog/size";
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
    size: drawerSize("md"),
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
 * 下载与访问记录各自挂独立权限点（download / accessLogs:SystemUploadFile）：
 * 无授权时按钮隐藏，避免点击后服务端 403（无权限点时按 `IsAuthenticated` 的
 * 路径匹配 fail-closed 拒绝，与「能看到行即可操作」无关）；行级数据范围仍由
 * 服务端 get_object 数据权限兜底。打标按全局 assign:Tag 权限点显示，
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
      props: { type: "success", icon: useRenderIcon(Download), link: true },
      onClick: async ({ row, loading }) => {
        // 下载走受鉴权端点（服务端记访问审计），不再使用 /media/ 直链
        loading.value = true;
        try {
          await api.download(row?.pk, row?.filename);
        } catch {
          // 失败提示由 http 拦截器统一处理
        } finally {
          loading.value = false;
        }
      },
      show: hasAuth("download:SystemUploadFile")
    },
    {
      text: t("fileAccess.accessLogs"),
      code: "accessLogs",
      props: { type: "info", icon: useRenderIcon(History), link: true },
      onClick: ({ row }) => openAccessLogsDrawer({ t, row: row as RecordType }),
      show: hasAuth("accessLogs:SystemUploadFile")
    },
    {
      // 行内打标：单对象全量替换语义（弹窗内可选标签/就地新建）
      text: t("tag.assignTitle"),
      code: "assignTags",
      props: { type: "warning", icon: useRenderIcon(Tag), link: true },
      onClick: ({ row }) =>
        openTagDialog({
          resource: TAGGABLE_RESOURCE.file,
          row: row as RecordType
        }),
      show: canAssignTags
    }
  ];
}
