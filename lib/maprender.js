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

const StaticMaps = require('staticmaps');

const sprintf = require('sprintf-js').sprintf;

const envconfig = require('../envconfig');

const tileServers = {
  // We use this proxy to the USGS National Map.
  localTiles: {
    url: 'http://localhost:8081/tnmTiles/{z}/{y}/{x}',
    size: 256,
  },
};

const getMapBounds = async function(perims, width, height, maxZoom) {
  const det = tileServers['localTiles'];

  const stdOptions = {
    width: width,
    height: height,
    paddingX: 128,
    paddingY: 128,
    tileUrl: det.url,
    tileSize: det.size,
    imageMagick: envconfig.gfx.use_im ? true : false,
    sharp: envconfig.gfx.use_im ? false : true,
    stepsPerZoomLevel: 4,
  };
  const map = new StaticMaps(stdOptions);

  const polys = perims;
  polys.map((p) => p.map((x, i) => {
    const perim = {
      coords: x,
      color: '#' + sprintf('%02x', ((i * 10 + 16) % 255)) + sprintf('%02x', ((i * 73 + 3) % 255)) + sprintf('%02x', ((i * 3 + 237) % 255)) + 'AA',
      fill: '#00000000',
      width: i + 1,
    };
    map.addPolygon(perim);
  }));

  const idealZoom = map.calculateZoom(4 /* steps */);

  const zoom = maxZoom ? Math.min(maxZoom, idealZoom) : idealZoom;

  const bounds = map.determineExtent(zoom);
  const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];

  return {center: center, zoom: zoom, idealZoom: idealZoom};
};

exports.getMapBounds = getMapBounds;
