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

const proj4 = require('proj4');
const util = require('../lib/util');

const processNfsaFire = function(e, proj) {
  const entry = e.attributes;
  const ret = {};
  const to = proj4(proj, 'EPSG:4326', [e.geometry.x, e.geometry.y]);
  ret.Lon = to[0];
  ret.Lat = to[1];
  for (const key in entry) {
    ret[key] = entry[key];
    if (key.endsWith('DateTime')) {
      ret[key + 'Epoch'] = ret[key];
      ret[key] = util.dateString(ret[key]);
    }
    if (_.isString(ret[key])) {
      ret[key] = ret[key].trim();
    }
  }
  ret.Source = 'NFSA';
  ret._CorrelationIds = [ret.UniqueFireIdentifier];
  ret.ModifiedOnDateTime_Raw = ret.ModifiedOnDateTime;
  ret.ModifiedOnDateTimeEpoch_Raw = ret.ModifiedOnDateTimeEpoch;
  if (ret.ICS209ReportDateTime) {
    ret.ModifiedOnDateTime = ret.ICS209ReportDateTime;
    ret.ModifiedOnDateTimeEpoch = ret.ICS209ReportDateTimeEpoch;
  }

  ret.Hashtag = util.fireHashTag(ret.Name);
  return ret;
};

exports.getFires = async function(userAgent, includeEmergingNew, includeEmergingOld) {
  const dataOptions = {
    uri: 'https://maps.nwcg.gov/sa/publicData.json',
    qs: {
    },
    headers: {
      'User-Agent': 'Request-Promise; ' + userAgent,
    },
    json: true,
  };

  const prov = util.createProvenance(dataOptions);
  const layers = await rp(dataOptions);
  const dataSetName = 'Active Incidents';
  const dataSet = _.find(layers, (p) => p.name === dataSetName);
  const requiredLayerNames = ['Large WF'];
  if (includeEmergingNew) {
    requiredLayerNames.unshift('Emerging WF < 24 hours');
  }
  if (includeEmergingOld) {
    requiredLayerNames.unshift('Emerging WF > 24 hours');
  }
  const filteredLayers = dataSet.layerConfigs.filter((f) => requiredLayerNames.includes(f.featureCollection.layerDefinition.name));
  const layerFeatures = filteredLayers.map((x) => {
    return x.featureCollection.featureSet.features.map((y) => {
      const r = processNfsaFire(y, 'EPSG:' + x.featureCollection.featureSet.spatialReference.latestWkid);
      r.NFSAType = x.featureCollection.layerDefinition.name;
      return r;
    });
  });
  const data0 = _.flatten(layerFeatures);
  const data = data0.map((e) => Object.assign(e, {_Provenance: _.cloneDeep(prov)}));
  const nfsaData = _.keyBy(data, (o) => o.UniqueFireIdentifier);
  return nfsaData;
};
