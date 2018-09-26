/*
Copyright (c) 2018 Advay Mengle <source@madvay.com>.
See the LICENSE and NOTICE files for details..
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

const envconfig = require('../envconfig');
const pug = require('pug');
const path = require('path');
const fs = require('fs');


exports.command = 'map';

exports.description = 'Runs a daemon to post updates';

exports.builder = {
  twitter: {
    boolean: true,
    desc: 'Whether to post to Twitter'
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
}


const config = {
  twitterName: envconfig.twitterAuth.name,
};


const template = pug.compileFile(path.join(__dirname, '../templates/firePerimeterRender.pug'));
const html = function (entry) {
  return template({ config: config, data: entry, curdir: process.cwd() });
};



async function doIt(argv) {


  const tmpdir = files.setupDirs(argv.outputdir, argv.clean);

  server.run(argv.port, argv.outputdir);  

  const updateId = new Date()

  const file = argv.outputdir + '/img/ONEOFF-WEB-MAP-' + updateId + '.html';
  const url = 'http://localhost:8080/updates/img/ONEOFF-WEB-MAP-' + updateId + '.html';
  const imgPath = argv.outputdir + '/img/ONEOFF-IMG-MAP-' + updateId + '.jpeg';

  const templateData = {
    lat: argv.lat,
    lon: argv.lon,
    zoom: argv.zoom,
    title: argv.title,
    cities: []
  };
  const htmlDetails = html(templateData);
  fs.writeFileSync(file, htmlDetails);
  await render.renderInBrowser(1450, 1450, url, imgPath);
}

exports.handler = argv => {
  doIt(argv).then(() => {process.exit()})
};