<script lang="ts" setup>
import { h, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElInput, ElTag } from "element-plus";
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
import Lock from "~icons/ep/lock";
import Location from "~icons/ep/location";
import Document from "~icons/ep/document";

defineOptions({ name: "AccessToken" });

const { t } = useI18n();
const plusPageRef = ref();

const dialogVisible = ref(false);

/** 创建后明文仅展示一次：弹层 + 复制按钮，关闭即不再可见 */
const plainToken = ref("");

const form = reactive({ name: "", expired_at: null });

/**
 * PAT 是个人资源：路由挂在 PERMISSION_WHITE_URL（同 MFA 口径，无需菜单权限码），
 * auth 仅作 RePlusPage 显隐开关；内置新增/编辑/导入导出隐藏——
 * 创建走页面顶部专用表单（承载明文一次性展示），字段编辑由行内清单编辑器承载。
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

const handleCreate = () => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.create({
      name: form.name,
      expired_at: form.expired_at || null
    }),
    success: (res: DetailResult) => {
      plainToken.value = String(res.data.token ?? "");
      dialogVisible.value = true;
      form.name = "";
      form.expired_at = null;
      refresh();
    }
  });
};

const handleRevoke = (row: RecordType) => {
  handleOperation({
    t,
    apiReq: personalAccessTokenApi.partialUpdate(row.pk, { is_active: false }),
    success: () => refresh()
  });
};

/**
 * 清单编辑器（接口范围 / IP 白名单共用）：多行文本，一行一条，空 = 不限。
 *
 * 两者交互完全一致（textarea + 说明 + 保存 loading 收口），收口避免两份实现漂移；
 * SFC 内不用 JSX，用 h()。
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

/** 接口范围编辑：路径前缀/正则，可带方法前缀（如 `GET /api/system/user`） */
const openScopeEditor = (row: RecordType) =>
  openListEditor({
    pk: row.pk,
    field: "scopes",
    title: t("accessToken.scope"),
    tip: t("accessToken.scopeTip"),
    placeholder: t("accessToken.scopePlaceholder"),
    value: row.scopes ?? []
  });

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
        column.cellRenderer = ({ row }) =>
          (row.scopes ?? []).length
            ? h(ElTag, { type: "info", size: "small" }, () =>
                t("accessToken.scopeCount", { n: row.scopes.length })
              )
            : t("accessToken.scopeUnrestricted");
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
  <div class="max-w-215">
    <h3 class="my-8!">{{ t("accessToken.title") }}</h3>
    <el-alert
      type="info"
      :closable="false"
      :title="t('accessToken.tip')"
      class="mb-4"
    />
    <el-form inline class="mb-4">
      <el-form-item :label="t('accessToken.name')">
        <el-input
          v-model="form.name"
          :placeholder="t('accessToken.nameRule')"
          maxlength="128"
          class="w-200px!"
        />
      </el-form-item>
      <el-form-item :label="t('accessToken.expiredAt')">
        <el-date-picker
          v-model="form.expired_at"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          :placeholder="t('accessToken.neverExpire')"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :disabled="!form.name" @click="handleCreate">
          {{ t("accessToken.create") }}
        </el-button>
      </el-form-item>
    </el-form>

    <RePlusPage
      ref="plusPageRef"
      :api="personalAccessTokenApi"
      :auth="auth"
      :selection="false"
      locale-name="accessToken"
      :list-columns-format="listColumnsFormat"
      :operation-buttons-props="operationButtonsProps"
    />

    <el-dialog
      v-model="dialogVisible"
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
      </template>
    </el-dialog>
  </div>
</template>
