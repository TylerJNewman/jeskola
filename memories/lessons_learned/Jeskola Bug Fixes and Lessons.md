---
title: Jeskola Bug Fixes and Lessons
type: note
permalink: lessons-learned/jeskola-bug-fixes-and-lessons
tags:
- jeskola
- bugs
- lessons
- css
- react
---

# Jeskola Bug Fixes and Lessons

## CSS Cascade Layer Bug (Tailwind v4)
**Problem**: All Tailwind padding utilities (px-4, py-2) were silently overridden.
**Root cause**: `* { padding: 0; }` in globals.css was outside any CSS layer. In Tailwind v4, `@import "tailwindcss"` puts utilities in layers. Unlayered styles have higher priority than layered utilities.
**Fix**: Wrap in `@layer base { * { padding: 0; } }`
**Lesson**: In Tailwind v4, ALL global resets must be inside `@layer base` or they'll override utility classes.

## Double AudioParam Updates
**Problem**: Module body components called setX() (which updates AudioParam) then set state (which triggers pushStateToAudio(), updating AudioParam again).
**Fix**: Added `ModularNode.patchState()` method that updates `_state` without calling `pushStateToAudio()`. All 8 module bodies now use patchState for serialization sync.

## SequencerBody RAF Waste
**Problem**: requestAnimationFrame loop ran continuously even when transport was stopped.
**Fix**: Only use `onStepChange` callback + stop handler; removed continuous RAF loop.

## RecipeDrawer Memory Leak
**Problem**: Morph timer (setTimeout) not cleaned up on component unmount.
**Fix**: Added useEffect cleanup returning `clearTimeout(morphTimerRef.current)`.

## DelayModule Dry Gain Mismatch
**Problem**: Constructor set dry gain to 0.8 but formula is `1 - mix` where mix defaults 0.5.
**Fix**: Changed initial dry gain to 0.5.

## Port Label Alignment
**Problem**: Port labels used gap-1 (4px) but handles use handleRowGap (38px), causing misalignment.
**Fix**: Each label element gets `height: handleRowGap` to match handle spacing exactly.

## False Positives in Code Review
- ADSR "missing pushStateToAudio()" — not needed; ADSR state is stored and read on-demand
- Zustand selector instability — Map.get() returns the same reference, so selectors are stable
- These were correctly triaged as false positives during the bug hunt

## Related
- [[Jeskola React Architecture]]
