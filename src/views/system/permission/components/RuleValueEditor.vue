<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import {
  getDateTimePickerShortcuts,
  getPickerShortcuts
} from "@/components/RePlusPage";
import SearchPicker from "@/components/SearchPicker";
import { SECOND_UNIT_CHOICES, type SecondsEditor } from "./utils/ruleValue";

/**
 * 规则取值编辑器：按后端下发的 `input` 元数据分派值控件
 * （文本 / JSON / 日期 / 日期范围 / 相对秒数 / 关联对象）。
 *
 * 自 RuleEditForm 拆出（行为不变）：父组件保留取值状态与校验，
 * 本组件只负责控件渲染与 v-model 回写，避免单文件越过行数门禁。
 */
defineOptions({ name: "PermissionRuleValueEditor" });

interface Props {
  /** 值控件类型（ruleMeta 推导：text/json/datetime/datetimerange/seconds/user/...） */
  input: string;
  /** 「全部数据」类型：不渲染排除开关，提示走 summaryAll */
  isAll: boolean;
  /** 运行期取值提示（input === "none" 时展示） */
  runtimeValueText: string;
  /** 规则类型提示（来自后端 choices 的 hint） */
  typeHint?: string;
  /** 取值校验错误 */
  error?: string;
  /** 关联对象类型缺搜索权限：禁用态提示，不退化纯文本 */
  pickerMissing: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  typeHint: "",
  error: ""
});

const { t } = useI18n();

const exclude = defineModel<boolean>("exclude", { required: true });
const textValue = defineModel<string>("textValue", { required: true });
const jsonValue = defineModel<string>("jsonValue", { required: true });
const datetimeValue = defineModel<string>("datetimeValue", { required: true });
const rangeValue = defineModel<string[] | null>("rangeValue", {
  required: true
});
const secondsEditor = defineModel<SecondsEditor>("secondsEditor", {
  required: true
});
const objectValue = defineModel<object | object[] | string | undefined>(
  "objectValue",
  { required: true }
);
</script>

<template>
  <div class="mt-3 flex flex-col gap-1" data-testid="rule-value">
    <div class="flex-bc">
      <span class="rule-edit-label">{{
        t("systemPermission.editor.value")
      }}</span>
      <el-radio-group v-if="!props.isAll" v-model="exclude" size="small">
        <el-radio-button :value="false">{{
          t("systemPermission.excludeInclude")
        }}</el-radio-button>
        <el-radio-button :value="true">{{
          t("systemPermission.excludeExclude")
        }}</el-radio-button>
      </el-radio-group>
    </div>

    <el-text v-if="props.input === 'none'" type="info" size="small">
      {{
        props.isAll
          ? t("systemPermission.editor.summaryAll")
          : props.runtimeValueText
      }}
    </el-text>
    <el-date-picker
      v-else-if="props.input === 'datetime'"
      v-model="datetimeValue"
      class="w-full"
      :placeholder="t('systemPermission.addValue')"
      :shortcuts="getDateTimePickerShortcuts()"
      type="datetime"
      value-format="YYYY-MM-DD HH:mm:ss"
    />
    <el-date-picker
      v-else-if="props.input === 'datetimerange'"
      v-model="rangeValue"
      class="w-full"
      :shortcuts="getPickerShortcuts()"
      type="datetimerange"
      value-format="YYYY-MM-DD HH:mm:ss"
    />
    <div v-else-if="props.input === 'seconds'" class="flex items-center gap-2">
      <el-select v-model="secondsEditor.future" class="w-28" :teleported="true">
        <el-option
          :label="t('systemPermission.editor.secondsPast')"
          :value="false"
        />
        <el-option
          :label="t('systemPermission.editor.secondsFuture')"
          :value="true"
        />
      </el-select>
      <el-input-number
        v-model="secondsEditor.amount"
        class="w-32"
        :min="1"
        :max="9999"
        controls-position="right"
      />
      <el-select v-model="secondsEditor.unit" class="w-28">
        <el-option
          v-for="unit in SECOND_UNIT_CHOICES"
          :key="unit"
          :label="t(`systemPermission.editor.secondsUnit.${unit}`)"
          :value="unit"
        />
      </el-select>
    </div>
    <el-input
      v-else-if="props.input === 'json'"
      v-model="jsonValue"
      :autosize="{ minRows: 2, maxRows: 6 }"
      :placeholder="t('systemPermission.editor.jsonPlaceholder')"
      type="textarea"
    />
    <SearchPicker
      v-else-if="props.input === 'user' && !props.pickerMissing"
      v-model="objectValue"
      entity="user"
    />
    <SearchPicker
      v-else-if="props.input === 'dept' && !props.pickerMissing"
      v-model="objectValue"
      entity="dept"
    />
    <SearchPicker
      v-else-if="props.input === 'role' && !props.pickerMissing"
      v-model="objectValue"
      entity="role"
    />
    <SearchPicker
      v-else-if="props.input === 'menu' && !props.pickerMissing"
      v-model="objectValue"
      entity="menu"
    />
    <!-- 关联对象类型但缺搜索权限：禁用态提示，避免退化为纯文本取值（裸字符串进规则） -->
    <el-input
      v-else-if="props.pickerMissing"
      disabled
      :placeholder="t('systemPermission.editor.pickerAuthMissing')"
    />
    <el-input
      v-else
      v-model="textValue"
      clearable
      :placeholder="t('systemPermission.addValue')"
    />
    <span v-if="props.error" class="rule-edit-error">{{ props.error }}</span>
  </div>
</template>

<style lang="scss" scoped>
.rule-edit-label {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-regular);
}

.rule-edit-error {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-color-danger);
}
</style>
