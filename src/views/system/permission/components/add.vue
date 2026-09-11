<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import type { CascaderOption, FormRules } from "element-plus";
import { message } from "@/utils/message";
import { FieldKeyChoices } from "@/views/system/constants";
import { hasAuth } from "@/router/utils";
import { watchDeep } from "@vueuse/core";
import ReCol from "@/components/ReCol";
import { modelLabelFieldApi } from "@/api/system/field";
import {
  getDateTimePickerShortcuts,
  getPickerShortcuts
} from "@/components/RePlusPage";
import SearchUser from "@/views/system/components/SearchUser.vue";
import SearchDept from "@/views/system/components/SearchDept.vue";
import SearchRole from "@/views/system/components/SearchRole.vue";
import SearchMenu from "@/views/system/components/SearchMenu.vue";
import FromQuestion from "@/components/FromQuestion/index.vue";
import {
  RULE_PRESETS,
  ruleValueInput,
  type RulePreset
} from "./utils/ruleTypes";

const props = withDefaults(defineProps<FormProps>(), {
  valuesData: () => [],
  fieldLookupsData: () => [],
  formInline: () => ({
    name: [],
    match: "",
    exclude: false,
    type: "",
    value: ""
  })
});

const { t } = useI18n();

// el-cascader 的 options 类型要求 CascaderOption[]，但数据以 name 作为取值键（见下方 :props 映射）
const cascaderOptions = computed(
  () => props.fieldLookupsData as unknown as CascaderOption[]
);

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);
const tableData = ref<Array<Record<string, unknown>>>([]);
const matchList = ref<Array<{ value: string; label: string }>>([]);

function getRef() {
  return ruleFormRef.value;
}

/** 当前值类型的输入形态；none = 由后端运行期按当前用户注入，配置端无需填写 */
const valueInput = computed(() => ruleValueInput(newFormInline.value.type));

/** 选中类型的过滤语义（后端 choices.hint 下发，前端不重复维护文案） */
const typeHint = computed(
  () =>
    props.valuesData.find(item => item.value === newFormInline.value.type)
      ?.hint ?? ""
);

/** 运行时注入类型没有可填的 value：放开必填，避免「看不到输入框却校验失败」 */
const formRulesComputed = computed<FormRules>(() =>
  valueInput.value === "none"
    ? ({ ...formRules, value: [] } as FormRules)
    : formRules
);

function loadMatchOptions(name?: string[]) {
  matchList.value = [];
  if (!name || name.length < 2) return;
  if (!hasAuth("lookups:SystemModelLabelField")) {
    message(t("systemPermission.lookupNoAuth"), { type: "warning" });
    return;
  }
  const index = name[0] === "*" ? 0 : 1;
  return modelLabelFieldApi
    .lookups({ table: name[index], field: name[index + 1] })
    .then(res => {
      if (res.code === 1000) {
        matchList.value = res.data as Array<{ value: string; label: string }>;
        // 字段变化后旧 match 可能已不适用（后端会拒），新列表里没有就清掉
        if (
          newFormInline.value.match &&
          !matchList.value.some(
            item => item.value === newFormInline.value.match
          )
        ) {
          newFormInline.value.match = "";
        }
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
}

/** 属性名（表/字段）变化：旧的 match 与 value 失去语义，一律清空重填 */
function handleNameChange(name?: string[]) {
  newFormInline.value.match = "";
  newFormInline.value.value = "";
  tableData.value = [];
  if (name?.[0] === "*" && name?.[1] === "*") {
    // 全表全字段 = 全部数据：直接落到对应类型，避免「看起来像全部数据但保存被拒」
    newFormInline.value.type = FieldKeyChoices.ALL;
    newFormInline.value.match = "all";
    newFormInline.value.value = "*";
    matchList.value = [];
    return;
  }
  loadMatchOptions(name);
}

/** 值类型变化：清空与旧类型绑定的 value，避免脏值提交后被后端拒绝 */
function valueTypeChange(value?: string) {
  tableData.value = [];
  newFormInline.value.value = "";
  if (value === FieldKeyChoices.ALL) {
    newFormInline.value.match = "all";
    newFormInline.value.value = "*";
  }
}

/** 应用常用模板：只预置 type/match，表与字段按语义由管理员选择 */
function applyPreset(preset: RulePreset) {
  tableData.value = [];
  if (preset.wildcard) {
    newFormInline.value.name = ["*", "*"];
    newFormInline.value.type = preset.type;
    newFormInline.value.match = preset.match;
    newFormInline.value.value = "*";
    matchList.value = [];
    return;
  }
  newFormInline.value.type = preset.type;
  newFormInline.value.match = preset.match;
  newFormInline.value.value = "";
}

onMounted(() => {
  loadMatchOptions(newFormInline.value.name);
  try {
    tableData.value = JSON.parse(newFormInline.value.value);
  } catch {
    tableData.value = [];
  }
});

watchDeep(
  () => tableData.value,
  value => {
    if (
      [
        FieldKeyChoices.TABLE_USER,
        FieldKeyChoices.TABLE_ROLE,
        FieldKeyChoices.TABLE_MENU,
        FieldKeyChoices.TABLE_DEPT,
        FieldKeyChoices.DEPARTMENTS
      ].indexOf(newFormInline.value.type) > -1
    ) {
      newFormInline.value.value = JSON.stringify(value);
    }
  }
);

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRulesComputed"
    label-width="80px"
  >
    <el-row :gutter="24">
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('systemPermission.addName')" prop="name">
          <el-cascader
            v-model="newFormInline.name"
            :options="cascaderOptions"
            :placeholder="t('systemPermission.addName')"
            :props="{
              value: 'name',
              label: 'label',
              children: 'children'
            }"
            class="w-full"
            clearable
            filterable
            @change="handleNameChange"
          >
            <template #default="{ node, data }">
              <span>{{ data.label }}</span>
              <span v-show="data.parent">({{ data.name }})</span>
              <span v-show="!node.isLeaf">
                ({{ data?.children?.length }})
              </span>
            </template>
          </el-cascader>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('systemPermission.presets')">
          <div class="flex flex-wrap gap-2">
            <el-button
              v-for="preset in RULE_PRESETS"
              :key="preset.key"
              size="small"
              @click="applyPreset(preset)"
            >
              {{ t(`systemPermission.preset_${preset.key}`) }}
            </el-button>
          </div>
        </el-form-item>
      </re-col>
      <re-col
        v-if="newFormInline.type !== FieldKeyChoices.ALL"
        :sm="24"
        :value="24"
        :xs="24"
      >
        <el-form-item :label="t('systemPermission.addMatch')" prop="match">
          <template #label>
            <from-question
              description="https://docs.djangoproject.com/zh-hans/5.0/ref/models/querysets/#field-lookups"
              :label="t('systemPermission.addMatch')"
            />
          </template>
          <el-select
            v-model="newFormInline.match"
            :placeholder="t('systemPermission.addMatch')"
            :reserve-keyword="false"
            allow-create
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in matchList"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <span style="float: left; padding-right: 20px">
                {{ item.value }}
              </span>
              <span
                style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
              >
                {{ item.label }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('systemPermission.addExclude')" prop="exclude">
          <template #label>
            <from-question
              :description="t('systemPermission.addExcludeTip')"
              :label="t('systemPermission.addExclude')"
            />
          </template>
          <el-select
            v-model="newFormInline.exclude"
            :placeholder="t('systemPermission.addExclude')"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              :label="t('systemPermission.excludeInclude')"
              :value="false"
            />
            <el-option
              :label="t('systemPermission.excludeExclude')"
              :value="true"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('systemPermission.addType')" prop="type">
          <el-select
            v-model="newFormInline.type"
            :placeholder="t('systemPermission.addType')"
            :reserve-keyword="false"
            class="w-full"
            clearable
            default-first-option
            filterable
            @change="valueTypeChange"
          >
            <el-option
              v-for="item in valuesData"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <span style="float: left; padding-right: 12px">
                {{ item.label }}
              </span>
              <span
                style="
                  float: right;
                  font-size: 12px;
                  color: var(--el-text-color-secondary);
                "
              >
                {{ item.hint }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
      </re-col>
      <re-col v-if="typeHint" :sm="24" :value="24" :xs="24">
        <el-alert
          :closable="false"
          :title="typeHint"
          class="mb-2"
          show-icon
          type="info"
        />
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item
          v-if="valueInput === 'none'"
          :label="t('systemPermission.addValue')"
        >
          <el-text type="info">{{
            t("systemPermission.valueByRuntime")
          }}</el-text>
        </el-form-item>
        <el-form-item
          v-else-if="newFormInline.type === FieldKeyChoices.DATETIME"
          :label="t('systemPermission.addValue')"
          prop="value"
        >
          <el-date-picker
            v-model="newFormInline.value"
            :shortcuts="getDateTimePickerShortcuts()"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item
          v-else-if="newFormInline.type === FieldKeyChoices.DATETIME_RANGE"
          :label="t('systemPermission.addValue')"
          prop="value"
        >
          <el-date-picker
            v-model="newFormInline.value"
            :shortcuts="getPickerShortcuts()"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item
          v-else-if="
            newFormInline.type === FieldKeyChoices.TABLE_USER &&
            hasAuth('list:SearchUser')
          "
          :label="t('systemPermission.notice_user')"
          prop="notice_user"
        >
          <SearchUser v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-else-if="
            (newFormInline.type === FieldKeyChoices.TABLE_DEPT ||
              newFormInline.type === FieldKeyChoices.DEPARTMENTS) &&
            hasAuth('list:SearchDept')
          "
          :label="t('systemPermission.notice_dept')"
          prop="notice_dept"
        >
          <SearchDept v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-else-if="
            newFormInline.type === FieldKeyChoices.TABLE_ROLE &&
            hasAuth('list:SearchRole')
          "
          :label="t('systemPermission.notice_role')"
          prop="notice_role"
        >
          <SearchRole v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-else-if="
            newFormInline.type === FieldKeyChoices.TABLE_MENU &&
            hasAuth('list:SearchMenu')
          "
          :label="t('systemPermission.notice_menu')"
          prop="notice_menu"
        >
          <SearchMenu v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-else
          :label="t('systemPermission.addValue')"
          prop="value"
        >
          <el-input
            v-model="newFormInline.value"
            :placeholder="t('systemPermission.addValue')"
            clearable
          />
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
