import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { aiProfileApi, type AiProfileItem } from "@/api/system/ai";
import AiProfileForm from "../components/AiProfileForm.vue";

/**
 * AI 配置档案表格：CRUD + 激活/停用/测试。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + AiProfileForm
 *   （api_key 明文不回显、留空沿用原密钥的语义在表单内收敛）；
 * - 删除保留框架默认入口（带二次确认，天然规避手写「取消仍执行」陷阱）；
 * - is_active 列渲染为彩色 tag（使用中/未激活），与「设为默认/停用」按钮语义一致，
 *   故覆盖框架对 boolean 列的自动开关渲染。
 */
export function useAiProfiles(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(aiProfileApi);
  const auth = reactive({
    ...getDefaultAuths("AiProfile"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:AiProfile");
  const canEdit = hasAuth("partialUpdate:AiProfile");
  const canActivate = hasAuth("activate:AiProfile");
  const canDeactivate = hasAuth("deactivate:AiProfile");
  const canTest = hasAuth("test:AiProfile");
  const canProbe = hasAuth("probe:AiProfile");

  const refresh = () => tableRef.value?.handleGetData();

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "is_active":
          column["cellRenderer"] = ({ row }) => {
            const active = (row as AiProfileItem).is_active;
            return h(
              ElTag,
              { size: "small", type: active ? "success" : "info" },
              () =>
                active ? t("aiConfig.profileOn") : t("aiConfig.profileOff")
            );
          };
          break;
        case "temperature":
        case "max_tokens":
          // 采样参数未配置为 null：与表单「未设置」语义一致
          column["cellRenderer"] = ({ row }) => {
            const value = (row as Record<string, unknown>)[
              column.prop as string
            ];
            return value == null ? t("aiConfig.unset") : String(value);
          };
          break;
        case "purpose":
          column["cellRenderer"] = ({ row }) => {
            const purpose = (row as AiProfileItem).purpose;
            return h(
              ElTag,
              {
                size: "small",
                type: purpose === "structured" ? "warning" : "primary"
              },
              () =>
                purpose === "structured"
                  ? t("aiConfig.purposeStructured")
                  : t("aiConfig.purposeChat")
            );
          };
          break;
        case "capabilities":
          // 能力画像：JSON / 原生工具调用 / 思考内容三项（未探测显示灰 tag）
          column["cellRenderer"] = ({ row }) => {
            const capabilities = ((row as AiProfileItem).capabilities ??
              {}) as Record<string, { ok?: boolean } | undefined>;
            const items: { key: string; label: string }[] = [
              { key: "json", label: t("aiConfig.capJson") },
              { key: "tool_calls", label: t("aiConfig.capToolCalls") },
              { key: "reasoning", label: t("aiConfig.capReasoning") }
            ];
            // 视觉能力（按需探测）：仅在有探测结果时展示，默认形态零变化
            if (capabilities["vision"]) {
              items.push({ key: "vision", label: t("aiConfig.capVision") });
            }
            return h(
              "div",
              { class: "flex flex-wrap gap-1" },
              items.map(item => {
                const entry = capabilities[item.key];
                const type = entry ? (entry.ok ? "success" : "danger") : "info";
                return h(
                  ElTag,
                  { key: item.key, size: "small", type },
                  () => item.label
                );
              })
            );
          };
          break;
      }
    });
    return columns;
  };

  /* ---------------- 新建 / 编辑（ReDialog + AiProfileForm） ---------------- */
  const formRef = ref<InstanceType<typeof AiProfileForm>>();

  const openDialog = (row: AiProfileItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("aiConfig.edit") : t("aiConfig.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(AiProfileForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? aiProfileApi.partialUpdate(row.pk, payload)
            : aiProfileApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("aiConfig.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  /* ---------------- 激活 / 停用 / 测试 ---------------- */
  const confirmThen = async (
    confirmText: string,
    action: () => Promise<{ code: number; detail?: string }>,
    doneText: string
  ) => {
    const ok = await ElMessageBox.confirm(
      confirmText,
      t("aiConfig.profileTitle"),
      {
        type: "warning",
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel")
      }
    )
      .then(() => true)
      .catch(() => false);
    if (!ok) return;
    const res = await action();
    if (res.code === SUCCESS_CODE) {
      message(doneText, { type: "success" });
      refresh();
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  const activate = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.activateConfirm"),
      () => aiProfileApi.activate(row.pk),
      t("aiConfig.activateDone")
    );

  const deactivate = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.deactivateConfirm"),
      () => aiProfileApi.deactivate(row.pk),
      t("aiConfig.deactivateDone")
    );

  const testProfile = async (row: AiProfileItem) => {
    const res = await aiProfileApi.test(row.pk);
    if (res.code === SUCCESS_CODE) {
      message(String(res.detail ?? t("aiConfig.testOk")), { type: "success" });
    } else if (res.detail) {
      message(String(res.detail), { type: "warning" });
    }
  };

  /** 能力探测：结果落档案画像，前端按能力项提示（不阻断使用）
   *  withVision=true 追加多模态探测（默认按钮不触发，避免无多模态模型上的无谓等待） */
  const probeProfile = async (row: AiProfileItem, withVision = false) => {
    const res = await aiProfileApi
      .probe(row.pk, withVision ? { vision: true } : undefined)
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) {
      const data = ((res as { data?: Record<string, { ok?: boolean }> }).data ??
        {}) as Record<string, { ok?: boolean } | undefined>;
      const okList = ["json", "tool_calls", "reasoning"]
        .concat(withVision ? ["vision"] : [])
        .filter(key => data[key]?.ok);
      message(
        `${t("aiConfig.probeDone")}: ${okList.length ? okList.join(" / ") : t("aiConfig.capUnknown")}`,
        { type: "success" }
      );
      refresh();
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  /* ---------------- 按钮装配 ---------------- */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 8,
    width: 430,
    buttons: [
      {
        text: t("aiConfig.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testProfile(row as AiProfileItem),
        show: canTest && 10
      },
      {
        text: t("aiConfig.probe"),
        code: "probe",
        props: { type: "success", link: true },
        onClick: ({ row }) => probeProfile(row as AiProfileItem),
        show: canProbe && 15
      },
      {
        text: t("aiConfig.probeVision"),
        code: "probeVision",
        props: { type: "success", link: true },
        onClick: ({ row }) => probeProfile(row as AiProfileItem, true),
        show: canProbe && 16
      },
      {
        text: t("aiConfig.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as AiProfileItem),
        show: canEdit && 20
      },
      {
        text: t("aiConfig.activate"),
        code: "activate",
        props: { type: "warning", link: true },
        onClick: ({ row }) => activate(row as AiProfileItem),
        show: row =>
          Boolean(canActivate && !(row as AiProfileItem).is_active) && 30
      },
      {
        text: t("aiConfig.deactivate"),
        code: "deactivate",
        props: { type: "info", link: true },
        onClick: ({ row }) => deactivate(row as AiProfileItem),
        show: row =>
          Boolean(canDeactivate && (row as AiProfileItem).is_active) && 40
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("aiConfig.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
