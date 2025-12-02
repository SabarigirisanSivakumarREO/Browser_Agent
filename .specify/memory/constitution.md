<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 0.0.0 → 1.0.0 (MAJOR - Initial constitution ratification)

Modified principles: N/A (Initial creation)

Added sections:
- Core Principles (8 principles)
  - I. Code Quality & Maintainability
  - II. TypeScript First
  - III. Playwright for Browser Automation
  - IV. Error Handling & Logging
  - V. Async/Await Patterns
  - VI. Context Efficiency
  - VII. Modular Design
  - VIII. Documentation Standards
- Technology Standards
- Development Workflow

Removed sections: N/A (Initial creation)

Templates requiring updates:
- .specify/templates/plan-template.md ✅ (Constitution Check section compatible)
- .specify/templates/spec-template.md ✅ (Requirements section compatible)
- .specify/templates/tasks-template.md ✅ (Phase structure compatible)
- .specify/templates/checklist-template.md ✅ (No constitution references)
- .specify/templates/agent-file-template.md ✅ (No constitution references)

Follow-up TODOs: None
================================================================================
-->

# Browser Agent Constitution

## Core Principles

### I. Code Quality & Maintainability

All code MUST prioritize readability, maintainability, and long-term sustainability over clever optimizations or shortcuts.

- Code MUST be self-documenting with clear naming conventions
- Functions MUST have a single responsibility
- Code duplication MUST be eliminated through proper abstraction
- Technical debt MUST be documented and addressed proactively
- Code reviews MUST verify adherence to quality standards

**Rationale**: Browser automation agents require stable, maintainable codebases that can evolve with changing web technologies and user requirements.

### II. TypeScript First

All implementation MUST use Node.js with TypeScript for type safety and developer experience.

- TypeScript strict mode MUST be enabled (`strict: true`)
- All functions MUST have explicit return types
- `any` type is PROHIBITED except in documented exceptional cases
- Interfaces MUST be used for object shapes and contracts
- Generics SHOULD be used to maximize type reusability

**Rationale**: Type safety prevents runtime errors, improves IDE support, and makes refactoring safe in complex browser automation scenarios.

### III. Playwright for Browser Automation

Playwright MUST be the primary tool for all browser automation tasks.

- Playwright's built-in selectors MUST be preferred over custom implementations
- Auto-waiting mechanisms MUST be leveraged instead of explicit waits
- Browser contexts MUST be properly isolated for parallel execution
- Page object pattern SHOULD be used for complex page interactions
- Screenshot and trace capabilities MUST be available for debugging

**Rationale**: Playwright provides reliable cross-browser automation with modern async patterns, built-in waiting, and excellent debugging capabilities.

### IV. Error Handling & Logging

All operations MUST implement comprehensive error handling and structured logging.

- All async operations MUST have try-catch blocks with specific error types
- Errors MUST be logged with sufficient context for debugging
- Structured logging (JSON format) MUST be used for machine-parseable output
- Log levels MUST be used appropriately: error, warn, info, debug
- Sensitive data MUST NEVER appear in logs

**Rationale**: Browser automation is inherently fragile; comprehensive error handling and logging are essential for diagnosing failures in production.

### V. Async/Await Patterns

All asynchronous code MUST follow consistent async/await patterns.

- `async/await` MUST be used instead of raw Promises or callbacks
- Promise.all MUST be used for independent parallel operations
- Sequential operations MUST use proper await chains
- Async iterators SHOULD be used for streaming operations
- Error propagation MUST be explicit and predictable

**Rationale**: Consistent async patterns improve code readability and prevent common concurrency bugs in browser automation workflows.

### VI. Context Efficiency

LLM context usage MUST be optimized to target 40-60% of available context window.

- Responses MUST be concise without sacrificing clarity
- Large code blocks SHOULD be chunked into logical segments
- Redundant information MUST NOT be repeated across interactions
- Summaries SHOULD replace verbose explanations where appropriate
- Tool usage MUST be efficient to minimize context overhead

**Rationale**: Efficient context usage ensures the agent can handle complex, multi-step browser automation tasks without running out of context.

### VII. Modular Design

Code MUST be organized into modular, testable units with clear separation of concerns.

- Each module MUST have a single, well-defined responsibility
- Dependencies MUST be injected rather than hardcoded
- Interfaces MUST define contracts between modules
- Side effects MUST be isolated and contained
- Circular dependencies are PROHIBITED

**Rationale**: Modular design enables unit testing, parallel development, and safe refactoring of browser automation components.

### VIII. Documentation Standards

All code MUST include comprehensive inline documentation.

- Public APIs MUST have JSDoc comments with parameter and return descriptions
- Complex algorithms MUST include explanatory comments
- Non-obvious code MUST have inline comments explaining the "why"
- README files MUST be maintained for each major module
- Examples MUST accompany complex API usage

**Rationale**: Browser automation often involves non-obvious interactions with web pages; documentation preserves institutional knowledge.

## Technology Standards

**Runtime**: Node.js (LTS version)
**Language**: TypeScript 5.x with strict mode
**Browser Automation**: Playwright
**Package Manager**: npm or pnpm
**Testing Framework**: Playwright Test or Vitest
**Linting**: ESLint with TypeScript plugin
**Formatting**: Prettier

### Required Dependencies

- `playwright` - Browser automation
- `typescript` - Type safety
- `@types/node` - Node.js type definitions

### Recommended Patterns

- Repository pattern for data access abstraction
- Factory pattern for browser context creation
- Strategy pattern for selector strategies
- Observer pattern for event handling

## Development Workflow

### Code Review Requirements

- All changes MUST be reviewed before merging
- Reviews MUST verify constitution compliance
- Type safety violations MUST block merge
- Test coverage MUST be maintained or improved

### Testing Gates

- Unit tests MUST pass before merge
- Integration tests MUST run against browser targets
- Type checking MUST pass with zero errors
- Linting MUST pass with zero warnings

### Commit Standards

- Commits MUST follow conventional commit format
- Commits MUST be atomic and focused
- Commit messages MUST explain the "why"

## Governance

This constitution establishes the foundational principles and standards for the Browser Agent project. All development activities MUST comply with these principles.

### Amendment Procedure

1. Proposed amendments MUST be documented with rationale
2. Amendments MUST be reviewed by project stakeholders
3. Approved amendments MUST include a migration plan for existing code
4. Version MUST be incremented according to semantic versioning:
   - MAJOR: Principle removals or incompatible changes
   - MINOR: New principles or expanded guidance
   - PATCH: Clarifications and refinements

### Compliance Review

- All PRs MUST verify compliance with constitution principles
- Violations MUST be documented in the Complexity Tracking section of plans
- Justified exceptions MUST be explicitly approved and documented

**Version**: 1.0.0 | **Ratified**: 2025-01-23 | **Last Amended**: 2025-01-23
