#!/usr/bin/env python3
"""Build the public engineering case studies from reviewed JSON, without network access.

Run after editing case content. Rebuild exploration only when its catalog changes.
The site is reading material only: this generator never runs vendor code or hardware.
"""
from pathlib import Path
from html import escape
from urllib.parse import urlsplit
from datetime import date
import json,re
ROOT=Path(__file__).resolve().parent
HOSTS={'www.nxp.com','mcuxpresso.nxp.com','community.nxp.com','www.analog.com','wiki.analog.com','www.ti.com','software-dl.ti.com','arm-software.github.io','www.keil.arm.com'}
PAGES={'knowledge.html','simulation.html','hardware-filters.html','notes-iir-fir.html','engineering-cases.html','exploration.html'}
def txt(s):
    if not isinstance(s,str):raise ValueError('Text required')
    return escape(s,quote=True)
def url(s,external=False):
    if not isinstance(s,str) or any(c.isspace() or ord(c)<32 for c in s):raise ValueError('Invalid URL')
    u=urlsplit(s)
    if external:
        if u.scheme!='https' or u.hostname not in HOSTS or u.username or u.password or u.port is not None:raise ValueError('Invalid source URL')
    elif u.scheme or u.netloc or u.path not in PAGES or '\\' in s:raise ValueError('Invalid learning URL')
    return txt(s)
def link(x,external=False):
    return '<a href="'+url(x['url'],external)+'"'+(' rel="noopener noreferrer"' if external else '')+'>'+txt(x.get('label',x.get('title','来源')))+'</a>'
def refs(ids,sources):
    return ' <span class="case-citations">'+ ' '.join('<a href="#source-'+txt(i)+'">['+str(list(sources).index(i)+1)+']</a>' for i in ids)+'</span>' if ids else ''
def blocks(values,sources):
    return ''.join('<section class="case-block"><h4>'+txt(v['title'])+'</h4><p>'+txt(v['text'])+refs(v.get('refs',[]),sources)+'</p></section>' for v in values)
def render(c,index):
    if not re.fullmatch('[a-z][a-z0-9-]+',c['id']):raise ValueError('Invalid ID')
    if c['status']!='待学习' or c['reproduction_status']!='未本站实物复现':raise ValueError('Cases cannot imply completion')
    date.fromisoformat(c['last_verified'])
    sources={s['id']:s for s in c['sources']}
    if len(sources)!=len(c['sources']):raise ValueError('Duplicate source IDs')
    for s in c['sources']:url(s['url'],True)
    source_items=''.join('<li id="source-'+txt(s['id'])+'">'+link(s,True)+'<span>'+txt(s['date'])+' · '+txt(s['kind'])+'</span></li>' for s in c['sources'])
    learn=''.join(link(s) for s in c['learning_links'])
    parts=''.join('<section class="case-section"><h3>'+title+'</h3>'+blocks(c[key],sources)+'</section>' for key,title in [('constraints','实际约束'),('decisions','工程选择'),('results','原始证据与结果'),('pitfalls','容易踩的坑')])
    return f'''<article class="case-study" id="{txt(c['id'])}" aria-labelledby="{txt(c['id'])}-title">
<header class="case-heading"><p class="case-kicker">案例 {index:02d} / {txt(c['vendor'])} <span>{txt(c['status'])}</span></p><h2 id="{txt(c['id'])}-title">{txt(c['title'])}</h2><p>{txt(c['subtitle'])}</p></header>
<dl class="case-meta"><div><dt>原始日期 / 版本</dt><dd>{txt(c['publication'])}</dd></div><div><dt>证据类型</dt><dd>{txt(c['evidence'])}</dd></div><div><dt>硬件 / 软件环境</dt><dd>{txt(c['environment'])}</dd></div></dl>
<ol class="project-chain case-chain" aria-label="{txt(c['vendor'])} 案例数据链">{''.join('<li>'+txt(s)+'</li>' for s in c['chain'])}</ol>
<section class="case-section"><h3>要解决的实际问题</h3><p>{txt(c['problem'])}</p></section>{parts}
<section class="case-section case-procedure"><h3>如果动手，怎样验证</h3><p class="case-boundary">以下是本站拟议复现清单，尚未执行。先核对器件版本、设备额定值与实验安全条件。</p><ol>{''.join('<li>'+txt(s)+'</li>' for s in c['reproduction'])}</ol></section>
<aside class="case-transfer"><h3>迁移回本站已有实验</h3><p>{txt(c['exercise'])}</p><div class="project-links">{learn}</div></aside>
<section class="case-sources"><h3>原始资料</h3><ol>{source_items}</ol><p>{txt(c['license'])}</p></section>
<footer class="case-footer">资料核验 <time datetime="{txt(c['last_verified'])}">{txt(c['last_verified'])}</time> · {txt(c['status'])} · {txt(c['reproduction_status'])}<a href="#cases-title">回到案例目录 ↑</a></footer></article>'''
def build():
    data=json.loads((ROOT/'engineering-cases.json').read_text())
    if data['schema_version']!=1:raise ValueError('Unsupported schema')
    date.fromisoformat(data['verified_at']);cases=data['cases']
    if len({c['id'] for c in cases})!=len(cases):raise ValueError('Duplicate case IDs')
    source=(ROOT/'index.html').read_text()
    header=re.search(r'<header class="lab-site-header architecture-header">.*?</header>',source,re.S).group(0)
    header=header.replace(' aria-current="page"','').replace('<a href="exploration.html">','<a href="exploration.html" aria-current="page">')
    jump=''.join('<a class="case-index-card" href="#'+txt(c['id'])+'"><span>'+str(i).zfill(2)+' / '+txt(c['vendor'])+'</span><strong>'+txt(c['catalog_title'])+'</strong><small>'+txt(c['chain'][0])+' → '+txt(c['chain'][-1])+'</small></a>' for i,c in enumerate(cases,1))
    html=f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<title>企业工程案例 · RIVER 信号实验室</title><meta name="description" content="从磁校准、振动采集、超声液位到定点 FFT 与 IIR 移植：沿真实约束、工程选择、测试条件与证据边界学习信号处理。">
<link rel="icon" type="image/png" href="favicon-rgb-8b14e515.png"><link rel="stylesheet" href="lab-shell.css?v=e1c8c0a2"><link rel="stylesheet" href="architecture.css?v=20261006-exploration"><link rel="stylesheet" href="exploration.css?v=20261006-radar-guide1"><link rel="stylesheet" href="engineering-cases.css?v=20261017">
<script src="architecture.js?v=20261006" defer></script><link rel="stylesheet" href="question-helper.css?v=20261016r3"><script src="question-helper.js?v=20261017-cases-r2" defer></script><link rel="stylesheet" href="signal-design.css?v=20261016r3"><script src="signal-motion.js?v=20261019.4" defer></script>
<link rel="stylesheet" href="signal-studio.css?v=20261019.4"></head><body class="lab-shell engineering-cases-page math-studio"><a class="site-skip" href="#main">跳到案例正文</a>{header}
<main class="cases-main" id="main"><a class="cases-back" href="exploration.html">返回探索</a><section class="cases-intro" aria-labelledby="cases-title"><p class="case-kicker">工程阅读 / {len(cases)} 个案例 · 待学习</p><h1 id="cases-title">公式到了现场，要多回答哪些问题？</h1><p class="cases-lede">从公开的企业技术资料里，追踪约束、选择和验证。读的是一条信号链如何成立，不只是一份代码仓库。</p><p>这里选取校准与融合、振动采集、超声测量、定点频谱处理和 IIR 系数与状态移植等不同问题。它们是历史参考案例，不代表最新器件推荐、供应商排名或量产效果保证。所有案例均未本站实物复现。</p></section>
<nav class="case-index" aria-label="案例目录">{jump}</nav>
<aside class="cases-evidence"><h2>先认清证据，再看数字</h2><p>“厂商实测”只覆盖原报告的硬件和条件；“实现文档”说明代码怎样组织，不自动证明性能；“本站计算”只复算公开数值或明确写出的理想模型；“拟议复现”仍是待做步骤。本页未引入独立第三方实物测试，也没有运行外部候选代码。</p><p>发布日期、版本和本次核验日期分开记录。链接中的原始文件才是检查细节的入口；遇到口径、日期或资料可读性差异会保留说明。</p></aside>
{''.join(render(c,i) for i,c in enumerate(cases,1))}
<footer class="architecture-footer">RIVER 信号实验室 · 把理论连到实际约束，再用明确的测试检验它。</footer></main></body></html>'''
    (ROOT/'engineering-cases.html').write_text(html+'\n')
    print(f'Rendered {len(cases)} engineering cases')
if __name__=='__main__':build()
