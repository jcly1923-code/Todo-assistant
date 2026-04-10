"""日报/周报提示词拼装（与聚合数据解耦，便于单独审阅与修改）。"""

from typing import Optional

from .tomorrow import TOMORROW_JSON_END, TOMORROW_JSON_START


def _tone_block(tone_profile: Optional[str]) -> list[str]:
    if not (tone_profile and tone_profile.strip()):
        return []
    return [
        "## 用户语气风格参考（仅影响措辞与节奏，不得改变事实材料中的任何数据、事项与日期）",
        "",
        tone_profile.strip(),
        "",
    ]


def build_daily_prompt(data: dict, tone_profile: Optional[str] = None) -> str:
    """构建日报生成的 prompt"""
    completed_earlier = data.get("completed_today_created_earlier") or []
    early_done = data.get("early_completed_today") or []
    incomplete_nv = data.get("incomplete_carryover_not_overdue") or []
    overdue = data.get("overdue_incomplete") or []
    open_titles = data.get("open_incomplete_titles") or []

    lines = [
        "你擅长从杂乱的待办事项清单中提取关键信息，并将其转化为一份结构清晰、重点突出、具有反思价值的工作日报。"
        "请严格依据下方「事实材料」撰写内容，不要臆测材料中未出现的信息。"
        "文风以克制、白描为主：围绕材料还原当日工作情况，避免戏剧化叙事、堆砌比喻或长篇抒情；待办多为简短标题时以概括为主，勿延伸成剧情式过程。"
        "不得编造与材料矛盾的事实、数字或未出现的细节。",
        "",
        f"## 目标日期：{data['date']}",
        "",
        "统计口径说明：基础清单为「目标日创建的待办」与「目标日标记完成的待办」。"
        "另有「补充事实」列出跨日完成、提前完成、历史未完成与逾期风险；仅当对应小节非空时，才在正文中引用，勿虚构补充小节中不存在的条目。",
        "期望截止日期以事实材料中的日期为准；未写「期望截止」或写「未设置」表示用户未填。",
        "",
        f"参考数字：当日相关事件合计 {data['total_events']} 条（新建 {data['total_created']} 条，完成 {data['total_completed']} 条）。",
        "",
        *_tone_block(tone_profile),
        "## 事实材料",
        "",
    ]

    if data["created"]:
        lines.append("### 当日创建的待办")
        for i, t in enumerate(data["created"], 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            lines.append(f"{i}. {t['title']}{tag_str}")
        lines.append("")
    else:
        lines.append("### 当日创建的待办")
        lines.append("（无）")
        lines.append("")

    if data["completed"]:
        lines.append("### 当日完成的待办")
        for i, t in enumerate(data["completed"], 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            lines.append(f"{i}. {t['title']}{tag_str}")
        lines.append("")
    else:
        lines.append("### 当日完成的待办")
        lines.append("（无）")
        lines.append("")

    lines.append("### 补充：今日完成、但创建日早于今日的待办")
    if completed_earlier:
        for i, t in enumerate(completed_earlier, 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            due = t.get("due_date") or "未设置"
            lines.append(
                f"{i}. {t['title']}{tag_str}（创建日 {t['created_date']}，期望截止 {due}，"
                f"完成日 {t.get('completed_date') or ''}）"
            )
        lines.append("")
    else:
        lines.append("（无）")
        lines.append("")

    lines.append("### 补充：其中「提前完成」（完成日期早于期望截止日期，可在执行快照中简短鼓励）")
    if early_done:
        for i, t in enumerate(early_done, 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            lines.append(
                f"{i}. {t['title']}{tag_str}（期望截止 {t.get('due_date') or ''}，完成日 {t.get('completed_date') or ''}）"
            )
        lines.append("")
    else:
        lines.append("（无）")
        lines.append("")

    lines.append(
        "### 补充：截至目标日仍未完成、且创建日早于目标日（期望截止未早于目标日或未设置期望截止）"
    )
    if incomplete_nv:
        for i, t in enumerate(incomplete_nv, 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            due = t.get("due_date") or "未设置"
            lines.append(f"{i}. {t['title']}{tag_str}（创建日 {t['created_date']}，期望截止 {due}）")
        lines.append("")
    else:
        lines.append("（无）")
        lines.append("")

    lines.append(
        "### 补充：截至目标日仍未完成、且期望截止日期早于目标日（已逾期，须在执行快照中提示时间与优先级风险）"
    )
    if overdue:
        for i, t in enumerate(overdue, 1):
            tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
            due = t.get("due_date") or ""
            lines.append(f"{i}. {t['title']}{tag_str}（创建日 {t['created_date']}，期望截止 {due}）")
        lines.append("")
    else:
        lines.append("（无）")
        lines.append("")

    lines.append("### 用户当前未完成待办标题（下列若与明日建议重复，则用户会创建出重复待办）")
    if open_titles:
        lines.append(
            "明日计划 JSON 的 `items` 中 **不得** 出现与下列标题相同或仅轻微改写的条目；"
            "若需推进同类事项，应写成「下一步具体动作」或子步骤，而非重复已有待办标题。"
        )
        for i, tit in enumerate(open_titles, 1):
            lines.append(f"{i}. {tit}")
        lines.append("")
    else:
        lines.append("（当前无进行中待办）")
        lines.append("")

    lines.extend(
        [
            "输出格式要求（正文使用 Markdown 格式）：",
            "",
            "### 1. 执行快照",
            "- 用一句话概括今天主要工作内容。",
            "- 简要说明：当日新建与当日完成的条数（仅数量，不列清单）。",
            "- 若「补充」中有「今日完成、但创建早于今日」：点明条数，并概括这类工作的性质（仍勿逐条抄标题）。",
            "- 若「补充」中有「提前完成」：可简短正向鼓励（基于事实，不夸大）。",
            "- 若「补充」中有「创建早于今日、今日仍未完成」：点明仍在推进或积压的风险（条数级）。",
            "- 若「补充」中有「已逾期仍未完成」：**必须**提示用户注意时间与优先级风险，语气务实、不指责；若无该小节或为空则不要编造逾期。",
            "- 若某类补充为「（无）」，不要在快照中假装存在该类情况。",
            "",
            "### 2. 成长复盘（重点模块）",
            "分两部分书写，体现总结与思考：复盘须紧扣标题与标签能直接支撑的内容，克制还原、少写「故事」；与材料矛盾或未出现的细节不得写入。",
            "信息不足时宁可简短并注明「依据有限」，勿用生动联想代替事实。",
            "",
            "**今天所学（2～3 点）**",
            "- 具体说明做了哪些事情、收获与经验，以及经验是否可复用（须与材料一致，勿写材料未出现的细节）。",
            "",
            "**改进与提升（1～2 点）**",
            "- 哪些事情遇到困难，具体卡在哪一步。",
            "- 新发现：如工作偏好、难点、如何克服与提升。",
            "- 诚实记录，不粉饰、不推责。",
            "",
            "正文全部结束后，**必须另起一行**输出下列「机器可读块」（供系统解析「明日计划」）。",
            "该块共 **三行**，不得使用 Markdown 代码块（不要用 ``` 包裹），不要在正文其它位置重复明日建议：",
            "",
            f"第 1 行（必须与下列标记字符完全一致）：{TOMORROW_JSON_START}",
            "第 2 行：单行合法 JSON 对象（双引号键名，无注释、无尾逗号、无换行）。结构示例：",
            '{"items":[{"title":"待办标题示例一"},{"title":"待办标题示例二"}]}',
            f"第 3 行（必须与下列标记字符完全一致）：{TOMORROW_JSON_END}",
            "",
            "JSON 字段要求：`items` 为数组，每项仅含字符串字段 `title`；建议 3～5 条；须与上文复盘相关、明天可执行；"
            "且每条 `title` 须与上文「用户当前未完成待办标题」在语义上可区分，禁止重复积压事项。",
            "用语自然，避免「赋能」「抓手」等空泛词。",
            "",
            "## 限制（必须遵守）",
            "- 禁止虚构、夸大成果或隐瞒不利信息。",
            "- 不得引入材料中未出现的待办标题、数字或结论。",
            "- 叙述与推断须可被事实材料支持；优先归纳与白描，避免浮夸修辞与未经验证的推断。"
            "不得编造具体背景、过程、决策或时间线，除非标题或描述中明确含有对应信息。",
            "- 语言风格贴近工作日报，语气自然、干练，体现反思与成长。",
        ]
    )

    return "\n".join(lines)


def build_weekly_prompt(data: dict, tone_profile: Optional[str] = None) -> str:
    """构建周报生成的 prompt"""
    s = data["summary"]
    open_titles = data.get("open_incomplete_titles") or []

    lines = [
        "你擅长跨日复盘、总结与制定后续计划。请严格依据下方「事实材料」撰写内容，不要臆测材料中未出现的信息。"
        "文风以克制、白描为主：围绕材料归纳本周节奏与结论，避免戏剧化叙事、堆砌比喻或长篇抒情；标题与标签较简短时以概括为主，勿延伸成剧情式过程。"
        "不得编造与材料矛盾的事实、数字或未出现的细节。",
        "",
        f"## 目标周期：{data['week_start']} 至 {data['week_end']}（自然周）",
        "",
        "统计口径说明：下列材料按日列出；基础项为「该日创建的待办」与「该日标记完成的待办」。"
        "各日「补充」为与日报一致的跨日/截止相关事实（若有），仅当对应行非空时可在正文中引用，勿虚构。",
        "期望截止日期以材料中的日期为准；未写「期望截止」或写「未设置」表示用户未填。",
        "",
        (
            f"参考数字（全周汇总）：相关事件合计 {s['total_events']} 条（新建 {s['total_created']} 条，"
            f"完成 {s['total_completed']} 条；完成条数占「新建+完成」事件合计的 {s['completion_rate']}%）。"
        ),
        "",
        *_tone_block(tone_profile),
        "## 事实材料（按日）",
        "",
    ]

    has_any_day = False
    for day_data in data["daily_data"]:
        if day_data["total_events"] == 0:
            continue
        has_any_day = True
        lines.append(f"### {day_data['date']}")

        if day_data["created"]:
            lines.append("#### 当日创建的待办")
            for i, t in enumerate(day_data["created"], 1):
                tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
                lines.append(f"{i}. {t['title']}{tag_str}")
        else:
            lines.append("#### 当日创建的待办")
            lines.append("（无）")

        lines.append("")

        if day_data["completed"]:
            lines.append("#### 当日完成的待办")
            for i, t in enumerate(day_data["completed"], 1):
                tag_str = f" [{', '.join(t['tags'])}]" if t["tags"] else ""
                lines.append(f"{i}. {t['title']}{tag_str}")
        else:
            lines.append("#### 当日完成的待办")
            lines.append("（无）")

        lines.append("")

        ce = day_data.get("completed_today_created_earlier") or []
        early = day_data.get("early_completed_today") or []
        carry_nv = day_data.get("incomplete_carryover_not_overdue") or []
        overdue = day_data.get("overdue_incomplete") or []
        if ce or early or carry_nv or overdue:
            lines.append("#### 补充（与日报同一统计口径）")
            if ce:
                lines.append(f"- 当日完成、但创建日早于当日：{len(ce)} 条")
            if early:
                lines.append(f"- 其中提前完成（完成日早于期望截止日）：{len(early)} 条")
            if carry_nv:
                lines.append(
                    f"- 截至当日仍未完成、且创建早于当日（未逾期或期望截止未早于当日）：{len(carry_nv)} 条"
                )
            if overdue:
                lines.append(
                    f"- 截至当日仍未完成、且期望截止早于当日（已逾期）：{len(overdue)} 条"
                )
            lines.append("")

    if not has_any_day:
        lines.append("（本周各日均无上述口径下的创建或完成记录。）")
        lines.append("")

    lines.append("### 用户当前未完成待办标题（生成「下周计划建议」时不要重复下列积压事项）")
    if open_titles:
        lines.append(
            "下列为截至生成时仍在进行中的待办标题；「下周计划建议」须写可区分的下一步或子任务，"
            "不得与下列标题相同或仅轻微改写，以免与现有待办重复。"
        )
        for i, tit in enumerate(open_titles, 1):
            lines.append(f"{i}. {tit}")
        lines.append("")
    else:
        lines.append("（当前无进行中待办）")
        lines.append("")

    lines.extend(
        [
            "## 输出要求（请使用 Markdown）",
            "",
            "请按以下模块组织全文：",
            "",
            "1. **数据统计**：基于按日清单与「补充」计数，概括本周新建、完成的大致分布；可点明哪几天更集中（仅当材料能支持时）。"
            "若需提及「未完成/积压/逾期」，须与上表补充数字或标题一致，不得编造；材料不足时注明「依据有限」。",
            "",
            "2. **总结与归类**：在尊重事实的前提下做跨日归纳，提炼亮点、风险与不足；叙述须可被材料支持，优先归纳与白描。"
            "可适度概括工作节奏，但不得编造具体背景、过程、决策或时间线，除非标题或描述中明确含有对应信息。",
            "",
            "3. **下周计划建议**：结合本周完成情况，给出可执行的下周安排；**须以「待办条目」形式逐条列出**（每条一句、可执行、可检验），"
            "且不得与上文「用户当前未完成待办标题」重复或同义重复。",
            "",
            "## 限制（必须遵守）",
            "",
            "- 禁止虚构、夸大成果或隐瞒不利信息。",
            "- 不得引入材料中未出现的待办标题、数字或结论。",
            "- 语言简洁、专业，适合工作场景周报复盘使用。",
        ]
    )

    return "\n".join(lines)
