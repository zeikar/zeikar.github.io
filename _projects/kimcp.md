---
layout: project
title: "KiMCP"
description: "MCP server that exposes Korean APIs (Naver, Kakao, TMAP) as tools for LLM applications and agent workflows."
tech_stack: ["Python", "MCP Python SDK", "uv", "HTTPX", "Korean Open APIs"]
github_url: "https://github.com/zeikar/kimcp"
image: "/assets/images/projects/kimcp.png"
sequence: 18
gadget_no: 8
---

KiMCP is an MCP server that hands an LLM a set of Korean web and map APIs as tools — so an assistant can actually search Naver, look up a place on KakaoMap, or get transit directions instead of guessing.

## Tools it exposes

- **Naver** — blog, news, cafe, 지식iN, local, image, and shopping search
- **Daum** — blog and cafe search
- **Maps & routing** — KakaoMap place search, car directions (Kakao), and public-transit directions (TMAP)
- **Web pages** — fetch any page as plain text, no key needed; Naver blog links are rewritten to the mobile site, which parses cleanly

## Degrade-by-key design

You set only the API keys you have. The tools are registered per provider at startup: if a provider's keys are missing, the server prints a warning and skips that provider's tools. A Naver-only setup gets the Naver tools plus the page fetcher instead of an error. Built on the MCP Python SDK with `uv` for setup and a one-line `mcp install` into Claude Desktop.
