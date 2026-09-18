# Work Rules

1. When modifying code, also update any comments that describe that code. Do not leave comments referring to outdated values or behavior.
2. Run the smoke test (`node tools/smoke.mjs`) only when explicitly instructed. Do not run it for simple changes.
3. Do not update `balance-editor.html`. Even if CONFIG fields are added, changed, or removed, leave this file untouched until the feature is fully complete and the file is rebuilt.
4. Do not perform any tests, validation, add debugging code, temporary hooks, logging, or refactoring unless explicitly requested by the user. Even if you believe they are necessary, do not perform them on your own.
5. Modify only what is strictly necessary for the requested task. Do not improve, clean up, or change unrelated files, structures, or code. If additional work appears necessary, report it without making the change.
