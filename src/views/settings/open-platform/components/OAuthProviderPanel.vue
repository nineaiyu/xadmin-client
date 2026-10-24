<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, h, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import OAuthProviderCard from "./OAuthProviderCard.vue";
import { useOAuthProviders } from "../utils/useOAuthProviders";
import {
  emptyProvider,
  normalizeProvider,
  type OAuthProvider
} from "../utils/oauthProvider";

defineOptions({ name: "OAuthProviderPanel" });

const props = defineProps<{
  canRead: boolean;
  canEdit: boolean;
  canTest: boolean;
}>();

const { t } = useI18n();
const { providers, flavors, loading, saving, loadFailed, load, save, test } =
  useOAuthProviders();
const rawVisible = ref(false);
const rawText = ref("");
const rawError = ref("");

const canEdit = computed(() => props.canEdit);

const addProvider = () => {
  providers.value.push(emptyProvider());
};

const removeProvider = (index: number) => {
  providers.value.splice(index, 1);
};

const openRaw = () => {
  rawText.value = JSON.stringify(providers.value, null, 2);
  rawError.value = "";
  rawVisible.value = true;
};

const applyRaw = () => {
  try {
    const parsed = JSON.parse(rawText.value);
    if (!Array.isArray(parsed)) {
      rawError.value = t("oauthProvider.rawMustBeArray");
      return;
    }
    providers.value = parsed.map(item => normalizeProvider(item));
    rawVisible.value = false;
  } catch {
    rawError.value = t("oauthProvider.rawInvalid");
  }
};

const onSave = async () => {
  const result = await save();
  if (result.ok) {
    message(t("oauthProvider.saved"), { type: "success" });
  } else {
    message(result.detail, { type: "error" });
  }
};

const onTest = async (provider: OAuthProvider) => {
  const result = await test(provider);
  if (!result.ok) {
    message(result.detail, { type: "error" });
    return;
  }
  ElMessageBox.alert(
    h(
      "pre",
      { class: "whitespace-pre-wrap break-all" },
      JSON.stringify(result.data, null, 2)
    ),
    t("oauthProvider.testOk"),
    { confirmButtonText: t("buttons.close") }
  );
};

onMounted(load);
</script>

<template>
  <ReEmpty
    v-if="!canRead"
    data-testid="oauth-no-permission"
    :description="t('setting.noPermission')"
  />
  <div v-else v-loading="loading" class="space-y-3">
    <ReEmpty v-if="loadFailed" :description="t('setting.loadFailed')">
      <el-button type="primary" plain @click="load">
        {{ t("buttons.reload") }}
      </el-button>
    </ReEmpty>
    <template v-else>
      <div class="flex-bc flex-wrap gap-2">
        <p class="text-sm text-(--el-text-color-secondary)">
          {{ t("oauthProvider.desc") }}
        </p>
        <div v-if="canEdit" class="flex items-center gap-2">
          <el-button size="small" @click="addProvider">
            {{ t("oauthProvider.add") }}
          </el-button>
          <el-button size="small" @click="openRaw">
            {{ t("oauthProvider.rawMode") }}
          </el-button>
          <el-button
            size="small"
            type="primary"
            :loading="saving"
            @click="onSave"
          >
            {{ t("buttons.save") }}
          </el-button>
        </div>
      </div>
      <ReEmpty
        v-if="providers.length === 0"
        :description="t('oauthProvider.empty')"
      />
      <OAuthProviderCard
        v-for="(provider, index) in providers"
        :key="`${provider.key}-${index}`"
        :model-value="provider"
        :flavors="flavors"
        :can-edit="canEdit"
        :can-test="canTest"
        @update:model-value="providers[index] = $event"
        @remove="removeProvider(index)"
        @test="onTest"
      />
    </template>
    <el-dialog
      v-model="rawVisible"
      :title="t('oauthProvider.rawMode')"
      width="720px"
      destroy-on-close
    >
      <el-alert
        type="info"
        :closable="false"
        :title="t('oauthProvider.rawHint')"
        class="mb-3"
      />
      <el-input v-model="rawText" type="textarea" :rows="18" />
      <div v-if="rawError" class="mt-2 text-sm text-(--el-color-danger)">
        {{ rawError }}
      </div>
      <template #footer>
        <el-button @click="rawVisible = false">{{
          t("buttons.cancel")
        }}</el-button>
        <el-button type="primary" @click="applyRaw">
          {{ t("oauthProvider.rawApply") }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
