// The demo build (brief 080): `KOPIYKA_FLAVOUR=demo` points Expo Router at src/demo-app, so only the routes there exist.
// Any other value, or none, leaves app.json exactly as it is.
module.exports = ({ config }) => {
  if (process.env.KOPIYKA_FLAVOUR !== 'demo') return config;
  const plugins = config.plugins.map((plugin) => {
    const [name, options = {}] = Array.isArray(plugin) ? plugin : [plugin];
    return name === 'expo-router' ? [name, { ...options, root: 'src/demo-app' }] : plugin;
  });
  return { ...config, plugins };
};
