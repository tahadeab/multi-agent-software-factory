## Summary

Describe the change and the user or operational problem it addresses.

## Validation

- [ ] `pnpm test`
- [ ] `pnpm check`
- [ ] `pnpm build`
- [ ] Database migration reviewed and verified, if applicable
- [ ] Desktop/mobile UI reviewed, if applicable

## Safety and operations

- [ ] No credentials, `.env` files, logs, database exports, or private artifacts are included.
- [ ] External actions remain behind an approval gate.
- [ ] Background worker behavior and lease recovery were considered, if applicable.
- [ ] Documentation and `todo.md` were updated.

## Notes for reviewers

Add migration notes, rollout/rollback details, screenshots, or known limitations here.
