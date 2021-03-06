/*
Copyright (c) 2019 Advay Mengle <source@madvay.com>.
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
const promisify = require('util').promisify;
const rp = require('request-promise');
const {DateTime} = require('luxon');

const cheerio = require('cheerio');

const parse = promisify(require('csv-parse'));

const dateString = require('./util').dateString;
const util = require('./util');

const nfsaMapping = {
  incident_acres_burned: 'DailyAcres',
  incident_containment: 'PercentContained',
  incident_id: 'UniqueFireIdentifier',
  incident_name: 'Fire_Name',
  incident_date_last_update: 'ModifiedOnDateTime',
  incident_date_last_updateEpoch: 'ModifiedOnDateTimeEpoch',
  incident_url: 'Link',

  // todo:
  firecause: 'FireCause',

};

const processFire = function(e, provenance) {
  const ret = {};
  ret.Lon = e.incident_longitude;
  ret.Lat = e.incident_latitude;
  const entry = e;
  _.forOwn(entry, (v, key) => {
    ret[key] = entry[key];
    if (typeof ret[key] === 'string') {
      ret[key] = ret[key].trim();
    }
    if (key === 'incident_date_last_update' || key === 'incident_date_created') {
      const v = ret[key];
      const x = DateTime.fromFormat(v, 'yyyy-MM-dd HH:mm:ss', {zone: 'America/Los_Angeles'});
      const p = x.toUTC();
      ret[key + 'Epoch'] = p.toJSDate().valueOf();
      ret[key] = dateString(p.toJSDate().valueOf());
    }
    if (_.isString(ret[key])) {
      ret[key] = ret[key].trim();
    }
  });
  const ret2 = _.cloneDeep(ret);
  _.forOwn(ret, (v, key) => {
    ret2[key] = ret[key];
    if (key in nfsaMapping) {
      ret2[nfsaMapping[key]] = ret[key];
    }
  });
  const lfn = ret2.Fire_Name.toLowerCase();
  if (lfn.endsWith(' (not a cal fire incident)') || lfn.endsWith(' (not a cal fire incident)')) {
    ret2.Fire_Name = ''.substr(0, ret2.Fire_Name.length - ' (Not a CAL FIRE Incident)'.length);
    ret2.Notes = '(Not a CAL FIRE Incident)';
  }
  ret2.Name = ret2.Fire_Name;
  ret2.Source = 'CALFIRE';
  ret2.State = 'CA';
  ret2.UniqueFireIdentifier = 'CALFIRE-' + ret2.incident_id;
  ret2.Hashtag = util.fireHashTag(ret2.Name);
  ret2._Provenance = _.cloneDeep(provenance);
  ret2._CorrelationIds = [ret2.UniqueFireIdentifier];
  if (ret2.Link && ret2.Link.startsWith('https://osfm.fire.ca.gov/')) {
    ret2.Link = 'https://www.fire.ca.gov/' + ret2.Link.substring('https://osfm.fire.ca.gov/'.length)
  }
  return ret2;
};


const qs = {
};


/*
On June 27, 2019, the conditions of use (linked at the bottom of the incident data page) on
Cal Fire said:

  In general, information presented on this web site, unless otherwise indicated, is considered
  in the public domain. It may be distributed or copied as permitted by law. However, the State
  does make use of copyrighted data (e.g., photographs) which may require additional permissions
  prior to your use. In order to use any information on this web site not owned or created by
  the State, you must seek permission directly from the owning (or holding) sources. The State
  shall have the unlimited right to use for any purpose, free of any charge, all information
  submitted via this site except those submissions made under separate legal contract. The
  State shall be free to use, for any purpose, any ideas, concepts, or techniques contained
  in information provided through this site.

Archived: https://web.archive.org/web/20190627202100/https://www.fire.ca.gov/conditions-of-use/

(this is not legal advice)
*/

// ua: user-agent
exports.getFires = async function(ua, timeoutMs) {
  const firesDataOptions = {
    uri: 'https://www.fire.ca.gov/imapdata/mapdataactive.csv',
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua,
    },
    timeout: timeoutMs || 120000,
    json: false,
  };
  const provenance = util.createProvenance(firesDataOptions);
  const resp = await rp(firesDataOptions);
  const rows = await parse(resp, {
    cast: true,
    columns: true,
    objname: 'incident_id',
    trim: true,
    skip_empty_lines: true,
    skip_lines_with_error: false,
  });
  const x = _.mapKeys(_.mapValues(rows, (e) => processFire(e, provenance)), (v, _) => v.UniqueFireIdentifier);
  return x;
};


exports.getFireDetail = async function(fire, ua, timeoutMs) {
  const firesDataOptions = {
    uri: fire.Link,
    qs: qs,
    headers: {
      'User-Agent': 'Request-Promise; ' + ua,
    },
    timeout: timeoutMs || 120000,
    json: false,
  };
  const provenance = util.createProvenance(firesDataOptions);
  const resp = await rp(firesDataOptions);
  const parser = cheerio.load(resp);
  const dmgElems = parser('h4', '.incident-damages-and-losses');
  const dmgTexts = _.map(dmgElems, (x) => (parser(x).text()));
  const ret = {
  };
  let some = false;
  _.forEach(dmgTexts, (x) => {
    const m = x.match(/((?<dmg>\d+) Structures? Damaged)|((?<dest>\d+) Structures? Destroyed)|((?<inj>\d+) Injur.*)|((?<fatal>\d+) Fatal.*)/);
    if (m && m.groups) {
      if (m.groups.dmg) {
        ret.structuresDamaged = Number.parseInt(m.groups.dmg);
        some = true;
      }
      if (m.groups.dest) {
        ret.structuresDestroyed = Number.parseInt(m.groups.dest);
        some = true;
      }
      if (m.groups.inj) {
        ret.injuries = Number.parseInt(m.groups.inj);
        some = true;
      }
      if (m.groups.fatal) {
        ret.fatalities = Number.parseInt(m.groups.fatal);
        some = true;
      }
    }
  });
  if (!some) {
    return null;
  }
  return ret;
};
