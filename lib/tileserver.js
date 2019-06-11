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

// NOTE: We don't actually use this.

const FairSemaphore = require('fair-semaphore');
const os = require('os');
const rp = require('request-promise');
const _ = require('lodash');
const yaml = require('js-yaml');
const fs = require('fs');
const express = require('express');
const sharp = require('sharp');
const ip = require('ip');

const envconfig = require('../envconfig');
const util = require('../lib/util');

const webApp = express();


const tileSemaphore = util.namedSemaphore(new FairSemaphore(1), 'tnm');

exports.run = function(port) {
  webApp.get('/tnmTiles/:z/:y/:x', (req, res) => {
    try {
      const z = parseInt(req.params.z, 10);
      const y = parseInt(req.params.y, 10);
      const x = parseInt(req.params.x, 10);
      if (!ip.isLoopback(req.ip)) {
        res.status(403).send();
        return;
      }
      const proxyUrl = `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/${z}/${y}/${x}`;
      tileSemaphore.take(() => {
        rp({encoding: null, resolveWithFullResponse: true,
          url: proxyUrl}).then((resp) => {
          if (resp.statusCode >= 400) {
            tileSemaphore.leave();
            console.log(' ^^ %s %s %s', proxyUrl, err, resp ? resp.statusCode : 'no resp');
            res.status(404).send();
            return;
          }
          res.type('image/png');
          if (resp.headers['content-type'] === 'image/png') {
            res.send(resp.body);
          } else {
            sharp(resp.body).png().pipe(res);
          }
          tileSemaphore.leave();
        }).catch((err) => {
          tileSemaphore.leave();
          console.log(' ^^ %s %s %s', proxyUrl, err);
          res.status(404).send();
        });
      });
    } catch (err) {
      console.log(err);
    }
  });
  webApp.listen(port);
};
