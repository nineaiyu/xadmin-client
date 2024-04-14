<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { message } from "@/utils/message";
import { FieldKeyChoices } from "@/views/system/constants";
import { hasGlobalAuth } from "@/router/utils";
import SearchUsers from "@/views/system/base/searchUsers.vue";
import { watchDeep } from "@vueuse/core";
import SearchDepts from "@/views/system/base/searchDepts.vue";
import SearchRoles from "@/views/system/base/searchRoles.vue";
import SearchMenus from "@/views/system/base/searchMenus.vue";
import ReCol from "@/components/ReCol";
import { modelLabelFieldApi } from "@/api/system/field";

const props = withDefaults(defineProps<FormProps>(), {
  valuesData: () => [],
  fieldLookupsData: () => [],
  formInline: () => ({
    name: "",
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
  if (value[0] === "*" && value[1] === "*") {
    matchList.value = ["*"];
    newFormInline.value.match = "*";
    newFormInline.value.value = "*";
    return;
  }
  if (hasGlobalAuth("list:systemModelFieldLookups")) {
    modelLabelFieldApi
      .lookups({ table: value[0], field: value[1] })
      .then(res => {
        if (res.code === 1000) {
          matchList.value = res.data.results;
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
    if (item.key === value) {
      showValueInput.value = item.disabled;
    }
  });
};

const tableData = ref([]);

onMounted(() => {
  valueTypeChange(newFormInline.value.type);
  if (newFormInline.value?.name[0]) {
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
            <template #default="{ data }">
              <span>{{ data.label }}-{{ data.name }}</span>
            </template>
          </el-cascader>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('systemPermission.addMatch')" prop="match">
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
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="12" :xs="24">
        <el-form-item :label="t('systemPermission.addExclude')" prop="exclude">
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
              :key="item.key"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col :sm="24" :value="24" :xs="24">
        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_USER &&
            hasGlobalAuth('list:systemSearchUsers')
          "
          :label="t('systemPermission.notice_user')"
          prop="notice_user"
        >
          <search-users v-model="tableData" />
        </el-form-item>

        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_DEPT &&
            hasGlobalAuth('list:systemSearchDepts')
          "
          :label="t('systemPermission.notice_dept')"
          prop="notice_dept"
        >
          <search-depts v-model="tableData" />
        </el-form-item>
        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_ROLE &&
            hasGlobalAuth('list:systemSearchRoles')
          "
          :label="t('systemPermission.notice_role')"
          prop="notice_role"
        >
          <search-roles v-model="tableData" />
        </el-form-item>

        <el-form-item
          v-if="
            newFormInline.type === FieldKeyChoices.TABLE_MENU &&
            hasGlobalAuth('list:systemSearchMenus')
          "
          :label="t('systemPermission.notice_menu')"
          prop="notice_menu"
        >
          <search-menus v-model="tableData" />
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
