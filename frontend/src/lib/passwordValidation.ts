const MIN = 6;
const MAX = 72;

/** 返回首条不满足的规则说明；空串视为无错误（由 required 处理） */
export function getPasswordRuleError(password: string): string | null {
  if (!password) return null;
  if (password.length < MIN || password.length > MAX) {
    return `密码长度需在 ${MIN}～${MAX} 位之间`;
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return '须同时包含大写与小写英文字母';
  }
  return null;
}
