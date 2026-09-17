---
layout: project
title: "Whozzie"
description: "A spin-the-wheel name picker for settling who goes first, in English and Korean."
tech_stack: ["Next.js", "next-intl", "TypeScript", "React", "Tailwind CSS"]
github_url: "https://github.com/zeikar/whozzie"
demo_url: "https://whozzie.vercel.app"
image: "/assets/images/projects/whozzie.png"
sequence: 19
gadget_no: 9
---

Whozzie ("Who's it gonna be?") is for the moment a group can't decide. Type in the names, spin, and whoever stops under the pointer is it.

## The wheel

- **Duplicates are ignored.** A name already on the wheel can't be added twice, so nobody gets two slices.
- **Draw again without the winner.** The result dialog can take the winner off the wheel, so a full order is spin, remove, repeat.
- **The spin is the draw.** Each spin adds five to nine full turns plus a random angle and eases out over five seconds. The winner is computed from that final angle, not picked separately.

## Korean from the start

Locale routing went in before the wheel did. next-intl serves English at the root and Korean under `/ko`, and the sitemap lists both.

Korean names come through an input method, and pressing Enter while a character was still being composed used to add an entry nobody meant to add. The input now ignores Enter until composition finishes.
