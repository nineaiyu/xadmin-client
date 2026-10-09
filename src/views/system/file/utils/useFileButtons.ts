import { shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { openDialogDrawer, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import uploadForm from "../components/FileUpload.vue";
import { buildFileRowButtons } from "./fileRowActions";
import Upload from "~icons/ep/upload";
import Tag from "~icons/ri/price-tag-3-line";
import type { systemUploadFileApi } from "@/api/file/file";
import type { useI18n } from "vue-i18n";
import type { useTagAssign } from "@/views/system/components/useTagAssign";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 文件列表按钮装配（自 hook.tsx 抽出）：行操作（下载/访问记录/打标，见
 * fileRowActions.ts）与工具栏（上传登记 / 批量打标）。
 */
export function useFileButtons({
  t,
  api,
  tableRef,
  auth,
  canAssignTags,
  selectedNum,
  handleBatchTags,
  loadStats,
  openTagDialog
}: {
  t: TFunction;
  api: UnwrapNestedRefs<typeof systemUploadFileApi>;
  tableRef: Ref;
  auth: { upload?: boolean };
  canAssignTags: boolean;
  selectedNum: Ref<number>;
  handleBatchTags: () => void;
  loadStats: (fresh?: boolean) => void;
  openTagDialog: ReturnType<typeof useTagAssign>["openTagDialog"];
}) {
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 280,
    buttons: buildFileRowButtons({ t, api, canAssignTags, openTagDialog })
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        code: "upload",
        text: t("systemUploadFile.upload"),
        props: {
          type: "success",
          icon: useRenderIcon(Upload)
        },
        onClick: () => {
          openDialogDrawer({
            t,
            title: t("systemUploadFile.upload"),
            rawRow: {},
            rawColumns: [],
            dialogDrawerOptions: { width: "600px", hideFooter: true },
            minWidth: "600px",
            form: uploadForm,
            props: {
              // 弹层 props 的函数值会被 openDialogDrawer 立即求值（resolveSpec），
              // 因此这里返回一个带 handleGetData 的对象；上传成功后同时刷新
              // 列表与顶部配额卡片（upload.vue 消费 handleGetData）
              tableRef: () => ({
                handleGetData: () => {
                  tableRef.value?.handleGetData?.();
                  loadStats(true);
                }
              })
            }
          });
        },
        // 上传入口只看上传权限：config 权限只影响上传弹层内的配置读取
        // （无 config 权限时 FileUpload 弹层回退默认大小限制并提示）
        show: auth.upload,
        index: 3
      },
      {
        // 批量打标：勾选后一次性追加/移除/替换（与用户管理页同一弹窗）
        text: t("tag.batchAssignTitle"),
        code: "batchTags",
        props: {
          type: "primary",
          icon: useRenderIcon(Tag),
          plain: true
        },
        onClick: () => handleBatchTags(),
        show: () => Boolean(canAssignTags && selectedNum.value)
      }
    ]
  });

  return { operationButtonsProps, tableBarButtonsProps };
}
