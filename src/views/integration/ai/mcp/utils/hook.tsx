import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElLink, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { addDrawer } from "@/components/ReDrawer";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { mcpServerApi, type McpServerItem } from "@/api/ai/mcp";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import McpServerForm from "../components/McpServerForm.vue";
import McpToolsDrawer from "../components/McpToolsDrawer.vue";
import Plus from "~icons/ep/plus";

type McpRow = McpServerItem;

/** 请求异常归一（C5 弹窗口径）：失败也给可读 detail，避免 loading 悬挂 */
const normalizeError = (error: unknown) => ({
  code: -1,
  data: null,
  detail: String((error as { detail?: string })?.detail ?? error)
});

/**
 * 外部 MCP 服务器页装配：
 * - 列表走 RePlusPage 标准 CRUD（删除保留框架默认入口，编辑走自定义表单弹窗）；
 * - 行操作「工具」打开抽屉：资料卡 + 工具快照清单 + 调用测试（白名单内）；
 * - 「同步」拉取 tools/list 更新服务器快照。
 */
export function useMcpServers(tableRef: Ref) {
  const { t } = useI18n();
  const auth = reactive({
    ...getDefaultAuths("AiMcpServers"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:AiMcpServers");
  const canUpdate = hasAuth("partialUpdate:AiMcpServers");
  const canSync = hasAuth("sync:AiMcpServers");
  const api = reactive(mcpServerApi);

  const refresh = () => tableRef.value?.handleGetData();

  /* ---------------- 新建/编辑（自定义表单弹窗） ---------------- */
  const formRef = ref<InstanceType<typeof McpServerForm>>();

  const openForm = (row?: McpRow) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("mcp.editTitle") : t("mcp.createTitle"),
      width: dialogSize("sm"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(McpServerForm, { ref: formRef, row: row ?? null }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        const res = row
          ? await mcpServerApi
              .partialUpdate(row.pk, payload)
              .catch(normalizeError)
          : await mcpServerApi.create(payload).catch(normalizeError);
        if (res.code !== SUCCESS_CODE) {
          message(`${t("results.failed")}，${String(res.detail ?? "")}`, {
            type: "error"
          });
          return;
        }
        message(res.detail ?? t("mcp.saveDone"), { type: "success" });
        // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
        done();
        refresh();
      }
    });
  };

  /* ---------------- 行操作：同步 / 工具抽屉 ---------------- */
  const runSync = async (row: McpRow) => {
    const res = await mcpServerApi.sync(row.pk).catch(normalizeError);
    if (res.code === SUCCESS_CODE) {
      const count = (res.data as { count?: number } | null)?.count ?? 0;
      message(t("mcp.syncDone", { count }), { type: "success" });
    } else {
      message(String(res.detail ?? t("results.failed")), { type: "warning" });
    }
    refresh();
  };

  const openTools = (row: McpRow) => {
    addDrawer({
      title: t("mcp.drawerTitle", { name: row.name }),
      size: "55%",
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(McpToolsDrawer, { row, onSynced: () => refresh() })
    });
  };

  /* ---------------- 列渲染（入口 + 只读状态） ---------------- */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "name":
          column["cellRenderer"] = ({ row }) => {
            const item = row as McpRow;
            return h(
              ElLink,
              { type: "primary", onClick: () => openTools(item) },
              () => item.name
            );
          };
          break;
        case "enabled":
          // 只读状态标签：编辑入口收敛到表单弹窗（避免禁用态开关的重复入口）
          column["cellRenderer"] = ({ row, props }) => {
            const enabled = Boolean((row as McpRow).enabled);
            return h(
              ElTag,
              {
                type: enabled ? "success" : "danger",
                size: props.size,
                effect: "plain"
              },
              () => (enabled ? t("mcp.enabled") : t("mcp.disabled"))
            );
          };
          break;
        case "last_sync_error":
          column["cellRenderer"] = ({ row }) => {
            const detail = String((row as McpRow).last_sync_error || "");
            return detail
              ? h("span", { class: "text-(--el-color-danger) text-xs" }, detail)
              : h("span", {}, "-");
          };
          break;
      }
    });
    return columns;
  };

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("mcp.create"),
        code: "create",
        props: {
          type: "primary",
          icon: useRenderIcon(Plus)
        },
        onClick: () => openForm(),
        show: canCreate
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    // 资料与工具清单由抽屉承载（默认「查看」入口关闭）；4 个行操作全内联
    width: 260,
    hideDetail: true,
    showNumber: 4,
    buttons: [
      {
        text: t("mcp.sync"),
        code: "sync",
        props: { type: "primary", link: true },
        onClick: ({ row }) => runSync(row as McpRow),
        show: canSync
      },
      {
        text: t("mcp.tools"),
        code: "tools",
        props: { link: true },
        onClick: ({ row }) => openTools(row as McpRow),
        show: 10
      },
      {
        text: t("buttons.edit"),
        code: "edit",
        props: { link: true },
        onClick: ({ row }) => openForm(row as McpRow),
        show: canUpdate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    tableBarButtonsProps,
    operationButtonsProps
  };
}
