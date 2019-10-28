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
const fs = require('fs');
const JSZip = require('jszip');
const paths = require('path');
const promisify = require('util').promisify;
const rp = require('request-promise');

const writeFile = promisify(fs.writeFile);

const DOMParser = require('xmldom').DOMParser;
const togeojson = require('@publicdocs/togeojson');


exports.loadKmz = async function(url, path, toGeoJson, includeOtherFiles, timeoutMs) {
  try {
    await promisify(fs.unlink)(path);
  } catch (err) {}
  const body = await rp({
    url: url,
    encoding: null,
    timeout: timeoutMs || 1200000,
  });
  const zip = await JSZip.loadAsync(body);
  await Promise.all(_.map(zip.files, (k) => {
    return (async function() {
      let path2 = paths.join(paths.dirname(path), k.name);
      if (k.name.match(RegExp('.*\.[kK][mM][lL]$'))) {
        path2 = path;
      } else if (!includeOtherFiles) {
        return null;
      }
      const b = await k.async('nodebuffer');
      await writeFile(path2, b);

      if (toGeoJson) {
        const xml = await fs.readFileSync(path2, 'utf8');
        const kml = new DOMParser().parseFromString(xml);
        const gj = togeojson.kml(kml, {styles: true});
        await writeFile(path2 + '.geojson', JSON.stringify(gj), 'utf8');
      }
    })();
  }));
};
