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
const fs = require('fs');
const promisify = require('util').promisify;
const yaml = require('js-yaml');

const parse = promisify(require('csv-parse'));

let units = {};

const shortforms = [
  ['Fire Department', 'FD'],
  ['Police Department', 'PD'],
  ['Fire District', 'FD'],
  ['Fire Protection District', 'FPD'],
  ['National Forest', 'NF'],
  ['National Wildlife Refuge', 'NWR'],
  ['National Historical Park', 'NHP'],
  ['National Historical Site', 'NHS'],
  ['National Recreation Area', 'NRA'],
  ['National Park', 'NP'],
  ['County', 'Co.'],
  ['Office of Emergency Services', 'OES'],
  ['Operational Area', 'OA'],
];

const makeShortName = function(name) {
  return _.reduce(shortforms, (ret, f) => ret.replace(f[0], f[1]), name);
};

const makeUnitTag = function(u) {
  const acct = u.twitter || u.twitter2;
  const name = u.ShortName;
  return acct ? ('@' + acct) : (name ? name : null);
};

exports.loadUnits = async function(nwcgUnitIdPath, socialPath) {
  let ret = {};
  if (nwcgUnitIdPath) {
    const nwcgUnitIdData = await promisify(fs.readFile)(nwcgUnitIdPath);
    const nwcgRows = await parse(nwcgUnitIdData, {
      cast: true,
      columns: true,
      delimiter: '|',
      quote: null,
      objname: 'UnitId',
      skip_empty_lines: true,
      skip_lines_with_error: false,
    });
    const usRows = _.pickBy(nwcgRows, (v, k) => k.startsWith('US'));
    const data = _.mapKeys(usRows, (v, k) => k.substring(2));
    ret = _.merge(ret, data);
  }
  if (socialPath) {
    const data = yaml.safeLoad(await promisify(fs.readFile)(socialPath));
    ret = _.merge(ret, data);
  }
  units = Object.assign({}, _.mapValues(ret, (v) => {
    const r = {};
    if (!v.Name) {
      return v;
    }
    v.ShortName = makeShortName(v.Name);
    r.tag = makeUnitTag(v);
    return Object.assign(v, r);
  }));
};


exports.unitTag = function(id) {
  if (!id) {
    return null;
  }
  const i = id.toUpperCase();
  const u = units[i] || units['US' + i];
  if (!u) {
    return null;
  }
  return u.tag || null;
};
