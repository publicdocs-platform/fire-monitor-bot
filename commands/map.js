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


const render = require('../lib/render');
const server = require('../lib/server');
const files = require('../lib/files');
const afm = require('../lib/afm');
const kmz = require('../lib/kmz');
const del = require('del');

const envconfig = require('../envconfig');
const pug = require('pug');
const path = require('path');
const fs = require('fs');

exports.command = 'map';

exports.description = 'Runs a daemon to post updates';

exports.builder = {
  twitter: {
    boolean: true,
    desc: 'Whether to post to Twitter',
  },
  lat: {
    number: true,
    required: true,
    desc: 'Latitutde to map',
  },
  lon: {
    number: true,
    required: true,
    desc: 'Longitude to map',
  },
  zoom: {
    number: true,
    required: true,
    desc: 'Zoom level to map',
  },
  title: {
    string: true,
    desc: 'Map title',
  },
  subtitle: {
    string: true,
    desc: 'Map subtitle',
  },
  kmz: {
    string: true,
    desc: 'A KMZ url to display',
  },
  excludedLayers: {
    string: true,
    desc: 'Comma-separated layer names to exclude',
  },
  quit: {
    boolean: true,
    default: true,
    desc: 'Quit after generating map',
  },
};


const config = {
  twitterName: envconfig.twitterAuth.name,
  systemName: envconfig.ui.system_url,
};


const template = pug.compileFile(path.join(__dirname, '../templates/detailsRender.pug'));
const html = function(entry) {
  return template({config: config, data: entry, curdir: process.cwd()});
};


async function doIt(argv) {
  files.setupDirs(argv.outputdir, argv.clean);

  server.run(argv.port, argv.outputdir);

  const updateId = new Date();

  await afm.refreshAfmSatelliteData(argv.outputdir + '/kml/');

  let customLayerCount = 0;
  if (argv.kmz) {
    await del(path.join(argv.outputdir, 'kml', 'custom-*.kml'));
    for (const p of argv.kmz.split(',')) {
      await kmz.loadKmz(p, path.join(argv.outputdir, 'kml', 'custom-'+customLayerCount+'.kml'), true);
      customLayerCount++;
    }
  }

  const file = argv.outputdir + '/img/ONEOFF-WEB-MAP-' + updateId + '.html';
  const url = 'http://localhost:8080/updates/img/ONEOFF-WEB-MAP-' + updateId + '.html';
  const imgPath = argv.outputdir + '/img/ONEOFF-IMG-MAP-' + updateId + '.jpeg';

  const templateData = {
    lat: argv.lat,
    lon: argv.lon,
    zoom: argv.zoom,
    title: argv.title,
    subtitle: argv.subtitle ? argv.subtitle.split(';') : [],
    cities: [],
    mapData: {
      excluded: (argv.excludedLayers ? argv.excludedLayers.split(',') : []),
      customLayerCount: customLayerCount,
    },
  };
  const htmlDetails = html(templateData);
  fs.writeFileSync(file, htmlDetails);
  await render.renderInBrowser(1450, 1450, url, imgPath);
}

exports.handler = (argv) => {
  doIt(argv).then(() => {
    if (argv.quit) {
      process.exit();
    }
  });
};
