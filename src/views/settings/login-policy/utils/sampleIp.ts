/**
 * 登录策略预演样例 IP 校验（纯函数，配 vitest）。
 *
 * 口径对齐服务端 `common/utils/ip/utils.py::is_ip_address`（Python
 * `ipaddress.ip_address` 严格解析）：
 * - IPv4 每段 0-255 且不接受前导零（`01.2.3.4` 服务端即按非法处理）；
 * - IPv6 接受 RFC 4291 完整/压缩形态（`::` 压缩至多一处、IPv4 映射尾按 2 组计）；
 * - 只收单个样例地址：CIDR / `a-b` 区间 / `*` / zone index（`fe80::1%eth0`）
 *   均不合法——那些是策略配置面的写法，预演输入是具体的一次登录来源。
 */

export function isIPv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d{1,3}$/.test(part)) return false;
    // 前导零拒绝（"0" 本身合法），与 Python ipaddress 解析口径一致
    if (part.length > 1 && part.startsWith("0")) return false;
    return Number(part) <= 255;
  });
}

export function isIPv6(value: string): boolean {
  if (!value.includes(":")) return false;
  if (value.includes("%")) return false;
  // 至多一处 :: 压缩
  const sections = value.split("::");
  if (sections.length > 2) return false;
  const toGroups = (section: string): string[] | null => {
    if (section === "") return [];
    const groups = section.split(":");
    // 段内出现空组（如 `1:::2`、`1:` ）即非法
    return groups.some(group => group === "") ? null : groups;
  };
  const head = toGroups(sections[0]);
  const tail = sections.length === 2 ? toGroups(sections[1]) : [];
  if (!head || !tail) return false;

  // 逐组校验：1-4 位十六进制；末组可为 IPv4 点分十进制（按 2 组折算）
  const groups = [...head, ...tail];
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    if (isIPv4(group)) {
      // IPv4 映射尾只能是最后一组
      if (i !== groups.length - 1) return false;
      count += 2;
      continue;
    }
    if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return false;
    count += 1;
  }

  // 无压缩：恰 8 组；有压缩：显式组最多 7（:: 至少替代 1 组，`::` 本身即全零地址）
  return sections.length === 2 ? count <= 7 : count === 8;
}
