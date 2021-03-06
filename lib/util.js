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
const titleCase = require('title-case');

exports.dateString = function(d) {
  if (d === null) {
    return null;
  }
  return new Date(d).toISOString().substr(0, 16) + 'Z';
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
  const ret = Object.assign({Source_NFSA_Join: _.cloneDeep(n), Source_GEOMAC: _.cloneDeep(g)}, _.cloneDeep(r));
  ret._CorrelationIds = _.union(
      (n ? n._CorrelationIds : []) || [],
      (g ? g._CorrelationIds : []) || [],
      (r ? r._CorrelationIds : []) || []);
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
  // Note if modified times are equal, we prefer nfsa, it has more detail.
  if (g.ModifiedOnDateTime > n.ModifiedOnDateTime) {
    return copyAndAssignLR(g, n, g);
  } else {
    return copyAndAssignLR(n, n, g);
  }
};

function copyAndAssignCLR(r, cf, ng) {
  const ret = Object.assign(
      {
        Source_CALFIRE: cf,
        Source_NFSA_Join: _.cloneDeep(ng.Source_NFSA_Join),
        Source_GEOMAC: _.cloneDeep(ng.Source_GEOMAC),
      },
      _.cloneDeep(r));
  delete ret._Provenance;
  ret._CorrelationIds = _.union(
      ng._CorrelationIds || [],
      cf._CorrelationIds || [],
      r._CorrelationIds || []);
  return ret;
}

exports.mergedCalfireFire = function(cf, ng) {
  if (!cf) {
    throw new Error('Can only merge with an existing CALFIRE incident.');
  }
  if (!ng) {
    return copyAndAssignCLR(cf, cf, {});
  }
  // Note if modified times are equal, we prefer NG, it has more detail.
  if (cf.ModifiedOnDateTime > ng.ModifiedOnDateTime) {
    return copyAndAssignCLR(cf, cf, ng);
  } else {
    return copyAndAssignCLR(ng, cf, ng);
  }
};

exports.latestPerimeter = function(n, g) {
  if (!g) {
    return n;
  }
  if (!n) {
    return g;
  }
  if (g.attributes.perimeterdatetime > n.attributes.perimeterdatetime) {
    return g;
  } else {
    return n;
  }
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
  while (r.endsWith('Complex Fire')) {
    r = r.substring(0, r.length - ' Fire'.length);
  }
  while (r.endsWith('Fire Fire')) {
    r = r.substring(0, r.length - ' Fire'.length);
  }
  return r.trim();
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
