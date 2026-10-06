#!/usr/bin/env python3
"""Render the public project catalog without executing project code or fetching URLs.

Edit exploration-catalog.json (projects and radar_guide), verify its primary sources,
then run this script. Preserve radar_guide when updating the project catalog.
HTML is generated statically so project links and details work without JavaScript.
"""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from datetime import date
import json
import re

ROOT=Path(__file__).resolve().parent
EXTERNAL_HOSTS={'github.com','docs.acconeer.com','developer.acconeer.com','www.ti.com','dr-download-cdn.ti.com','arm-software.github.io','liquidsdr.org','www.gnuradio.org'}
LOCAL_PAGES={'knowledge.html','simulation.html','notes-iir-fir.html','next-learning.html','exploration.html'}

def text(value):
    if not isinstance(value,str):raise ValueError('Expected text')
    return escape(value,quote=True)

def safe_url(value,external=False):
    if not isinstance(value,str) or any(c.isspace() or ord(c)<32 for c in value):raise ValueError('Invalid URL')
    url=urlsplit(value)
    if external:
        if url.scheme!='https' or url.hostname not in EXTERNAL_HOSTS or url.username or url.password or url.port is not None:raise ValueError('Unapproved external URL: '+value)
    elif url.scheme or url.netloc or url.path not in LOCAL_PAGES or '\\' in value:raise ValueError('Invalid local URL: '+value)
    return text(value)

def link(item,external=False):
    rel=' rel="noopener noreferrer"' if external else ''
    return '<a href="'+safe_url(item['url'],external)+'"'+rel+'>'+text(item['label'])+'</a>'

def items(values):
    return '<ul>'+''.join('<li>'+text(v)+'</li>' for v in values)+'</ul>'

def render_card(project,categories):
    p=project
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,70}',p['id']):raise ValueError('Invalid ID')
    if p['category'] not in categories:raise ValueError('Unknown category')
    if p['status']!='待学习' or p['reproduction_status']!='未在本站复现':raise ValueError('Catalog entries cannot claim learning or reproduction completion')
    date.fromisoformat(p['last_verified'])
    external=''.join(link(l,True) for l in p['official_links'])
    learn=''.join(link(l) for l in p['learning_links'])
    licenses=' · '.join(link(l,True) for l in p['license_links'])
    chain='<ol class="project-chain" aria-label="简化的处理流程">'+''.join('<li>'+text(v)+'</li>' for v in p['chain'])+'</ol>'
    return f'''<article class="project-card" id="{text(p['id'])}" data-category="{text(p['category'])}" aria-labelledby="{text(p['id'])}-title">
<div class="project-meta"><span>{text(categories[p['category']])} / {text(p['kind'])}</span><span class="project-state">{text(p['status'])}</span></div>
<h2 id="{text(p['id'])}-title">{text(p['title'])}</h2><p class="project-name">{text(p['project'])}</p>
{chain}
<p class="project-application">{text(p['application'])}</p>
<p class="project-first"><strong>起步：</strong>{text(p['first_step'])}</p>
<div class="project-links" aria-label="本站学习入口">{learn}</div>
<details class="project-details"><summary>先修、算法、硬件与来源</summary>
<dl class="project-facts"><dt>先修知识</dt><dd>{items(p['prerequisites'])}</dd><dt>关键算法</dt><dd>{items(p['algorithms'])}</dd><dt>硬件与环境</dt><dd>{text(p['hardware'])}</dd><dt>成熟度与复现边界</dt><dd>{text(p['maturity'])}</dd><dt>许可范围</dt><dd>{text(p['license'])}<br>{licenses}</dd></dl>
<p class="project-warning">{text(p['warning'])}</p>
<div class="project-links" aria-label="外部官方来源">{external}</div>
</details><p class="project-verification">来源核验 <time datetime="{text(p['last_verified'])}">{text(p['last_verified'])}</time> · {text(p['reproduction_status'])}</p>
</article>'''

def render_radar_guide(guide, projects):
    """Keep the guide in the catalog source so scheduled rebuilds retain it."""
    date.fromisoformat(guide['last_verified'])
    ids={p['id'] for p in projects if p['category']=='radar'}
    icons={
        'sample':'<path d="M8 38h8l6-16 8 30 8-32 8 30 8-30 8 17h10"/><circle cx="16" cy="38" r="2"/><circle cx="38" cy="20" r="2"/><circle cx="62" cy="37" r="2"/>',
        'feature':'<path d="M10 53h62M20 53V42M32 53V33M44 53V14M56 53V37M68 53V45"/>',
        'detection':'<path d="M8 43h64" stroke-dasharray="4 4"/><path d="M13 53V48M25 53V44M37 53V20M49 53V46M61 53V28"/><circle cx="37" cy="20" r="5"/><circle cx="61" cy="28" r="5"/>',
        'track':'<path d="M12 50Q29 17 68 17" stroke-dasharray="4 4"/><circle cx="12" cy="50" r="4"/><circle cx="28" cy="30" r="4"/><circle cx="47" cy="20" r="4"/><circle cx="68" cy="17" r="4"/>'
    }
    steps=[]
    for step in guide['map_steps']:
        if step['icon'] not in icons:raise ValueError('Unknown guide icon')
        steps.append(f'<li><svg viewBox="0 0 80 68" aria-hidden="true" focusable="false">{icons[step["icon"]]}</svg><div><strong>{text(step["title"])}</strong><span>{text(step["detail"])}</span></div></li>')
    roles=''.join(f'<div><dt>{text(r["name"])}</dt><dd><strong>{text(r["question"])}</strong><p>{text(r["answer"])}</p></dd></div>' for r in guide['roles'])
    cases=[]
    for case in guide['cases']:
        if case['project_id'] not in ids:raise ValueError('Guide case must refer to an existing radar project')
        chain='<ol class="radar-process" aria-label="'+text(case['title'])+'的处理顺序">'+''.join('<li>'+text(s)+'</li>' for s in case['chain'])+'</ol>'
        sources=''.join(link(s,True) for s in case['sources'])
        card=link({'label':'查看项目卡与硬件边界','url':'exploration.html?category=radar#'+case['project_id']})
        cases.append(f'<article class="radar-case"><p class="radar-architecture">{text(case["architecture"])}</p><h4>{text(case["title"])}</h4>{chain}<p>{text(case["note"])}</p><div class="project-links">{sources}{card}</div></article>')
    sequence=''.join(f'<li><h4>{text(s["title"])}</h4><p>{text(s["text"])}</p>{link(s["link"])}</li>' for s in guide['sequence'])
    return f'''<section class="radar-guide" id="radar-guide" aria-labelledby="radar-guide-title">
<div class="radar-guide-heading"><span class="exploration-state">雷达入门导读</span><h2 id="radar-guide-title">{text(guide['title'])}</h2><p>{text(guide['intro'])}</p></div>
<figure class="radar-map"><ol>{''.join(steps)}</ol><figcaption>{text(guide['map_caption'])}</figcaption></figure>
<h3>先把五类算法分开</h3><dl class="radar-roles">{roles}</dl>
<aside class="radar-caution"><h3>{text(guide['noise_title'])}</h3><p>{text(guide['noise_note'])}</p></aside>
<h3>对照三个官方案例，沿数据流读实现</h3><div class="radar-cases">{''.join(cases)}</div>
<div class="radar-start"><h3>建议起步顺序</h3><ol class="radar-sequence">{sequence}</ol><p class="radar-boundary">{text(guide['boundary'])}</p></div>
<p class="radar-verification">资料核验 <time datetime="{text(guide['last_verified'])}">{text(guide['last_verified'])}</time> · 项目卡保留先修、许可与原始来源。</p>
</section>'''

def build():
    data=json.loads((ROOT/'exploration-catalog.json').read_text())
    if data['schema_version']!=1:raise ValueError('Unsupported schema')
    date.fromisoformat(data['updated_at'])
    categories=data['categories']
    for key in categories:
        if not re.fullmatch(r'[a-z][a-z0-9-]*',key):raise ValueError('Invalid category')
    projects=data['projects']
    if len({p['id'] for p in projects})!=len(projects):raise ValueError('Duplicate IDs')
    source=(ROOT/'index.html').read_text()
    header=re.search(r'<header class="lab-site-header architecture-header">.*?</header>',source,re.S).group(0)
    header=header.replace(' aria-current="page"','').replace('<a href="exploration.html">','<a href="exploration.html" aria-current="page">')
    if 'href="exploration.html" aria-current="page"' not in header:raise ValueError('Shared navigation must contain exploration')
    cards='\n'.join(render_card(p,categories) for p in projects)
    guide=render_radar_guide(data['radar_guide'],projects)
    buttons='<button class="exploration-filter" type="button" data-category-filter="all" aria-pressed="true">全部方向</button>'
    buttons+=''.join(f'<button class="exploration-filter" type="button" data-category-filter="{text(k)}" aria-pressed="false">{text(v)}</button>' for k,v in categories.items())
    html=f'''<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark">
<title>探索 · RIVER 信号实验室</title>
<meta name="description" content="从民用雷达到开源 DSP：带先修知识、算法链路、硬件边界与许可来源的信号处理项目导读。">
<link rel="icon" type="image/png" href="favicon-rgb-8b14e515.png">
<link rel="stylesheet" href="lab-shell.css?v=e1c8c0a2"><link rel="stylesheet" href="architecture.css?v=20261006-exploration"><link rel="stylesheet" href="exploration.css?v=20261006-radar-guide1">
<script src="architecture.js?v=20261006" defer></script><script src="exploration.js?v=20261006" defer></script>
<link rel="stylesheet" href="question-helper.css?v=20261006-private-chat1"><script src="question-helper.js?v=20261006-private-chat1" defer></script>
</head><body class="lab-shell exploration-page"><a class="site-skip" href="#main">跳到探索内容</a>
{header}
<main id="main" class="exploration-main">
<section class="exploration-intro" aria-labelledby="exploration-title"><div><span class="exploration-state">未来学习方向 · 尚待动手验证</span><h1 id="exploration-title">从波形，到真实项目。</h1><p>把感兴趣的方向整理成能开始的一步：它解决什么问题，用到什么算法，需要先学什么，再去哪里读实现。</p><p>先收录民用雷达案例与成熟开源 DSP 项目。本站实验帮你理解其中的原理，外部工程仍需在各自环境中验证。</p></div>
<ol class="exploration-route" aria-label="建议的探索顺序"><li><strong>学原理</strong><span>在知识图谱找到先修概念</span></li><li><strong>看波形</strong><span>用独立教学模拟建立直觉</span></li><li><strong>读实现</strong><span>沿着数据流定位算法代码</span></li><li><strong>再验证</strong><span>检查许可、环境与真实数据</span></li></ol></section>
<div class="radar-jump"><a href="#radar-guide">雷达入门导读：处理链、算法分工与起步顺序 <span aria-hidden="true">↓</span></a></div>
<section aria-label="筛选探索项目"><div class="exploration-toolbar" id="exploration-toolbar" hidden><div class="exploration-filters" role="group" aria-label="项目分类">{buttons}</div><label class="exploration-search" for="exploration-search">搜索项目或算法<input id="exploration-search" type="search" maxlength="120" placeholder="例如：雷达、FFT、IIR、Python" autocomplete="off"></label></div>
<p class="exploration-count" id="exploration-count" role="status" aria-live="polite">显示 {len(projects)} 个学习方向</p>
<noscript><p>所有项目均可直接阅读；开启 JavaScript 后可按分类和关键词筛选。</p></noscript>
<div class="exploration-empty" id="exploration-empty" hidden><p>没有匹配的方向。试试更短的关键词，或清除筛选。</p><button type="button" class="exploration-reset" id="exploration-reset">清除筛选</button></div>
<div class="exploration-grid" id="exploration-projects">{cards}</div></section>
{guide}
<section class="exploration-policy" aria-labelledby="exploration-policy-title"><h2 id="exploration-policy-title">收录依据</h2><ul><li>优先看官方源码、文档、测试和复现入口，辨别它解决的信号处理问题。</li><li>经典基础库、厂商参考设计与前沿研究分别判断；Stars 和流行度不能替代成熟度证据。</li><li>新方向先作为待学习条目。来源、许可或复现条件不清楚时，明确标注边界，不宣称已经掌握或跑通。</li><li>只整理公开技术概念与项目资料。本站不自动下载、安装或运行这些外部项目。</li></ul><p>来源核验日期表示最近一次资料检查，并非硬件测试日期。卡片中的信号链为教学概括；实际实现以链接的官方版本为准。</p></section>
<footer class="architecture-footer">RIVER 信号实验室 · 用仿真理解原理，用真实数据检验判断。</footer>
</main></body></html>
'''
    (ROOT/'exploration.html').write_text(html)
    print(f'Rendered {len(projects)} projects into exploration.html')

if __name__=='__main__':build()
