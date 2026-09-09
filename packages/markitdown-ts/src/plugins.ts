/**
 * Plugin system for MarkItDown TypeScript.
 * Provides discovery and loading of 3rd-party MarkItDown plugins.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

export interface MarkItDownPlugin {
  registerConverters: (
    markitdown: any,
    options?: Record<string, unknown>,
  ) => void | Promise<void>;
  PLUGIN_INTERFACE_VERSION?: number;
  __plugin_interface_version__?: number;
}

export interface DiscoveredPlugin {
  name: string;
  version?: string;
  description?: string;
  entryPoint: string;
}

/**
 * Discover installed MarkItDown plugins by searching `node_modules` upwards.
 */
export function discoverInstalledPlugins(startDir?: string): DiscoveredPlugin[] {
  const discovered: DiscoveredPlugin[] = [];
  const seenNames = new Set<string>();

  let currentDir = path.resolve(startDir || process.cwd());
  const checkedDirs = new Set<string>();

  while (currentDir && !checkedDirs.has(currentDir)) {
    checkedDirs.add(currentDir);

    const nodeModulesPath = path.join(currentDir, "node_modules");
    if (fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory()) {
      try {
        const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });

        for (const entry of entries) {
          const isDirOrLink = entry.isDirectory() || entry.isSymbolicLink();
          if (isDirOrLink) {
            if (entry.name.startsWith("@")) {
              // Scoped package directory
              const scopeDir = path.join(nodeModulesPath, entry.name);
              try {
                const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
                for (const scopedEntry of scopedEntries) {
                  if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
                    checkAndAddPackage(
                      path.join(scopeDir, scopedEntry.name),
                      seenNames,
                      discovered,
                    );
                  }
                }
              } catch {
                // Ignore read errors in scoped dirs
              }
            } else {
              checkAndAddPackage(
                path.join(nodeModulesPath, entry.name),
                seenNames,
                discovered,
              );
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    // Also check local package.json workspaces if present
    const pkgJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const rootPkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
        if (Array.isArray(rootPkg.workspaces)) {
          for (const wsPattern of rootPkg.workspaces) {
            if (wsPattern.endsWith("/*")) {
              const wsBase = path.resolve(currentDir, wsPattern.slice(0, -2));
              if (fs.existsSync(wsBase) && fs.statSync(wsBase).isDirectory()) {
                const subEntries = fs.readdirSync(wsBase, { withFileTypes: true });
                for (const sub of subEntries) {
                  if (sub.isDirectory() || sub.isSymbolicLink()) {
                    checkAndAddPackage(
                      path.join(wsBase, sub.name),
                      seenNames,
                      discovered,
                    );
                  }
                }
              }
            } else {
              const wsPath = path.resolve(currentDir, wsPattern);
              if (fs.existsSync(path.join(wsPath, "package.json"))) {
                checkAndAddPackage(wsPath, seenNames, discovered);
              }
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break; // Reached filesystem root
    currentDir = parentDir;
  }

  return discovered;
}

function checkAndAddPackage(
  pkgDir: string,
  seenNames: Set<string>,
  discovered: DiscoveredPlugin[],
): void {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return;

  try {
    const raw = fs.readFileSync(pkgJsonPath, "utf-8");
    const pkg = JSON.parse(raw);

    const name: string = pkg.name || "";
    if (seenNames.has(name) || name === "markitdown") return;

    const keywords: string[] = Array.isArray(pkg.keywords) ? pkg.keywords : [];
    const isMarkItDownPlugin =
      keywords.includes("markitdown-plugin") ||
      pkg["markitdown-plugin"] !== undefined ||
      name.startsWith("markitdown-plugin-") ||
      name.includes("/markitdown-plugin-");

    if (isMarkItDownPlugin) {
      seenNames.add(name);

      // Determine main entry point
      let entryFile = pkg.module || pkg.main || "index.js";
      let resolvedEntry = path.resolve(pkgDir, entryFile);
      if (!fs.existsSync(resolvedEntry)) {
        // Check dist/index.js
        const distEntry = path.resolve(pkgDir, "dist", "index.js");
        if (fs.existsSync(distEntry)) {
          resolvedEntry = distEntry;
        }
      }

      discovered.push({
        name,
        version: pkg.version,
        description: pkg.description,
        entryPoint: resolvedEntry,
      });
    }
  } catch {
    // Ignore invalid package.json
  }
}

/**
 * Load a plugin module by path or package name.
 */
export async function loadPlugin(entryPoint: string): Promise<MarkItDownPlugin | null> {
  try {
    const url = path.isAbsolute(entryPoint)
      ? pathToFileURL(entryPoint).href
      : entryPoint;
    const mod = await import(url);

    const registerConverters =
      mod.registerConverters ||
      mod.register_converters ||
      mod.default?.registerConverters ||
      mod.default?.register_converters ||
      (typeof mod.default === "function" ? mod.default : undefined);

    if (typeof registerConverters === "function") {
      return {
        registerConverters,
        PLUGIN_INTERFACE_VERSION:
          mod.PLUGIN_INTERFACE_VERSION ||
          mod.__plugin_interface_version__ ||
          mod.default?.PLUGIN_INTERFACE_VERSION ||
          1,
      };
    }
  } catch (err) {
    console.warn(`[markitdown] Failed to load plugin '${entryPoint}':`, err);
  }

  return null;
}

/**
 * Discovers and activates all installed plugins on a MarkItDown instance.
 */
export async function loadAndRegisterPlugins(
  markitdown: any,
  options?: Record<string, unknown>,
  startDir?: string,
): Promise<string[]> {
  const discovered = discoverInstalledPlugins(startDir);
  const activated: string[] = [];

  for (const pluginInfo of discovered) {
    const plugin = await loadPlugin(pluginInfo.entryPoint);
    if (plugin) {
      try {
        await plugin.registerConverters(markitdown, options);
        activated.push(pluginInfo.name);
      } catch (err) {
        console.warn(
          `[markitdown] Plugin '${pluginInfo.name}' failed to register converters:`,
          err,
        );
      }
    }
  }

  return activated;
}
