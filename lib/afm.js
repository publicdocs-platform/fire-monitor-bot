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


const kmz = require('./kmz');
const path = require('path');

exports.refreshAfmSatelliteData = async function(outDir) {
  await kmz.loadKmz('https://fsapps.nwcg.gov/afm/data/kml/conus.kmz', path.join(outDir, 'modis.kml'));
  await kmz.loadKmz('https://fsapps.nwcg.gov/afm/data/kml/alaska.kmz', path.join(outDir, 'modis-alaska.kml'));
  await kmz.loadKmz('https://fsapps.nwcg.gov/afm/data_viirs_iband/kml/conus.kmz', path.join(outDir, 'viirs-i.kml'));
  await kmz.loadKmz('https://fsapps.nwcg.gov/afm/data_viirs_iband/kml/alaska.kmz', path.join(outDir, 'viirs-i-alaska.kml'));
  return true;
};
