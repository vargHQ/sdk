# Contributing to @vargai/sdk

## Development Setup

This project uses **Bun** as the runtime and package manager.

```bash
# Install dependencies
bun install

# Run linter
bun run lint

# Format code
bun run format

# Type check
bun run type-check

# Check bundle size
bun run size
```

## Git Workflow

This project uses automated Git hooks powered by [Husky](https://typicode.github.io/husky/) to maintain code quality and security.

### Automated Checks

#### Before Commit (`pre-commit`)
1. **Gitleaks** - Scans for secrets, API keys, and credentials
2. **Biome** - Lints and formats staged files automatically

#### Commit Message (`commit-msg`)
3. **Commitlint** - Validates commit message format

#### Before Push (`pre-push`)
4. **TypeScript** - Type checking to catch errors early

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>
```

**Available types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, missing semi colons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Changes to build system or dependencies
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

**Examples:**
```bash
feat: add voice cloning endpoint
feat(video): implement background removal
fix: handle null pointer in transcription
fix(captions): correct timestamp alignment
docs: update API documentation
refactor: simplify audio processing pipeline
perf(image): optimize memory usage
chore: update dependencies
```

### Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:

- **Automatic formatting** on commit via lint-staged
- **Manual formatting**: `bun run format`
- **Manual linting**: `bun run lint`

### Bundle Size

SDK bundle size is monitored via size-limit:

```bash
bun run size
```

Current limits are defined in `.size-limit.json`.

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/amazing-feature`
3. Make your changes
4. Commit with conventional format: `git commit -m "feat: add amazing feature"`
5. Push to your fork: `git push origin feat/amazing-feature`
6. Open a Pull Request

### PR Guidelines

- ✅ All automated checks must pass
- ✅ Follow conventional commits format
- ✅ Update documentation if needed
- ✅ Add tests for new features
- ✅ Keep bundle size within limits

## Bypassing Hooks

⚠️ **Only in emergencies:**

```bash
# Skip all hooks (not recommended)
git commit --no-verify -m "emergency fix"
```

## Troubleshooting

### Hooks not running?

```bash
# Reinstall hooks
bun run prepare
chmod +x .husky/*
```

### Type errors?

```bash
bun run type-check
```

### Format issues?

```bash
bun run format
```

### Secrets detected?

If gitleaks detects secrets:
1. **DO NOT** bypass the hook
2. Remove the secret from your code
3. Use environment variables instead
4. If already committed, rotate the exposed credentials

## Questions?

Open an issue or reach out to the maintainers.

