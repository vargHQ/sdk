# Git Hooks Configuration

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks for maintaining code quality and security.

## Installed Hooks

### `pre-commit`
Runs before each commit:
- **Gitleaks** - Scans staged files for secrets and credentials
- **Lint-staged** - Runs Biome linter/formatter on staged files

### `commit-msg`
Validates commit messages:
- **Commitlint** - Enforces [Conventional Commits](https://www.conventionalcommits.org/) format

### `pre-push`
Runs before pushing to remote:
- **TypeScript type checking** - Ensures no type errors before push

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes
- `revert`: Revert previous commit

### Examples
```bash
feat: add video generation API
fix(transcribe): handle empty audio files
docs: update installation guide
refactor: simplify audio processing pipeline
```

## Available Scripts

```bash
# Run linter
bun run lint

# Format code
bun run format

# Type check
bun run type-check

# Check bundle size
bun run size
```

## Bypassing Hooks

⚠️ **Not recommended** - Only use when absolutely necessary:

```bash
# Skip all hooks
git commit --no-verify -m "emergency fix"

# Skip specific checks by setting env vars
HUSKY=0 git commit -m "skip all hooks"
```

## Troubleshooting

If hooks aren't running:

```bash
# Reinstall hooks
rm -rf .husky/_
bun run prepare
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
```

## Size Limits

Bundle size limits are defined in `.size-limit.json`. Check size before publishing:

```bash
bun run size
```




