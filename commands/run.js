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
const rp = require('request-promise');
const _ = require('lodash');
const yaml = require('js-yaml');
const pug = require('pug');
const fs = require('fs');
const del = require('del');
const os = require('os');
const deepDiff = require('deep-diff');
const numeral = require('numeral');
const assert = require('assert').strict;
const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const {globalStats, MeasureUnit} = require('@opencensus/core');
const crypto = require('crypto');

const envconfig = require('../envconfig');
const logging = require('../lib/logging');
const monitoring = require('../lib/monitoring');
const logger = logging.child({labels: {system: 'run'}});
const util = require('../lib/util');
const afm = require('../lib/afm');
const dateString = util.dateString;
const maprender = require('../lib/maprender');
const render = require('../lib/render');
const geocoding = require('../lib/geocoding');
const geomac = require('../lib/geomac');
const calfire = require('../lib/calfire');
const nfsa = require('../lib/nfsa');
const server = require('../lib/server');
const files = require('../lib/files');
const units = require('../lib/units');

// Metrics
const monNumLoopsStarted = globalStats.createMeasureInt64('loops_started', MeasureUnit.UNIT, 'The number of main loops started');
const monNumLoopsFinished = globalStats.createMeasureInt64('loops_finished', MeasureUnit.UNIT, 'The number of main loops finished (error or success)');
const monNumLoopsErrored = globalStats.createMeasureInt64('loops_errored', MeasureUnit.UNIT, 'The number of main loops errored');
const monNumLoopsSucceeded = globalStats.createMeasureInt64('loops_success', MeasureUnit.UNIT, 'The number of main loops succeeded');
const monLoopLatencySec = globalStats.createMeasureDouble('loop_latency', MeasureUnit.SEC, 'The loop latency in seconds');

const monNumFiresProcessed = globalStats.createMeasureInt64('fires_processed', MeasureUnit.UNIT, 'The number of fires processed');
const monNumFireMaterialUpdatesProcessed = globalStats.createMeasureInt64('fire_material_updates', MeasureUnit.UNIT, 'The number of fire material updates');
const monFireMaterialUpdateProcessLatencySec = globalStats.createMeasureDouble('fire_material_update_latency', MeasureUnit.SEC, 'The latency of a material update');

monitoring.monitorDist('run', monLoopLatencySec,
    [0, 1, 2, 4, 8, 16, 16 * 2, 16 * 3, 16 * 4, 32 * 3, 32 * 4, 32 * 5, 32 * 6, 32 * 7, 32 * 8, 64 * 5, 64 * 6, 64 * 7, 64 * 8]
);
monitoring.monitorLast('run', monLoopLatencySec);
monitoring.monitorSum('run', monLoopLatencySec);

monitoring.monitorDist('run', monFireMaterialUpdateProcessLatencySec,
    [0, 1, 2, 4, 8, 16, 16 * 2, 16 * 3, 16 * 4, 32 * 3, 32 * 4, 32 * 5, 32 * 6, 32 * 7, 32 * 8, 64 * 5, 64 * 6, 64 * 7, 64 * 8]
);
monitoring.monitorLast('run', monFireMaterialUpdateProcessLatencySec);
monitoring.monitorSum('run', monFireMaterialUpdateProcessLatencySec);

monitoring.monitorSum('run', monNumLoopsStarted);
monitoring.monitorSum('run', monNumLoopsFinished);
monitoring.monitorSum('run', monNumLoopsErrored);
monitoring.monitorSum('run', monNumLoopsSucceeded);

monitoring.monitorSum('run', monNumFireMaterialUpdatesProcessed);
monitoring.monitorSum('run', monNumFiresProcessed);

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
  forceUpdate: {
    boolean: true,
    desc: 'Forces an update even if there is no existing DB',
  },
  failOnError: {
    boolean: true,
    desc: 'Forces process to exit on any major error',
  },
  maxUpdatesPerLoop: {
    number: true,
    default: 0,
    desc: 'Max number of real updates per main loop.',
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
  skipUpdatesOlderThanHours: {
    number: true,
    default: 6,
    desc: 'Updates older than this hours are skipped for display',
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
  embargoSec: {
    number: true,
    default: 60 * 10,
    desc: 'Seconds to wait to post a new tweet (if updated data is found in the interim, the older tweet may be deleted)',
  },
  mergeDistanceMaxMiles: {
    number: true,
    default: 5.0,
    desc: 'Max miles to merge fires with same name from multiple sources',
  },
  pruneDays: {
    number: true,
    default: 2,
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
  ingestCalfire: {
    boolean: true,
    default: true,
    desc: 'Whether to ingest CAL FIRE incidents',
  },
  qrcodePrefix: {
    string: true,
    desc: 'Prefix to hash qrcodes',
  },
  showSourceLinks: {
    boolean: true,
    default: true,
    desc: 'Whether to show source URLs in tweets',
  },
  htmlSnapshots: {
    boolean: true,
    default: false,
    desc: 'Whether to generate a webpage snapshot of all the posts in one loop',
  },
};

exports.handler = (argv) => {
  logger.info('Arguments %o', argv, {arguments: argv});

  const FairSemaphore = require('fair-semaphore');
  const processingSemaphore = new FairSemaphore(1);

  const intensiveProcessingSemaphore = util.namedSemaphore(processingSemaphore, 'computation');

  files.setupDirs(argv.outputdir, argv.clean);

  server.run(argv.port, argv.outputdir);

  const config = {
    twitterName: envconfig.twitterAuth.name,
    disclaimerUrl: envconfig.ui.disclaimer_url,
    systemName: envconfig.ui.system_url,
  };


  const htmlTemplate = pug.compileFile(path.join(__dirname, '../templates/render-overview.pug'));
  const genHtml = function(entry) {
    return htmlTemplate({config: config, data: entry, curdir: process.cwd()});
  };

  const snapHtmlTemplate = pug.compileFile(path.join(__dirname, '../templates/util/snap.pug'));
  const genSnapHtml = function(entry) {
    return snapHtmlTemplate({config: config, data: entry, curdir: process.cwd()});
  };

  const perimeterTemplate = pug.compileFile(path.join(__dirname, '../templates/render-details.pug'));
  const perimeterHtml = function(entry) {
    return perimeterTemplate({config: config, data: entry, curdir: process.cwd()});
  };


  const tweetTemplate = pug.compileFile(path.join(__dirname, '../templates/tweet-update.pug'));

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

  let snapId = 0;

  async function internalLoop(isFirstRun, previousDb) {
    const currentDb = _.cloneDeep(previousDb);

    const async = {
      nfsaIncidents: nfsa.getFires(argv.userAgent, argv.emergingNew, argv.emergingOld),
      geomacIncidents: geomac.getFires(argv.userAgent),
      calfireIncidents: argv.ingestCalfire ? calfire.getFires(argv.userAgent) : {},
    };

    const nfsaIncidents = await async.nfsaIncidents;
    const geomacIncidents = await async.geomacIncidents;
    const calfireIncidents = await async.calfireIncidents;

    mergeNfsaAndGeomacIncidentsIntoDb(nfsaIncidents, geomacIncidents, currentDb);
    mergeCalfireIncidentsIntoDb(calfireIncidents, currentDb, argv.mergeDistanceMaxMiles);
    mergeDupeFires(currentDb, argv.mergeDistanceMaxMiles);

    const curTime = new Date().getTime();
    const pruneTime = curTime - 1000 * 60 * 60 * 24 * argv.pruneDays;
    const skipOldTime = curTime - 1000 * 60 * 60 * argv.skipUpdatesOlderThanHours;
    const skipOldTimeISO = new Date(skipOldTime).toISOString();

    const globalUpdateId = 'Update-at-' + dateString(curTime);
    logger.info('Updating ' + globalUpdateId);
    const diffGlobal = deepDiff(previousDb, currentDb) || [];
    const diffsGlobal = yaml.safeDump(diffGlobal, {skipInvalid: true});
    fs.writeFileSync(argv.outputdir + '/data/GLOBAL-DIFF-' + globalUpdateId + '.yaml', diffsGlobal);

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

    const currentDbKeys = _.keys(currentDb);
    const currentDbKeysSorted = _.sortBy(currentDbKeys, (i) => -currentDb[i].DailyAcres);
    // Human summaries
    const updates = [];
    const updateNames = [];

    const oldDbKeys = _.keys(previousDb);

    let numProcessed = 0;
    const processedEntries = [];
    fireLoop: for (const key1 of currentDbKeysSorted) {
      if (argv.maxUpdatesPerLoop && numProcessed >= argv.maxUpdatesPerLoop) {
        continue;
      }
      logger.debug(' #[ Start Processing key %s', key1);
      const start = process.hrtime();
      try { // NOPMD
        let i = key1;

        // cur is a *reference* to currentDb[i]
        let {cur, perimDateTime, inciWeb, perim} = preDiffFireProcess(i, currentDb, previousDb, perims);
        if (isFirstRun) {
          continue;
        }

        const oldMatchingKeys = _.intersection(oldDbKeys, cur._CorrelationIds);
        let old = {};
        for (const oldKey of oldMatchingKeys) {
          if (!old || !old.ModifiedOnDateTime || old.ModifiedOnDateTime < previousDb[oldKey].ModifiedOnDateTime) {
            old = _.cloneDeep(previousDb[oldKey]);
            if (old.ModifiedOnDateTime >= cur.ModifiedOnDateTime) {
              logger.debug('  -) Previous record id %s (cur id %s) not updated old %o new %o', oldKey, i, old.ModifiedOnDateTime, cur.ModifiedOnDateTime, {
                x: currentDb[i],
                last: old,
                cur: cur,
              });
              // Keep the newer data around.
              const curPerimData = _.cloneDeep(cur.PerimeterData);
              const curCorrelates = _.union(cur._CorrelationIds, old._CorrelationIds);
              if (i !== oldKey) {
                delete currentDb[i];
                i = oldKey;
              }
              currentDb[i] = _.cloneDeep(old);
              // Except perimeters, which still need to be checked.
              currentDb[i].PerimDateTime = perimDateTime;
              currentDb[i].PerimeterData = curPerimData;
              assert.equal(currentDb[i].UniqueFireIdentifier, i);
              currentDb[i]._CorrelationIds = curCorrelates;
              // cur is a *reference* to x[i]
              cur = currentDb[i];

              // Only skip the update if perimeter is ALSO not up to date.
              if (!perimDateTime || (old.PerimDateTime && old.PerimDateTime >= perimDateTime)) {
                logger.debug('  -) Previous perim ALSO not updated old %o new %o', old.PerimDateTime, perimDateTime, {
                  x: currentDb[i],
                  last: old,
                  cur: cur,
                });
                currentDb[i].PerimDateTime = old.PerimDateTime;
                currentDb[i].PerimeterData = _.cloneDeep(old.PerimeterData);
                continue fireLoop;
              }
            }
          }
        }

        const updateId = 'UPD-' + cur.ModifiedOnDateTime + '-PER-' + (cur.PerimDateTime || 'none') + '-ID-' + i + '-NAME-' + cur.Name.replace(/[^a-z0-9]/gi, '') + '-S-' + cur.Source.charAt(0);
        const uniqueUpdateId = (process.env.FAKE_HOSTNAME || os.hostname()) + '.' + updateId;
        // QRCode to find commits easily.
        const hash = crypto.createHash('sha256');
        hash.update(uniqueUpdateId);
        const code = hash.digest('hex');
        const qrcode = (argv.qrcodePrefix || '') + code;
        const updateSummary =
          `🔥 ${cur.Final_Fire_Name} (${i}) ${cur.Hashtag}
           🕒 ${cur.ModifiedOnDateTime}
           ⏰ Perim ${cur.PerimDateTime || 'none'}
           ℹ️ ${cur.Source}
           🆔 ${updateId}
           🔑 ${code}`;
        cur._Update = {UpdateId: updateId, Code: code};

        if (!cur.ModifiedOnDateTimeEpoch || cur.ModifiedOnDateTimeEpoch < pruneTime) {
          logger.debug(' #! Pruning %s %s -> last mod %s', i, cur.Name, cur.ModifiedOnDateTime, {cur: cur, x: currentDb[i]});
          if (!_.isEmpty(_.intersection(oldDbKeys, cur._CorrelationIds))) {
            updates.push('🗑️' + updateSummary);
          }
          delete currentDb[i];
          continue;
        }

        let oneDiff = deepDiff(old, cur);
        oneDiff = _.keyBy(oneDiff, (o) => o.path.join('.'));

        if (!('DailyAcres' in oneDiff || 'PercentContained' in oneDiff || 'PerimeterData.Acres' in oneDiff)) {
          if (!argv.monitorPerims || !('PerimDateTime' in oneDiff)) {
            // Unless acreage, perim, or containment change, we don't report it.x
            logger.info('     -) No perim date diff or not monitored %s %o', updateId, perimDateTime, {diff: oneDiff, updateId: updateId});
            updates.push('⏭️a' + updateSummary);
            continue;
          }
          // Only show perimeters changed after the filter.
          if (!perimDateTime || perimDateTime <= argv.perimAfter) {
            logger.info('    -) No perim date or old %s %o diff %o', updateId, perimDateTime, {diff: oneDiff, updateId: updateId});
            updates.push('⏭️b' + updateSummary);
            continue;
          }
        }

        if (!('PercentContained' in oneDiff || 'PerimeterData.Acres' in oneDiff) && old.DailyAcres && cur.DailyAcres && Math.abs(cur.DailyAcres - old.DailyAcres) < 1.1) {
          // May be spurious - due to rounding in GEOMAC vs NFSA.
          logger.info('    -) Insufficient acreage change old %s %o cur %o', updateId, old.DailyAcres, cur.DailyAcres, {diff: oneDiff, updateId: updateId});
          updates.push('⏭️c' + updateSummary);
          continue;
        }

        if (cur.ModifiedOnDateTime < skipOldTimeISO && (!perimDateTime || perimDateTime < skipOldTimeISO)) {
          logger.info('    -) Update too old %s MOD %o PERIM %o', updateId, cur.ModifiedOnDateTime, perimDateTime);
          updates.push('⏭️⏰' + updateSummary);
          continue;
        }

        const diffs = yaml.safeDump(oneDiff, {skipInvalid: true});
        const isNew = !(i in previousDb);

        logger.debug('    - Material update.', {diff: oneDiff});

        const diffPath = argv.outputdir + '/data/DIFF-' + updateId + '.yaml';

        if (fs.existsSync(diffPath)) {
          logger.error('    $$$$ ANOMALY DETECTED - REPEATING UPDATE %s - SKIPPED', updateId, {
            updateId: updateId,
            diffs: diffs,
          });
          updates.push('⚠️ ANOMALY ' + updateSummary + '\n   UUID: ' + uniqueUpdateId);
          fs.writeFileSync(argv.outputdir + '/data/ANOMALY-DIFF-' + updateId + '.' + globalUpdateId + '-INSTANT-' + new Date().toISOString() + '.yaml', diffs);
          continue;
        }

        fs.writeFileSync(diffPath, diffs);
        if (argv.realFireNames) {
          cur.Hashtag = util.fireName(cur.Name);
        }

        await promisify(intensiveProcessingSemaphore.take).bind(intensiveProcessingSemaphore)();
        let didProcess = false;
        let didError = false;
        logger.info(' [# Entering internalProcessFire ' + updateId, {updateId: updateId});
        logger.info('   ' + updateSummary, {updateId: updateId});
        try {
          const processedEntry = await internalProcessFire(logger, updateId, inciWeb, cur, perim, old, oneDiff, isNew, i, perimDateTime, uniqueUpdateId, qrcode);
          if (processedEntry) {
            didProcess = true;
            processedEntries.push(processedEntry);
          }
        } catch (err) {
          didError = true;
          logger.error('    $$$$ ERROR processing %s', updateId, {updateId: updateId});
          logger.error(err);
          if (argv.failOnError) {
            process.exit(13);
          }
        } finally {
          intensiveProcessingSemaphore.leave();

          updates.push((didProcess ? '📣' : (didError ? '🚫' : '🔇')) + updateSummary + '\n   UUID: ' + uniqueUpdateId);
          if (didProcess) {
            updateNames.push(cur.Final_Fire_Name);
            const duration = process.hrtime(start);
            const latency = duration[0] + (duration[1]/1000000.0)/1000.0;
            globalStats.record([{measure: monNumFireMaterialUpdatesProcessed, value: 1}, {measure: monFireMaterialUpdateProcessLatencySec, value: latency}]);
          }
          logger.info(' ]# Exiting internalProcessFire ' + updateId, {updateId: updateId});
        }
        if (didProcess) {
          numProcessed++;
        }
      } finally {
        globalStats.record([{measure: monNumFiresProcessed, value: 1}]);
        logger.debug(' ]# End Processing key %s', key1);
      }
    }

    const dbMetaInfo = {
      WARNING: 'DO NOT USE FOR HEALTH, SAFETY, EMERGENCY, or EVACUATION PURPOSES. Consult local public officials instead.\n'+
               'Info is APPROXIMATE, often INCORRECT and OUT-OF-DATE, NOT REAL-TIME, and NOT REVIEWED BY A HUMAN BEING.\n'+
               'For information only. USE AT YOUR OWN RISK — FIRES MAY BE CLOSER AND LARGER THAN THEY APPEAR HERE.\n'+
               'Unofficial. Not affiliated with or endorsed by any government agencies.\n'+
               'No claim to original government works.  Source data may be modified and combined with other data.\n'+
               'To the maximum extent permitted by law: (1) all content is provided to you on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHER (INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDNTIONS OF TITLE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NONINFRINGEMENT); and (2) IN NO EVENT WILL ANY AUTHOR OR DATA PROVIDER BE LIABLE TO YOU ON ANY LEGAL THEORY (INCLUDING, WITHOUT LIMITATION, NEGLIGENCE) OR OTHERWISE FOR ANY DIRECT, SPECIAL, INDIRECT, INCIDENTAL, CONSEQUENTIAL, PUNITIVE, EXEMPLARY, OR OTHER LOSSES, COSTS, EXPENSES, OR DAMAGES arising out of your use of this content, even if the author or data provider has been advised of the possibility of such losses, costs, expenses, or damages.',
      Host: os.hostname(),
    };

    fs.writeFileSync(argv.db, yaml.safeDump({__META: dbMetaInfo, Database: currentDb}, {skipInvalid: true}));

    if (argv.postPersistCmd) {
      const postPeristEnv = Object.assign({}, process.env, {
        FIRE_MONITOR_BOT_DB: argv.db,
        FIRE_MONITOR_BOT_UPDATE_ID: globalUpdateId,
        FIRE_MONITOR_BOT_UPDATES: updates.join('\n\n'),
        FIRE_MONITOR_BOT_UPDATE_SUMMARY: updateNames.join(', '),
      });
      try {
        const {stdout, stderr} = await exec(argv.postPersistCmd, {
          env: postPeristEnv,
        });
        logger.debug('Post persist stdout: \n' + stdout, {stdout: stdout, env: postPeristEnv});
        if (stderr) {
          logger.debug('Post persist stderr: \n' + stderr, {stderr: stderr, env: postPeristEnv});
        }
      } catch (err) {
        logger.error('### Error in post persist command: ');
        logger.error(err);
        if (argv.failOnError) {
          process.exit(13);
        }
      }
    }

    if (argv.htmlSnapshots) {
      const snapWebpage = argv.outputdir + '/snaps/SNAP-' + snapId + '.html';
      const snapHtml = genSnapHtml({
        entries: processedEntries,
      });
      snapId++;
      fs.writeFileSync(snapWebpage, snapHtml);
    }

    if (argv.once) {
      process.exit();
      while (true) { }
    }

    return currentDb;

    async function internalProcessFire(parentLogger, updateId, inciWeb, cur, perim, old, oneDiff, isNew, key, perimDateTime, uniqueUpdateId, qrcode) {
      const logger = parentLogger.child({
        labels: {updateId: updateId},
        updateId: updateId,
      });
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
          if (argv.failOnError) {
            process.exit(13);
          }
        });
      }
      let rr = null;
      if (perim.length > 1 && argv.locations) {
        rr = await maprender.getMapBounds(perim, 1450 / 2, 1200 / 2, 15, cur.DailyAcres || 0);
      } else {
        logger.debug('     >> Missing perimeter - %s', updateId);
      }
      const events = [{lon: cur.Lon, lat: cur.Lat}];
      const center = rr ? rr.center : [cur.Lon, cur.Lat];
      const zoom = rr ? rr.zoom : 12;
      const terrainPath = perim.length > 0 ? null : '/dev/null';

      const lat = center ? center[1] : cur.Lat;
      const lon = center ? center[0] : cur.Lon;
      // MultiPolygon -> Coordinates
      const points = _.flattenDepth(perim, 2);
      const meaningfulDistanceMi = 100 + Math.sqrt(0.0015625 /* mi2 per acre*/ * cur.DailyAcres);
      const cities2 = lat ? _.sortBy(geocoding.nearestCities(lat, lon, 1000, 500)
          .map((x) => {
            if (x.distance < meaningfulDistanceMi) {
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
        InHawaii: cur.state === 'HI' || cur.State === 'HI' || (_.first(cities) || {}).adminCode === 'HI',
        KnownLocationLowPop: lat && lon && nearPopulation <= 1000,
        UnknownLocationSmallSize: !lat && !lon && (cur.DailyAcres || 0) < 1.1 && (cur.TotalIncidentPersonnel || 0) < 15,
        FalseAlarmType: cur.IncidentTypeCategory === 'FA' || cur.incidenttypecategory === 'FA',
        FalseAlarmName: cur.Fire_Name.toLowerCase().startsWith(' fa fire') || cur.Fire_Name.toLowerCase().startsWith(' fa') || cur.Fire_Name.toLowerCase().startsWith('fa ') || (cur.Fire_Name.toLowerCase().includes('false') && cur.Fire_Name.toLowerCase().includes('alarm')),
        StepUpName: (cur.Fire_Name.toLowerCase().includes('step-up') || cur.Fire_Name.toLowerCase().includes('step up') || cur.Fire_Name.toLowerCase().includes('stepup')),
        NonStatFRName: cur.Fire_Name.toLowerCase().startsWith('nonstat '),
        // 3 hours with no info, might be stale
        OldEmergingFiresWithoutInfo: (cur.NFSAType || '').includes('Emerging') && !cur.DailyAcres && !cur.PercentContained && (cur.ModifiedOnDateTimeEpoch - cur.FireDiscoveryDateTimeEpoch > 1000 * 60 * 60 * 3),
        LACNoData: !cur.DailyAcres && !cur.PercentContained && cur.Fire_Name.toLowerCase().substr(0, 4) === 'lac-',
      };

      for (const filterKey in displayFilters) {
        if (displayFilters[filterKey]) {
          logger.info('     >) Skipping %s -> filter %s', updateId, filterKey);
          return false;
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
        uniqueUpdateId: uniqueUpdateId,
        terrainImg: terrainImg,
        link: argv.showSourceLinks ? cur.Link : null,
      };
      const html = genHtml(templateData);
      const tweet = genTweet(templateData);
      fs.writeFileSync(argv.outputdir + '/tweets/TWEET-' + updateId + '.txt', tweet);
      fs.writeFileSync(mainWebpage, html);

      await renderUpdateImage();
      await perimAndSaveProcess();

      return {
        uniqueUpdateId: uniqueUpdateId,
        tweet: tweet,
        img1: '../img/IMG-TWEET-' + updateId + '.png',
        img2: '../img/IMG-PERIM-' + updateId + '.jpeg',
      };

      async function perimAndSaveProcess() {
        const detailImg = (lat && lon) || (perim.length > 0 && !(perim.length === 1 && perim[0].length === 1 && perim[0][0].length === 2));
        let detailRender = null;
        if (detailImg) {
          const perimTemplateData = {
            lat: lat,
            lon: lon,
            zoom: zoom,
            uniqueUpdateId: uniqueUpdateId,
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

        // Tweet out in acre order. The priority is manifested via alpha-sorted filenames.
        const invPrio = Math.ceil(cur.DailyAcres || 0);
        const priority = numeral(Math.round(10000000 - invPrio)).format('00000000');

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

        const embargo = new Date().valueOf() + argv.embargoSec * 1000;

        const saved = {
          text: tweet,
          embargoUntil: embargo,
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
    const cur = x[key];
    let perimAcres = null;
    let perim = [];
    let perimDateTime = null;
    let inciWeb = null;
    let perimProvenance = null;

    // Get latest perimeter of all matching fires.
    for (const corrId of cur._CorrelationIds) {
      if (corrId in perims && (!perimDateTime || perimDateTime < p.attributes.perimeterdatetime)) {
        const p = perims[cur.UniqueFireIdentifier];
        perim = p.geometry.coords || [];
        perimDateTime = p.attributes.perimeterdatetime;
        inciWeb = p.attributes.inciwebid;
        perimAcres = p.attributes.gisacres;
        perimProvenance = p._Provenance;
      }
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
    cur.Final_Fire_Name = util.fireName(cur.Fire_Name);
    return {cur, perimDateTime, inciWeb, perim};
  }

  const mainLoop = function(first, last) {
    (async function() {
      let x = last;
      if (!argv.twitterOnly) {
        logger.debug('Main loop instance started');
        globalStats.record([{measure: monNumLoopsStarted, value: 1}]);
        const start = process.hrtime();
        try {
          if (!argv.ignoreSatellites) {
            await afm.refreshAfmSatelliteData(argv.outputdir + '/kml/');
          }
          await units.loadUnits(argv.unitsIdPath, argv.unitsSocialPath);
          await dailyMap();
          x = await internalLoop(first, last);
          globalStats.record([{measure: monNumLoopsSucceeded, value: 1}]);
        } catch (err) {
          globalStats.record([{measure: monNumLoopsErrored, value: 1}]);
          logger.error('>> Main loop error');
          logger.error(err);
          if (argv.failOnError) {
            process.exit(13);
          }
        }
        const duration = process.hrtime(start);
        const latency = duration[0] + (duration[1]/1000000.0)/1000.0;
        globalStats.record([{measure: monNumLoopsFinished, value: 1}, {measure: monLoopLatencySec, value: latency}]);
        logger.debug('Main loop instance complete');
      }
      setTimeout(function() {
        mainLoop(false, x);
      }, 1000 * periodSeq * 1);
    })();
  };

  let persist = undefined;
  if (fs.existsSync(argv.db)) {
    persist = yaml.safeLoad(fs.readFileSync(argv.db));
    if (persist.__META) {
      persist = persist.Database;
    }
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
    mainLoop(argv.forceUpdate ? false : (persist ? false : true), persist ? persist : {});
  });
};


function mergeNfsaAndGeomacIncidentsIntoDb(nfsaIncidents, geomacIncidents, currentDb) {
  const keys = _.union(_.keys(nfsaIncidents), _.keys(geomacIncidents));
  keys.map((key) => {
    currentDb[key] = util.mergedNfsaGeomacFire(nfsaIncidents[key], geomacIncidents[key]);
  });
}

function mergeDupeFires(currentDb, mergeDistanceMax) {
  for (const id of _.keys(currentDb)) {
    const item = currentDb[id];
    if (!item) {
      // Already deleted!
      continue;
    }
    const searchName = util.fireName(item.Name);
    const matchingDbItems = _.filter(currentDb, (o) => {
      return !_.isEmpty(_.intersection(o._CorrelationIds, item._CorrelationIds)) ||
          (util.fireName(o.Name) === searchName &&
           geocoding.distance(o.Lon, o.Lat, item.Lon, item.Lat) <= mergeDistanceMax);
    });

    if (matchingDbItems.length > 1) {
      // Preserve only the key/value with the most recent data,
      // but preserve all correlation ids.
      const bestItems = _.sortBy(matchingDbItems, (c) => (c.ModifiedOnDateTime + c.Source)).reverse();
      const bestItemId = bestItems[0].UniqueFireIdentifier;
      const corrIds = _.reduce(bestItems, (c, d) => _.union(c, d._CorrelationIds), []);
      currentDb[bestItemId]._CorrelationIds = corrIds;
      logger.debug(' ! NON-Unique fire %s , with best id %s', id, bestItemId);
      _.map(bestItems, (k) => {
        if (k.UniqueFireIdentifier !== bestItemId) {
          logger.debug('  >! non-unique fire %s , with best id %s - removing %s', id, bestItemId, k.UniqueFireIdentifier);
          delete currentDb[k.UniqueFireIdentifier];
        }
      });
    } else {
      // Don't need to do anything!
      logger.debug('Unique fire %s', id);
    }
  }
}

function mergeCalfireIncidentsIntoDb(calfireIncidents, currentDb, mergeDistanceMax) {
  for (const calfireId of _.keys(calfireIncidents)) {
    const calfireItem = calfireIncidents[calfireId];
    const searchName = util.fireName(calfireItem.Name);
    const matchingDbItems = _.filter(currentDb, (o) => {
      return o.Source !== 'CALFIRE' &&
          o.UniqueFireIdentifier.substr(5, 2) === 'CA' &&
          util.fireName(o.Name) === searchName &&
          geocoding.distance(o.Lon, o.Lat, calfireItem.Lon, calfireItem.Lat) <= mergeDistanceMax;
    });
    if (matchingDbItems.length === 0) {
      currentDb[calfireId] = util.mergedCalfireFire(calfireItem, null);
    } else if (matchingDbItems.length === 1) {
      currentDb[calfireId] = util.mergedCalfireFire(calfireItem, matchingDbItems[0]);
      delete currentDb[matchingDbItems[0].UniqueFireIdentifier];
    } else {
      logger.error('Multiple NG incidents match CALFIRE fire = %s', searchName,
          {
            calfireItem: calfireItem,
            matchingDbItems: matchingDbItems,
          }
      );
    }
  }
}
