# Phase 2 split tools (kept for the record)

These one-off scripts turned the phase 1 file `src/legacy-main.ts` into the modules in `src/`.
They are not part of the build. To re-run them, restore the input first:

    git show df5e075:src/legacy-main.ts > scripts/split/legacy-main.phase1.ts
    node scripts/split/report.mjs        # what the split needs (shared writes, load order)
    node scripts/split/emit.mjs          # writes src/**/*.ts and src/main.ts
    node scripts/split/split-actions.mjs # splits the action map into src/actions/map/
    node scripts/split/split-inspector.mjs # splits the inspector into one file per section

- `map.mjs` says which module each top-level statement goes to.
- `analyze-refs.mjs` resolves every name with the TypeScript checker, so local names that shadow a
  global are never confused with it.
- A variable that another module assigns gets a setter (`setLayers`, `setDragging`, ...).
- Event listeners move into a `listen()` per module; `main.ts` calls them in the original order.
