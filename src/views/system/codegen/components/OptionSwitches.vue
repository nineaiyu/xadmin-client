<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { MODULE_LEVELS, type CodegenFormState } from "../utils/payload";

defineOptions({ name: "CodegenOptionSwitches" });

const state = defineModel<CodegenFormState>({ required: true });

const { t } = useI18n();
</script>

<template>
  <el-form label-width="92px" label-position="left" class="codegen-options">
    <el-form-item :label="t('codegen.options')">
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <el-checkbox v-model="state.with_import_export">
          {{ t("codegen.withImportExport") }}
        </el-checkbox>
        <el-checkbox v-model="state.with_tags">
          {{ t("codegen.withTags") }}
        </el-checkbox>
        <el-checkbox v-model="state.with_tests">
          {{ t("codegen.withTests") }}
        </el-checkbox>
        <el-checkbox v-model="state.with_module">
          {{ t("codegen.withModule") }}
        </el-checkbox>
        <el-checkbox v-model="state.with_ai">
          {{ t("codegen.withAi") }}
        </el-checkbox>
        <el-checkbox v-model="state.with_frontend">
          {{ t("codegen.withFrontend") }}
        </el-checkbox>
        <el-checkbox v-model="state.skip_menu_seed">
          {{ t("codegen.skipMenuSeed") }}
        </el-checkbox>
      </div>
    </el-form-item>
    <template v-if="state.with_module">
      <el-form-item :label="t('codegen.moduleId')">
        <el-input
          v-model="state.module_id"
          :placeholder="t('codegen.moduleIdPlaceholder')"
        />
      </el-form-item>
      <el-form-item :label="t('codegen.moduleLevel')">
        <el-radio-group v-model="state.module_level">
          <el-radio-button
            v-for="level in MODULE_LEVELS"
            :key="level"
            :value="level"
          >
            {{ t(`codegen.moduleLevel_${level}`) }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
    </template>
  </el-form>
</template>
