module.exports = {
  'parser': 'babel-eslint',
  'env': {
    'browser': false,
    'commonjs': true,
    'es6': true,
    'node': true,
  },
  'extends': 'google',
  'globals': {
    'Atomics': 'readonly',
    'SharedArrayBuffer': 'readonly',
  },
  'plugins': [
    "sort-requires",
  ],
  'parserOptions': {
    'ecmaVersion': 2018,
  },
  'rules': {
    'require-jsdoc': 'off',
    'max-len': 'off',
    'eqeqeq': ['error', 'smart'],
    'sort-imports': ["error", { "ignoreCase": true }],
    'sort-requires/sort-requires': 2
  },
  'overrides': [
    {
      'files': ['client/*.js'],
      'parserOptions': {
        'sourceType': 'script',
      },
      'env': {
        'browser': true,
        'commonjs': false,
        'node': false,
      },
    }
  ]
};
