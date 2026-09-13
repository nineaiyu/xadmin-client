<script lang="ts" setup>
import { h, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElInput, ElMessageBox, ElTag, ElTooltip } from "element-plus";
import type { RecordType } from "plus-pro-components";
import type { DetailResult } from "@/api/types";
import { addDialog } from "@/components/ReDialog";
import { message } from "@/utils/message";
import {
  handleOperation,
  RePlusPage,
  type OperationProps,
  type PageTableColumn,
  type RePlusPageProps
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { personalAccessTokenApi } from "@/api/user/token";
import PatCallLogs from "./PatCallLogs.vue";
import PatScopeEditor from "./PatScopeEditor.vue";
import Lock from "~icons/ep/lock";
import Location from "~icons/ep/location";
import Document from "~icons/ep/document";
import Plus from "~icons/ep/plus";

defineOptions({ name: "AccessToken" });

const { t } = useI18n();
const plusPageRef = ref();

/** 创建弹层（名称 / 过期时间 / 接口范围）与明文一次性展示弹层 */
const createVisible = ref(false);
const creating = ref(false);
const createForm = reactive<{
  name: string;
  expired_at: string | null;
  scopes: string[];
}>({
  name: "",
  expired_at: null,
  scopes: []
});
const tokenVisible = ref(false);
const plainToken = ref("");

/**
 * PAT 是个人资源：路由挂在 PERMISSION_WHITE_URL（同 MFA 口径，无需菜单权限码），
 * auth 仅作 RePlusPage 显隐开关；内置新增/编辑/导入导出隐藏——
 * 创建走工具栏专用弹层（承载明文一次性展示），字段编辑由行内清单编辑器承载。
 */
const auth: RePlusPageProps["auth"] = {
  list: true,
  create: false,
  update: false,
  partialUpdate: false,
  destroy: true,
  retrieve: false,
  exportData: false,
  importData: false
};

const refresh = () => plusPageRef.value?.handleGetData();

const openCreate = () => {
  createForm.name = "";
  createForm.expired_at = null;
  // 接口范围留空 = 不限（其后可在行内「接口范围」里补配）
  createForm.scopes = [];
  createVisible.value = true;
};

const submitCreate = () => {
  if (!createForm.name || creating.value) return;
  creating.value = true;
  handleOperation({
    t,
    // 明文随后在弹层里一次性展示，成功提示交给弹层，避免双弹窗叠 toast
    showSuccessMsg: false,
    apiReq: personalAccessTokenApi.create({
      name: createForm.name,
      expired_at: createForm.expired_at || null,
      scopes: createForm.scopes
    }),
    success: (res: DetailResult) => {
      plainToken.value = String(res.data.token ?? "");
      createVisible.value = false;
      tokenVisible.value = true;
      refresh();
    },
    requestEnd: () => {
      creating.value = false;
    }
  });
};

const copyToken = async () => {
  try {
    // clipboard API 仅在安全上下文（https/localhost）可用，非安全上下文降级
    if (!navigator.clipboard?.writeText)
      throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(plainToken.value);
    message(t("accessToken.copied"), { type: "success" });
  } catch {
    message(t("accessToken.copyFailed"), { type: "error" });
  }
};

/** 吊销：不可恢复，先二次确认（凭证即时失效，所有在用脚本会 401） */
const handleRevoke = (row: RecordType) => {
  void ElMessageBox.confirm(
    t("accessToken.revokeConfirm", { name: row.name }),
    t("accessToken.revoke"),
    {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel"),
      confirmButtonClass: "el-button--danger"
    }
  )
    .then(() =>
      handleOperation({
        t,
        apiReq: personalAccessTokenApi.partialUpdate(row.pk, {
          is_active: false
        }),
        success: () => refresh()
      })
    )
    .catch(() => undefined);
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
 * SFC 内不用 JSX，用 h()；接口范围改走 PatScopeEditor（勾选有权限的接口）。
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
  addDialog({
    title: options.title,
    width: "480px",
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
    beforeSure: (done, { closeLoading }) => {
      const items = editor.text
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
      handleOperation({
        t,
        apiReq: personalAccessTokenApi.partialUpdate(options.pk, {
          [options.field]: items
        }),
        success: () => {
          done();
          refresh();
        },
        // 确定按钮 loading 收口：失败保持弹窗可重试，避免重复点击
        requestEnd: closeLoading
      });
    }
  });
};

/**
 * 接口范围编辑：勾选「我有权限的接口」（选项来自 scope-options，按本人权限收口）
 * + 自定义条目兜底（白名单接口/正则/历史条目，一行一条）。
 */
const openScopeEditor = (row: RecordType) => {
  // 编辑态由弹窗自己持有：组件挂载后会把已保存条目分流到勾选/自定义
  const state = reactive<{ value: string[] }>({
    value: [...(row.scopes ?? [])]
  });
  addDialog({
    title: t("accessToken.scope"),
    width: "680px",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    contentRenderer: () =>
      h(PatScopeEditor, {
        modelValue: state.value,
        "onUpdate:modelValue": (value: string[]) => (state.value = value)
      }),
    beforeSure: (done, { closeLoading }) => {
      handleOperation({
        t,
        apiReq: personalAccessTokenApi.partialUpdate(row.pk, {
          scopes: state.value
        }),
        success: () => {
          done();
          refresh();
        },
        // 确定按钮 loading 收口：失败保持弹窗可重试，避免重复点击
        requestEnd: closeLoading
      });
    }
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
    width: "720px",
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
        // 明细走 tooltip：条目是路径正则，列内只显示条数，hover 可看到具体范围
        column.cellRenderer = ({ row }) => {
          const items: string[] = row.scopes ?? [];
          if (!items.length) return t("accessToken.scopeUnrestricted");
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
                  items.join("\n")
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
        column.cellRenderer = ({ row }) => row[column._column?.key] ?? "—";
        break;
    }
  });
  return columns;
};

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
      show: 2
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
      show: 3
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
      show: 4
    }
  ]
};
</script>

<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      :title="t('accessToken.tip')"
      class="mt-8 mb-4"
    />

    <RePlusPage
      ref="plusPageRef"
      :api="personalAccessTokenApi"
      :auth="auth"
      :selection="false"
      :title="t('accessToken.title')"
      locale-name="accessToken"
      :list-columns-format="listColumnsFormat"
      :operation-buttons-props="operationButtonsProps"
      :table-bar-buttons-props="tableBarButtonsProps"
    />

    <el-dialog
      v-model="createVisible"
      :title="t('accessToken.createDialogTitle')"
      width="620px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" @submit.prevent>
        <el-form-item :label="t('accessToken.name')" required>
          <el-input
            v-model="createForm.name"
            :placeholder="t('accessToken.nameRule')"
            maxlength="128"
            clearable
            @keyup.enter="submitCreate"
          />
        </el-form-item>
        <el-form-item :label="t('accessToken.expiredAt')">
          <el-date-picker
            v-model="createForm.expired_at"
            type="datetime"
            class="w-full!"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :placeholder="t('accessToken.neverExpire')"
          />
        </el-form-item>
        <el-form-item :label="t('accessToken.scope')">
          <PatScopeEditor v-model="createForm.scopes" hide-custom />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">
          {{ t("buttons.cancel") }}
        </el-button>
        <el-button
          type="primary"
          :loading="creating"
          :disabled="!createForm.name"
          @click="submitCreate"
        >
          {{ t("accessToken.create") }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="tokenVisible"
      :title="t('accessToken.createdTitle')"
      width="520px"
      @closed="plainToken = ''"
    >
      <el-alert
        type="warning"
        :closable="false"
        :title="t('accessToken.onceTip')"
        class="mb-3"
      />
      <code class="block break-all rounded bg-gray-100 p-2 dark:bg-gray-800">
        {{ plainToken }}
      </code>
      <template #footer>
        <el-button type="primary" @click="copyToken">
          {{ t("accessToken.copy") }}
        </el-button>
        <el-button @click="tokenVisible = false">
          {{ t("buttons.close") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
