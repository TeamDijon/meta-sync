import { readFileSync, existsSync } from 'fs';

export class ManifestParser {
  static parseFile(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Manifest file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf8');
    return this.parseContent(content);
  }

  static parseContent(content) {
    const definitions = {
      metafields: [],
      metaobjects: [],
    };

    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    let currentSection = null;

    for (const line of lines) {
      // Parse definition headers first (### namespace.key or ### type)
      if (line.startsWith('### ') && currentSection) {
        const definitionName = line.substring(4).trim();
        const parsed = this.parseDefinitionLine(definitionName, currentSection);
        if (parsed) {
          if (parsed.type === 'metafield') {
            definitions.metafields.push(parsed);
          } else if (parsed.type === 'metaobject') {
            definitions.metaobjects.push(parsed);
          }
        }
        continue;
      }

      // Detect sections from headers (# or ##, but not ###)
      if (line.startsWith('#') && !line.startsWith('###')) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('metafield')) {
          currentSection = 'metafields';
        } else if (lowerLine.includes('metaobject')) {
          currentSection = 'metaobjects';
        }
        continue;
      }
    }

    return definitions;
  }

  static parseDefinitionLine(definitionName, currentSection) {
    if (currentSection === 'metafields') {
      // Expected format: namespace.key (from ### namespace.key)
      if (definitionName.includes('.')) {
        const parts = definitionName.split('.');
        if (parts.length >= 2) {
          const namespace = parts[0];
          const key = parts.slice(1).join('.'); // Handle multi-dot keys like specs.dimensions

          return {
            type: 'metafield',
            namespace,
            key,
            identifier: `${namespace}.${key}`,
          };
        }
      }
    } else if (currentSection === 'metaobjects') {
      // Expected format: type (from ### type)
      return {
        type: 'metaobject',
        objectType: definitionName,
        identifier: definitionName,
      };
    }

    return null;
  }

  static findMatchingDefinitions(manifestDefs, allDefinitions) {
    const matches = {
      metafields: [],
      metaobjects: [],
      notFound: [],
    };

    // Match metafields
    for (const manifestDef of manifestDefs.metafields) {
      const found = allDefinitions.metafields.find(
        (def) =>
          def.namespace === manifestDef.namespace && def.key === manifestDef.key
      );

      if (found) {
        matches.metafields.push(found);
      } else {
        matches.notFound.push({
          type: 'metafield',
          identifier: `${manifestDef.namespace}/${manifestDef.key}`,
        });
      }
    }

    // Match metaobjects
    for (const manifestDef of manifestDefs.metaobjects) {
      const found = allDefinitions.metaobjects.find(
        (def) =>
          (manifestDef.objectType && def.type === manifestDef.objectType) ||
          (manifestDef.name && def.name === manifestDef.name)
      );

      if (found) {
        matches.metaobjects.push(found);
      } else {
        matches.notFound.push({
          type: 'metaobject',
          identifier: manifestDef.objectType || manifestDef.name,
        });
      }
    }

    return matches;
  }
}
