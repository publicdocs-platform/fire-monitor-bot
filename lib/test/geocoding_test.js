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

const assert = require('assert');
const lib = require('../geocoding');

describe('Array', function() {
  describe('#indexOf()', function() {
    it('should return correct compass directions', function() {
      assert.equal(lib.compass(0), 'N');
      assert.equal(lib.compass(180), 'S');
      assert.equal(lib.compass(-180), 'S');
      assert.equal(lib.compass(90), 'E');
      assert.equal(lib.compass(-90), 'W');
      assert.equal(lib.compass(-15), 'NNW');
      assert.equal(lib.compass(20), 'NNE');
      assert.equal(lib.compass(11), 'N');
      assert.equal(lib.compass(13), 'NNE');
      assert.equal(lib.compass(-13), 'NNW');
      assert.equal(lib.compass(22.5), 'NNE');
      assert.equal(lib.compass(45), 'NE');
      assert.equal(lib.compass(87), 'E');
    });
  });
});