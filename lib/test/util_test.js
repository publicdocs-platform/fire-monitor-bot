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
  describe('#mergedNfsaGeomacFire()', function() {
    const nfsaRealLate = {
      ModifiedOnDateTime: '99',
      Common: 'NFSA',
      JustNFSA: 'NFSA',
      _Provenance: 'NFSA',
      EstimatedCostToDate: 'NSFA',
    };
    const geomacRealLate = {
      ModifiedOnDateTime: '99',
      Common: 'GEOMAC',
      JustGEOMAC: 'GEOMAC',
      _Provenance: 'GEOMAC',
    };
    const nfsaRealEarly = {
      ModifiedOnDateTime: '59',
      Common: 'NFSA',
      JustNFSA: 'NFSA',
      _Provenance: 'NFSA',
      EstimatedCostToDate: 'NSFA',
    };
    const geomacRealEarly = {
      ModifiedOnDateTime: '59',
      Common: 'GEOMAC',
      JustGEOMAC: 'GEOMAC',
      _Provenance: 'GEOMAC',
    };
    it('should take the only nfsa item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealLate, undefined), {
        ModifiedOnDateTime: '99',
        Common: 'NFSA',
        EstimatedCostToDate: 'NSFA',
        JustNFSA: 'NFSA',
        Source_NFSA_Join: nfsaRealLate,
        Source_GEOMAC: undefined,
      });
    });

    it('should take the only geomac item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(undefined, geomacRealLate), {
        ModifiedOnDateTime: '99',
        Common: 'GEOMAC',
        JustGEOMAC: 'GEOMAC',
        Source_GEOMAC: geomacRealLate,
        Source_NFSA_Join: undefined,
      });
    });


    it('should take the later geomac item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealEarly, geomacRealLate), {
        ModifiedOnDateTime: '99',
        Common: 'GEOMAC',
        JustGEOMAC: 'GEOMAC',
        Source_GEOMAC: geomacRealLate,
        Source_NFSA_Join: nfsaRealEarly,
      });
    });


    it('should take the later nfsa item', function() {
      assert.deepStrictEqual(lib.mergedNfsaGeomacFire(nfsaRealLate, geomacRealEarly), {
        ModifiedOnDateTime: '99',
        Common: 'NFSA',
        EstimatedCostToDate: 'NSFA',
        JustNFSA: 'NFSA',
        Source_NFSA_Join: nfsaRealLate,
        Source_GEOMAC: geomacRealEarly,
      });
    });
  });
});
