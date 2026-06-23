#!/usr/bin/env python3
"""
merge_entry.py — 将新条目合并到 data.json
用法：
  python merge_entry.py --input new_entry.json
  python merge_entry.py --input new_entry.json --dry-run  # 预览不写入
"""

import argparse
import json
import os
import sys
from datetime import datetime


DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data.json")


def load_data(path):
    """加载 data.json"""
    if not os.path.exists(path):
        print(f"❌ 文件不存在: {path}")
        print(f"   请先运行 python scripts/gen_examples.py 生成示例数据")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(path, data):
    """保存 data.json，保持中文字符不被转义"""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 已保存到 {path}")


def validate_entry(entry):
    """验证条目必填字段"""
    required = ["id", "title", "field", "summary", "breakthrough"]
    missing = [f for f in required if not entry.get(f)]
    if missing:
        return False, f"缺少必填字段: {', '.join(missing)}"
    return True, ""


def print_entry_preview(entry, index):
    """打印条目预览"""
    print(f"\n[{index}] {entry.get('title', '无标题')[:70]}")
    print(f"    学科: {entry.get('field', '?')}  |  评级: {'⭐' * (entry.get('innovationRating', 0) or 0)}  |  日期: {entry.get('dateAdded', '?')}")
    tags = entry.get('tags', [])
    if tags:
        print(f"    标签: {', '.join(tags[:6])}")
    print()


def main():
    parser = argparse.ArgumentParser(description="合并新条目到 data.json")
    parser.add_argument("--input", "-i", required=True, help="输入的 JSON 条目文件（generate_review.py 输出）")
    parser.add_argument("--dry-run", action="store_true", help="预览模式，不写入文件")
    parser.add_argument("--git-add", action="store_true", help="合并后自动 git add")
    args = parser.parse_args()

    # 加载新条目
    if not os.path.exists(args.input):
        print(f"❌ 文件不存在: {args.input}")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        new_entry = json.load(f)

    # 验证
    valid, msg = validate_entry(new_entry)
    if not valid:
        print(f"❌ 条目验证失败: {msg}")
        sys.exit(1)

    # 补充时间信息
    now = datetime.now().strftime("%Y-%m-%d")
    if not new_entry.get("dateAdded"):
        new_entry["dateAdded"] = now
    new_entry["updatedAt"] = now

    # 加载现有数据
    data = load_data(DATA_FILE)
    research = data.get("research", [])

    # 检查重复（按标题前30字）
    existing_titles = {r["title"][:30] for r in research if r.get("title")}
    new_key = new_entry["title"][:30]
    if new_key in existing_titles:
        print(f"⚠️ 检测到重复标题（前30字相同）:")
        print(f"   新: {new_entry['title']}")
        print(f"   已存在相同条目，跳过")
        sys.exit(0)

    print(f"\n📋 新条目预览:")
    print(f"   标题: {new_entry['title']}")
    print(f"   学科: {new_entry['field']}")
    print(f"   日期: {new_entry['dateAdded']}")

    # 预览模式
    if args.dry_run:
        print("\n🔍 预览模式（--dry-run），不写入文件")
        print(f"   如果写入，将插入到 research[0] 位置")
        print(f"   当前条目数: {len(research)} → {len(research) + 1}")
        return

    # 插入到数组开头（最新在最前）
    research.insert(0, new_entry)
    data["research"] = research

    # 保存
    save_data(DATA_FILE, data)
    print(f"\n✅ 已插入条目")
    print(f"   当前条目数: {len(research)}")
    print(f"   ID: {new_entry['id']}")

    # 可选 git add
    if args.git_add:
        os.system(f"git add \"{DATA_FILE}\"")
        print("  已 git add data.json")


if __name__ == "__main__":
    main()
