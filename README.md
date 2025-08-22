# Meta-Sync �

A powerful CLI tool for syncing Shopify metafield and metaobject definitions between stores. Perfect for staging → production deployments with safety controls and manifest-based workflows.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Shopify API](https://img.shields.io/badge/Shopify_API-unstable-blue.svg)](https://shopify.dev/docs/api)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- 🔍 **List** all definitions from any store with unified manifest export
- 📋 **Copy** selective definitions using manifest files
- 🚀 **Bulk sync** complete store definitions (delete-first + copy architecture)
- 🗑️ **Delete** selective or all definitions with confirmation prompts
- 🎯 **Resource filtering** - target metafields, metaobjects, or both
- 📦 **Entry management** - copy metaobject entries with conflict resolution
- 🎭 **Dry-run** preview changes before execution
- 📝 **Comprehensive logging** with verbose output and file logging
- 🛡️ **Safety controls** with interactive confirmations for destructive operations
- 🔄 **Unified manifest format** - seamless list → copy/delete workflow
- ⚙️ **Configuration diagnostics** - validate stores, test connections, troubleshoot issues

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd meta-sync
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your store credentials

# 3. List definitions from a store
npm run list -- --store staging

# 4. Copy definitions between stores
npm run copy -- --from staging --to production --dry-run
```

## 📖 Commands Overview

### Core Commands

| Command  | Description                          | Safety Level     |
| -------- | ------------------------------------ | ---------------- |
| `list`   | Export all definitions to manifest   | ✅ Safe          |
| `copy`   | Copy selective definitions           | ⚠️ Modify target |
| `bulk`   | Complete store sync (delete + copy)  | 🚨 Destructive   |
| `delete` | Remove selective/all definitions     | 🚨 Destructive   |
| `config` | Validate configuration & diagnostics | ✅ Safe          |

### Global Options

| Option              | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `--dry-run`         | Preview changes without execution                           |
| `--verbose`         | Detailed logging output                                     |
| `--log <path>`      | Save logs to file                                           |
| `--yes`             | Skip confirmation prompts (automation)                      |
| `--resources`       | Filter resource types (`metafields`, `metaobjects`, `both`) |
| `--include-entries` | Include metaobject entries in processing                    |

### Resource Type Filtering

All commands support the `--resources` option to filter which resource types to process:

- `--resources metafields` - Process only metafield definitions
- `--resources metaobjects` - Process only metaobject definitions
- `--resources both` - Process both types (default)

### Metaobject Entry Management

The `--include-entries` flag enables processing of metaobject entries (actual data instances):

- **List command**: Shows entry counts for each metaobject type
- **Copy/Bulk commands**: Copies entries after definitions with conflict resolution
- **Delete command**: Removes entries before deleting definitions

Entry conflicts are resolved interactively with options to:

- Skip conflicting entries
- Update existing entries with new values
- Apply same decision to all future conflicts

## 🛠️ Usage

### Recommended: NPM Scripts

Use NPM scripts for cleaner commands:

```bash
# List definitions with entry counts
npm run list -- --store <store> --include-entries --output manifest.md

# List only metafields
npm run list -- --store <store> --resources metafields --output metafields.md

# Copy only metaobjects with entries and manifest
npm run copy -- --from <source> --to <target> --manifest manifest.md --resources metaobjects --include-entries --dry-run

# Bulk sync only metafields (delete-first architecture)
npm run bulk -- --from <source> --to <target> --resources metafields --verbose

# Delete metaobjects including entries with confirmation
npm run delete -- --store <target> --manifest cleanup.md --resources metaobjects --include-entries

# Validate configuration and test connections
npm run config
```

### Alternative: Direct CLI

```bash
node src/cli.js <command> [options]
```

## ⚙️ Configuration Management

### Environment Setup

Create a `.env` file with your Shopify private app credentials:

```env
# Store configurations - use any naming convention
STAGING_STORE_URL=my-staging-store.myshopify.com
STAGING_ACCESS_TOKEN=shppa_xxxxxxxxxx

PRODUCTION_STORE_URL=my-production-store.myshopify.com
PRODUCTION_ACCESS_TOKEN=shppa_xxxxxxxxxx

# Add as many stores as needed
DEV_STORE_URL=dev-store.myshopify.com
DEV_ACCESS_TOKEN=shppa_xxxxxxxxxx
```

> **💡 Store Mapping**: The `--store` parameter uses environment variable prefixes:
>
> - `--store staging` → `STAGING_STORE_URL` + `STAGING_ACCESS_TOKEN`
> - `--store production` → `PRODUCTION_STORE_URL` + `PRODUCTION_ACCESS_TOKEN`

### Configuration Diagnostics

Use the `config` command to validate your setup and troubleshoot issues:

```bash
# Check configuration and test connections
npm run config

# Example output:
# ✅ Configuration Status
# 📊 Stores configured: 2
# 🏪 Available stores: production, staging
# 🌍 Environment: development
#
# ✅ Store Connection Tests
# ✅ production: Client creation successful
# ✅ staging: Client creation successful
```

The config command provides:

- **Store validation**: Confirms all configured stores
- **Environment verification**: Shows current environment settings
- **Connection testing**: Validates API client creation
- **Troubleshooting guidance**: Helps identify configuration issues

## 📋 Unified Manifest Format

The tool uses a **unified manifest format** where `list` output is directly compatible with `copy` and `delete` inputs.

### Example Manifest

```markdown
# Store Definitions: staging

Generated: 2025-08-22T14:00:00.000Z
Found 25 metafield definitions and 3 metaobject definitions.

## Metafields

### product.specs.weight

- **Type:** number_decimal
- **Owner:** PRODUCT
- **Description:** Product weight in kg

### collection.seo.featured_image

- **Type:** file_reference
- **Owner:** COLLECTION
- **Description:** Featured image for SEO

## Metaobjects

### recipe

- **Name:** Recipe
- **Description:** Recipe with ingredients and instructions
- **Entries:** 8 entries found
- **Fields:**
  - **title** (single_line_text_field) - Recipe title
  - **ingredients** (multi_line_text_field) - Ingredient list
- **Access:** Admin=PUBLIC_READ_WRITE, Storefront=PUBLIC_READ
- **Capabilities:** publishable, translatable
```

### Manifest Rules

- **Headers**: Use `## Metafields` and `## Metaobjects`
- **Metafields**: Define as `### namespace.key`
- **Metaobjects**: Define as `### type`
- **Parsing**: Only `###` headers are parsed - other content is informational

## 🏗️ Bulk Command Architecture

The `bulk` command implements a **delete-first architecture** for complete store synchronization:

### Workflow

1. **Delete Phase**: Removes all definitions from target store
2. **Copy Phase**: Copies all definitions from source store
3. **Entry Sync**: Optionally syncs metaobject entries (with `--include-entries`)

### Benefits

- **Clean Slate**: Ensures target store exactly matches source
- **No Conflicts**: Eliminates definition conflicts and orphaned data
- **Consistency**: Guarantees identical store configurations
- **DRY Architecture**: Reuses existing `delete` and `copy` command logic

### Safety Features

- **Dry-run Preview**: Shows both delete and copy operations
- **Interactive Confirmation**: Requires explicit approval
- **Verbose Logging**: Detailed progress tracking
- **Error Handling**: Robust error recovery and reporting

## 🔄 Common Workflows

### 1. Selective Deployment

```bash
# Export current definitions
npm run list -- --store staging --output review.md

# Edit review.md to keep only desired definitions
# Preview deployment
npm run copy -- --from staging --to production --manifest review.md --dry-run

# Execute deployment
npm run copy -- --from staging --to production --manifest review.md
```

### 2. Complete Store Migration (Delete-First Architecture)

```bash
# Preview full sync (shows delete + copy operations)
npm run bulk -- --from staging --to production --dry-run --verbose

# Execute with confirmation (deletes all target definitions first, then copies)
npm run bulk -- --from staging --to production

# Or skip confirmation for automation
npm run bulk -- --from staging --to production --yes
```

### 3. Emergency Cleanup

```bash
# Create cleanup manifest
npm run list -- --store production --output current.md
# Edit current.md to keep only problematic definitions

# Preview deletion
npm run delete -- --store production --manifest cleanup.md --dry-run

# Execute deletion (with confirmation)
npm run delete -- --store production --manifest cleanup.md
```

### 4. Multi-Environment Pipeline

```bash
# Dev → Staging → Production pipeline
npm run copy -- --from dev --to staging --dry-run
npm run copy -- --from dev --to staging

npm run copy -- --from staging --to production --dry-run
npm run copy -- --from staging --to production
```

### 5. Configuration Validation & Troubleshooting

```bash
# Validate all store configurations
npm run config

# Test before important operations
npm run config && npm run bulk -- --from staging --to production --dry-run
```

## 🛡️ Safety Features

### Interactive Confirmations

Destructive operations (`delete`, `bulk`) require confirmation:

```
⚠️  DESTRUCTIVE OPERATION CONFIRMATION

Operation: Delete metafield/metaobject definitions
Target Store: production (my-prod-store.myshopify.com)
Impact: 15 metafield definitions, 3 metaobject definitions

This will permanently delete the above definitions and all associated data.

Continue? (yes/no):
```

### Confirmation Bypass

For CI/CD automation, skip confirmations:

```bash
# Automated deployment
npm run bulk -- --from staging --to production --yes --verbose
```

### Dry-Run Validation

Always preview changes first:

```bash
npm run bulk -- --from staging --to production --dry-run --verbose
```

## 🔑 Shopify API Requirements

### Required Scopes

For complete functionality, configure private apps with these scopes:

**Essential Scopes:**

- `read_metaobjects_definitions` + `write_metaobjects_definitions`
- `read_products` + `write_products` (Product/Variant/Collection metafields)
- `read_customers` + `write_customers` (Customer metafields)

**Additional Resource Scopes:**

- `read_orders` + `write_orders` (Order metafields)
- `read_draft_orders` + `write_draft_orders` (Draft order metafields)
- `read_locations` + `write_locations` (Location metafields)
- `read_markets` + `write_markets` (Market metafields)
- `read_content` + `write_content` (Page/Blog/Article metafields)

> **💡 Tip**: Start with essential scopes and add others as needed for your specific metafield types.

<details>
<summary>📋 Complete Scope Reference</summary>

| Resource Type                 | Read Scope                     | Write Scope                     |
| ----------------------------- | ------------------------------ | ------------------------------- |
| Metaobjects                   | `read_metaobjects_definitions` | `write_metaobjects_definitions` |
| Products/Variants/Collections | `read_products`                | `write_products`                |
| Customers                     | `read_customers`               | `write_customers`               |
| Orders                        | `read_orders`                  | `write_orders`                  |
| Draft Orders                  | `read_draft_orders`            | `write_draft_orders`            |
| Locations                     | `read_locations`               | `write_locations`               |
| Markets                       | `read_markets`                 | `write_markets`                 |
| Pages/Blogs/Articles          | `read_content`                 | `write_content`                 |
| Shop                          | _No additional scopes_         | _No additional scopes_          |
| Company/Company Location\*    | `read_customers`               | `write_customers`               |

\*Requires Shopify Plus

</details>

## 🐛 Troubleshooting

### Configuration Validation

First step for any issues - validate your configuration:

```bash
# Check configuration and test connections
npm run config

# This will verify:
# - Store URLs and access tokens
# - API client creation
# - Environment variables
# - Connection status
```

### Common Issues

**Authentication Errors:**

- Run `npm run config` to test your store connections
- Verify store URLs and access tokens in `.env`
- Check private app scopes match your metafield types
- Ensure tokens have correct permissions (especially `read_metaobjects_definitions`)

**Metaobject Entry Issues:**

- Ensure you have `read_metaobjects` scope for accessing entries
- Use `--verbose` to see detailed GraphQL query information
- Check that metaobject definitions exist before trying to copy entries

**Sync Failures:**

- Use `--dry-run` to preview and identify issues
- Check `--verbose` logs for detailed error information
- Verify source definitions exist before copying
- For bulk operations, ensure sufficient API rate limits

**Performance:**

- Large operations may take time - use `--verbose` for progress
- Consider selective manifest copying instead of bulk operations
- Monitor API rate limits during bulk operations

### Error Analysis

All operations provide detailed error logging:

```bash
# Save detailed logs
npm run copy -- --from staging --to production --verbose --log sync.log

# Review logs for issues
cat sync.log
```

## 🏗️ Development

### Project Structure

```
meta-sync/
├── src/
│   ├── cli.js                  # CLI entry point
│   ├── commands/               # Command implementations
│   │   ├── list.js            # List definitions
│   │   ├── copy.js            # Copy definitions
│   │   ├── bulk.js            # Bulk sync (delete + copy)
│   │   ├── delete.js          # Delete definitions
│   │   └── config.js          # Configuration diagnostics
│   ├── managers/
│   │   └── definition.js      # Core business logic
│   ├── shopify/
│   │   ├── client.js          # GraphQL API client
│   │   └── graphql-fragments.js # GraphQL query builders
│   └── utils/
│       ├── config.js          # Configuration management
│       ├── logger.js          # Logging utilities
│       ├── manifest.js        # Manifest parsing
│       ├── confirmation.js    # Interactive prompts
│       └── command-base.js    # Base command class
├── .env.example               # Environment template
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

### Technical Stack

- **Runtime**: Node.js 18+ with ES modules
- **CLI Framework**: Commander.js for argument parsing
- **API Client**: Custom GraphQL client for Shopify Admin API (unstable version)
- **Architecture**: Command pattern with base classes, managers, and DRY principles

### Running Tests

```bash
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 Check this README for comprehensive usage examples
- 🐛 Report issues on GitHub
- 💡 Feature requests welcome

---

**Made with ❤️ for the Shopify development community**
