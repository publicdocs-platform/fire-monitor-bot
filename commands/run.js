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

exports.command = 'run';

exports.aliases = ['daemon'];

exports.description = 'Runs a daemon to post updates';

exports.builder = {
  once: {
    boolean: true,
    desc: 'Run only once and then exit'
  },
  twitter: {
    boolean: true,
    desc: 'Whether to post to Twitter'
  },
  userAgent: {
    string: true,
    desc: 'String to add to User-Agent',
    default: 'Bot',
  },
  clean: {
    boolean: true,
    desc: 'Whether to clear the data files and Twitter post queue before starting'
  },
  locations: {
    boolean: true,
    desc: 'Whether to post images of fire locations'
  },
  redo: {
    string: true,
    desc: 'Forces an update of a given fire ids (comma separated)'
  },
  middleMap: {
    string: true,
    desc: 'Render middle zoom map'
  },
  realFireNames: {
    boolean: true,
    desc: 'Use real fire names not hashtags'
  },
  archiveInciweb: {
    boolean: true,
    desc: 'Save InciWeb updates to web.archive.org'
  },
  perimAfter: {
    string: true,
    default:'2017-12-31',
    desc: 'Only display a update because of a perimeter change after this timestamp'
  }
}

exports.handler = argv => {

  const os = require('os');
  const path = require('path');
  const rp = require('request-promise');
  const _ = require('lodash');
  const yaml = require('js-yaml');
  const titleCase = require('title-case');
  const pug = require('pug');
  const fs = require('fs');
  const deepDiff = require('deep-diff');
  const express = require('express');
  const serveIndex = require('serve-index');
  const numeral = require('numeral');
  const rimraf = require('rimraf');
  const sharp = require('sharp');
  const ip = require('ip');

  const envconfig = require('../envconfig');
  const util = require('../lib/util');
  const dateString = util.dateString;
  const maprender = require('../lib/maprender');
  const geocoding = require('../lib/geocoding');
  const geomac = require('../lib/geomac');
  const tileserver = require('../lib/tileserver');

  // This functionality is disabled.
  if (false) { tileserver.run(8081); }
  if (argv.middleMap) { throw 'Cannot handle middle maps.'; }

  const FairSemaphore = require('fair-semaphore');
  const processingSemaphore = new FairSemaphore(1);

  const intensiveProcessingSemaphore = util.namedSemaphore(processingSemaphore, 'computation');

  const webApp = express();

  const mkdirp = require('mkdirp');

  const tmpdir = os.tmpdir() + '/firemon/';

  if (argv.clean) {
    rimraf.sync(tmpdir, {disableGlob: true});
    rimraf.sync(argv.outputdir, {disableGlob: true});
  }

  mkdirp.sync(tmpdir + '/img/src/terrain');
  mkdirp.sync(tmpdir + '/img/src/detail');
  mkdirp.sync(argv.outputdir + '/img');
  mkdirp.sync(argv.outputdir + '/tweets');
  mkdirp.sync(argv.outputdir + '/postqueue');
  mkdirp.sync(argv.outputdir + '/data');


  webApp.use('/updates', express.static(argv.outputdir + '/'), serveIndex(argv.outputdir + '/', { icons: true, view: 'details' }));
  webApp.listen(argv.port);
  const processFire = function (entry) {
    let ret = {};
    for (let key in entry) {
      ret[key] = entry[key];
      if (key.endsWith('DateTime')) {
        ret[key] = dateString(ret[key]);
      }
      if (_.isString(ret[key])) {
        ret[key] = ret[key].trim();
      }
    }
    ret.Source = 'NFSA';
    ret.Hashtag = util.fireHashTag(ret.Name);
    return ret;
  };


  const dataOptions = {
    uri: 'https://maps.nwcg.gov/sa/publicData.json',
    qs: {
    },
    headers: {
      'User-Agent': 'Request-Promise; ' + argv.userAgent
    },
    json: true
  };


  const config = {
    twitterName: envconfig.twitterAuth.name,
    sourceUrl: dataOptions.uri,
    disclaimerUrl: envconfig.ui.disclaimer_url,
  };


  const htmlTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateRender.pug'));
  const genHtml = function (entry) {
    return htmlTemplate({ config: config, data: entry, curdir: process.cwd() });
  };

  const perimeterTemplate = pug.compileFile(path.join(__dirname, '../templates/firePerimeterRender.pug'));
  const perimeterHtml = function (entry) {
    return perimeterTemplate({ config: config, data: entry, curdir: process.cwd() });
  };



  const centerTemplate = pug.compileFile(path.join(__dirname, '../templates/fireVicinityRender.pug'));
  const centerHtml = function (entry) {
    return centerTemplate({ config: config, data: entry, curdir: process.cwd() });
  };

  const tweetTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateTweet.pug'));

  const genTweet = function (entry) {
    return tweetTemplate({ config: config, data: entry, curdir: process.cwd() });
  };

  if (argv.twitter) {
    const t = require('../lib/twitter');
    t.launchDaemon(argv.outputdir + '/postqueue/', util.namedSemaphore(processingSemaphore, 'twitter'));
  }

  const REMOVE_forceDeltaDebug = argv.debug;
  const periodSeq = argv.debug ? 5 : 65;


  const dailyMap = (() => {
    let ranBeforeDaily = false;
    return async function() {
      return;
      const t = new Date();
      const time = Date.parse(argv.dailyMapTime);
      if (!ranBeforeDaily) {
        ranBeforeDaily = t.getTime() < time.getTime();
        return;
      }

      if (!ranBeforeDaily || t.getTime() < time.getTime()) {
        return;
      }

      ranBeforeDaily = false;


      
      
    };
  })();

  function internalLoop(first, last) {

    const process = function (layers) {
      //console.log(' >> received data');
      let outstanding = 0;
      let x = Object.assign({}, last);
      try {
        const layer = layers[0].layerConfigs[0 /*featureCollection.layerDefinition.name == 'Large WF'*/]
        const data = layer.featureCollection.featureSet.features;
        
        const nfsaData = _.keyBy(data.map(e => processFire(e.attributes)), o => o.UniqueFireIdentifier);
        outstanding++;
        intensiveProcessingSemaphore.take(() => {
          geomac.getFires(argv.userAgent, (gm, err) => {
            if (err) {
              throw err;
              console.log('Geomac Request error %s', err);
              return;
            }
            let keys = _.union(_.keys(nfsaData), _.keys(gm));
            keys.map(key => {
              const merged = geomac.mergedNfsaGeomacFire(nfsaData[key], gm[key]);
              x[key] = merged;
              if (!merged) {
                console.log('Missing ' + key);
              }
            });

            if (REMOVE_forceDeltaDebug && !first) {
              const bs = ['2018-CASHF-001444','2018-WAOWF-000443','2018-CASHF-001438'];
              bs.map((bsk, bsi) => {
                if (!x[bsk]) { return; }
                x[bsk].Fire_Name = 'TEST FAKE ' + x[bsk].Fire_Name;
                x[bsk].Hashtag = '#TestOnly' + x[bsk].Hashtag.substr(1);
                x[bsk].ModifiedOnDateTime = dateString(new Date().getTime());
                x[bsk].PercentContained = last[bsk].PercentContained + 7.3;
                x[bsk].DailyAcres = last[bsk].DailyAcres + 55;
                x[bsk].EstimatedCostToDate = last[bsk].EstimatedCostToDate - 34455;
                x[bsk].TotalIncidentPersonnel = last[bsk].TotalIncidentPersonnel + 55;
              });
            }

            const globalUpdateId = 'Update-at-' + dateString(new Date().getTime());
            {
              console.log('Writing ' + globalUpdateId);
              const diffGlobal = deepDiff(last, x) || [];
              const diffsGlobal = yaml.safeDump(diffGlobal, {skipInvalid: true});
              fs.writeFileSync(argv.outputdir + '/data/GLOBAL-DIFF-' + globalUpdateId + '.yaml', diffsGlobal);
            }
          
            geomac.getPerimeters(argv.userAgent, (perims, err) => {

              try {
                if (err) {
                  throw err;
                }
                const xkeys = _.keys(x);
                const xsortedKeys = _.sortBy(xkeys, i => -x[i].DailyAcres);
                xsortedKeys.map((key) => {
                  const i = key;
                  
                  let cur = x[i];

                  const old = last[i] || {};

                  let perim = [];
                  let perimDateTime = null;
                  let inciWeb = null;

                  if (cur.UniqueFireIdentifier in perims) {
                    perim = perims[cur.UniqueFireIdentifier].geometry.coords || [];
                    perimDateTime = perims[cur.UniqueFireIdentifier].attributes.perimeterdatetime;
                    inciWeb = perims[cur.UniqueFireIdentifier].attributes.inciwebid;
                  }
                  const children = _.values(perims)
                    .filter(fire => {
                      const b = (fire.attributes.complexname || '').toLowerCase() === (cur.Fire_Name || '').toLowerCase();
                      if (b) {
                        if (!perimDateTime || perimDateTime < fire.attributes.perimeterdatetime) {
                          perimDateTime = fire.attributes.perimeterdatetime;
                          inciWeb = fire.attributes.inciwebid;
                        }
                      }
                      return b;
                    })
                    .map(fire => fire.geometry.coords)
                    .reduce((a,b) => a.concat(b), []);

                  perim = perim.concat(children);

                  if (cur.Lat) {
                    perim.push([ [[cur.Lon, cur.Lat], [cur.Lon, cur.Lat]] ]);
                  }

                  cur.PerimDateTime = perimDateTime;

                  if (first) {
                    return;
                  }

                  if (i in last && last[i].ModifiedOnDateTime >= cur.ModifiedOnDateTime) {                    
                    // Keep the newer data around.
                    x[i] = Object.assign({}, last[i]);
                    x[i].PerimDateTime = perimDateTime;
                    cur = x[i];
                    // Only skip the update if perimeter is ALSO not up to date.
                    if (!perimDateTime || (last[i].PerimDateTime && last[i].PerimDateTime >= perimDateTime)) {
                      return;
                    }
                  }

                  let oneDiff = deepDiff(old, cur);
                  oneDiff = _.keyBy(oneDiff, o => o.path.join('.'));

                  if (!('DailyAcres' in oneDiff || 'PercentContained' in oneDiff)) {
                    if (!('PerimDateTime' in oneDiff)) {
                      // Unless acreage, perim, or containment change, we don't report it.
                      return;
                    }
                    // Only show perimeters changed after the filter.
                    if (!perimDateTime || perimDateTime <= argv.perimAfter) {
                      return;
                    }
                  }
                  if (!('PercentContained' in oneDiff || 'PerimDateTime' in oneDiff) && old.DailyAcres && cur.DailyAcres && Math.abs(cur.DailyAcres - old.DailyAcres) < 1.1) {
                    // May be spurious - due to rounding in GEOMAC vs NFSA.
                    return;
                  }


                  const updateId = 'Update-' + cur.ModifiedOnDateTime + '-PER-' + (cur.PerimDateTime || 'NONE') + '-of-' + i + '-named-' + cur.Name;
                


                  const diffs = yaml.safeDump(oneDiff || [],  {skipInvalid: true});
                  const isNew = !(i in last);

                  console.log('- ' + updateId);
                  const diffPath = argv.outputdir + '/data/DIFF-' + updateId + '.yaml';

                  if (fs.existsSync(diffPath)) {
                    console.log('$$$$ ANOMALY DETECTED - REPEATING UPDATE %s - SKIPPED', updateId);
                    fs.writeFileSync(argv.outputdir + '/data/ANOMALY-DIFF-' + updateId + '.' + globalUpdateId + '-INSTANT-' + new Date().toISOString() + '.yaml', diffs);
                    return;
                  }

                  fs.writeFileSync(diffPath, diffs);

                  console.log('   # Before intensiveProcessingSemaphore ' + updateId);
                  outstanding++;

                  if (argv.realFireNames) {
                    cur.Hashtag = util.fireName(cur.Name);
                  }

                  intensiveProcessingSemaphore.take(function () {
                    try {
                      console.log('   # Entering intensiveProcessingSemaphore ' + updateId);
                      const infoImg = argv.outputdir + '/img/IMG-TWEET-' + updateId + '.png';
                      const mainWebpage = argv.outputdir + '/img/WEB-INFO-' + updateId + '.html';
                      const perimImg = argv.outputdir + '/img/IMG-PERIM-' + updateId + '.jpeg';
                      const perimWebpage = argv.outputdir + '/img/WEB-PERIM-' + updateId + '.html';
                      const centerImg = argv.outputdir + '/img/IMG-CENTER-' + updateId + '.jpeg';
                      const centerWebpage = argv.outputdir + '/img/WEB-CENTER-' + updateId + '.html';

                      const mainWebpageUrl = 'http://localhost:8080/updates/img/WEB-INFO-' + updateId + '.html';
                      const centerWebpageUrl = 'http://localhost:8080/updates/img/WEB-CENTER-' + updateId + '.html';
                      const perimWebpageUrl = 'http://localhost:8080/updates/img/WEB-PERIM-' + updateId + '.html';
                      const terrainMapImg = tmpdir + '/img/src/terrain/MAP-TERRAIN-' + updateId + '.png';
                      const detailMapImg = tmpdir + '/img/src/detail/MAP-DETAIL-' + updateId + '.png';

                      if (inciWeb && argv.archiveInciweb) {
                        let u = 'https://web.archive.org/save/https://inciweb.nwcg.gov/incident/' + inciWeb + '/';
                        rp({uri: u, resolveWithFullResponse: true}).then((r) => {
                          console.log('   ~~ Archived to web.archive.org: %s', r.headers ? ('https://web.archive.org/' + r.headers['content-location']) : 'unknown');
                        }).catch((err) => {
                          console.log('   ~~ ERROR Archiving to web.archive.org: ' + u );
                          console.log(err);
                        });
                      }

                      const capture = (center, zoom, terrainPath) => {

                        const lat = center ? center[1] : cur.Lat;
                        const lon = center ? center[0] : cur.Lon;

                        // MultiPolygon -> Coordinates
                        const points = _.flattenDepth(perim, 2);

                        const useful = 100 + Math.sqrt(0.0015625 /*mi2 per acre*/ * cur.DailyAcres);
                        const cities2 = lat ? _.sortBy(geocoding.nearestCities(lat, lon, 1000, 500)
                          .map(x => {
                            let thePoint = [];
                            if (x.distance < useful) {
                              x.useful = true;
                              const pointDists = points.map(pp => geocoding.distance(pp[0], pp[1], x.lon, x.lat));
                              const minPointIndex = _.minBy(_.range(0, points.length), idx => pointDists[idx]);
                              const thePoint = points[minPointIndex];
                              x.distance = pointDists[minPointIndex];
                              x.bearing = geocoding.bearing(x.lon, x.lat, thePoint[0], thePoint[1]);
                              x.displayName = geocoding.cityDisplayName(x);
                              x.directions = geocoding.friendlyDistance(x.distance, 'mi', geocoding.compass(x.bearing), x.displayName);
                              x.weightedPopulation = x.distance < 20 ? x.population : (x.distance < 50 ? 0.5 * x.population : (x.distance < 75 ? 0.01 * x.population : (x.distance < 100 ? 0.001 * x.population: 0)));
                            } else {
                              x.useful = false;
                              x.weightedPopulation = 0;
                            }
                            return x;
                          }), (x) => x.distance) : [];
                        
                        const cities = _.sortBy(cities2, x => x.distance);
                        const nearPopulation = cities.reduce((a, b) => a + b.weightedPopulation,0);
                        const allPopulation = cities.reduce((a, b) => a + b.population,0);

                        console.log('  > Fire %s is near pop. %d (all %d)', updateId, nearPopulation, allPopulation);
                        if ((lat && lon && nearPopulation <= 1000 || cur.state == 'AK' || cur.State == 'AK') ||
                            (!lat && !lon && cur.DailyAcres < 2 && (cur.TotalIncidentPersonnel || 0) < 15)
                          ) {
                          console.log('  > Skipping %s', updateId);
                          outstanding--;
                          console.log('   # Exiting intensiveProcessingSemaphore ' + updateId);
                          intensiveProcessingSemaphore.leave();
                          return;
                        }
                        const byPop = _.sortBy(cities, 'population');
                        let displayCities = { 
                          closest: _.first(cities.filter((x) => x.useful)),
                          biggest: _.last(byPop.filter((x) => x.useful)),
                          all: {closest: cities, biggest: _.reverse(byPop)}
                        };
                        if (displayCities.closest == displayCities.biggest) {
                          displayCities.biggest = null;
                        }

                        const terrainImg = terrainPath || null;
                        const templateData = { 
                          lat: lat, 
                          lon: lon, 
                          zoom: 7,
                          cities: displayCities,
                          current: cur, 
                          last: old, 
                          diff: oneDiff, 
                          isNew: isNew, 
                          terrainImg: terrainImg, 
                          terrainCredit: terrainImg ? maprender.terrainCredit : '',
                        };
                        const html = genHtml(templateData);
                        const tweet = genTweet(templateData);
                        fs.writeFileSync(argv.outputdir + '/tweets/TWEET-' + updateId + '.txt', tweet);

                        fs.writeFileSync(mainWebpage, html);

                        const puppeteer = require('puppeteer');
                        (async () => {
                          const browser = await puppeteer.launch({defaultViewport: { 
                            width: 2048, height: 1270, 
                            deviceScaleFactor: 2
                          }});
                          const page = await browser.newPage();
                          await page.goto(mainWebpageUrl, {
                            timeout: 60000 * 10,
                            waitUntil: 'networkidle0'
                          });
                          await page.screenshot({
                            path: infoImg, type: "jpeg", quality: 95,
                          });
                          await browser.close();

                          const perimAndSave = function(centerImg) {
                            const saveTweet = function(detailRender) {
                              // Tweet out in population and acre order.
                              const invPrio = Math.log10(cur.DailyAcres) * 1000 + nearPopulation;
                              const priority = numeral(Math.round(100000000000 - invPrio)).format('0000000000000');
                              //allImgs = 
                              let saved = {
                                text: tweet,
                                image1AltText: tweet,
                                image1: infoImg,
                                image2AltText: 'Perimeter map',
                                image2: detailRender,
                                image3AltText: 'Vicnity map',
                                image3: centerImg,
                              };
                              if (center) {
                                saved.coords = { lat: lat, lon: lon };
                              }

                              // Tell the twitter daemon we are ready to post.
                              const savedYaml = yaml.safeDump(saved,  {skipInvalid: true});
                              fs.writeFileSync(argv.outputdir + '/postqueue/' + priority + '-TWEET-' + updateId + '.yaml', savedYaml);

                              outstanding--;

                              console.log('   # Exiting intensiveProcessingSemaphore ' + updateId);
                              intensiveProcessingSemaphore.leave();
                            }

                            const detailImg = perim.length > 0 && !(perim.length == 1 && perim[0].length == 1 && perim[0][0].length == 2);
                            if (detailImg) {
                              const perimTemplateData = {
                                lat: lat, 
                                lon: lon, 
                                zoom: zoom,
                                cities: displayCities,
                                perimDateTime: perimDateTime,
                                current: cur,
                                last: old, 
                                diff: oneDiff,
                                isNew: isNew, 
                                img: detailImg, 
                                imgCredit: maprender.detailedCredit,
                              };
                              const htmlPerim = perimeterHtml(perimTemplateData);
                              fs.writeFileSync(perimWebpage, htmlPerim);

                              const puppeteer = require('puppeteer');
                              (async () => {
                                const browser = await puppeteer.launch({defaultViewport: { 
                                  width: 1450, height: 1450, 
                                  deviceScaleFactor: 2
                                }});
                                const page = await browser.newPage();
                                await page.goto(perimWebpageUrl, {
                                  timeout: 60000 * 10,
                                  waitUntil: 'networkidle0'
                                });
                                await page.screenshot({
                                  path: perimImg, type: "jpeg", quality: 95,
                                });
                                await browser.close();
                                saveTweet(perimImg);
                              })();
                            } else {
                              saveTweet(null);
                            }
                          }
                          if (lat && argv.middleMap) {
                            const centerTemplateData = {
                              lat: lat, 
                              lon: lon, 
                              zoom: 7,
                              cities: displayCities,
                              perimDateTime: perimDateTime,
                              current: cur,
                              last: old, 
                              diff: oneDiff,
                              isNew: isNew, 
                              img: true, 
                              imgCredit: maprender.detailedCredit,
                            };
                            const htmlCenter = centerHtml(centerTemplateData);
                            fs.writeFileSync(centerWebpage, htmlCenter);

                            const puppeteer = require('puppeteer');
                            (async () => {
                              const browser = await puppeteer.launch({defaultViewport: { 
                                width: 1450, height: 1450, 
                                deviceScaleFactor: 2
                              }});
                              const page = await browser.newPage();
                              await page.goto(centerWebpageUrl, {
                                timeout: 60000 * 10,
                                waitUntil: 'networkidle0'
                              });
                              await page.screenshot({
                                path: centerImg, type: "jpeg", quality: 95,
                              });
                              await browser.close();
                              perimAndSave(centerImg);
                            })();
                          } else {
                            perimAndSave(null);
                          }

                        })();
                      };

                      if (perim.length > 0 && argv.locations) {
                        maprender.renderMap(null, perim, 1450/2, 1200/2, 12, true, (center, zoom, idealZoom, dErr) => {
                          capture(center, idealZoom, perim.length > 0 ? null : '/dev/null');
                        });
                      } else {
                        console.log('>> Missing perimeter - ' + updateId);
                        capture(null, null, null);
                      }
                    } catch (err) {
                      console.log(err);
                    }
                  });

                });
              } catch (err) {
                console.log(err);
              }

              outstanding--;
              intensiveProcessingSemaphore.leave();
            });
          });
        });
      } catch (err) {
        console.log(err);
      } finally {
        // Just wait!
        console.log(' >> Repeat semaphore wait');
        const whenReady = function (again) {
          intensiveProcessingSemaphore.take(function () {
            console.log(' >> Repeat semaphore acquired');
            if (outstanding < 0) {
              intensiveProcessingSemaphore.leave();
              throw "Can't have negative outstanding requests";
            }
            if (outstanding == 0) {
              console.log(' >> Repeat semaphore - ready to refresh');
              fs.writeFileSync(argv.db, yaml.safeDump(x,  {skipInvalid: true}));
              intensiveProcessingSemaphore.leave();
              if (argv.once) {
                process.exit();
                while(true) { }
              }
              setTimeout(function () { mainLoop(false, x); }, 1000 * periodSeq * 1);
              return;
            }
            console.log(' >> Repeat semaphore - NOT ready to refresh: ' + outstanding);
            intensiveProcessingSemaphore.leave();
            setTimeout(function () { again(again); }, 1000);
          });
        };
        whenReady(whenReady);
      }
    };
    rp(dataOptions).then((layers) => {process(layers);}).catch(function (err) {
      console.log('Request error %s', err);
      process(
        [{layerConfigs:{featureCollection:{featureSet:{features:[]}}}}]);
    });
  }

  const mainLoop = function (first, last) {
    dailyMap().then(() => {
      internalLoop(first, last);
    })
  }

  let persist = undefined;
  if (fs.existsSync(argv.db)) {
    persist = yaml.safeLoad(fs.readFileSync(argv.db));
    if (argv.redo) {
      argv.redo.split(',').map(x => { delete persist[x]; return 0; });
    }
  }


  console.log(`*** The fire information displayed by this app is UNOFFICIAL, FOR INFORMATION ONLY, 
  NOT SUITABLE FOR SAFETY/EMERGENCY PURPOSES, 
  and MAY BE INCORRECT OR OUT-OF-DATE. USE AT YOUR OWN RISK. ***`)

  setImmediate(function () { mainLoop(persist ? false : true, persist ? persist : {}); });
};
