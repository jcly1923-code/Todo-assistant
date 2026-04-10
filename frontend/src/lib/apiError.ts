/** 从 axios 类错误中提取 FastAPI 的 `detail` 字符串（若有）。 */
export function getApiErrorDetail(error: unknown): string | undefined {
  const d = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof d === 'string' && d.trim() ? d : undefined;
}
