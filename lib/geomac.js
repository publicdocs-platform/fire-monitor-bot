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

const rp = require('request-promise');
const promisify = require('util').promisify;
const _ = require('lodash');
const yaml = require('js-yaml');
const titleCase = require('title-case');
const pug = require('pug');
const fs = require('fs');
const deepDiff = require('deep-diff');
const numeral = require('numeral');

const dateString = require('./util').dateString;
const util = require('./util');
const envconfig = require('../envconfig');

exports.cleanGeometryRing = function(r) {
  return r;
  let ret = [];
  const orig = r[0];
  for (let i in r) {
    ret.push(r[i]);
    // Terminate after one loop.
    if (i > 0 && r[i][0] == orig[0] && r[i][1] == orig[1]) {
      break;
    }
  }
  return ret;
};

function copyAndAssignLR(r, n, g) {
  return Object.assign({Source_NFSA_Join: n, Source_GEOMAC: g}, r);
}

exports.mergedNfsaGeomacFire = function(n, g) {
  if (!g) { return copyAndAssignLR(n, n, g); }
  if (!n) { return copyAndAssignLR(g, n, g); }
  let ret = {Lat : g.Lat, Lon: g.Lon};

  if (g.ModifiedOnDateTime > n.ModifiedOnDateTime) {
    Object.assign(ret, n);
    Object.assign(ret, g);
    // we don't get such data on GEOMAC.
    delete ret.EstimatedCostToDate;
    delete ret.TotalIncidentPersonnel;
  } else {
    Object.assign(ret, g);
    Object.assign(ret, n);
  }

  return copyAndAssignLR(ret, n, g);
}

const nfsaMapping = { 
  acres: 'DailyAcres', 
  firecause: 'FireCause', 
  firediscoverydatetime: 'FireDiscoveryDateTime', 
  uniquefireidentifier: 'UniqueFireIdentifier',
  irwinmodifiedon: 'ModifiedOnDateTime',
  percentcontained: 'PercentContained',
  incidentname: 'Fire_Name'
};

const processFire = function (e) {
  let ret = {};
  ret.Lon = e.geometry.coordinates[0];
  ret.Lat = e.geometry.coordinates[1];
  const entry = e['properties'];
  for (let key in entry) {
    ret[key] = entry[key];
    if (key.endsWith('datetime') || key === 'datecurrent' || key === 'irwinmodifiedon') {
      ret[key] = dateString(ret[key]);
    }
    if (_.isString(ret[key])) {
      ret[key] = ret[key].trim();
    }

    if (key in nfsaMapping) {
      ret[nfsaMapping[key]] = ret[key];
    }
  }
  ret.Name = ret.Fire_Name;
  ret.Source = 'GEOMAC';
  ret.Hashtag = util.fireHashTag(ret.Name);
  return ret;
};

const processFirePerim = function (e) {
  let ret = {geometry: {}, attributes: {}};
  if (e.geometry.type === 'Polygon') {
    ret.geometry.coords = [e.geometry.coordinates];
  } else if (e.geometry.type === 'MultiPolygon') {
    ret.geometry.coords = e.geometry.coordinates;
  }
  const entry = e['properties'];
  for (let key in entry) {
    ret.attributes[key] = entry[key];
    if (key.endsWith('datetime') || key === 'datecurrent' || key === 'irwinmodifiedon') {
      ret.attributes[key] = dateString(ret.attributes[key]);
    }
    if (_.isString(ret.attributes[key])) {
      ret.attributes[key] = ret.attributes[key].trim();
    }
  }
  return ret;
};

const qs = {
  outFields:'*',
  returnGeometry: true,
  outSR:'{"wkid": 4326}',  // WGS 84, aka lat-long
  f:'geojson',
  where: '1=1',
  resultRecordCount: 10000,
};


exports.getPerimeters = async function(ua) {

  const perimDataOptions = {
    uri: 'https://wildfire.cr.usgs.gov/ArcGIS/rest/services/geomac_dyn/MapServer/2/query',
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua
    },
    json: true
  };

  const resp = await rp(perimDataOptions);
  const data = resp.features;
  const x = _.keyBy(data.map(e => processFirePerim(e)), o => o.attributes.uniquefireidentifier);
  return x;
};


exports.getFires = async function(ua) {

  const firesDataOptions = {
    uri: 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/0/query',
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua
    },
    json: true
  };
  const resp = await rp(firesDataOptions);
  const data = resp.features;
  const x = _.keyBy(data.map(e => processFire(e)), o => o.uniquefireidentifier);
  return x;

};

