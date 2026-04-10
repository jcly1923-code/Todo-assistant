/** 浏览器本机 IANA 时区（定时任务保存时使用，与系统/浏览器时区一致） */
export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}
