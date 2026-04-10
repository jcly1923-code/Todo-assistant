import re

PASSWORD_MIN_LEN = 6
PASSWORD_MAX_LEN = 72


def validate_password_strength(password: str) -> str:
    if len(password) < PASSWORD_MIN_LEN or len(password) > PASSWORD_MAX_LEN:
        raise ValueError(f"密码长度需在 {PASSWORD_MIN_LEN}～{PASSWORD_MAX_LEN} 位之间")
    if not re.search(r"[a-z]", password) or not re.search(r"[A-Z]", password):
        raise ValueError("密码须同时包含大写与小写英文字母")
    return password
