#!/usr/bin/env python3
"""
generate_review.py — 调用 AI API 生成结构化研究点评
用法：
  python generate_review.py --input paper.json --output entry.json
  python generate_review.py --doi 10.xxxx/xxxxx --output entry.json
  python generate_review.py --manual  # 手动输入论文信息
"""

import argparse
import json
import os
import sys
import re

# AI API 调用
try:
    import requests
except ImportError:
    print("❌ 请先安装 requests: pip install requests")
    sys.exit(1)


def load_env():
    """从 .env 文件加载配置"""
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    env_vars = {}
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars


def call_ai_api(title, abstract, model="deepseek", api_key=None):
    """
    调用 AI API 生成结构化点评
    支持：deepseek, openai, claude
    """
    prompt = f"""你是一位跨学科科学研究评论家。请根据以下论文信息，用中文生成分析报告，以JSON格式返回。

约束：
- relatedMilestones（历史里程碑）必须基于真实存在的研究，**严禁捏造**。如果不确定，输出空数组 []。
- divergentExtensions 中的跨领域联系必须言之有据，不得做无根据的联想。
- 如果对某部分内容不确定，请明确标注"此部分为推测"。
- breakthrough 不少于300字。
- 创新性评级实事求是，顶级突破给4-5分，普通进展给1-3分。

返回JSON格式：
{{
  "breakthrough": "核心突破内容，500-800字中文，详细解释研究发现/理论是什么",
  "significance": "为什么重要，该发现的科学意义和潜在影响",
  "innovationRating": 4,
  "divergentExtensions": [
    {{"direction": "跨领域联系", "content": "详细内容", "relatedFields": ["相关学科1", "相关学科2"]}},
    {{"direction": "应用推演", "content": "短期5年/中期10年/长期20年的潜在影响", "relatedFields": []}},
    {{"direction": "开放问题", "content": "这项研究打开的新问题", "relatedFields": []}}
  ],
  "expertCommentary": "专业点评，包含方法论评价、局限性和前景，300-500字",
  "relatedMilestones": [
    {{"year": 2020, "description": "关键进展描述"}}
  ],
  "tags": ["标签1", "标签2", "标签3"],
  "readTime": 8
}}

论文信息：
标题：{title}
摘要：{abstract}"""

    if model == "deepseek":
        return call_deepseek(prompt, api_key)
    elif model == "openai":
        return call_openai(prompt, api_key)
    elif model == "claude":
        return call_claude(prompt, api_key)
    else:
        print(f"❌ 不支持的模型: {model}，支持: deepseek, openai, claude")
        return None


def call_deepseek(prompt, api_key):
    """调用 DeepSeek API"""
    if not api_key:
        print("❌ 未设置 DEEPSEEK_API_KEY")
        return None

    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": "deepseek-v4-flash",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    try:
        resp = requests.post(url, headers=headers, json=data, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        return parse_json_response(content)
    except Exception as e:
        print(f"❌ DeepSeek API 调用失败: {e}")
        return None


def call_openai(prompt, api_key):
    """调用 OpenAI API"""
    if not api_key:
        print("❌ 未设置 OPENAI_API_KEY")
        return None

    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    data = {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    try:
        resp = requests.post(url, headers=headers, json=data, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        return parse_json_response(content)
    except Exception as e:
        print(f"❌ OpenAI API 调用失败: {e}")
        return None


def call_claude(prompt, api_key):
    """调用 Claude API"""
    if not api_key:
        print("❌ 未设置 ANTHROPIC_API_KEY")
        return None

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    data = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        resp = requests.post(url, headers=headers, json=data, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        content = result["content"][0]["text"]
        return parse_json_response(content)
    except Exception as e:
        print(f"❌ Claude API 调用失败: {e}")
        return None


def parse_json_response(content):
    """从 AI 响应中提取 JSON"""
    # 尝试直接解析
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # 尝试从 ```json ... ``` 中提取
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试从 { 找到第一个 { 和最后一个 }
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(content[start:end+1])
        except json.JSONDecodeError:
            pass

    print("❌ 无法从 AI 响应中解析 JSON")
    print(f"原始响应: {content[:500]}...")
    return None


def build_entry(paper, review, field=None):
    """将论文信息和 AI 生成的点评合并为完整的 data.json 条目"""
    import time

    title = paper.get("title", "")
    summary = paper.get("summary", "")
    authors = paper.get("authors", [])
    institution = paper.get("institution", "")
    source = paper.get("source", {})

    # 取 journal 和 DOI 等
    journal = paper.get("journal", "")
    doi = paper.get("doi", "")
    url = paper.get("url", "")
    pub_date = paper.get("published", "")

    # 推断学科
    if not field:
        field = paper.get("field", infer_field(title, summary))

    # 生成 ID
    entry_id = f"r-{int(time.time() * 1000)}"

    entry = {
        "id": entry_id,
        "title": title,
        "field": field,
        "subfield": "",
        "researchers": authors,
        "institution": institution,
        "source": {
            "journal": journal,
            "doi": doi,
            "url": url,
            "publicationDate": pub_date,
        },
        "summary": summary[:200] if summary else "",
        "abstract": summary,
    }

    # 合并 AI 生成的部分
    if review:
        entry["breakthrough"] = review.get("breakthrough", "")
        entry["significance"] = review.get("significance", "")
        entry["innovationRating"] = review.get("innovationRating", 3)
        entry["divergentExtensions"] = review.get("divergentExtensions", [])
        entry["expertCommentary"] = review.get("expertCommentary", "")
        entry["relatedMilestones"] = review.get("relatedMilestones", [])
        entry["tags"] = review.get("tags", [])
        entry["readTime"] = review.get("readTime", 5)
    else:
        entry["breakthrough"] = "（待AI生成）"
        entry["significance"] = ""
        entry["innovationRating"] = 0
        entry["divergentExtensions"] = []
        entry["expertCommentary"] = ""
        entry["relatedMilestones"] = []
        entry["tags"] = []
        entry["readTime"] = 5

    entry["dateAdded"] = time.strftime("%Y-%m-%d")
    entry["status"] = "unread"
    entry["starred"] = False
    entry["citations"] = {
        "bibtex": f"@article{{{entry_id[-8:]}, title={{{title}}}, journal={{{journal}}}, year={{{pub_date[:4]}}}}}",
        "formatted": f"{', '.join(authors[:3])}{' et al.' if len(authors) > 3 else ''} {title}. {journal} ({pub_date[:4]})." if authors else f"{title}. {journal} ({pub_date[:4]}).",
    }

    return entry


def infer_field(title, summary):
    """根据标题和摘要推测学科"""
    keywords = {
        "物理": ["量子", "粒子", "引力", "弦论", "凝聚态", "光子", "原子", "相对论", "超导", "majorana"],
        "天文": ["恒星", "星系", "系外行星", "黑洞", "宇宙", "jwst", "星云", "暗物质", "暗能量", "望远镜", "行星"],
        "生物": ["基因", "蛋白质", "细胞", "神经", "dna", "rna", "crispr", "表观遗传", "神经元", "抗体", "小鼠", "基因组", "蛋白质"],
        "心理": ["认知", "意识", "记忆", "情绪", "心理", "大脑", "行为", "感知", "注意", "fMRI", "神经反馈", "ptsd"],
        "哲学": ["伦理", "存在", "知识", "理性", "实在", "自由意志", "道德", "语言哲学", "现象学", "意识", "意向性"],
        "计算机": ["算法", "模型", "深度", "神经网络", "数据", "计算", "llm", "语言模型", "transformer", "注意力机制", "token"],
    }
    text = (title + " " + summary).lower()
    scores = {}
    for field, words in keywords.items():
        scores[field] = sum(2 for w in words if w in text[:100])
        scores[field] += sum(1 for w in words if w in text)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "物理"


def main():
    parser = argparse.ArgumentParser(description="AI 生成研究点评")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--input", help="输入 JSON 文件(fetch_papers.py 输出)")
    group.add_argument("--doi", help="DOI 号")
    group.add_argument("--manual", action="store_true", help="手动输入论文信息")
    parser.add_argument("--field", help="学科（可选，自动推断）")
    parser.add_argument("--output", default="new_entry.json", help="输出文件")
    parser.add_argument("--model", default="deepseek", help="AI 模型: deepseek/openai/claude")
    parser.add_argument("--index", type=int, default=0, help="输入文件中的第几篇论文（从0开始）")
    args = parser.parse_args()

    # 加载 API 密钥
    env = load_env()
    api_key_map = {
        "deepseek": env.get("DEEPSEEK_API_KEY", os.environ.get("DEEPSEEK_API_KEY", "")),
        "openai": env.get("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", "")),
        "claude": env.get("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", "")),
    }
    api_key = api_key_map.get(args.model)

    paper = None

    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        papers = data.get("papers", [])
        if not papers:
            print("❌ 输入文件中没有论文")
            return
        if args.index >= len(papers):
            print(f"❌ 索引 {args.index} 超出范围，共 {len(papers)} 篇")
            return
        paper = papers[args.index]
        print(f"📄 使用论文 [{args.index}/{len(papers)-1}]: {paper.get('title', '')[:60]}...")

    elif args.doi:
        paper = {"title": f"论文 DOI: {args.doi}", "summary": "", "authors": [], "journal": "", "doi": args.doi, "url": f"https://doi.org/{args.doi}", "published": ""}
        print(f"📄 DOI: {args.doi}")

    elif args.manual:
        print("📝 手动输入论文信息（直接回车可跳过）")
        title = input("标题: ").strip()
        authors_str = input("作者（逗号分隔）: ").strip()
        journal = input("期刊: ").strip()
        doi = input("DOI: ").strip()
        summary = input("摘要: ").strip()
        if not title:
            print("❌ 标题必填")
            return
        paper = {
            "title": title,
            "summary": summary,
            "authors": [a.strip() for a in authors_str.split(",") if a.strip()],
            "journal": journal,
            "doi": doi,
            "url": f"https://doi.org/{doi}" if doi else "",
            "published": "",
            "institution": "",
        }

    if not paper:
        print("❌ 未获取到论文信息")
        return

    # 调用 AI
    title = paper.get("title", "")
    summary = paper.get("summary", "")
    print(f"🤖 正在调用 {args.model} API 生成点评...")
    review = call_ai_api(title, summary, args.model, api_key)

    if review:
        print("✅ AI 点评生成成功")
    else:
        print("⚠️ AI 点评生成失败，将生成空壳条目")
        review = None

    # 构建完整条目
    field = args.field or paper.get("field", "")
    entry = build_entry(paper, review, field)

    # 输出
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(entry, f, ensure_ascii=False, indent=2)
    print(f"💾 条目已保存到 {args.output}")
    print(f"\n📋 条目预览:")
    print(f"   标题: {entry['title'][:60]}...")
    print(f"   学科: {entry['field']}")
    print(f"   创新评级: {entry['innovationRating']} ⭐")
    print(f"   标签: {', '.join(entry['tags'][:5])}")
    if entry['source']['doi']:
        print(f"   DOI: {entry['source']['doi']}")


if __name__ == "__main__":
    main()
