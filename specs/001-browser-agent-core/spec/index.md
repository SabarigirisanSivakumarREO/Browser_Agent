# Feature Specification: Browser Agent Core

**Feature Branch**: `001-browser-agent-core`
**Created**: 2025-01-23
**Status**: Element Mapping ✅ | Phase 26 ✅ | Phase 25 ✅ | Phase 24 ✅ | Phase 22 📋 Pending
**Input**: User description: "Build a browser agent that can navigate websites and extract data using LangChain for intelligent processing"

> **Change Request 001 (2026-01-30)**: Architecture simplification ✅ **COMPLETE**
> - ✅ REMOVED: `--vision`, `--full-page-vision`, `--full-page-screenshot` modes
> - ✅ KEPT: `--vision-agent` as the ONE vision mode
> - ✅ MERGED: Vision Agent into CRO Agent (single agent loop)
> - ✅ Analysis now happens AFTER data collection (category-based LLM calls)
> - DEFERRED: Phase 20 (60 tasks) to backlog
> - NEXT: Phase 22 - PLP, Homepage, Cart, Checkout, Generic knowledge bases

---

## Quick Navigation

| Section | Description | File |
|---------|-------------|------|
| User Stories | US1-US14 + Edge Cases | [user-stories.md](./user-stories.md) |
| Foundation Requirements | FR-001 to FR-014, CR-001 to CR-009 | [requirements-foundation.md](./requirements-foundation.md) |
| CRO Requirements | FR-015 to FR-097, Phases 16-18 | [requirements-cro.md](./requirements-cro.md) |
| Phase 19-20 Requirements | FR-098 to FR-170, Coverage & Pipeline (10 modules) | [requirements-phase19-20.md](./requirements-phase19-20.md) |
| Phase 21 Requirements | FR-171 to FR-342, Vision + Evidence + Mapping | [requirements-phase21.md](./requirements-phase21.md) |
| Phase 22 Requirements | FR-343 to FR-347, Page Type Knowledge Bases | [requirements-phase22.md](./requirements-phase22.md) |
| Phase 23 Requirements | FR-360 to FR-372, LLM Input Capture | [requirements-phase23.md](./requirements-phase23.md) |
| Phase 24 Requirements | FR-380 to FR-389, Hybrid LLM Page Type Detection | [requirements-phase24.md](./requirements-phase24.md) |
| Phase 25 Requirements | FR-390 to FR-396, Enhanced Extraction & Screenshot Analysis | [requirements-phase25.md](./requirements-phase25.md) |
| Phase 26 Requirements | FR-420 to FR-429, LLM Analysis Optimization | [requirements-phase26.md](./requirements-phase26.md) |
| Element Mapping | FR-430 to FR-433, Element positions in prompts + ref parsing | [requirements-phase25.md](./requirements-phase25.md#element-mapping-quality-fix) |
| Phase 27 Requirements | FR-440 to FR-455, Analysis Quality & Annotation Fix | [requirements-phase27.md](./requirements-phase27.md) |

---

## Summary

### User Stories (14 total)
- **US1-US5**: Foundation (URL Loading, Heading Extraction, LangChain, Output, Cookie Consent)
- **US6-US10**: CRO Agent (DOM Extraction, Agent Loop, Tools, Heuristics, Reporting)
- **US11-US14**: Advanced (Page Coverage, Unified Pipeline, Constraints, Selectors)

### Requirements Coverage
- **Functional Requirements**: FR-001 to FR-347
- **Configuration Requirements**: CR-001 to CR-043
- **Success Criteria**: SC-001 to SC-156

### Phase Mapping
| Phase | Focus | Requirements | Status |
|-------|-------|--------------|--------|
| 1-12 | Foundation | FR-001 to FR-014 | ✅ Complete |
| 13-15 | CRO Models & DOM | FR-015 to FR-038 | ✅ Complete |
| 16 | Agent Core | FR-039 to FR-048 | ✅ Complete |
| 17 | CRO Tools | FR-049 to FR-063 | ✅ Complete |
| 18 | Heuristics | FR-064 to FR-097 | ✅ Complete |
| 19 | Page Coverage | FR-098 to FR-112 | ✅ Complete |
| ~~20~~ | ~~Unified Pipeline~~ | ~~FR-113 to FR-170~~ | **DEFERRED** |
| 21a-d | Vision Core | FR-171 to FR-260 | ✅ Complete |
| ~~21e-f~~ | ~~Multi-Viewport~~ | - | ✅ REMOVED (CR-001) |
| ~~21g~~ | ~~Vision Agent~~ | ~~FR-280 to FR-301~~ | ✅ MERGED (CR-001) |
| **CR-001** | **Architecture Simplification** | - | ✅ Complete |
| 21h | Evidence Capture | FR-302 to FR-321 | ✅ Complete |
| 21i | Coordinate Mapping | FR-322 to FR-342 | ✅ Complete |
| **21l** | **Default Evidence & Mapping** | FR-343 to FR-355 | ✅ Complete |
| **22** | **Page Type KBs** | FR-356 to FR-359 | 📋 Pending |
| **23** | **LLM Input Capture** | FR-360 to FR-372 | ✅ Complete |
| **24** | **Hybrid LLM Page Detection** | FR-380 to FR-389 | ✅ Complete |
| **25** | **Enhanced Extraction** | FR-390 to FR-411 | ✅ Complete |
| **26** | **LLM Analysis Optimization** | FR-420 to FR-429 | ✅ Complete |
| **27** | **Analysis Quality & Annotation Fix** | FR-440 to FR-462 | ✅ Complete |
