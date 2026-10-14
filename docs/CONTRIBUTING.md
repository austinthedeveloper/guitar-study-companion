# Development Workflow

## Working agreements

1. Work on the earliest incomplete milestone unless an explicit decision changes priorities.
2. Break each milestone into small vertical changes with tests and documentation.
3. Keep business logic in testable Nx libraries, not embedded in Angular components or Azure Functions handlers.
4. Validate music transformations deterministically; use AI for perception and teaching.
5. Update checkboxes in `MILESTONES.md` only after verifying acceptance criteria.
6. Capture new ideas in `FEATURE_BACKLOG.md` rather than silently expanding scope.
7. Record architectural changes in `DECISIONS.md` before making sweeping refactors.
8. Never commit credentials or real copyrighted page images.

## Definition of done

- [ ] Implementation works locally.
- [ ] Relevant automated tests pass.
- [ ] New or changed pages and flows have e2e specs (happy path, empty, error, axe), and the full e2e suite passes.
- [ ] Errors and ambiguous input are handled.
- [ ] No private fixtures, secrets, or raw scan logs are exposed.
- [ ] Documentation and milestone checklist reflect verified state.
- [ ] User-facing flow supports the central creative-transfer goal.

## Suggested first implementation task

Create the Nx workspace and an Angular page that can upload and preview a JPG/PNG, select a crop, and submit it to a stub Azure Function returning a **synthetic transcription draft**. This tests the entire interaction boundary before choosing a vision model.
