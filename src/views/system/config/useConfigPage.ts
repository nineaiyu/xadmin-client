import { shallowRef, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { ApiResult } from "@/api/types";
import CircleClose from "~icons/ep/circle-close";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 配置页可清除缓存的接口形态（系统配置 / 用户配置共用） */
interface ConfigCacheApi {
  invalid: (pk: string | number) => Promise<ApiResult>;
}

/**
 * 配置页共用壳：系统配置与用户配置两页 hook 结构高度一致，差异仅在权限后缀
 * （由调用页组件名 SystemConfig / UserConfig 推导）与文案；此壳收敛权限表装配
 * 与「清除缓存」行内按钮（确认 / loading / 成功后刷新口径）。
 *
 * 页面专有装配仍留在各自 hook：系统配置的注册键候选提示、用户配置的 owner
 * 跳转列与用户维度编辑项。
 */
export function useConfigPage(options: {
  t: TFunction;
  api: ConfigCacheApi;
  tableRef: Ref;
  invalidText: string;
  invalidConfirmTitle: string;
}) {
  const { t, api, tableRef } = options;
  // 权限后缀取当前页组件名，invalid 位随之推导（invalid:SystemConfig / invalid:UserConfig）
  const auth = usePageAuth(["invalid"]);

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 250,
    buttons: [
      {
        text: options.invalidText,
        code: "invalid",
        confirm: { title: options.invalidConfirmTitle },
        props: {
          type: "danger",
          icon: useRenderIcon(CircleClose),
          link: true
        },
        onClick: ({ row, loading }) => {
          loading.value = true;
          handleOperation({
            t,
            apiReq: api.invalid(row?.pk ?? row?.id),
            success() {
              tableRef.value.handleGetData();
            },
            requestEnd() {
              loading.value = false;
            }
          });
        },
        index: 3,
        show: auth.invalid
      },
      {
        code: "detail",
        show: false
      }
    ]
  });

  return { auth, operationButtonsProps };
}
