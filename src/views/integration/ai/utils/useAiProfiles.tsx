import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElMessageBox, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import {
  addDrawer,
  closeDrawer,
  type DrawerOptions
} from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { aiProfileApi, type AiProfileItem } from "@/api/system/ai";
import AiProfileForm from "../components/AiProfileForm.vue";
import AiProfilePanel from "../components/AiProfilePanel.vue";
import { buildAiProfileActionGroups } from "./aiProfileActions";

/**
 * AI 配置档案表格：CRUD + 激活/停用/测试 + 统一「管理」抽屉。
 *
 * - 行内保留在线处置（测试 / 激活 / 停用）；档案参数速览、能力画像与低频动作
 *   （能力探测含多模态、编辑、删除）收敛进「管理」抽屉，操作列由 430 收窄到 240；
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + AiProfileForm
 *   （api_key 明文不回显、留空沿用原密钥的语义在表单内收敛）；
 * - 删除关闭框架默认入口（带二次确认的删除动作移入抽屉危险区，统一入口）；
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
    partialUpdate: false,
    // 删除收敛进「管理」抽屉危险区，关闭框架默认入口避免两处入口
    destroy: false
  });
  const canCreate = hasAuth("create:AiProfile");
  const canEdit = hasAuth("partialUpdate:AiProfile");
  const canActivate = hasAuth("activate:AiProfile");
  const canDeactivate = hasAuth("deactivate:AiProfile");
  const canTest = hasAuth("test:AiProfile");
  const canProbe = hasAuth("probe:AiProfile");
  const canDestroy = hasAuth("destroy:AiProfile");

  const refresh = () => tableRef.value?.handleGetData();

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "name":
          // 档案名同为「管理」抽屉入口
          column["cellRenderer"] = ({ row }) => {
            const item = row as AiProfileItem;
            return h(
              ElLink,
              {
                type: "primary",
                onClick: () => openProfilePanel(item)
              },
              () => item.name
            );
          };
          break;
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

  /* ---------------- 激活 / 停用 / 测试 / 删除 ---------------- */
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
    // 异常归一为可读失败结果：抽屉内触发的动作不应把异常抛到全局
    const res = await action().catch(error => ({
      code: -1,
      detail: String((error as { detail?: string })?.detail ?? error)
    }));
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

  const removeProfile = (row: AiProfileItem) =>
    confirmThen(
      t("aiConfig.deleteConfirm"),
      () => aiProfileApi.destroy(row.pk),
      t("aiConfig.deleteDone")
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

  /** 「管理」抽屉：档案资料 + 能力画像 + 探测/配置/删除动作（低频动作唯一入口） */
  const openProfilePanel = (row: AiProfileItem) => {
    const options: DrawerOptions = {
      title: t("aiConfig.panelTitle", { name: row.name }),
      size: "520px",
      destroyOnClose: true,
      hideFooter: true
    };
    // 动作执行前先收起抽屉：能力画像/状态标签基于行快照，重开即最新；
    // 同时避免与编辑弹窗、危险操作确认框叠加
    const withClosed = (run: () => void) => () => {
      closeDrawer(options, 0);
      run();
    };
    options.contentRenderer = () =>
      h(AiProfilePanel, {
        row,
        groups: buildAiProfileActionGroups({
          t,
          flags: { canProbe, canEdit, canDestroy },
          handlers: {
            probe: withClosed(() => probeProfile(row)),
            probeVision: withClosed(() => probeProfile(row, true)),
            edit: withClosed(() => openDialog(row)),
            remove: withClosed(() => removeProfile(row))
          }
        })
      });
    addDrawer(options);
  };

  /* ---------------- 按钮装配 ---------------- */
  const operationButtonsProps = shallowRef<OperationProps>({
    // 行内保留在线处置（激活/停用、测试）+ 管理抽屉入口：列宽由 430 收窄
    width: 240,
    // 档案资料/参数与能力画像由「管理」抽屉承载，关闭框架默认详情入口避免重复
    hideDetail: true,
    buttons: [
      {
        text: t("aiConfig.activate"),
        code: "activate",
        props: { type: "warning", link: true },
        onClick: ({ row }) => activate(row as AiProfileItem),
        show: row =>
          Boolean(canActivate && !(row as AiProfileItem).is_active) && -40
      },
      {
        text: t("aiConfig.deactivate"),
        code: "deactivate",
        props: { type: "info", link: true },
        onClick: ({ row }) => deactivate(row as AiProfileItem),
        show: row =>
          Boolean(canDeactivate && (row as AiProfileItem).is_active) && -40
      },
      {
        text: t("aiConfig.test"),
        code: "test",
        props: { type: "success", link: true },
        onClick: ({ row }) => testProfile(row as AiProfileItem),
        show: canTest && -30
      },
      {
        text: t("aiConfig.manage"),
        code: "manage",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openProfilePanel(row as AiProfileItem),
        show: -15
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
