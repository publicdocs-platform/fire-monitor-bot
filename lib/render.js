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

const puppeteer = require('puppeteer');

exports.renderInBrowser = async function(width, height, url, outPath) {
  const browser = await puppeteer.launch({
    defaultViewport: {
      width: width, height: height,
      deviceScaleFactor: 2,
    },
  });
  const page = await browser.newPage();
  await page.goto(url, {
    timeout: 60000 * 10,
    waitUntil: 'networkidle0',
  });
  await page.screenshot({
    path: outPath, type: 'jpeg', quality: 95,
  });
  await browser.close();
  return outPath;
};
