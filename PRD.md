# Meta-Sync: Shopify Metafield & Metaobject Sync Tool

## Project Requirements Document (PRD)

---

## 🎯 **Project Vision**

**Objective:** Create a CLI tool that automates the synchronization of metafield and metaobject definitions between Shopify stores (staging ↔ production), eliminating manual copying and reducing deployment risks.

**Value Proposition:**

- Saves hours of manual work on each project deployment
- Reduces human error in metafield/metaobject management
- Enables scalable workflows for agencies managing multiple Shopify stores
- Provides granular control over sync operations with detailed logging

---

## 👥 **Target User & Context**

- **Primary User:** Solo Shopify developer/consultant working with agencies
- **Use Case:** Staging → Production deployments for client projects
- **Scale:** ~100 definitions per project maximum
- **Environment:** Node.js CLI tool, project-based usage
- **Technical Level:** Experienced Shopify developers

---

## ⭐ **Core Features (MVP)**

### 1. **Bulk Sync Operations**

```bash
meta-sync bulk --from staging --to production
```

- **Process:** Delete all definitions from target → Copy all from source
- **Coverage:** Both metafield AND metaobject definitions
- **Safety:** Dry-run capability with detailed preview
- **Logging:** Comprehensive operation log with timestamps

### 2. **Granular Control Commands**

```bash
# List all definitions from a store
meta-sync list --store staging --output definitions.md

# Delete specific definitions using manifest
meta-sync delete --store production --manifest definitions.md

# Copy all definitions between stores
meta-sync copy --from staging --to production

# Copy specific definitions using manifest
meta-sync copy --from staging --to production --manifest definitions.md
```

### 3. **Environment Management**

- **.env Configuration:**
  ```
  STAGING_STORE_TOKEN=shpat_xxxxx
  PRODUCTION_STORE_TOKEN=shpat_xxxxx
  ```
- **Store URL Management:** Extract store domain from token or CLI params
- **Token Security:** Environment variable best practices

### 4. **Definition Export Format**

**Markdown Structure:**

```markdown
# Metafield Definitions

## Product Metafields

- `custom/product_features` (list.single_line_text_field)
- `custom/care_instructions` (multi_line_text_field)

## Customer Metafields

- `loyalty/tier_level` (single_line_text_field)

# Metaobject Definitions

## Product Highlights (`product_highlight`)

- title (single*line_text_field) \_required*
- description (multi_line_text_field)
- image (file_reference)
```

---

## 🚀 **Advanced Features (Phase 2)**

### 1. **Selective Operations via Manifests**

- **Targeted Sync:** Create custom manifest files with specific definitions to sync
- **Single Definition Manifests:** One-entry files for syncing individual definitions
- **Conflict Detection:** Check if definition exists before creating
- **Conflict Resolution:** Options to skip, overwrite, or prompt

### 2. **Template Store Support**

```bash
meta-sync template --store template --to new-project
```

- **Template Management:** Maintain a master store with common definitions
- **Quick Setup:** Bootstrap new projects with standard definitions

### 3. **Enhanced Validation & Safety**

- **Pre-flight Checks:** Validate tokens and permissions
- **Backup Creation:** Export target store definitions before sync
- **Rollback Capability:** Restore from backup if needed
- **Rate Limit Handling:** Intelligent retry with backoff

---

## 🛠 **Technical Architecture**

### **Platform & Language**

- **Runtime:** Node.js/JavaScript (ES6+)
- **Package Manager:** npm
- **CLI Framework:** Commander.js or similar
- **HTTP Client:** Built-in fetch API

### **Core Components**

1. **ShopifyClient Class**
   - GraphQL API communication
   - Token management
   - Rate limiting
2. **DefinitionManager Class**
   - CRUD operations for definitions
   - Bulk operations coordination
3. **FileManager Class**
   - Markdown export/import
   - Configuration management
4. **Logger Class**
   - Operation logging
   - Dry-run reporting

### **Key GraphQL Operations**

Based on Shopify API documentation:

**Metafield Definitions:**

- `metafieldDefinitions(ownerType: MetafieldOwnerType!, first: 100)` - List all
- `metafieldDefinitionCreate(definition: MetafieldDefinitionInput!)` - Create
- `metafieldDefinitionDelete(id: ID!)` - Delete

**Metaobject Definitions:**

- `metaobjectDefinitions(first: 100)` - List all
- `metaobjectDefinitionCreate(definition: MetaobjectDefinitionInput!)` - Create
- `metaobjectDefinitionDelete(id: ID!)` - Delete

---

## 📋 **CLI Command Specification**

### **Core Commands**

```bash
# Bulk Operations
meta-sync bulk --from <store> --to <store> [--dry-run]

# Granular Control
meta-sync list --store <store> [--output <file>]
meta-sync copy --from <store> --to <store> [--manifest <file>]
meta-sync delete --store <store> [--manifest <file>]
```

**Command Behaviors:**

- **`copy`** without `--manifest`: Copies ALL definitions from source to target
- **`copy`** with `--manifest`: Copies only definitions listed in the manifest file
- **`delete`** without `--manifest`: Deletes ALL definitions from target store
- **`delete`** with `--manifest`: Deletes only definitions listed in the manifest file

### **Global Options**

- `--dry-run`: Preview changes without executing
- `--verbose`: Detailed logging output
- `--config <path>`: Custom config file location
- `--log <path>`: Custom log file location

---

## 🔒 **Security & Environment**

### **Token Management**

- **Storage:** Environment variables only
- **Format:** Private app tokens (shpat_xxxxx)
- **Scopes Required:**
  - `read_metaobject_definitions`
  - `write_metaobject_definitions`
  - Access to metafield namespaces

### **Configuration**

**.env Structure:**

```
STAGING_STORE_TOKEN=shpat_xxxxx
PRODUCTION_STORE_TOKEN=shpat_xxxxx
# Optional: Store URLs if not extractable from tokens
STAGING_STORE_URL=staging-store.myshopify.com
PRODUCTION_STORE_URL=production-store.myshopify.com
```

---

## ⚡ **Implementation Priority**

### **Phase 1 (MVP - Immediate Need)**

1. ✅ Basic CLI structure with Commander.js
2. ✅ Environment configuration (.env support)
3. ✅ Shopify GraphQL client with authentication
4. ✅ List definitions command with markdown export
5. ✅ Bulk sync command (delete all → copy all)
6. ✅ Dry-run functionality with detailed preview
7. ✅ Basic error handling and validation

### **Phase 2 (Enhanced Features)**

1. ✅ Selective sync with pattern matching
2. ✅ Conflict detection and resolution
3. ✅ Backup/restore functionality
4. ✅ Template store support
5. ✅ Enhanced logging and reporting

---

## 🚧 **Technical Constraints & Considerations**

### **Shopify API Limitations**

- **Rate Limits:** 40 calls/second for private apps
- **Bulk Operations:** No native bulk delete/create for definitions
- **Definition Limits:** ~100 definitions per store (as specified)
- **Reserved Namespaces:** Handle app-owned vs merchant-owned definitions

### **Error Handling**

- **Network Failures:** Retry logic with exponential backoff
- **API Errors:** Detailed error messages with suggested fixes
- **Validation Failures:** Pre-flight checks for common issues
- **Partial Failures:** Continue operation where possible, report failures

### **Performance Considerations**

- **Sequential Operations:** Avoid overwhelming API with parallel requests
- **Progress Indicators:** Show progress for long-running operations
- **Memory Management:** Stream large export files rather than loading in memory

---

## 📊 **Success Metrics**

### **Functional Success**

- ✅ Successfully sync 100+ definitions in under 5 minutes
- ✅ Zero data loss during sync operations
- ✅ 100% accuracy in definition recreation (namespace, key, type, validation)

### **Usability Success**

- ✅ Single command bulk sync for most common use case
- ✅ Clear, actionable error messages
- ✅ Comprehensive dry-run preview prevents mistakes
- ✅ Detailed operation logs for troubleshooting

---

## 🔄 **Future Enhancements (Beyond MVP)**

1. **Web Interface:** Browser-based GUI for less technical users
2. **CI/CD Integration:** GitHub Actions/pipeline integration
3. **Multi-Store Support:** Sync across multiple stores simultaneously
4. **Definition Versioning:** Track changes over time
5. **Advanced Filtering:** Complex queries for definition selection
6. **Shopify Plus Features:** Support for Plus-specific metadata
7. **Real-time Sync:** Watch mode for continuous synchronization

---

## 📝 **Implementation Notes**

### **Development Setup**

```bash
npm init -y
npm install commander dotenv
# Additional dependencies as needed
```

### **Project Structure**

```
meta-sync/
├── src/
│   ├── cli/
│   ├── shopify/
│   ├── managers/
│   └── utils/
├── tests/
├── docs/
├── .env.example
├── package.json
└── README.md
```

### **Testing Strategy**

- **Unit Tests:** Core business logic
- **Integration Tests:** Shopify API interactions (with test stores)
- **CLI Tests:** Command parsing and execution
- **Manual Testing:** Real-world scenarios with staging/production stores

---

**Document Version:** 1.0  
**Last Updated:** August 22, 2025  
**Next Review:** Upon Phase 1 completion
