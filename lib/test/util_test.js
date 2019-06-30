/*
Copyright (c) 2019 Advay Mengle <source@madvay.com>.
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

const assert = require('assert');
const lib = require('../util');

describe('util', function() {
  describe('#dateString()', function() {
    it('should return null on null', function() {
      assert.strictEqual(lib.dateString(null), null);
    });

    it('should return ISO strings', function() {
      assert.strictEqual(lib.dateString(0), '1970-01-01T00:00Z');
      assert.strictEqual(lib.dateString(943358459320), '1999-11-23T12:00Z');
    });
  });

  describe('#fireName()', function() {
    it('should append " Fire" trimmed', function() {
      assert.strictEqual(lib.fireName('Top Dog'), 'Top Dog Fire');
      assert.strictEqual(lib.fireName('Top'), 'Top Fire');
      assert.strictEqual(lib.fireName(''), 'Fire');
    });

    it('should fix spaces', function() {
      assert.strictEqual(lib.fireName('Top   Dog'), 'Top Dog Fire');
      assert.strictEqual(lib.fireName('Top '), 'Top Fire');
      assert.strictEqual(lib.fireName('   '), 'Fire');
    });

    it('should title case', function() {
      assert.strictEqual(lib.fireName('Top DOG'), 'Top Dog Fire');
      assert.strictEqual(lib.fireName('yellow'), 'Yellow Fire');
    });

    it('should not add Fire to Complex', function() {
      assert.strictEqual(lib.fireName('Top Dog Complex'), 'Top Dog Complex');
      assert.strictEqual(lib.fireName('Top Complex'), 'Top Complex');
      assert.strictEqual(lib.fireName('Complex Top'), 'Complex Top Fire');
    });

    it('should not add Fire to Fire', function() {
      assert.strictEqual(lib.fireName('Top Dog Fire'), 'Top Dog Fire');
      assert.strictEqual(lib.fireName('Top Fire'), 'Top Fire');
      assert.strictEqual(lib.fireName('Fire Top'), 'Fire Top Fire');
    });
  });

  describe('#mergedNfsaGeomacFire()', function() {
    const nfsaRealLate = {
      ModifiedOnDateTime: '99',
      Common: 'NFSA',
      JustNFSA: 'NFSA',
      _Provenance: 'NFSA',
      EstimatedCostToDate: 'NSFA',
      _CorrelationIds: ['N2'],
    };
    const geomacRealLate = {
      ModifiedOnDateTime: '99',
      Common: 'GEOMAC',
      JustGEOMAC: 'GEOMAC',
      _Provenance: 'GEOMAC',
      _CorrelationIds: ['G2'],
    };
    const nfsaRealEarly = {
      ModifiedOnDateTime: '59',
      Common: 'NFSA',
      JustNFSA: 'NFSA',
      _Provenance: 'NFSA',
      EstimatedCostToDate: 'NSFA',
      _CorrelationIds: ['N1'],
    };
    const geomacRealEarly = {
      ModifiedOnDateTime: '59',
      Common: 'GEOMAC',
      JustGEOMAC: 'GEOMAC',
      _Provenance: 'GEOMAC',
      _CorrelationIds: ['G1'],
    };
    it('should take the only nfsa item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealLate, undefined), {
        'ModifiedOnDateTime': '99',
        'Common': 'NFSA',
        'EstimatedCostToDate': 'NSFA',
        'JustNFSA': 'NFSA',
        'Source_NFSA_Join': nfsaRealLate,
        'Source_GEOMAC': undefined,
        '_CorrelationIds': ['N2'],
      });
    });

    it('should take the only geomac item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(undefined, geomacRealLate), {
        'ModifiedOnDateTime': '99',
        'Common': 'GEOMAC',
        'JustGEOMAC': 'GEOMAC',
        'Source_GEOMAC': geomacRealLate,
        'Source_NFSA_Join': undefined,
        '_CorrelationIds': ['G2'],
      });
    });


    it('should take the later geomac item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealEarly, geomacRealLate), {
        'ModifiedOnDateTime': '99',
        'Common': 'GEOMAC',
        'JustGEOMAC': 'GEOMAC',
        'Source_GEOMAC': geomacRealLate,
        'Source_NFSA_Join': nfsaRealEarly,
        '_CorrelationIds': ['N1', 'G2'],
      });
    });


    it('should take the later nfsa item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealLate, geomacRealEarly), {
        'ModifiedOnDateTime': '99',
        'Common': 'NFSA',
        'EstimatedCostToDate': 'NSFA',
        'JustNFSA': 'NFSA',
        'Source_NFSA_Join': nfsaRealLate,
        'Source_GEOMAC': geomacRealEarly,
        '_CorrelationIds': ['N2', 'G1'],
      });
    });

    it('should take the same time nfsa item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealLate, geomacRealLate), {
        'ModifiedOnDateTime': '99',
        'Common': 'NFSA',
        'EstimatedCostToDate': 'NSFA',
        'JustNFSA': 'NFSA',
        'Source_NFSA_Join': nfsaRealLate,
        'Source_GEOMAC': geomacRealLate,
        '_CorrelationIds': ['N2', 'G2'],
      });
    });
  });
});
