<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { formRules } from "./utils/rule";
import { FormProps } from "./utils/types";
import { getDataPermissionLookupsListApi } from "@/api/system/permission";
import { message } from "@/utils/message";

const props = withDefaults(defineProps<FormProps>(), {
  valuesData: () => [],
  fieldLookupsData: () => [],
  formInline: () => ({
    name: "",
    match: "",
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
const getMatchData = value => {
  if (value[0] === "*" && value[1] === "*") {
    matchList.value = ["*"];
    newFormInline.value.match = "*";
    newFormInline.value.value = "*";
    return;
  }
  getDataPermissionLookupsListApi({ table: value[0], field: value[1] }).then(
    res => {
      if (res.code === 1000) {
        matchList.value = res.data.results;
      } else {
        message(`${t("results.failed")}，${res.detail}`, {
          type: "error"
        });
      }
    }
  );
};
const { t } = useI18n();
const showValueInput = ref(true);
const valueTypeChange = value => {
  props.valuesData.forEach(item => {
    if (item.key === value) {
      showValueInput.value = item.value_show;
    }
  });
};

defineExpose({ getRef });
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="newFormInline"
    :rules="formRules"
    label-width="80px"
  >
    <el-form-item :label="t('permission.addName')" prop="name">
      <el-cascader
        v-model="newFormInline.name"
        class="w-full"
        :placeholder="t('permission.addName')"
        :options="props.fieldLookupsData"
        :props="{
          value: 'value',
          label: 'name',
          children: 'model_fields'
        }"
        clearable
        filterable
        @change="getMatchData"
      >
        <template #default="{ data }">
          <span>{{ data.name }}</span>
        </template>
      </el-cascader>
    </el-form-item>
    <el-form-item :label="t('permission.addMatch')" prop="match">
      <el-select
        v-model="newFormInline.match"
        class="w-full"
        filterable
        clearable
        allow-create
        :reserve-keyword="false"
        :placeholder="t('permission.addMatch')"
      >
        <el-option
          v-for="item in matchList"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </el-form-item>
    <el-form-item :label="t('permission.addType')" prop="type">
      <el-select
        v-model="newFormInline.type"
        class="w-full"
        filterable
        clearable
        default-first-option
        :reserve-keyword="false"
        :placeholder="t('permission.addType')"
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
    <el-form-item
      v-if="showValueInput"
      :label="t('permission.addValue')"
      prop="value"
    >
      <el-input
        v-model="newFormInline.value"
        :placeholder="t('permission.addValue')"
        clearable
      />
    </el-form-item>
  </el-form>
</template>
