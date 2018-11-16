/*
Copyright (c) 2018 Advay Mengle <source@madvay.com>.
See the LICENSE and NOTICE files for details.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
'use strict';

const _ = require('lodash');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify;

const envconfig = require('../envconfig');

let units = {};

exports.loadUnits = async function(socialPath) {
  let ret = {}
  if (socialPath) {
    ret = Object.assign(ret, yaml.safeLoad(await promisify(fs.readFile)(socialPath)));
  }
  units = Object.assign({}, ret);
};

exports.unitTag = function(id) {
  if (!id) { return null; }
  const i = id.toUpperCase();
  const u = units[i] || units['US' + i];
  if (!u) { return null; }
  const acct = u.twitter || u.twitter2;
  const name = u.name;
  return acct ? ('@' + acct) : (name ? name : null);
};
