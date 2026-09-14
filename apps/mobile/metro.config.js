// Monorepo Metro setup. Expo's defaults assume the app owns its node_modules;
// here `@direct/shared`, `@direct/core` and `@direct/i18n` are TypeScript source
// living outside the app folder, so Metro has to watch the repo root.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const appModules = path.resolve(projectRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [appModules, path.resolve(workspaceRoot, "node_modules")];

// Hierarchical lookup stays ON. Turning it off (the usual monorepo advice)
// breaks packages that carry a pinned nested dependency: react-native-reanimated
// ships its own semver@7 because the hoisted copy is semver@6, and a flat
// search never finds it.
config.resolver.disableHierarchicalLookup = false;

/**
 * With hierarchical lookup on, a module inside the root `node_modules` would
 * resolve `react` to the root copy — which is the *website's* React, a
 * different version from the one the Expo SDK pins here. Two Reacts in one
 * bundle breaks hooks in ways that surface as unrelated runtime errors, so
 * every `react` import is pinned to this app's copy. `react-native` and the
 * `react-native-*` packages are single hoisted copies and resolve normally;
 * the trailing slash keeps them out of this branch.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return { type: "sourceFile", filePath: require.resolve(moduleName, { paths: [appModules] }) };
  }
  // react-native-maps has no web build. The browser is not a target, but
  // `expo start --web` is a fast way to review layout and copy, so point it at
  // an inert stub; `mapsAvailable()` is false on web and takes the offline
  // branch before any of it would render.
  if (platform === "web" && moduleName === "react-native-maps") {
    return {
      type: "sourceFile",
      filePath: path.resolve(projectRoot, "src/shims/react-native-maps.web.tsx"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
