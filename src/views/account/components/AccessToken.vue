<script lang="ts" setup>
import { defineComponent, h, reactive, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import {
  ElAlert,
  ElButton,
  ElInput,
  ElSwitch,
  ElTag,
  ElTooltip
} from "element-plus";
import type { RecordType } from "plus-pro-components";
import { isSuccess } from "@/api/types";
import {
  addDialog,
  closeDialog,
  type DialogOptions
} from "@/components/ReDialog";
import { copyText } from "@/utils/clipboard";
import { message } from "@/utils/message";
import { invalidateMetaCache } from "@/utils/metaCache";
import { useConfirm } from "@/hooks/useConfirm";
import { useDialogForm } from "@/hooks/useDialogForm";
import {
  handleOperation,
  RePlusPage,
  type OperationProps,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ApiScopeEditor from "@/components/ApiScopeEditor";
import { loadPatScopeCatalog, personalAccessTokenApi } from "@/api/user/token";
import { buildScopeIndex, formatScopeLines } from "@/utils/scopeDisplay";
import AccountPanel from "./AccountPanel.vue";
import PatCallLogs from "./PatCallLogs.vue";
import AccessTokenCreateForm from "./AccessTokenCreateForm.vue";
import {
  resolveTokenScopePayload,
  type TokenScopePayload
} from "./tokenScopePayload";
import Lock from "~icons/ep/lock";
import Location from "~icons/ep/location";
import Document from "~icons/ep/document";
import Plus from "~icons/ep/plus";
import { dialogSize } from "@/components/ReDialog/size";

defineOptions({ name: "AccessToken" });

const { t } = useI18n();
const confirm = useConfirm();
const plusPageRef = ref();

/** 创建弹层（名称 / 过期时间 / 接口范围）与明文一次性展示弹层 */
/**
 * PAT 是个人资源：路由挂在 PERMISSION_WHITE_URL（同 MFA 口径，无需菜单权限码），
 * auth 仅作 RePlusPage 显隐开关；内置新增/编辑/导入导出隐藏——
 * 创建走工具栏专用弹层（承载明文一次性展示），字段编辑由行内清单编辑器承载。
 * 删除同样关闭：吊销（is_active=false）已覆盖下线语义，硬删会让调用记录
 * 按 token_pk 永久失联，无法回溯历史用量。
 */
const auth: RePlusPageProps["auth"] = {
  list: true,
  create: false,
  update: false,
  partialUpdate: false,
  destroy: false,
  retrieve: false,
  exportData: false,
  importData: false
};

const refresh = () => plusPageRef.value?.handleGetData();

/**
 * 接口范围目录：只用于把条目（锚定正则）还原成人可读路径；
 * 目录拉取失败仅退回条目原文展示，列表与编辑不受影响。
 */
const scopeIndex = shallowRef(buildScopeIndex());
loadPatScopeCatalog()
  .then(res => {
    if (!isSuccess(res)) return;
    scopeIndex.value = buildScopeIndex(res.data?.groups);
  })
  .catch(() => undefined);

/** 明文令牌复制（弹层内按钮使用；token 由调用参数带入，不再依赖组件级 ref） */
const copyTokenText = (token: string) => copyText(token);

/** 明文一次性展示弹层（创建成功后打开，关闭后不可再读；统一走 ReDialog） */
const openPlainToken = (token: string) => {
  const options: DialogOptions = {
    title: t("accessToken.createdTitle"),
    width: dialogSize("md"),
    draggable: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () =>
      h("div", [
        h(ElAlert, {
          type: "warning",
          closable: false,
          title: t("accessToken.onceTip"),
          class: "mb-3"
        }),
        h(
          "code",
          {
            class: "block break-all rounded bg-(--el-fill-color-light) p-2"
          },
          token
        ),
        h("div", { class: "mt-4 text-right" }, [
          h(
            ElButton,
            {
              type: "primary",
              onClick: () => copyTokenText(token)
            },
            () => t("accessToken.copy")
          ),
          h(ElButton, { onClick: () => closeDialog(options, 0) }, () =>
            t("buttons.close")
          )
        ])
      ])
  };
  addDialog(options);
};

/** 创建令牌弹窗（统一走 ReDialog，表单在 AccessTokenCreateForm 中） */
const createFormRef = ref<InstanceType<typeof AccessTokenCreateForm>>();

const openCreate = () => {
  createFormRef.value = undefined;
  // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
  const { beforeSure } = useDialogForm<Record<string, unknown>>({
    formRef: createFormRef,
    submit: payload =>
      personalAccessTokenApi.create<{ token?: string }>(payload),
    // 先关创建弹窗再打开明文弹层（避免双弹窗叠层），再刷新列表
    // （useDialogForm 内 done 先于回调）
    onSuccess: res => {
      const token = String(
        (res.data as { token?: string } | null | undefined)?.token ?? ""
      );
      openPlainToken(token);
      refresh();
    }
  });
  addDialog({
    title: t("accessToken.createDialogTitle"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    sureBtnLoading: true,
    contentRenderer: () => h(AccessTokenCreateForm, { ref: createFormRef }),
    beforeSure
  });
};

/** 吊销：不可恢复，先二次确认（凭证即时失效，所有在用脚本会 401） */
const handleRevoke = (row: RecordType) => {
  void confirm(t("accessToken.revokeConfirm", { name: row.name }), {
    title: t("accessToken.revoke"),
    danger: true
  }).then(ok => {
    if (ok)
      handleOperation({
        t,
        apiReq: personalAccessTokenApi.partialUpdate(row.pk, {
          is_active: false
        }),
        success: () => refresh()
      });
  });
};

/** 工具栏按钮：创建入口（明文的创建表单不适合走框架内建的通用表单弹窗） */
const tableBarButtonsProps: OperationProps = {
  buttons: [
    {
      text: t("accessToken.create"),
      code: "createToken",
      props: { type: "primary", icon: useRenderIcon(Plus) },
      onClick: () => openCreate(),
      show: true
    }
  ]
};

/**
 * 清单编辑器（IP 白名单）：多行文本，一行一条，空 = 不限。
 *
 * SFC 内不用 JSX，用 h()；接口范围改走 ApiScopeEditor（勾选有权限的接口）。
 */
const openListEditor = (options: {
  pk: string | number;
  /** 提交的字段名（与后端字段一致） */
  field: "scopes" | "ip_allowlist";
  title: string;
  tip: string;
  placeholder: string;
  value: string[];
}) => {
  const editor = reactive({ text: (options.value ?? []).join("\n") });
  const { beforeSure } = useDialogForm<string[]>({
    readPayload: () =>
      editor.text
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean),
    submit: items =>
      personalAccessTokenApi.partialUpdate(options.pk, {
        [options.field]: items
      }),
    onSuccess: res => {
      invalidateMetaCache();
      message(String(res.detail ?? t("results.success")), { type: "success" });
      refresh();
    },
    onFail: res =>
      message(`${t("results.failed")}，${res.detail}`, { type: "error" })
  });
  addDialog({
    title: options.title,
    width: dialogSize("sm"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h("div", null, [
        h(ElInput, {
          type: "textarea",
          rows: 6,
          modelValue: editor.text,
          "onUpdate:modelValue": (value: string) => (editor.text = value),
          placeholder: options.placeholder
        }),
        h("div", { class: "el-form-item__help w-full! mt-1" }, options.tip)
      ]),
    beforeSure
  });
};

/**
 * 接口范围编辑：勾选「我有权限的接口」（选项来自 scope-options，按本人权限收口）
 * + 自定义条目兜底（白名单接口/正则/历史条目，一行一条）。
 * 清空范围保存与创建表单同口径：必须显式打开「不限范围」开关（提交体携带
 * `unrestricted: true`，与后端 PATCH 校验对齐），否则拦下并保持弹窗打开。
 */
const openScopeEditor = (row: RecordType) => {
  // 编辑态由弹窗自己持有：组件挂载后会把已保存条目分流到勾选/自定义；
  // 「不限范围」初始值与令牌现状一致（存量空范围凭证原样保存仍合法）
  const state = reactive<{ value: string[]; unrestricted: boolean }>({
    value: [...(row.scopes ?? [])],
    unrestricted:
      row.unrestricted === undefined
        ? !(row.scopes ?? []).length
        : Boolean(row.unrestricted)
  });
  const { beforeSure } = useDialogForm<TokenScopePayload>({
    readPayload: () => {
      const payload = resolveTokenScopePayload(state.value, state.unrestricted);
      if (!payload) {
        message(t("accessToken.unrestrictedRequired"), { type: "warning" });
      }
      return payload;
    },
    submit: payload => personalAccessTokenApi.partialUpdate(row.pk, payload),
    onSuccess: res => {
      invalidateMetaCache();
      message(String(res.detail ?? t("results.success")), { type: "success" });
      refresh();
    },
    onFail: res =>
      message(`${t("results.failed")}，${res.detail}`, { type: "error" })
  });
  // h() 产物不是响应式上下文：包一层本地组件，开关随勾选联动（复位/禁用）
  const ScopeEditorContent = defineComponent({
    name: "PatScopeEditorContent",
    setup() {
      return () =>
        h("div", [
          h(ApiScopeEditor, {
            modelValue: state.value,
            "onUpdate:modelValue": (value: string[]) => {
              state.value = value;
              // 勾选了范围时开关失去意义：与创建表单同口径自动复位
              if (value.length) state.unrestricted = false;
            },
            loadOptions: loadPatScopeCatalog
          }),
          h("div", { class: "mt-3 flex-c gap-2" }, [
            h(ElSwitch, {
              modelValue: state.unrestricted,
              // ElSwitch 的更新回调按其类型面收窄为 boolean
              "onUpdate:modelValue": (value: string | number | boolean) => {
                state.unrestricted = Boolean(value);
              },
              disabled: state.value.length > 0
            }),
            h("span", { class: "text-sm" }, t("accessToken.unrestricted"))
          ]),
          h(
            "div",
            { class: "el-form-item__help mt-1" },
            t("accessToken.unrestrictedTip")
          )
        ]);
    }
  });
  addDialog({
    title: t("accessToken.scope"),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () => h(ScopeEditorContent),
    beforeSure
  });
};

/** IP 白名单编辑：单个 IP 或 CIDR 网段，格式校验由服务端收口 */
const openIpAllowlistEditor = (row: RecordType) =>
  openListEditor({
    pk: row.pk,
    field: "ip_allowlist",
    title: t("accessToken.ipAllowlist"),
    tip: t("accessToken.ipAllowlistTip"),
    placeholder: t("accessToken.ipAllowlistPlaceholder"),
    value: row.ip_allowlist ?? []
  });

/** 调用记录弹窗：内容组件自发起请求（精确口径说明见弹窗内提示） */
const openCallLogs = (row: RecordType) => {
  addDialog({
    title: `${t("accessToken.callLogs")} - ${row.name}`,
    width: dialogSize("lg"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () => h(PatCallLogs, { pk: row.pk })
  });
};

/** 列渲染覆盖：状态/接口范围/IP 白名单与时间列空值占位（保持迁移前展示口径） */
const listColumnsFormat = (columns: PageTableColumn[]) => {
  columns.forEach(column => {
    switch (column._column?.key) {
      case "is_active":
        column.cellRenderer = ({ row }) =>
          h(
            ElTag,
            { type: row.is_active ? "success" : "danger", size: "small" },
            () => (row.is_active ? t("labels.enable") : t("labels.disable"))
          );
        break;
      case "scopes":
        // 明细走 tooltip：条目本体是锚定正则，列内只显示条数，hover 看到可读路径。
        // 不限范围用醒目的警示标签区分（空范围 = 不限是运行时既定语义；后端
        // 下发显式 unrestricted 字段时以它为准）
        column.cellRenderer = ({ row }) => {
          const items: string[] = row.scopes ?? [];
          const unrestricted =
            row.unrestricted === undefined
              ? !items.length
              : Boolean(row.unrestricted);
          if (unrestricted) {
            return h(ElTag, { type: "warning", size: "small" }, () =>
              t("accessToken.unrestricted")
            );
          }
          return h(
            ElTooltip,
            { placement: "top" },
            {
              default: () =>
                h(ElTag, { type: "info", size: "small" }, () =>
                  t("accessToken.scopeCount", { n: items.length })
                ),
              content: () =>
                h(
                  "div",
                  {
                    class: "text-xs",
                    style: { maxWidth: "420px", whiteSpace: "pre-line" }
                  },
                  formatScopeLines(items, scopeIndex.value)
                )
            }
          );
        };
        break;
      case "ip_allowlist":
        column.cellRenderer = ({ row }) =>
          (row.ip_allowlist ?? []).length
            ? h(ElTag, { type: "info", size: "small" }, () =>
                t("accessToken.ipCount", { n: row.ip_allowlist.length })
              )
            : t("accessToken.ipAllowlistUnrestricted");
        break;
      case "expired_at":
      case "last_used_time":
        column.cellRenderer = ({ row }) =>
          row[column._column?.key as string] ?? "—";
        break;
    }
  });
  return columns;
};

/**
 * 表格自适应高度的底部预留：框架缺省 110px 只按「列表页直铺」口径，
 * 本页表格外面包了面板卡片（卡片内边距 + 面板底部留白 + 分栏页边距），
 * 按缺省值算表格会高出视口，把页面顶出滚动条，这里按实测加到 150。
 */
const pureTableProps = { adaptiveConfig: { offsetBottom: 150 } };

/** 行内动作：吊销（仅启用态）+ 接口范围 + IP 白名单 + 调用记录 */
const operationButtonsProps: OperationProps = {
  showNumber: 6,
  buttons: [
    {
      text: t("accessToken.revoke"),
      code: "revoke",
      props: { type: "warning", link: true },
      onClick: ({ row }) => handleRevoke(row),
      show: (row: RecordType) => !!row.is_active
    },
    {
      code: "scope",
      props: {
        type: "primary",
        link: true,
        title: t("accessToken.scope"),
        icon: useRenderIcon(Lock)
      },
      onClick: ({ row }) => openScopeEditor(row),
      index: 2,
      show: true
    },
    {
      code: "ipAllowlist",
      props: {
        type: "primary",
        link: true,
        title: t("accessToken.ipAllowlist"),
        icon: useRenderIcon(Location)
      },
      onClick: ({ row }) => openIpAllowlistEditor(row),
      index: 3,
      show: true
    },
    {
      code: "callLogs",
      props: {
        type: "primary",
        link: true,
        title: t("accessToken.callLogs"),
        icon: useRenderIcon(Document)
      },
      onClick: ({ row }) => openCallLogs(row),
      index: 4,
      show: true
    }
  ]
};
</script>

<template>
  <AccountPanel
    :title="t('accessToken.title')"
    :description="t('accessToken.tip')"
  >
    <RePlusPage
      ref="plusPageRef"
      :api="personalAccessTokenApi"
      :auth="auth"
      :selection="false"
      title=""
      locale-name="accessToken"
      :list-columns-format="listColumnsFormat"
      :operation-buttons-props="operationButtonsProps"
      :table-bar-buttons-props="tableBarButtonsProps"
      :pure-table-props="pureTableProps"
    />
  </AccountPanel>
</template>
