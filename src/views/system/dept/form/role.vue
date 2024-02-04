<script lang="ts" setup>
import { ref } from "vue";
import ReCol from "@/components/ReCol";
import { RoleFormProps } from "../utils/types";
import { useI18n } from "vue-i18n";
import { ModeChoices } from "@/views/system/constants";

const props = withDefaults(defineProps<RoleFormProps>(), {
  formInline: () => ({
    name: "",
    code: "",
    mode_type: ModeChoices.AND,
    rolesOptions: [],
    rulesOptions: [],
    choicesDict: [],
    ids: [],
    pks: []
  })
});
const { t } = useI18n();

const newFormInline = ref(props.formInline);
</script>

<template>
  <el-form :model="newFormInline" label-width="80px">
    <el-row :gutter="30">
      <re-col>
        <el-form-item :label="t('dept.name')" prop="name">
          <el-input v-model="newFormInline.name" disabled />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('dept.code')" prop="code">
          <el-input v-model="newFormInline.code" disabled />
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('dept.roles')" prop="ids">
          <el-select
            v-model="newFormInline.ids"
            class="w-full"
            clearable
            multiple
          >
            <el-option
              v-for="item in newFormInline.rolesOptions"
              :key="item.pk"
              :label="item.name"
              :value="item.pk"
            >
              <span style="float: left">{{ item.name }}</span>
              <span
                style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
                >{{ item.code }}</span
              >
            </el-option>
          </el-select>
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('permission.mode')" prop="mode_type">
          <el-select
            v-model="newFormInline.mode_type"
            class="!w-[180px]"
            clearable
          >
            <el-option
              v-for="item in newFormInline.choicesDict"
              :key="item.key"
              :disabled="item.disabled"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
      </re-col>
      <re-col>
        <el-form-item :label="t('dept.rules')" prop="pks">
          <el-select
            v-model="newFormInline.pks"
            class="w-full"
            clearable
            multiple
          >
            <el-option
              v-for="item in newFormInline.rulesOptions"
              :key="item.pk"
              :label="item.name"
              :value="item.pk"
            >
              <span style="float: left">{{ item.name }}</span>
              <span
                style="
                  float: right;
                  font-size: 13px;
                  color: var(--el-text-color-secondary);
                "
                >{{ item?.mode_display }}</span
              >
            </el-option>
          </el-select>
        </el-form-item>
      </re-col>
    </el-row>
  </el-form>
</template>
