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

const os = require('os');
const path = require('path');

const rimraf = require('rimraf');
const mkdirp = require('mkdirp');

const proj4 = require('proj4');

const rp = require('request-promise');
const _ = require('lodash');
const yaml = require('js-yaml');
const titleCase = require('title-case');
const pug = require('pug');
const fs = require('fs');
const del = require('del');
const deepDiff = require('deep-diff');
const numeral = require('numeral');
const sharp = require('sharp');
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const ip = require('ip');

const puppeteer = require('puppeteer');

const envconfig = require('../envconfig');
const util = require('../lib/util');
const afm = require('../lib/afm');
const dateString = util.dateString;
const maprender = require('../lib/maprender');
const render = require('../lib/render');
const geocoding = require('../lib/geocoding');
const geomac = require('../lib/geomac');
const tileserver = require('../lib/tileserver');
const server = require('../lib/server');
const files = require('../lib/files');
const units = require('../lib/units');



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
  twitterOnly: {
    boolean: true,
    desc: 'Whether to stop other daemon activities other than tweeting'
  },
  monitorPerims: {
    boolean: true,
    default: true,
    desc: 'Whether to post changes only to the perimeter.'
  },
  userAgent: {
    string: true,
    desc: 'String to add to User-Agent',
    default: 'Bot',
  },
  locations: {
    boolean: true,
    desc: 'Whether to post images of fire locations'
  },
  redo: {
    string: true,
    desc: 'Forces an update of a given fire ids (comma separated)'
  },
  realFireNames: {
    boolean: true,
    desc: 'Use real fire names not hashtags'
  },
  archiveInciweb: {
    boolean: true,
    desc: 'Save InciWeb updates to web.archive.org'
  },
  emergingNew: {
    boolean: true,
    desc: 'Include emerging wildfires <24hrs'
  },
  emergingOld: {
    boolean: true,
    desc: 'Include emerging wildfires >24hrs'
  },
  perimAfter: {
    string: true,
    default:'2017-12-31',
    desc: 'Only display a update because of a perimeter change after this timestamp'
  },
  twitterAuthPath: {
    string: true,
    desc: 'Path to twitter profiles'
  },
  twitterAccountsPath: {
    string: true,
    desc: 'Path to twitter accounts per state'
  },
  twitterPeriodSec: {
    number: true,
    default: 60 * 5 + 11,
    desc: 'Seconds between twitter posts'
  },
  pruneDays: {
    number: true,
    default: 45,
    desc: 'Days before pruning stale entries'
  },
  twitterThreadQueryPrefix: {
    string: true,
    desc: 'Twitter query to find posts to reply to'
  },
  postPersistCmd: {
    string: true,
    desc: 'Command to run after peristing data'
  },
  ignoreSatellites: {
    boolean: true,
    desc: 'Ignores AFM satellite data'
  },
  unitsSocialPath: {
    string: true,
    desc: 'Path to fire units social media info'
  },
  unitsIdPath: {
    string: true,
    desc: 'Path to fire units ID info'
  },
}

exports.handler = argv => {

  console.log(argv);

  // This functionality is disabled.
  if (false) { tileserver.run(8081); }

  const FairSemaphore = require('fair-semaphore');
  const processingSemaphore = new FairSemaphore(1);

  const intensiveProcessingSemaphore = util.namedSemaphore(processingSemaphore, 'computation');

  const tmpdir = files.setupDirs(argv.outputdir, argv.clean)

  server.run(argv.port, argv.outputdir);


  const processFire = function(e, proj) {
    let entry = e.attributes;
    let ret = {};
    const to = proj4(proj, 'EPSG:4326', [e.geometry.x, e.geometry.y]);
    ret.Lon = to[0];
    ret.Lat = to[1];
    for (let key in entry) {
      ret[key] = entry[key];
      if (key.endsWith('DateTime')) {
        ret[key + 'Epoch'] = ret[key];
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
    systemName: envconfig.ui.system_url,
  };


  const htmlTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateRender.pug'));
  const genHtml = function (entry) {
    return htmlTemplate({ config: config, data: entry, curdir: process.cwd() });
  };

  const perimeterTemplate = pug.compileFile(path.join(__dirname, '../templates/detailsRender.pug'));
  const perimeterHtml = function (entry) {
    return perimeterTemplate({ config: config, data: entry, curdir: process.cwd() });
  };



  const tweetTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateTweet.pug'));

  const genTweet = function (entry) {
    return tweetTemplate({ config: config, data: entry, curdir: process.cwd() });
  };

  if (argv.twitter) {
    const t = require('../lib/twitter');
    t.launchDaemon(argv.outputdir + '/postqueue/',
                   util.namedSemaphore(processingSemaphore, 'twitter'),
                   argv.twitterAuthPath,
                   argv.twitterAccountsPath,
                   argv.twitterPeriodSec * 1000
                  );
  }

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

  async function internalLoop(first, last) {

    const layers = await rp(dataOptions);

    let x = Object.assign({}, last);

    const dataSetName = 'Active Incidents';

    const dataSet = _.find(layers, p => p.name === dataSetName);

    const requiredLayerNames = ['Large WF'];
    if (argv.emergingNew) {
      requiredLayerNames.unshift('Emerging WF < 24 hours');
    }
    if (argv.emergingOld) {
      requiredLayerNames.unshift('Emerging WF > 24 hours');
    }

    const filteredLayers = dataSet.layerConfigs.filter(f => requiredLayerNames.includes(f.featureCollection.layerDefinition.name));
    const layerFeatures = filteredLayers.map(x => {
      return x.featureCollection.featureSet.features.map(y => {
        const r = processFire(y, 'EPSG:'+ x.featureCollection.featureSet.spatialReference.latestWkid);
        r.NFSAType = x.featureCollection.layerDefinition.name;
        return r;
      });
    });

    const data = _.flatten(layerFeatures);
    
    const nfsaData = _.keyBy(data, o => o.UniqueFireIdentifier);
    const gm = await geomac.getFires(argv.userAgent);

    let keys = _.union(_.keys(nfsaData), _.keys(gm));
    keys.map(key => {
      const merged = geomac.mergedNfsaGeomacFire(nfsaData[key], gm[key]);
      x[key] = merged;
      if (!merged) {
        console.log('Missing ' + key);
      }
    });

    const curTime = new Date().getTime();
    const pruneTime = curTime - 1000 * 60 * 60 * 24 * argv.pruneDays;

    const globalUpdateId = 'Update-at-' + dateString(curTime);
    {
      console.log('Saving ' + globalUpdateId);
      const diffGlobal = deepDiff(last, x) || [];
      const diffsGlobal = yaml.safeDump(diffGlobal, {skipInvalid: true});
      fs.writeFileSync(argv.outputdir + '/data/GLOBAL-DIFF-' + globalUpdateId + '.yaml', diffsGlobal);
    }
  
    const perims = await geomac.getPerimeters(argv.userAgent);

    const xkeys = _.keys(x);
    const xsortedKeys = _.sortBy(xkeys, i => -x[i].DailyAcres);

    for (let key1 of xsortedKeys) {
      
      const key = key1;
      
      var { i, cur, perimDateTime, old, inciWeb, perim } = preDiffFireProcess(key, x, last, perims);

      if (first) {
        continue;
      }


      if (i in last && last[i].ModifiedOnDateTime >= cur.ModifiedOnDateTime) {                    
        // Keep the newer data around.
        x[i] = Object.assign({}, last[i]);
        x[i].PerimDateTime = perimDateTime;
        cur = x[i];

        if (!cur.ModifiedOnDateTimeEpoch || cur.ModifiedOnDateTimeEpoch < pruneTime) {
          console.log(' #! Pruning %s %s -> last mod %s', i, cur.Name, cur.ModifiedOnDateTime);
          delete x[i];
          continue;
        }

        // Only skip the update if perimeter is ALSO not up to date.
        if (!perimDateTime || (last[i].PerimDateTime && last[i].PerimDateTime >= perimDateTime)) {
          continue;
        }
      }


      let oneDiff = deepDiff(old, cur);
      oneDiff = _.keyBy(oneDiff, o => o.path.join('.'));

      if (!('DailyAcres' in oneDiff || 'PercentContained' in oneDiff)) {
        if (!argv.monitorPerims || !('PerimDateTime' in oneDiff)) {
          // Unless acreage, perim, or containment change, we don't report it.
          continue;
        }
        // Only show perimeters changed after the filter.
        if (!perimDateTime || perimDateTime <= argv.perimAfter) {
          continue;
        }
      }
      if (!('PercentContained' in oneDiff || 'PerimDateTime' in oneDiff) && old.DailyAcres && cur.DailyAcres && Math.abs(cur.DailyAcres - old.DailyAcres) < 1.1) {
        // May be spurious - due to rounding in GEOMAC vs NFSA.
        continue;
      }

      const updateId = 'Update-' + cur.ModifiedOnDateTime + '-PER-' + (cur.PerimDateTime || 'NONE') + '-of-' + i + '-named-' + cur.Name.replace(/[^a-z0-9]/gi,'');

      const diffs = yaml.safeDump(oneDiff || [],  {skipInvalid: true});
      const isNew = !(i in last);

      console.log('- ' + updateId);
      const diffPath = argv.outputdir + '/data/DIFF-' + updateId + '.yaml';

      if (fs.existsSync(diffPath)) {
        console.log('$$$$ ANOMALY DETECTED - REPEATING UPDATE %s - SKIPPED', updateId);
        fs.writeFileSync(argv.outputdir + '/data/ANOMALY-DIFF-' + updateId + '.' + globalUpdateId + '-INSTANT-' + new Date().toISOString() + '.yaml', diffs);
        continue;
      }

      fs.writeFileSync(diffPath, diffs);
      if (argv.realFireNames) {
        cur.Hashtag = util.fireName(cur.Name);
      }

      await promisify(intensiveProcessingSemaphore.take).bind(intensiveProcessingSemaphore)();
      try {
        await internalProcessFire(updateId, inciWeb, cur, perim, old, oneDiff, isNew, key, perimDateTime);
      } catch (err) {
        console.log('$$$$ ERROR processing %s', updateId);
        console.log(err);
      } finally {
        intensiveProcessingSemaphore.leave();
      }

    }

    fs.writeFileSync(argv.db, yaml.safeDump(x,  {skipInvalid: true}));

    if (argv.postPersistCmd) {
      try {
        await exec(argv.postPersistCmd);
      } catch(err) {
        console.log('### Error in post persist command: ');
        console.log(err);
      }
    }

    if (argv.once) {
      process.exit();
      while(true) { }
    }

    return x;

    async function internalProcessFire(updateId, inciWeb, cur, perim, old, oneDiff, isNew, key, perimDateTime) {
      console.log(' # Entering Processing ' + updateId);
      const infoImg = argv.outputdir + '/img/IMG-TWEET-' + updateId + '.png';
      const mainWebpage = argv.outputdir + '/img/WEB-INFO-' + updateId + '.html';
      const perimImg = argv.outputdir + '/img/IMG-PERIM-' + updateId + '.jpeg';
      const perimWebpage = argv.outputdir + '/img/WEB-PERIM-' + updateId + '.html';
      const mainWebpageUrl = 'http://localhost:8080/updates/img/WEB-INFO-' + updateId + '.html';
      const centerWebpageUrl = 'http://localhost:8080/updates/img/WEB-CENTER-' + updateId + '.html';
      const perimWebpageUrl = 'http://localhost:8080/updates/img/WEB-PERIM-' + updateId + '.html';
      if (inciWeb && argv.archiveInciweb) {
        let u = 'https://web.archive.org/save/https://inciweb.nwcg.gov/incident/' + inciWeb + '/';
        rp({ uri: u, resolveWithFullResponse: true }).then((r) => {
          console.log('   ~~ Archived to web.archive.org: %s', r.headers ? ('https://web.archive.org/' + r.headers['content-location']) : 'unknown');
        }).catch((err) => {
          console.log('   ~~ ERROR Archiving to web.archive.org: ' + u);
          console.log(err);
        });
      }
      let rr = null;
      if (perim.length > 1 && argv.locations) {
        rr = await maprender.renderMap(null, perim, 1450 / 2, 1200 / 2, 15, true);
      } else {
        console.log('>> Missing perimeter - ' + updateId);
      }
      const center = rr ? rr.center : [cur.Lon, cur.Lat];
      const zoom = rr ? rr.zoom : 12;
      const terrainPath = perim.length > 0 ? null : '/dev/null';

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
            x.weightedPopulation = x.distance < 20 ? x.population : (x.distance < 50 ? 0.5 * x.population : (x.distance < 75 ? 0.01 * x.population : (x.distance < 100 ? 0.001 * x.population : 0)));
          }
          else {
            x.useful = false;
            x.weightedPopulation = 0;
          }
          return x;
        }), (x) => x.distance) : [];
      
      
      const cities = _.sortBy(cities2, x => x.distance);

      const nearPopulation = Math.round(cities.reduce((a, b) => a + b.weightedPopulation, 0));
      const allPopulation = cities.reduce((a, b) => a + b.population, 0);
      console.log('  > Fire %s is near pop. %d (all %d), %d acres, %d staff', updateId, nearPopulation, allPopulation, cur.DailyAcres, cur.TotalIncidentPersonnel);


      const displayFilters = {
        InAlaska: cur.state == 'AK' || cur.State == 'AK' || (_.first(cities) || {}).adminCode == 'AK',
        InHawaii: cur.state == 'HI' || cur.State == 'HI' || (_.first(cities) || {}).adminCode == 'HI',
        KnownLocationLowPop: lat && lon && nearPopulation <= 1000,
        UnknownLocationSmallSize: !lat && !lon && (cur.DailyAcres || 0) < 1.1 && (cur.TotalIncidentPersonnel || 0) < 15,
        FalseAlarmType: cur.IncidentTypeCategory === 'FA' || cur.incidenttypecategory === 'FA',
        FalseAlarmName: cur.Fire_Name.toLowerCase().substr(0,3) === 'FA ' || (cur.Fire_Name.toLowerCase().includes('false') && cur.Fire_Name.toLowerCase().includes('alarm')),
        // 3 hours with no info, might be stale
        OldEmergingFiresWithoutInfo: (cur.NFSAType || '').includes('Emerging') && !cur.DailyAcres && !cur.PercentContained && (cur.ModifiedOnDateTimeEpoch - cur.FireDiscoveryDateTimeEpoch > 1000 * 60 * 60 * 3),
      }

      for (let filterKey in displayFilters) {
        if (displayFilters[filterKey]) {
          console.log('  #> Skipping %s -> filter %s', updateId, filterKey);
          return;
        }
      }

      // This will go through. Make sure we don't put an old update on Twitter in the mean time.
      const delPaths = await del([argv.outputdir + '/postqueue/*-' + cur.UniqueFireIdentifier + '-*.yaml']);
      if (delPaths.length > 0) {
        console.log('  > Old tweets deleted: %s', delPaths.join('; '));
      }

      const byPop = _.sortBy(cities, 'population');
      let displayCities = {
        closest: _.first(cities.filter((x) => x.useful)),
        biggest: _.last(byPop.filter((x) => x.useful)),
        all: { closest: cities, biggest: _.reverse(byPop) }
      };
      if (displayCities.closest == displayCities.biggest) {
        displayCities.biggest = null;
      }

      const countyTag = cur.POOCounty ? util.hashTagify(cur.POOCounty + ' County') : null;

      const extraTags = [countyTag, cur.unitMention].filter(x => x).join(' ');

      const terrainImg = terrainPath || null;
      const templateData = {
        lat: lat,
        lon: lon,
        zoom: 7,
        cities: displayCities,
        current: cur,
        last: old,
        diff: oneDiff,
        extraTags: extraTags,
        isNew: isNew,
        terrainImg: terrainImg,
        terrainCredit: terrainImg ? maprender.terrainCredit : '',
      };
      const html = genHtml(templateData);
      const tweet = genTweet(templateData);
      fs.writeFileSync(argv.outputdir + '/tweets/TWEET-' + updateId + '.txt', tweet);
      fs.writeFileSync(mainWebpage, html);

      await renderUpdateImage();
      await perimAndSaveProcess(null);



      async function perimAndSaveProcess() {
        const detailImg = (lat && lon) || (perim.length > 0 && !(perim.length == 1 && perim[0].length == 1 && perim[0][0].length == 2));
        let detailRender = null;
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

          await renderPerim();
          detailRender = perimImg;
        }

        // Tweet out in population and acre order.
        const invPrio = Math.log10(cur.DailyAcres) * 1000 + nearPopulation;
        const priority = numeral(Math.round(100000000000 - invPrio)).format('0000000000000');
        //allImgs = 
        let saved = {
          text: tweet,
          image1AltText: cur.UniqueFireIdentifier + ' - ' + tweet,
          image1: infoImg,
          image2AltText: cur.UniqueFireIdentifier + ' - Perimeter map',
          image2: detailRender,
          selectors: [cur.state || cur.State || key.substr(5, 2), 'other'],
          threadQuery: argv.twitterThreadQueryPrefix ? (argv.twitterThreadQueryPrefix + ' ' + cur.Hashtag) : null,
        };
        if (center) {
          saved.coords = { lat: lat, lon: lon };
        }
        // Tell the twitter daemon we are ready to post.
        const savedYaml = yaml.safeDump(saved, { skipInvalid: true });
        fs.writeFileSync(argv.outputdir + '/postqueue/' + priority + '-TWEET-' + updateId + '.yaml', savedYaml);
        console.log('   # Exiting processing ' + updateId);

      }

      async function renderPerim() {
        return render.renderInBrowser(1450, 1450, perimWebpageUrl, perimImg);
      }

      async function renderUpdateImage() {
        return render.renderInBrowser(2048, 1330, mainWebpageUrl, infoImg);
      }
    }
  }


  function preDiffFireProcess(key, x, last, perims) {
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
      .reduce((a, b) => a.concat(b), []);
    perim = perim.concat(children);
    if (cur.Lat) {
      perim.push([[[cur.Lon, cur.Lat], [cur.Lon, cur.Lat]]]);
    }
    cur.PerimDateTime = perimDateTime;
    cur.unitId = cur.pooresponsibleunit || cur.UniqueFireIdentifier.split('-')[1];
    cur.unitMention = units.unitTag(cur.unitId);
    return { i, cur, perimDateTime, old, inciWeb, perim };
  }

  const mainLoop = function (first, last) {
    (async function() {
      let x = last;
      if (!argv.twitterOnly) {
        try {
          if (!argv.ignoreSatellites) {
            await afm.refreshAfmSatelliteData(argv.outputdir + '/kml/');
          }
          await units.loadUnits(argv.unitsIdPath, argv.unitsSocialPath);
          await dailyMap();
          x = await internalLoop(first, last);
        } catch (err) {
          console.log('>> ERROR');
          console.log(err);
        } finally {
        }

        console.log('Next round');
      }
      setTimeout(function () { mainLoop(false, x); }, 1000 * periodSeq * 1);
    })();
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


