import { useGlobal } from "@pureadmin/utils";

/** 设置项读写与本地存储同步：统一更新 `$storage.configure` 并回写响应式 `storage` */
export function useConfigureStorage() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  function storageConfigureChange<T>(key: string, val: T): void {
    const storageConfigure = $storage.configure;
    storageConfigure[key] = val;
    $storage.configure = storageConfigure;
  }

  return { storageConfigureChange };
}
