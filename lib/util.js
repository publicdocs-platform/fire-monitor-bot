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

const titleCase = require('title-case');

exports.dateString = function(d) {
  return new Date(d).toISOString().substr(0, 16) + 'Z';
};

exports.dateFriendlyString = function(d) {
  return new Date(d).toLocaleString('en-US', {
    timeZone: 'UTC',
    hour12: true,
    year: 'numeric',
    month: 'narrow',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short',
  });
};

exports.namedSemaphore = function(impl, name) {
  return {
    take: function(cb) {
      impl.take(name, cb);
    },
    leave: function() {
      impl.leave();
    },
  };
};

function copyAndAssignLR(r, n, g) {
  const ret = Object.assign({Source_NFSA_Join: n, Source_GEOMAC: g}, r);
  delete ret._Provenance;
  return ret;
}

exports.mergedNfsaGeomacFire = function(n, g) {
  if (!g) {
    return copyAndAssignLR(n, n, g);
  }
  if (!n) {
    return copyAndAssignLR(g, n, g);
  }
  const ret = {};

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
};

exports.hashTagify = function(name) {
  return '#' + titleCase(name.trim()).split(' ').join('');
};

exports.fireHashTag = function(name) {
  if (name.match(RegExp('^.*[0-9][0-9][0-9]$'))) {
    // Weird just return it.
    return name;
  }
  let r = '#' + titleCase(name.trim()).split(' ').join('') + 'Fire';
  while (r.endsWith('ComplexFire')) {
    r = r.substring(0, r.length - 'Fire'.length);
  }
  while (r.endsWith('FireFire')) {
    r = r.substring(0, r.length - 'Fire'.length);
  }
  return r;
};


exports.fireName = function(name) {
  let r = titleCase(name.trim()).split(' ').join(' ') + ' Fire';
  while (r.endsWith('ComplexFire')) {
    r = r.substring(0, r.length - 'Fire'.length);
  }
  while (r.endsWith('FireFire')) {
    r = r.substring(0, r.length - 'Fire'.length);
  }
  return r;
};

exports.createProvenance = function(request) {
  return {
    OriginalSource: {
      RetrievedOn: new Date().toISOString(),
      Request: request,
    },
    Modified: true,
  };
};
