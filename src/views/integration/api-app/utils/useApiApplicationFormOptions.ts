import { ref, shallowRef } from "vue";
import type {
  ApiApplicationCredential,
  ApiApplicationGrant
} from "@/api/identity/open";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import {
  buildApiApplicationColumns,
  joinListText,
  splitListText
} from "./apiApplicationFormColumns";
import {
  createApiApplicationSubmit,
  pickGrants
} from "./apiApplicationFormSubmit";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * API 应用表单（混合形态）：
 * - 基础字段全部来自后端元数据（名称 / 限流 / 配额 / 回调 / 启停）；
 * - 列定制（接口范围勾选器、清单字段文本化、授权扩展字段）见
 *   apiApplicationFormColumns.ts；
 * - 保存链路（主记录 + 授权端点、失败语义）见 apiApplicationFormSubmit.ts；
 * - 本 hook 只负责跨调用状态（授权加载状态 / 待写入规则）与 `beforeSubmit` 归一。
 */
export function useApiApplicationFormOptions({
  t,
  openCredential
}: {
  t: TFunction;
  openCredential: (data: ApiApplicationCredential) => void;
}) {
  /** 授权规则是否已成功加载（false = 提交时跳过授权保存，绝不覆盖为空） */
  const grantsLoaded = ref(true);
  /** 本次提交要写入的授权规则（已归一） */
  const pendingGrants = ref<ApiApplicationGrant[]>([]);

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        ip_allowlist: ({ rawRow }: { rawRow?: RecordType }) =>
          joinListText(rawRow?.ip_allowlist),
        callback_urls: ({ rawRow }: { rawRow?: RecordType }) =>
          joinListText(rawRow?.callback_urls)
      },
      columns: buildApiApplicationColumns({ t, grantsLoaded }),
      beforeSubmit: ({ formData }) => {
        formData.ip_allowlist = splitListText(formData.ip_allowlist);
        formData.callback_urls = splitListText(formData.callback_urls);
        const grants = pickGrants(formData);
        if (grants) pendingGrants.value = grants;
        return formData;
      }
    },
    apiReq: createApiApplicationSubmit({
      t,
      openCredential,
      grantsLoaded,
      pendingGrants
    })
  });

  return { addOrEditOptions };
}
