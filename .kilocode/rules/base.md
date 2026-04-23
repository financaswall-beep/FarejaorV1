# Project Guidelines

## Architecture
- Prefer Clean Architecture principles
- Keep domain and application logic independent from infrastructure and UI
- Make dependencies point inward
- Infrastructure should implement interfaces defined in the core

## Delivery
- Prefer the simplest solution that can ship
- Start with an MVP and evolve only when needed
- Avoid overengineering and premature abstractions

## Code Quality
- Prefer clarity over cleverness
- Keep modules small and cohesive
- Reuse code only when duplication is proven
- Write tests for critical business rules and regressions

## Structure
- Prefer this structure when it helps:
  - src/domain
  - src/application
  - src/infrastructure
  - src/presentation
- Adapt to framework conventions when needed

## Behavior
- Explain architectural trade-offs
- Before adding a new layer or dependency, justify why
- When in doubt, choose the simpler solution