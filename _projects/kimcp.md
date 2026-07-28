---
layout: project
title: "KiMCP"
description: "MCP server that exposes Korean APIs (Naver, Kakao, TMAP) as tools for LLM applications and agent workflows."
tech_stack: ["Python 3.10+", "MCP Python SDK", "uv", "HTTPX", "Korean Open APIs"]
github_url: "https://github.com/zeikar/kimcp"
image: "/assets/images/projects/kimcp.png"
sequence: 11
gadget_no: 8
---

KiMCP is an MCP server that hands an LLM a set of Korean web and map APIs as tools — so an assistant can actually search Naver, look up a place on KakaoMap, or get transit directions instead of guessing.

## Tools it exposes

- **Naver** — blog, news, cafe, 지식iN, local, image, and shopping search
- **Daum** — blog and cafe search
- **Maps & routing** — KakaoMap place search, car directions (Kakao), and public-transit directions (TMAP)

## Degrade-by-key design

You set only the API keys you have. Each tool checks for its provider's key at startup, and if it's missing the tool simply isn't registered — so a Naver-only setup exposes the Naver tools and quietly drops the rest instead of erroring. Built on the MCP Python SDK with `uv` for setup and a one-line `mcp install` into Claude Desktop.
