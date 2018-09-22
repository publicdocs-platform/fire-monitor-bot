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
const promisify = require('util').promisify;

const sprintf = require('sprintf-js').sprintf;

const errors = require('request-promise/errors');

const envconfig = require('../envconfig');

// Only for USGS maps.
exports.terrainCredit = 'Map services and data available from U.S. Geological Survey, National Geospatial Program (nationalmap.gov). No claim made to third-party works, including but not limited to US government works.';
exports.detailedCredit = 'Map services and data available from U.S. Geological Survey, National Geospatial Program (nationalmap.gov). No claim made to third-party works, including but not limited to US government works.';

const tileServers = {
  // We don't use any of these.  You'll need to find the appropriate credits if you do.
  osm: {
    url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
    size: 256,
  },
  toner: {
    url: 'http://d.tile.stamen.com/toner/{z}/{x}/{y}@2x.png',
    size: 512,
  },
  osmFrHot: {
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    size: 256,
  },
  tfLandscape: {
    url: 'https://tile.thunderforest.com/landscape/{z}/{x}/{y}@2x.png?apikey=<APIKEY>',
    size: 512,
  },
  opentopomap: {
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    size: 256,
  },
  // We use this proxy to the USGS National Map.
  localTiles: {
    url: 'http://localhost:8081/tnmTiles/{z}/{y}/{x}',
    size: 256,
  }
};

// WARNING: We do not actually use this to render anything!  Just to get the zoom and center.
const renderMap = async function(path, perims, width, height, maxZoom, detail) {

  const det = tileServers[detail ? 'localTiles' : 'localTiles'];

  const stdOptions = {
    width: width,
    height: height,
    paddingX: detail ? 16 : 128,
    paddingY: detail ? 16 : 128,
    tileUrl: det.url,
    tileSize: det.size,
    imageMagick: envconfig.gfx.use_im ? true : false,
    sharp: envconfig.gfx.use_im ? false : true,
  };
  const map = new StaticMaps(stdOptions);

  const polys = perims;
  polys.map(p => p.map((x, i) => {
    const perim = {
      coords: x,
      color: '#' +  sprintf('%02x', ((i * 10 + 16) % 255)) + sprintf('%02x', ((i * 73 + 3) % 255)) + sprintf('%02x', ((i * 3 + 237) % 255)) + 'AA',
      fill: '#00000000',
      width: i + 1
    };
    map.addPolygon(perim);
  }));

  const idealZoom = map.calculateZoom();

  const zoom = maxZoom ? Math.min(maxZoom, idealZoom) : idealZoom;

  const bounds = map.determineExtent(zoom);
  const center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];

  if (!detail) {
    map.lines = [];
  
    const marker = {
      img: `${__dirname}/../imgs/xmark.png`, // can also be a URL
      offsetX: 32,
      offsetY: 32,
      width: 64,
      height: 64,
      coord: center,
    };
    map.addMarker(marker);
  }

  if (!path) {
    return {center: center, zoom: zoom, idealZoom: idealZoom};
  }

  await map.render(center, zoom);
  map.image.save(path);
  console.log('  - Perimeter generated at ' + path);
  return {center: center, zoom: zoom, idealZoom: idealZoom};
};

exports.renderMap = renderMap;
