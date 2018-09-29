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


const rp = require('request-promise');
const fs = require('fs');
const paths = require('path');
const JSZip = require('jszip');
const _ = require('lodash');
const promisify = require('util').promisify;

exports.loadKmz = async function(url, path, includeOtherFiles) {
  try {
    await promisify(fs.unlink)(path);
  } catch(err) {}
  const body = await rp({
    url: url,
    encoding: null
  });
  const zip = await JSZip.loadAsync(body);
  await Promise.all(_.map(zip.files, k => {
    let path2 = paths.join(paths.dirname(path), k.name);
    if (k.name.match(RegExp('.*\.[kK][mM][lL]$'))) {
      path2 = path;
    } else if (!includeOtherFiles) {
      return null;
    }
    return k.async('nodebuffer').then(b => {
      return promisify(fs.writeFile)(path2, b);
    });
  }));
};
