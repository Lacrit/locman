module.exports = {
    "env": {
      "node": true,
      "es6": true
    },
    "extends": "airbnb-base",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "rules": {
      "linebreak-style": ["error", (process.platform === "win32" ? "windows" : "unix")],
      "no-param-reassign": 0,
      "no-console": 0,
      "no-plusplus": 0,
      "no-bitwise": 0,
      "operator-linebreak": 0,
      "no-extra-boolean-cast": 0,
      "no-restricted-syntax": 0,
      "function-paren-newline": 0,
      "arrow-parens": 0,
      "no-underscore-dangle": 0,
      "space-before-function-paren": ["error", {
        "anonymous": "never",
        "named": "never",
        "asyncArrow": "always"
      }],
      "no-mixed-operators": [
        "off",
        {
          "groups": [
            ["+", "-", "*", "/", "%", "**"]
          ]
        }
      ],
      "object-curly-newline": ["error", { "multiline": true, "minProperties": 8, "consistent" : true}],
    }
};