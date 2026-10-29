<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { isSuccess } from "@/api/types";
import { computed, onMounted, ref, watch, type Ref } from "vue";
import {
  handleOperation,
  useBaseColumns,
  type PageColumn
} from "@/components/RePlusPage";
import { PlusForm } from "plus-pro-components";
import type { FieldValues, PlusColumn, RecordType } from "plus-pro-components";
import { cloneDeep, pickBy } from "lodash-es";
import { useI18n } from "vue-i18n";
import { useMediaQuery } from "@vueuse/core";
import { BREAKPOINTS } from "@/utils/breakpoints";
import { FORM_SPAN_FULL } from "@/utils/formSpan";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";
import { settingItemProps } from "./types";

defineOptions({
  name: "SettingItem"
});

/**
 * 左置标签宽度：固定 260px（容纳最长设置项标题，如「登录二次验证临时令牌
 * 有效期（秒）」实测 258px），使同面板内控件列起点对齐（与弹窗表单同观感）。
 *
 * 不用 `label-width="auto"`：EP 的自适应是**逐项**按内容取宽，长标签确实不折行，
 * 但控件列起点参差（实测 90~258px 错落），观感不如对齐稳定。
 */
const LABEL_WIDTH = "260px";

const emit = defineEmits<{
  /** 透传 PlusForm 的 submit 事件载荷 */
  submit: [values: FieldValues];
  /** 表单值变化（含回显赋值；节流交给消费方，水印页据此实时预览） */
  change: [values: FieldValues];
}>();

const props = withDefaults(defineProps<settingItemProps>(), {
  api: undefined,
  title: undefined,
  localeName: "",
  autoSubmit: true,
  canRead: undefined,
  formProps: () => ({}),
  queryParams: () => ({}),
  refreshKey: 0,
  onSaved: undefined,
  columnDecorator: undefined,
  auth: () => ({
    partialUpdate: false,
    retrieve: false,
    test: false
  })
});

const { t } = useI18n();
const isNarrow = useMediaQuery(`(width <= ${BREAKPOINTS.md}px)`);
const loading = ref(false);
/** 列元数据请求失败：表单渲染不出字段，给可重试的失败态而不是永久 loading */
const loadFailed = ref(false);
const submitLoading = ref(false);
const testLoading = ref(false);
const { getColumnData } = useBaseColumns(props.localeName);

/** 「实际生效状态」诊断项(后端 build_setting_effective 下发,设置端点可选携带) */
type EffectiveItem = {
  title: string;
  enabled: boolean;
  reasons?: string[];
  notices?: string[];
};
const effectiveItems = ref<EffectiveItem[]>([]);
/** 提取保留键 effective:诊断不进表单 formData(否则会随保存回传) */
const applyEffective = (payload: unknown) => {
  const items = (payload as { items?: EffectiveItem[] } | null | undefined)
    ?.items;
  effectiveItems.value = Array.isArray(items) ? items : [];
};
const addOrEditData = ref<{
  addOrEditRules: RecordType;
  addOrEditColumns: PageColumn[];
  defaultData: RecordType;
  formData: RecordType;
}>({
  addOrEditRules: {},
  addOrEditColumns: [],
  defaultData: {},
  formData: {}
});

/** 未保存改动：离开路由/刷新前确认，避免设置面板整页改动被静默丢弃 */
const dirtyForm = computed(
  () =>
    Boolean(props.auth.partialUpdate) &&
    !loadFailed.value &&
    JSON.stringify(addOrEditData.value.formData) !==
      JSON.stringify(addOrEditData.value.defaultData)
);
useDesignerGuard({
  dirty: dirtyForm,
  namespace: `setting:${props.localeName}:${props.title ?? ""}`,
  mode: "page"
});

/**
 * PlusForm 列：从框架列元数据逐项派生（plus-pro 必填 prop 补齐；
 * 框架列在 UnwrapRef 映射后按索引访问字段，避免交叉类型属性丢失）
 */
const formColumns = computed<PlusColumn[]>(() =>
  addOrEditData.value.addOrEditColumns.map(
    column =>
      ({
        ...column,
        prop: String(column["prop"] ?? "")
      }) as PlusColumn
  )
);

// 表单值变化对外广播（回显/编辑都会触发），水印页据此做实时预览
watch(
  () => addOrEditData.value.formData,
  values => emit("change", cloneDeep(values) as FieldValues),
  { deep: true }
);

/** 字段白名单过滤：设置页按渠道拆分页签时各页签只渲染/提交自己的字段 */
const keepField = (key: string) =>
  !props.fields?.length || props.fields.includes(key);

const getData = async () => {
  if (!(props.canRead ?? props.auth.retrieve)) return;
  loading.value = true;
  loadFailed.value = false;
  try {
    // 两段请求可以并行，但赋值必须等两者都结束：列元数据回调晚到会把
    // retrieve 已回填的真实配置覆盖成列默认值；retrieve 失败也不能把默认值
    // 渲染成可保存表单，否则一次网络抖动就会被管理员保存成线上配置
    const [retrieveRes, columnPayload] = await Promise.all([
      props.api.retrieve(props.queryParams),
      new Promise<{
        addOrEditRules: Ref<Record<string, unknown>>;
        addOrEditColumns: Ref<PageColumn[]>;
      }>((resolve, reject) => {
        void getColumnData(
          props.api.columns,
          undefined,
          payload => resolve(payload),
          undefined,
          props.queryParams
        ).catch(reject);
      })
    ]);
    if (!isSuccess(retrieveRes)) {
      loadFailed.value = true;
      return;
    }
    const { addOrEditRules, addOrEditColumns } = columnPayload;
    addOrEditData.value.addOrEditRules = cloneDeep(addOrEditRules.value);
    addOrEditData.value.addOrEditColumns = cloneDeep(
      addOrEditColumns.value
    ).filter(column => keepField(column.prop as string));
    addOrEditData.value.addOrEditColumns.forEach(column => {
      // 布局：标签左置（右对齐）+ 单列——与弹窗表单（AddOrEdit）同形态；
      // 后端下发的响应式列宽面向多列表单，这里统一整行，靠表单容器限宽收住控件
      column["colProps"] = FORM_SPAN_FULL;
      (column["fieldProps"] as { disabled?: boolean })["disabled"] =
        !props.auth.partialUpdate;
      // 消费方列加工口（可选）：E2E 锚点、控件微调等页面级诉求，
      // 避免各页面复制一份 SettingItem
      props.columnDecorator?.(column);
    });
    const payload = (retrieveRes.data ?? {}) as RecordType;
    const { effective, ...formValues } = payload;
    applyEffective(effective);
    addOrEditData.value.formData = pickBy(formValues, (_value, key) =>
      keepField(key)
    );
    addOrEditData.value.defaultData = cloneDeep(addOrEditData.value.formData);
  } catch {
    // 列元数据或 retrieve 任一失败：进入可重试失败态，禁止以默认值保存
    loadFailed.value = true;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  getData();
});

/** 跨页签联动：只重取并刷新诊断，不覆盖表单里未保存的修改 */
const refreshDiagnostics = () => {
  if (!(props.canRead ?? props.auth.retrieve)) return;
  void props.api
    .retrieve(props.queryParams)
    .then(res => {
      if (res && isSuccess(res)) {
        const { effective } = (res.data ?? {}) as RecordType;
        applyEffective(effective);
      }
    })
    .catch(() => undefined);
};

watch(() => props.refreshKey, refreshDiagnostics);

const handleSubmitSettings = (data: FieldValues) => {
  // 回车/连点会重复提交：上一次未结束前直接忽略（按钮 loading 挡不住表单回车）
  if (submitLoading.value) return;
  emit("submit", data);
  if (props.autoSubmit) {
    submitLoading.value = true;
    handleOperation({
      t,
      apiReq: props.api.partialUpdate(props.queryParams, data),
      success: res => {
        const payload = (res?.data ?? {}) as RecordType;
        const { effective, ...response } = payload;
        // 保存响应同样携带诊断:横幅随保存即时刷新,无需重进页面
        applyEffective(effective);
        addOrEditData.value.defaultData = response;
        // 消费服务端响应整形（如短信手机号归一为 {code, phone}），表单回显与库内一致
        addOrEditData.value.formData = {
          ...addOrEditData.value.formData,
          ...response
        };
        // 保存成功后回调（如：水印配置变更后即时刷新当前会话的水印状态）
        void props.onSaved?.(data);
      },
      requestEnd: () => {
        submitLoading.value = false;
      }
    });
  }
};
const handleTest = () => {
  if (props.auth.test && !testLoading.value && !submitLoading.value) {
    testLoading.value = true;
    handleOperation({
      t,
      apiReq: props.api.create(props.queryParams, addOrEditData.value.formData),
      requestEnd: () => {
        testLoading.value = false;
      }
    });
  }
};
</script>

<template>
  <ReEmpty
    v-if="!auth.retrieve"
    data-testid="setting-item-no-permission"
    :description="t('setting.noPermission')"
  />
  <div
    v-else-if="loadFailed"
    class="setting-load-failed"
    data-testid="setting-load-failed"
  >
    <ReEmpty :description="t('setting.loadFailed')" />
    <el-button type="primary" plain @click="getData">
      {{ t("buttons.reload") }}
    </el-button>
  </div>
  <template v-else>
    <!-- 实际生效状态诊断(后端可选下发):原始开关之外给出合成结果与未生效原因,
         消除「开关开着但功能实际不可用」的可观测性缺口;tab 未下发时不渲染 -->
    <el-alert
      v-for="item in effectiveItems"
      :key="item.title"
      class="mb-3!"
      :type="item.enabled && !item.notices?.length ? 'success' : 'warning'"
      :closable="false"
      show-icon
      data-testid="setting-effective"
    >
      <template #title>
        {{
          item.enabled
            ? t("setting.effectiveOk", { name: item.title })
            : t("setting.effectiveBlocked", { name: item.title })
        }}
      </template>
      <div v-for="reason in item.reasons ?? []" :key="reason">{{ reason }}</div>
      <div v-for="notice in item.notices ?? []" :key="notice">{{ notice }}</div>
    </el-alert>
    <PlusForm
      ref="addFormRef"
      v-model="addOrEditData.formData"
      v-loading="loading"
      :columns="formColumns"
      :rules="addOrEditData.addOrEditRules"
      :default-values="cloneDeep(addOrEditData.defaultData)"
      :row-props="{ gutter: 24 }"
      class="setting-form"
      :label-position="isNarrow ? 'top' : 'right'"
      :label-width="isNarrow ? 'auto' : LABEL_WIDTH"
      :has-footer="auth.partialUpdate"
      v-bind="formProps"
      @submit="handleSubmitSettings"
    >
      <template #footer="{ handleSubmit }">
        <el-button v-if="auth.partialUpdate" @click="getData"
          >{{ t("setting.reload") }}
        </el-button>

        <el-button
          v-if="auth.partialUpdate"
          type="primary"
          :loading="submitLoading"
          @click="handleSubmit"
          >{{ t("buttons.save") }}
        </el-button>
        <el-button
          v-if="auth.test"
          type="success"
          :loading="testLoading"
          @click="handleTest"
          >{{ t("buttons.test") }}
        </el-button>
      </template>
    </PlusForm>
  </template>
</template>

<style lang="scss" scoped>
/**
 * 设置表单：标签左置（右对齐，固定 `LABEL_WIDTH`）+ 单列控件——与弹窗表单
 * （AddOrEdit）同形态；窄屏（<md）回退标签上置（top），避免左置标签挤压控件。
 *
 * 标签宽度取固定值（对齐控件列，见上方常量注释）；容器限宽 760px：大屏下内容纸
 * 很宽，不限宽会把输入框拉成长条、视线在标签与控件之间横扫。
 *
 * 按钮组（重置 / 保存 / 测试）与字段之间以上分隔线断开，形成「内容纸分区」，
 * 并贴合内容纸左内边距轴线（与面板标题同行起线，不随标签宽度漂移）。
 */
.setting-form {
  max-width: 760px;
}

.setting-form :deep(.plus-form__footer) {
  padding: var(--space-3) 0 0;
  margin-top: var(--space-4);
  border-top: 1px solid var(--divider);
}
</style>
