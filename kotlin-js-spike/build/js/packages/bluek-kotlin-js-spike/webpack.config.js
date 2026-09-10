let config = {
  mode: 'production',
  resolve: {
    modules: [
      "node_modules"
    ]
  },
  plugins: [],
  module: {
    rules: []
  },
  
};

// entry
config.entry = {
    main: [require('path').resolve(__dirname, "kotlin/bluek-kotlin-js-spike.js")]
};
config.output = {
    filename: (chunkData) => {
        return chunkData.chunk.name === 'main'
            ? "bluek-kotlin-js-spike.js"
            : "bluek-kotlin-js-spike-[name].js";
    },
    library: "BlueKProject",
    libraryTarget: "commonjs2",
    clean: true,
    globalObject: "globalThis"
};
config.output = config.output || {}
config.output.path = require('path').resolve(__dirname, "../../../kotlin-webpack/js/productionExecutable")
// source maps
config.module.rules.push({
        test: /\.m?js$/,
        use: ["source-map-loader"],
        enforce: "pre"
});
config.devtool = 'source-map';
config.ignoreWarnings = [
    /Failed to parse source map/,
    /Accessing import\.meta directly is unsupported \(only property access or destructuring is supported\)/
]

// noinspection JSUnnecessarySemicolon
;(function(config) {
    const tcErrorPlugin = require('kotlin-web-helpers/dist/tc-log-error-webpack');
    config.plugins.push(new tcErrorPlugin())
    config.stats = config.stats || {}
    Object.assign(config.stats, config.stats, {
        warnings: false,
        errors: false
    })
})(config);
module.exports = config
