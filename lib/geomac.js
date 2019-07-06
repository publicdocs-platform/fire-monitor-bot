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
const _ = require('lodash');

const dateString = require('./util').dateString;
const util = require('./util');

exports.cleanGeometryRing = function(r) {
  // Don't alter the geometry for now.
  return r;
};

const nfsaMapping = {
  acres: 'DailyAcres',
  firecause: 'FireCause',
  firediscoverydatetime: 'FireDiscoveryDateTime',
  firediscoverydatetimeEpoch: 'FireDiscoveryDateTimeEpoch',
  uniquefireidentifier: 'UniqueFireIdentifier',
  reportdatetime: 'ModifiedOnDateTime',
  reportdatetimeEpoch: 'ModifiedOnDateTimeEpoch',
  percentcontained: 'PercentContained',
  incidentname: 'Fire_Name',
};

const processFire = function(e, provenance) {
  const ret = {};
  ret.Lon = e.geometry.coordinates[0];
  ret.Lat = e.geometry.coordinates[1];
  const entry = e['properties'];
  _.forOwn(entry, (v, key) => {
    ret[key] = entry[key];
    if (key.endsWith('datetime') || key === 'datecurrent' || key === 'irwinmodifiedon') {
      ret[key + 'Epoch'] = ret[key];
      ret[key] = dateString(ret[key]);
    }
    if (_.isString(ret[key])) {
      ret[key] = ret[key].trim();
    }
  });
  const ret2 = _.cloneDeep(ret);
  _.forOwn(ret, (v, key) => {
    ret2[key] = ret[key];
    if (key in nfsaMapping) {
      ret2[nfsaMapping[key]] = ret[key];
    }
  });
  ret2.Name = ret2.Fire_Name;
  ret2.Source = 'GEOMAC';
  ret2.Hashtag = util.fireHashTag(ret2.Name);
  ret2._Provenance = _.cloneDeep(provenance);
  ret2._CorrelationIds = [ret2.UniqueFireIdentifier];
  return ret2;
};

const processFirePerim = function(e, provenance) {
  const ret = {geometry: {}, attributes: {}, _Provenance: _.cloneDeep(provenance)};
  if (e.geometry.type === 'Polygon') {
    ret.geometry.coords = [e.geometry.coordinates];
  } else if (e.geometry.type === 'MultiPolygon') {
    ret.geometry.coords = e.geometry.coordinates;
  }
  const entry = e['properties'];
  _.forOwn(entry, (v, key) => {
    ret.attributes[key] = entry[key];
    if (key.endsWith('datetime') || key === 'datecurrent' || key === 'irwinmodifiedon') {
      ret.attributes[key] = dateString(ret.attributes[key]);
    }
    if (_.isString(ret.attributes[key])) {
      ret.attributes[key] = ret.attributes[key].trim();
    }
  });
  return ret;
};

const qs = {
  outFields: '*',
  returnGeometry: true,
  outSR: '{"wkid": 4326}', // WGS 84, aka lat-long
  f: 'geojson',
  where: '1=1',
  resultRecordCount: 10000,
};


exports.getPerimeters = async function(ua, latest) {
  const perimDataOptions = {
    uri: 'https://wildfire.cr.usgs.gov/ArcGIS/rest/services/geomac_dyn/MapServer/' + (latest ? '3' : '2') + '/query',
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua,
    },
    json: true,
  };
  const provenance = util.createProvenance(perimDataOptions);
  provenance.SourceLayer = (latest ? '3' : '2');
  const resp = await rp(perimDataOptions);
  const data = resp.features;
  const x = _.keyBy(data.map((e) => processFirePerim(e, provenance)), (o) => o.attributes.uniquefireidentifier);
  return x;
};


exports.getFires = async function(ua) {
  const firesDataOptions = {
    uri: 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/0/query',
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua,
    },
    json: true,
  };
  const provenance = util.createProvenance(firesDataOptions);
  const resp = await rp(firesDataOptions);
  const data = resp.features;
  const x = _.keyBy(data.map((e) => processFire(e, provenance)), (o) => o.uniquefireidentifier);
  return x;
};

