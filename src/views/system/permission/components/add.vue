<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { message } from "@/utils/message";
import { FieldKeyChoices } from "@/views/system/constants";
import { hasAuth } from "@/router/utils";
import { watchDeep } from "@vueuse/core";
import ReCol from "@/components/ReCol";
import { modelLabelFieldApi } from "@/api/system/field";
import {
  getDateTimePickerShortcuts,
  getPickerShortcuts
} from "@/views/system/utils";
import SearchUser from "@/views/system/components/SearchUser.vue";
import SearchDept from "@/views/system/components/SearchDept.vue";
import SearchRole from "@/views/system/components/SearchRole.vue";
import SearchMenu from "@/views/system/components/SearchMenu.vue";
import FromQuestion from "@/components/FromQuestion/index.vue";

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

const ruleFormRef = ref();
const newFormInline = ref(props.formInline);

function getRef() {
  return ruleFormRef.value;
}

const matchList = ref([]);
const getMatchData = (value: any) => {
  if (!value) return;
  if (value[0] === "*" && value[1] === "*") {
    matchList.value = ["*"];
    newFormInline.value.match = "*";
    newFormInline.value.value = "*";
    return;
  }
  if (hasAuth("lookups:SystemModelLabelField")) {
    let index = 1;
    if (value[0] === "*") {
      index = 0;
    }
    modelLabelFieldApi
      .lookups({ table: value[index], field: value[index + 1] })
      .then(res => {
        if (res.code === 1000) {
          matchList.value = res.data;
        } else {
          message(`${t("results.failed")}，${res.detail}`, {
            type: "error"
          });
        }
      });
  }
};
const { t } = useI18n();
const showValueInput = ref(true);
const valueTypeChange = value => {
  tableData.value = [];
  // newFormInline.value.value = "";
  props.valuesData.forEach(item => {
    if (item.value === value) {
      showValueInput.value = item.disabled;
    }
  });
};

const tableData = ref([]);

onMounted(() => {
  valueTypeChange(newFormInline.value.type);
  if (newFormInline.value?.name[1]) {
    getMatchData(newFormInline.value.name);
  }
  try {
    tableData.value = JSON.parse(newFormInline.value.value);
  } catch (e) {
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
        FieldKeyChoices.TABLE_DEPT
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
    :rules="formRules"
    label-width="80px"
  >
    <el-row :gutter="24">
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item :label="t('systemPermission.addName')" prop="name">
          <el-cascader
            v-model="newFormInline.name"
            :options="props.fieldLookupsData"
            :placeholder="t('systemPermission.addName')"
            :props="{
              value: 'name',
              label: 'label',
              children: 'children'
            }"
            class="w-full"
            clearable
            filterable
            @change="getMatchData"
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
            <template #label="{ label, value }">
              <span style=" margin-right: 20px;font-weight: bold">{{
                value
              }}</span>
              <el-text type="info">{{ label }}</el-text>
            </template>
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
            <el-option :label="t('labels.enable')" :value="true" />
            <el-option :label="t('labels.disable')" :value="false" />
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
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item
          v-if="newFormInline.type === FieldKeyChoices.DATETIME"
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
          v-if="newFormInline.type === FieldKeyChoices.DATETIME_RANGE"
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
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_USER &&
            hasAuth('list:SearchUser')
          "
          :label="t('systemPermission.notice_user')"
          prop="notice_user"
        >
          <SearchUser v-model="tableData" />
        </el-form-item>

        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_DEPT &&
            hasAuth('list:SearchDept')
          "
          :label="t('systemPermission.notice_dept')"
          prop="notice_dept"
        >
          <SearchDept v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_ROLE &&
            hasAuth('list:SearchRole')
          "
          :label="t('systemPermission.notice_role')"
          prop="notice_role"
        >
          <SearchRole v-model="tableData" />
        </el-form-item>

        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_MENU &&
            hasAuth('list:SearchMenu')
          "
          :label="t('systemPermission.notice_menu')"
          prop="notice_menu"
        >
          <SearchMenu v-model="tableData" />
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item
          v-if="showValueInput"
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
