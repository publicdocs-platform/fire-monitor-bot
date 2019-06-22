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

const path = require('path');
const proj4 = require('proj4');
const rp = require('request-promise');
const _ = require('lodash');
const yaml = require('js-yaml');
const pug = require('pug');
const fs = require('fs');
const del = require('del');
const os = require('os');
const deepDiff = require('deep-diff');
const numeral = require('numeral');
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);

const envconfig = require('../envconfig');
const logging = require('../lib/logging');
const logger = logging.child({labels: {system: 'run'}});
const util = require('../lib/util');
const afm = require('../lib/afm');
const dateString = util.dateString;
const maprender = require('../lib/maprender');
const render = require('../lib/render');
const geocoding = require('../lib/geocoding');
const geomac = require('../lib/geomac');
const server = require('../lib/server');
const files = require('../lib/files');
const units = require('../lib/units');


exports.command = 'run';

exports.aliases = ['daemon'];

exports.description = 'Runs a daemon to post updates';

exports.builder = {
  once: {
    boolean: true,
    desc: 'Run only once and then exit',
  },
  twitter: {
    boolean: true,
    desc: 'Whether to post to Twitter',
  },
  twitterOnly: {
    boolean: true,
    desc: 'Whether to stop other daemon activities other than tweeting',
  },
  logTweets: {
    boolean: false,
    desc: 'Whether to log tweets to Firestore',
  },
  monitorPerims: {
    boolean: true,
    default: false,
    desc: 'Whether to post changes only to the perimeter.',
  },
  userAgent: {
    string: true,
    desc: 'String to add to User-Agent',
    default: 'Bot',
  },
  locations: {
    boolean: true,
    default: true,
    desc: 'Whether to post images of fire locations',
  },
  redo: {
    string: true,
    desc: 'Forces an update of a given fire ids (comma separated)',
  },
  realFireNames: {
    boolean: true,
    desc: 'Use real fire names not hashtags',
  },
  archiveInciweb: {
    boolean: true,
    desc: 'Save InciWeb updates to web.archive.org',
  },
  emergingNew: {
    boolean: true,
    default: true,
    desc: 'Include emerging wildfires <24hrs',
  },
  emergingOld: {
    boolean: true,
    desc: 'Include emerging wildfires >24hrs',
  },
  perimAfter: {
    string: true,
    default: '2017-12-31',
    desc: 'Only display a update because of a perimeter change after this timestamp',
  },
  twitterAuthPath: {
    string: true,
    desc: 'Path to twitter profiles',
  },
  twitterAccountsPath: {
    string: true,
    desc: 'Path to twitter accounts per state',
  },
  twitterPeriodSec: {
    number: true,
    default: 60 * 5 + 11,
    desc: 'Seconds between twitter posts',
  },
  pruneDays: {
    number: true,
    default: 45,
    desc: 'Days before pruning stale entries',
  },
  twitterThreadQueryPrefix: {
    string: true,
    desc: 'Twitter query to find posts to reply to',
  },
  postPersistCmd: {
    string: true,
    desc: 'Command to run after peristing data',
  },
  ignoreSatellites: {
    boolean: true,
    desc: 'Ignores AFM satellite data',
  },
  unitsSocialPath: {
    string: true,
    desc: 'Path to fire units social media info',
  },
  unitsIdPath: {
    string: true,
    desc: 'Path to fire units ID info',
  },
  retweetMinAcres: {
    number: true,
    default: 100,
    desc: 'Minimum acreage to retweet',
  },
  retweetSelector: {
    string: true,
    default: 'general',
    desc: 'Account selector to use for retweeting',
  },
};

exports.handler = (argv) => {
  logger.info('Arguments %o', argv, {arguments: argv});

  const FairSemaphore = require('fair-semaphore');
  const processingSemaphore = new FairSemaphore(1);

  const intensiveProcessingSemaphore = util.namedSemaphore(processingSemaphore, 'computation');

  files.setupDirs(argv.outputdir, argv.clean);

  server.run(argv.port, argv.outputdir);


  const processFire = function(e, proj) {
    const entry = e.attributes;
    const ret = {};
    const to = proj4(proj, 'EPSG:4326', [e.geometry.x, e.geometry.y]);
    ret.Lon = to[0];
    ret.Lat = to[1];
    for (const key in entry) {
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
    ret.ModifiedOnDateTime_Raw = ret.ModifiedOnDateTime;
    ret.ModifiedOnDateTimeEpoch_Raw = ret.ModifiedOnDateTimeEpoch;

    if (ret.ICS209ReportDateTime) {
      ret.ModifiedOnDateTime = ret.ICS209ReportDateTime;
      ret.ModifiedOnDateTimeEpoch = ret.ICS209ReportDateTimeEpoch;
    }

    ret.Hashtag = util.fireHashTag(ret.Name);
    return ret;
  };


  const dataOptions = {
    uri: 'https://maps.nwcg.gov/sa/publicData.json',
    qs: {
    },
    headers: {
      'User-Agent': 'Request-Promise; ' + argv.userAgent,
    },
    json: true,
  };


  const config = {
    twitterName: envconfig.twitterAuth.name,
    sourceUrl: dataOptions.uri,
    disclaimerUrl: envconfig.ui.disclaimer_url,
    systemName: envconfig.ui.system_url,
  };


  const htmlTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateRender.pug'));
  const genHtml = function(entry) {
    return htmlTemplate({config: config, data: entry, curdir: process.cwd()});
  };

  const perimeterTemplate = pug.compileFile(path.join(__dirname, '../templates/detailsRender.pug'));
  const perimeterHtml = function(entry) {
    return perimeterTemplate({config: config, data: entry, curdir: process.cwd()});
  };


  const tweetTemplate = pug.compileFile(path.join(__dirname, '../templates/fireUpdateTweet.pug'));

  const genTweet = function(entry) {
    return tweetTemplate({config: config, data: entry, curdir: process.cwd()});
  };

  if (argv.twitter) {
    const t = require('../lib/twitter');
    t.launchDaemon(argv.outputdir + '/postqueue/',
        util.namedSemaphore(processingSemaphore, 'twitter'),
        argv.twitterAuthPath,
        argv.twitterAccountsPath,
        argv.twitterPeriodSec * 1000,
        argv.logTweets
    );
  }

  const periodSeq = argv.debug ? 5 : 65;


  const dailyMap = (() => {
    return async function() {
      // Nothing yet.
      return;
    };
  })();

  async function internalLoop(first, last) {
    const prov = util.createProvenance(dataOptions);
    const layers = await rp(dataOptions);

    const x = Object.assign({}, last);

    const dataSetName = 'Active Incidents';

    const dataSet = _.find(layers, (p) => p.name === dataSetName);

    const requiredLayerNames = ['Large WF'];
    if (argv.emergingNew) {
      requiredLayerNames.unshift('Emerging WF < 24 hours');
    }
    if (argv.emergingOld) {
      requiredLayerNames.unshift('Emerging WF > 24 hours');
    }

    const filteredLayers = dataSet.layerConfigs.filter((f) => requiredLayerNames.includes(f.featureCollection.layerDefinition.name));
    const layerFeatures = filteredLayers.map((x) => {
      return x.featureCollection.featureSet.features.map((y) => {
        const r = processFire(y, 'EPSG:'+ x.featureCollection.featureSet.spatialReference.latestWkid);
        r.NFSAType = x.featureCollection.layerDefinition.name;
        return r;
      });
    });

    const data0 = _.flatten(layerFeatures);
    const data = data0.map((e) => Object.assign(e, {_Provenance: _.cloneDeep(prov)}));
    const nfsaData = _.keyBy(data, (o) => o.UniqueFireIdentifier);
    const gm = await geomac.getFires(argv.userAgent);

    const keys = _.union(_.keys(nfsaData), _.keys(gm));
    keys.map((key) => {
      const merged = util.mergedNfsaGeomacFire(nfsaData[key], gm[key]);
      x[key] = merged;
      if (!merged) {
        logger.warn('Missing ' + key);
      }
    });

    const curTime = new Date().getTime();
    const pruneTime = curTime - 1000 * 60 * 60 * 24 * argv.pruneDays;

    const globalUpdateId = 'Update-at-' + dateString(curTime);
    {
      logger.info('Saving ' + globalUpdateId);
      const diffGlobal = deepDiff(last, x) || [];
      const diffsGlobal = yaml.safeDump(diffGlobal, {skipInvalid: true});
      fs.writeFileSync(argv.outputdir + '/data/GLOBAL-DIFF-' + globalUpdateId + '.yaml', diffsGlobal);
    }

    const perims1 = await geomac.getPerimeters(argv.userAgent, false);
    const perims2 = await geomac.getPerimeters(argv.userAgent, true);
    const perims = {};
    const perimKeys = _.union(_.keys(perims1), _.keys(perims2));
    perimKeys.map((key) => {
      const merged = util.latestPerimeter(perims1[key], perims2[key]);
      perims[key] = merged;
      if (!merged) {
        logger.warn('Missing perim ' + key);
      }
    });

    const xkeys = _.keys(x);
    const xsortedKeys = _.sortBy(xkeys, (i) => -x[i].DailyAcres);

    for (const key1 of xsortedKeys) {
      try { // NOPMD
        logger.debug(' #[ Start Processing key %s', key1);
        const key = key1;

        let {i, cur, perimDateTime, old, inciWeb, perim} = preDiffFireProcess(key, x, last, perims);

        if (first) {
          continue;
        }


        if (i in last && last[i].ModifiedOnDateTime >= cur.ModifiedOnDateTime) {
          logger.debug('  -) Previous record not updated old %o new %o', last[i].ModifiedOnDateTime, cur.ModifiedOnDateTime, {
            x: x[i],
            last: last[i],
            cur: cur,
          });
          // Keep the newer data around.
          x[i] = Object.assign({}, last[i]);
          x[i].PerimDateTime = perimDateTime;
          x[i].PerimeterData = cur.PerimeterData;
          cur = x[i];

          // Only skip the update if perimeter is ALSO not up to date.
          if (!perimDateTime || (last[i].PerimDateTime && last[i].PerimDateTime >= perimDateTime)) {
            logger.debug('  -) Previous perim not updated old %o new %o', last[i].PerimDateTime, perimDateTime, {
              x: x[i],
              last: last[i],
              cur: cur,
            });
            x[i].PerimDateTime = last[i].PerimDateTime;
            x[i].PerimeterData = last[i].PerimeterData;
            continue;
          }
        }

        if (!cur.ModifiedOnDateTimeEpoch || cur.ModifiedOnDateTimeEpoch < pruneTime) {
          logger.debug(' #! Pruning %s %s -> last mod %s', i, cur.Name, cur.ModifiedOnDateTime);
          delete x[i];
          continue;
        }

        let oneDiff = deepDiff(old, cur);
        oneDiff = _.keyBy(oneDiff, (o) => o.path.join('.'));

        if (!('DailyAcres' in oneDiff || 'PercentContained' in oneDiff || 'PerimeterData.Acres' in oneDiff)) {
          if (!argv.monitorPerims || !('PerimDateTime' in oneDiff)) {
            // Unless acreage, perim, or containment change, we don't report it.x
            logger.info('     -) No perim date diff or not monitored %o', perimDateTime, {diff: oneDiff});
            continue;
          }
          // Only show perimeters changed after the filter.
          if (!perimDateTime || perimDateTime <= argv.perimAfter) {
            logger.info('    -) No perim date or old %o diff %o', perimDateTime, {diff: oneDiff});
            continue;
          }
        }
        if (!('PercentContained' in oneDiff || 'PerimeterData.Acres' in oneDiff) && old.DailyAcres && cur.DailyAcres && Math.abs(cur.DailyAcres - old.DailyAcres) < 1.1) {
          // May be spurious - due to rounding in GEOMAC vs NFSA.
          logger.info('    -) Insufficient acreage change old %o cur %o', old.DailyAcres, cur.DailyAcres, {diff: oneDiff});
          continue;
        }

        const updateId = 'Update-' + cur.ModifiedOnDateTime + '-PER-' + (cur.PerimDateTime || 'NONE') + '-of-' + i + '-named-' + cur.Name.replace(/[^a-z0-9]/gi, '');

        const diffs = yaml.safeDump(oneDiff, {skipInvalid: true});
        const isNew = !(i in last);

        logger.debug('    - Material update.', {diff: oneDiff});
        const diffPath = argv.outputdir + '/data/DIFF-' + updateId + '.yaml';

        if (fs.existsSync(diffPath)) {
          logger.error('    $$$$ ANOMALY DETECTED - REPEATING UPDATE %s - SKIPPED', updateId);
          fs.writeFileSync(argv.outputdir + '/data/ANOMALY-DIFF-' + updateId + '.' + globalUpdateId + '-INSTANT-' + new Date().toISOString() + '.yaml', diffs);
          continue;
        }

        fs.writeFileSync(diffPath, diffs);
        if (argv.realFireNames) {
          cur.Hashtag = util.fireName(cur.Name);
        }

        await promisify(intensiveProcessingSemaphore.take).bind(intensiveProcessingSemaphore)();
        try {
          logger.info(' [# Entering internalProcessFire ' + updateId);
          await internalProcessFire(logger, updateId, inciWeb, cur, perim, old, oneDiff, isNew, key, perimDateTime);
        } catch (err) {
          logger.error('    $$$$ ERROR processing %s', updateId);
          logger.error(err);
        } finally {
          intensiveProcessingSemaphore.leave();
          logger.info(' ]# Exiting internalProcessFire ' + updateId);
        }
      } finally {
        logger.debug(' ]# End Processing key %s', key1);
      }
    }

    fs.writeFileSync(argv.db, yaml.safeDump(x, {skipInvalid: true}));

    if (argv.postPersistCmd) {
      try {
        await exec(argv.postPersistCmd);
      } catch (err) {
        logger.error('### Error in post persist command: ');
        logger.error(err);
      }
    }

    if (argv.once) {
      process.exit();
      while (true) { }
    }

    return x;

    async function internalProcessFire(parentLogger, updateId, inciWeb, cur, perim, old, oneDiff, isNew, key, perimDateTime) {
      const logger = parentLogger.child({labels: {updateId: updateId}});
      const infoImg = argv.outputdir + '/img/IMG-TWEET-' + updateId + '.png';
      const mainWebpage = argv.outputdir + '/img/WEB-INFO-' + updateId + '.html';
      const perimImg = argv.outputdir + '/img/IMG-PERIM-' + updateId + '.jpeg';
      const perimWebpage = argv.outputdir + '/img/WEB-PERIM-' + updateId + '.html';
      const mainWebpageUrl = 'http://localhost:8080/updates/img/WEB-INFO-' + updateId + '.html';
      const perimWebpageUrl = 'http://localhost:8080/updates/img/WEB-PERIM-' + updateId + '.html';
      if (inciWeb && argv.archiveInciweb) {
        const u = 'https://web.archive.org/save/https://inciweb.nwcg.gov/incident/' + inciWeb + '/';
        rp({uri: u, resolveWithFullResponse: true}).then((r) => {
          logger.info('   ~~ Archived to web.archive.org: %s', r.headers ? ('https://web.archive.org/' + r.headers['content-location']) : 'unknown');
        }).catch((err) => {
          logger.info('   ~~ ERROR Archiving to web.archive.org: ' + u);
          logger.info(err);
        });
      }
      let rr = null;
      if (perim.length > 1 && argv.locations) {
        rr = await maprender.getMapBounds(perim, 1450 / 2, 1200 / 2, 15);
      } else {
        logger.info('     >> Missing perimeter - %s', updateId);
      }
      const events = [{lon: cur.Lon, lat: cur.Lat}];
      const center = rr ? rr.center : [cur.Lon, cur.Lat];
      const zoom = rr ? rr.zoom : 12;
      const terrainPath = perim.length > 0 ? null : '/dev/null';

      const lat = center ? center[1] : cur.Lat;
      const lon = center ? center[0] : cur.Lon;
      // MultiPolygon -> Coordinates
      const points = _.flattenDepth(perim, 2);
      const useful = 100 + Math.sqrt(0.0015625 /* mi2 per acre*/ * cur.DailyAcres);
      const cities2 = lat ? _.sortBy(geocoding.nearestCities(lat, lon, 1000, 500)
          .map((x) => {
            if (x.distance < useful) {
              x.useful = true;
              const pointDists = points.map((pp) => geocoding.distance(pp[0], pp[1], x.lon, x.lat));
              const minPointIndex = _.minBy(_.range(0, points.length), (idx) => pointDists[idx]);
              const thePoint = points[minPointIndex];
              x.distance = pointDists[minPointIndex];
              x.bearing = geocoding.bearing(x.lon, x.lat, thePoint[0], thePoint[1]);
              x.displayName = geocoding.cityDisplayName(x);
              x.directions = geocoding.friendlyDistance(x.distance, 'mi', geocoding.compass(x.bearing), x.displayName);
              x.weightedPopulation = x.distance < 20 ? x.population : (x.distance < 50 ? 0.5 * x.population : (x.distance < 75 ? 0.01 * x.population : (x.distance < 100 ? 0.001 * x.population : 0)));
            } else {
              x.useful = false;
              x.weightedPopulation = 0;
            }
            return x;
          }), (x) => x.distance) : [];


      const cities = _.sortBy(cities2, (x) => x.distance);

      const nearPopulation = Math.round(cities.reduce((a, b) => a + b.weightedPopulation, 0));
      const allPopulation = cities.reduce((a, b) => a + b.population, 0);
      logger.info('     > Fire %s is near pop. %d (all %d), %d acres, %d staff', updateId, nearPopulation, allPopulation, cur.DailyAcres, cur.TotalIncidentPersonnel, {
        updateId: updateId,
        nearPopulation: nearPopulation,
        allPopulation: allPopulation,
        DailyAcres: cur.DailyAcres,
        TotalIncidentPersonnel: cur.TotalIncidentPersonnel,
      });


      const displayFilters = {
        InAlaska: cur.state === 'AK' || cur.State === 'AK' || (_.first(cities) || {}).adminCode === 'AK',
        InHawaii: cur.state === 'HI' || cur.State === 'HI' || (_.first(cities) || {}).adminCode === 'HI',
        KnownLocationLowPop: lat && lon && nearPopulation <= 1000,
        UnknownLocationSmallSize: !lat && !lon && (cur.DailyAcres || 0) < 1.1 && (cur.TotalIncidentPersonnel || 0) < 15,
        FalseAlarmType: cur.IncidentTypeCategory === 'FA' || cur.incidenttypecategory === 'FA',
        FalseAlarmName: cur.Fire_Name.toLowerCase().substr(0, 3) === 'fa ' || (cur.Fire_Name.toLowerCase().includes('false') && cur.Fire_Name.toLowerCase().includes('alarm')),
        StepUpName: (cur.Fire_Name.toLowerCase().includes('step-up') || cur.Fire_Name.toLowerCase().includes('step up') || cur.Fire_Name.toLowerCase().includes('stepup')),
        // 3 hours with no info, might be stale
        OldEmergingFiresWithoutInfo: (cur.NFSAType || '').includes('Emerging') && !cur.DailyAcres && !cur.PercentContained && (cur.ModifiedOnDateTimeEpoch - cur.FireDiscoveryDateTimeEpoch > 1000 * 60 * 60 * 3),
        LACNoData: !cur.DailyAcres && !cur.PercentContained && cur.Fire_Name.toLowerCase().substr(0, 4) === 'lac-',
      };

      for (const filterKey in displayFilters) {
        if (displayFilters[filterKey]) {
          logger.info('     >) Skipping %s -> filter %s', updateId, filterKey);
          return;
        }
      }

      // This will go through. Make sure we don't put an old update on Twitter in the mean time.
      const delPaths = await del([argv.outputdir + '/postqueue/*-' + cur.UniqueFireIdentifier + '-*.yaml']);
      if (delPaths.length > 0) {
        logger.info('     > Old tweets deleted: %s', delPaths.join('; '));
      }

      const byPop = _.sortBy(cities, 'population');
      const displayCities = {
        closest: _.first(cities.filter((x) => x.useful)),
        biggest: _.last(byPop.filter((x) => x.useful)),
        all: {closest: cities, biggest: _.reverse(byPop)},
      };
      if (displayCities.closest === displayCities.biggest) {
        displayCities.biggest = null;
      }

      const extraTags = [cur.unitMention].filter((x) => (x && (x.startsWith('#') || x.startsWith('@')))).join(' ');

      const terrainImg = terrainPath || null;

      // QRCode to trace source.
      const qrcode = os.hostname() + '.' + updateId;

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
        mapData: {
          events: events,
          qrcode: qrcode,
        },
        terrainImg: terrainImg,
      };
      const html = genHtml(templateData);
      const tweet = genTweet(templateData);
      fs.writeFileSync(argv.outputdir + '/tweets/TWEET-' + updateId + '.txt', tweet);
      fs.writeFileSync(mainWebpage, html);

      await renderUpdateImage();
      await perimAndSaveProcess();


      async function perimAndSaveProcess() {
        const detailImg = (lat && lon) || (perim.length > 0 && !(perim.length === 1 && perim[0].length === 1 && perim[0][0].length === 2));
        let detailRender = null;
        if (detailImg) {
          const perimTemplateData = {
            lat: lat,
            lon: lon,
            zoom: zoom,
            cities: displayCities,
            mapData: {
              events: events,
              perimSourceLayer: cur.PerimeterData ? (cur.PerimeterData._Provenance ? cur.PerimeterData._Provenance.SourceLayer : null) : null,
              qrcode: qrcode,
            },
            perimDateTime: perimDateTime,
            current: cur,
            last: old,
            diff: oneDiff,
            isNew: isNew,
            img: detailImg,
          };
          const htmlPerim = perimeterHtml(perimTemplateData);
          fs.writeFileSync(perimWebpage, htmlPerim);

          await renderPerim();
          detailRender = perimImg;
        }

        // Tweet out in population and acre order.
        const invPrio = Math.log10(cur.DailyAcres) * 1000 + nearPopulation;
        const priority = numeral(Math.round(100000000000 - invPrio)).format('0000000000000');

        let retweetSelectors = [];
        if (argv.retweetSelector && cur.DailyAcres >= argv.retweetMinAcres) {
          retweetSelectors = [argv.retweetSelector];
        }

        const usePerimAcres = cur.PerimDateTime && (cur.PerimDateTime > cur.ModifiedOnDateTime) && cur.PerimeterData.Acres && cur.PerimeterData.Acres > (cur.DailyAcres || 0);

        const imgSummary = {
          img: infoImg,
          altText: cur.UniqueFireIdentifier + ' - ' + tweet,
        };

        const imgPerim = {
          img: detailRender,
          altText: cur.UniqueFireIdentifier + ' - Perimeter map',
        };

        const imgsSaved = usePerimAcres ? [imgPerim, imgSummary] : [imgSummary, imgPerim];

        const saved = {
          text: tweet,
          shortText: cur.UniqueFireIdentifier + ' - Unofficial fire report. See officials for safety info. May be incorrect; disclaimers in images.',
          image1AltText: imgsSaved[0].altText,
          image1: imgsSaved[0].img,
          image2AltText: imgsSaved[1].altText,
          image2: imgsSaved[1].img,
          selectors: [cur.state || cur.State || key.substr(5, 2), 'other'],
          retweetSelectors: retweetSelectors,
          threadQuery: argv.twitterThreadQueryPrefix ? (argv.twitterThreadQueryPrefix + ' ' + cur.Hashtag) : null,
        };
        if (center) {
          saved.coords = {lat: lat, lon: lon};
        }
        // Tell the twitter daemon we are ready to post.
        const savedYaml = yaml.safeDump(saved, {skipInvalid: true});
        fs.writeFileSync(argv.outputdir + '/postqueue/' + priority + '-TWEET-' + updateId + '.yaml', savedYaml);
      }

      async function renderPerim() {
        return render.renderInBrowser(2232, 1450, perimWebpageUrl, perimImg);
      }

      async function renderUpdateImage() {
        return render.renderInBrowser(2048, 1330, mainWebpageUrl, infoImg);
      }
    }
  }


  function preDiffFireProcess(key, x, last, perims) {
    const i = key;
    const cur = x[i];
    const old = last[i] || {};
    let perimAcres = null;
    let perim = [];
    let perimDateTime = null;
    let inciWeb = null;
    let perimProvenance = null;
    if (cur.UniqueFireIdentifier in perims) {
      const p = perims[cur.UniqueFireIdentifier];
      perim = p.geometry.coords || [];
      perimDateTime = p.attributes.perimeterdatetime;
      inciWeb = p.attributes.inciwebid;
      perimAcres = p.attributes.gisacres;
      perimProvenance = p._Provenance;
    }
    const children = _.values(perims)
        .filter((p) => {
          const b = (p.attributes.complexname || '').toLowerCase() === (cur.Fire_Name || '').toLowerCase();
          if (b) {
            if (!perimDateTime || perimDateTime < p.attributes.perimeterdatetime) {
              perimDateTime = p.attributes.perimeterdatetime;
              inciWeb = p.attributes.inciwebid;
            }
          }
          return b;
        })
        .map((p) => p.geometry.coords)
        .reduce((a, b) => a.concat(b), []);
    perim = perim.concat(children);
    if (cur.Lat) {
      perim.push([[[cur.Lon, cur.Lat], [cur.Lon, cur.Lat]]]);
    }
    // TODO: Migrate to PerimeterData.
    cur.PerimDateTime = perimDateTime;
    cur.PerimeterData = {
      DateTime: perimDateTime,
      Acres: perimAcres,
      _Provenance: perimProvenance,
    };
    cur.unitId = cur.pooresponsibleunit || cur.UniqueFireIdentifier.split('-')[1];
    cur.unitMention = units.unitTag(cur.unitId);
    return {i, cur, perimDateTime, old, inciWeb, perim};
  }

  const mainLoop = function(first, last) {
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
          logger.error('>> Main loop error');
          logger.error(err);
        } finally {
        }

        logger.info('Next round');
      }
      setTimeout(function() {
        mainLoop(false, x);
      }, 1000 * periodSeq * 1);
    })();
  };

  let persist = undefined;
  if (fs.existsSync(argv.db)) {
    persist = yaml.safeLoad(fs.readFileSync(argv.db));
    if (argv.redo) {
      argv.redo.split(',').map((x) => {
        delete persist[x]; return 0;
      });
    }
  }


  logger.warn(`*** The fire information displayed by this app is UNOFFICIAL, FOR INFORMATION ONLY, 
  NOT SUITABLE FOR SAFETY/EMERGENCY PURPOSES, 
  and MAY BE INCORRECT OR OUT-OF-DATE. USE AT YOUR OWN RISK. ***`);

  setImmediate(function() {
    mainLoop(persist ? false : true, persist ? persist : {});
  });
};


