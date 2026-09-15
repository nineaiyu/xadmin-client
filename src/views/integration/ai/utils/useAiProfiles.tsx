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

  /* ---------------- 按钮装配 ---------------- */
  const operationButtonsProps = shallowRef<OperationProps>({
    showNumber: 6,
    width: 320,
    buttons: [
      {
        text: t("aiConfig.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testProfile(row as AiProfileItem),
        show: canTest && 10
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
