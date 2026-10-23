import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { isSuccess } from "@/api/types";
import { settingsOAuthProviderApi } from "@/api/system/settings";
import {
  normalizeProvider,
  providerPayload,
  type OAuthFlavor,
  type OAuthProvider
} from "../utils/oauthProvider";

export function useOAuthProviders() {
  const { t } = useI18n();
  const providers = ref<OAuthProvider[]>([]);
  const flavors = ref<OAuthFlavor[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const loadFailed = ref(false);

  const load = async () => {
    loading.value = true;
    loadFailed.value = false;
    try {
      const res = await settingsOAuthProviderApi.retrieve();
      if (!isSuccess(res)) {
        loadFailed.value = true;
        return;
      }
      providers.value = (
        (res.data?.providers ?? []) as Array<Record<string, unknown>>
      ).map(normalizeProvider);
      flavors.value = (res.data?.flavors ?? []) as OAuthFlavor[];
    } catch {
      loadFailed.value = true;
    } finally {
      loading.value = false;
    }
  };

  const save = async () => {
    saving.value = true;
    try {
      const res = await settingsOAuthProviderApi.partialUpdate(
        {},
        { providers: providers.value.map(providerPayload) }
      );
      if (!isSuccess(res)) {
        return {
          ok: false,
          detail: res.detail || t("oauthProvider.saveFailed")
        };
      }
      providers.value = (
        (res.data?.providers ?? []) as Array<Record<string, unknown>>
      ).map(normalizeProvider);
      return { ok: true, detail: "" };
    } catch (error) {
      return { ok: false, detail: String(error) };
    } finally {
      saving.value = false;
    }
  };

  const test = async (provider: OAuthProvider) => {
    try {
      const res = await settingsOAuthProviderApi.testProvider(
        providerPayload(provider)
      );
      if (!isSuccess(res)) {
        return {
          ok: false,
          detail: res.detail || t("oauthProvider.testFailed"),
          data: null
        };
      }
      return { ok: true, detail: res.detail || "", data: res.data };
    } catch (error) {
      return { ok: false, detail: String(error), data: null };
    }
  };

  return { providers, flavors, loading, saving, loadFailed, load, save, test };
}
