// babel-preset-expo already pulls in the worklets plugin when reanimated is
// installed, so there is deliberately nothing else here.
module.exports = function (api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
