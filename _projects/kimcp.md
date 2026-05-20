---
layout: project
title: "KiMCP"
description: "MCP server that exposes Korean APIs (Naver, Kakao, TMAP) as tools for LLM applications and agent workflows."
tech_stack: ["Python 3.10+", "MCP Python SDK", "uv", "HTTPX", "Korean Open APIs"]
github_url: "https://github.com/zeikar/kimcp"
image: "/assets/images/projects/kimcp.png"
sequence: 11
---

## Project Overview

KiMCP (Korea-integrated Model Context Protocol) is an MCP server that helps LLM applications use Korean web and map APIs through a unified tool interface. It focuses on practical integrations needed by Korean-language assistant products.

## Key Features

- **Naver Search Tools**: Blog, news, cafe, knowledge iN, image, local, and shopping search
- **Daum Search Tools**: Blog and cafe integrations
- **Navigation Integrations**: Kakao map search plus driving and transit routing through Kakao/TMAP
- **Tool-level Fallback Behavior**: API-specific tools can be enabled/disabled by available keys
- **Claude Desktop Integration**: Supports direct install and local inspection workflows

## Technical Challenges & Solutions

### Challenge 1: API heterogeneity
Unified multiple provider APIs behind MCP-compatible tools with consistent input/output patterns.

### Challenge 2: Operational flexibility
Designed key-dependent tool activation so partial setups still provide useful capabilities.

### Challenge 3: Developer onboarding
Kept setup friction low with `uv` workflows and direct `mcp install` / `mcp dev` commands.

## What I Learned

- Building MCP-native tool servers for real assistant use cases
- Designing interfaces across API ecosystems with different conventions
- Balancing broad coverage and maintainable Python service architecture
- Improving local DX for agent tooling experimentation

## Impact

KiMCP expands what Korean-focused LLM assistants can do by connecting local data and navigation ecosystems to MCP-compatible clients.
