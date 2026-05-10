---
layout: project
title: "Fairy of Grass"
description: "GitHub Actions template that auto-generates daily contributions by creating scheduled empty commits."
tech_stack: ["GitHub Actions", "YAML", "Template Repository", "Automation"]
github_url: "https://github.com/zeikar/fairy-of-grass"
image: "/assets/images/projects/fairy-of-grass.png"
sequence: 13
---

## Project Overview

Fairy of Grass is a template repository for automating contribution activity on GitHub. It is designed for users who want to set up a simple scheduled workflow that creates regular commits with minimal configuration.

## Key Features

- **Template-based Setup**: Start from a GitHub template repository
- **Scheduled Automation**: Runs daily using GitHub Actions cron scheduling
- **Secret-driven Identity**: Uses repository secrets (`USER_EMAIL`) for commit metadata
- **Minimal Configuration**: Small setup surface for quick onboarding
- **Contribution Graph Focus**: Built specifically for consistent daily contribution updates

## Technical Challenges & Solutions

### Challenge 1: Frictionless onboarding
Kept setup to a few clear steps: create from template, add secret, and run.

### Challenge 2: Stable scheduled execution
Used GitHub Actions scheduling patterns to ensure regular, low-maintenance automation.

### Challenge 3: Reusable public template design
Structured the project as a reusable template so others can deploy the same workflow quickly.

## What I Learned

- Designing lightweight automation templates for broad reuse
- Managing scheduled repository workflows with GitHub Actions
- Documenting setup flows clearly for non-expert users
- Balancing simplicity and flexibility in template repos

## Impact

Fairy of Grass provides a quick path to daily GitHub automation and serves as a simple example of practical, reusable Actions-based workflow design.
