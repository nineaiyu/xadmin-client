import { useGlobal } from "@pureadmin/utils";

/** 设置项读写与本地存储同步：统一更新 `$storage.configure` 并回写响应式 `storage` */
export function useConfigureStorage() {
  const { $storage } = useGlobal<GlobalPropertiesApi>();

  function storageConfigureChange<T>(key: string, val: T): void {
    // 必须换引用：responsive-storage 只在给 `$storage.configure` 赋新对象时
    // 才同步落 localStorage；原地改字段再赋同一引用会让 saveSiteConfig 读到旧值，
    // 表现为「面板已生效、自动保存判定无差异而跳过」。
    $storage.configure = {
      ...($storage.configure as Record<string, unknown>),
      [key]: val
    } as typeof $storage.configure;
  }

  return { storageConfigureChange };
}
