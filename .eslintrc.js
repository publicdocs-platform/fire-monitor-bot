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
  'parserOptions': {
    'ecmaVersion': 2018,
  },
  'rules': {
    'require-jsdoc': 'off',
    'max-len': 'off',
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
