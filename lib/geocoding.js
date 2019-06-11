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

const path = require('path');

// BEGIN: nearby-cities uses hardcoded data from some transitive dependency.
// We do not want to rely on random data, and instead use our 'us-cities-db' package
// with data from U.S. Census that we can update as we see fit.  It is also US places only
// and no limitation that we only use a certain population minimum.

const requizzle = require('requizzle');
const localRequires = requizzle({
  infect: true,
  requirePaths: [path.join(__dirname, 'replaced-deps')],
});
const nearbyCities = localRequires('nearby-cities');

// END

const geoDistance = require('@turf/distance').default;
const geoBearing = require('@turf/bearing').default;
const sprintf = require('sprintf-js').sprintf;

exports.distance = function(lon1, lat1, lon2, lat2) {
  return geoDistance([lon1, lat1], [lon2, lat2], {units: 'miles'});
};


exports.bearing = function(lon1, lat1, lon2, lat2) {
  return geoBearing([lon1, lat1], [lon2, lat2]);
};


// -180 to 180, 0 = North, positive = CW
exports.compass = function(bearing) {
  const names = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const offset = 180.0 / names.length;
  const br = bearing < - offset ? bearing + 360 : bearing;
  // 0 to 360
  const b = br + offset;
  const i = Math.floor(b / (360.0 / names.length));
  if (i < 0 || i >= names.length) {
    return names[0];
  }
  return names[i];
};

exports.friendlyDistance = function(dist, unit, compass, obj) {
  if (dist <= 1) {
    return 'At ' + obj;
  }
  if (dist <= 5) {
    return 'Near ' + obj;
  }
  return sprintf('~%d%s %s of %s', dist, unit, compass, obj);
};

exports.nearestCities = function(lat, lon, count, maxKm) {
  const i = nearbyCities({latitude: lat, longitude: lon}, count, maxKm);
  // name, country, population, adminCode (state), lat, lon (not long!)
  return i.map((x) => {
    x.distance = geoDistance([lon, lat], [x.lon, x.lat], {units: 'miles'});
    x.bearing = geoBearing([x.lon, x.lat], [lon, lat]);
    x.compass = exports.compass(x.bearing);
    return x;
  });
};

exports.statesByAbbrev = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AS': 'American Samoa',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'DC': 'District Of Columbia',
  'FL': 'Florida',
  'GA': 'Georgia',
  'GU': 'Guam',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MH': 'Marshall Islands',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PW': 'Palau',
  'PA': 'Pennsylvania',
  'PR': 'Puerto Rico',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VI': 'Virgin Islands',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
};

exports.cityDisplayName = function(x) {
  const elems = [x.name, x.adminCode ? (x.adminCode) : null, x.country === 'US' ? null : x.country].filter((x) => x ? true : false);
  return elems.join(', ');
};
