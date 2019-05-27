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
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const promisify = require('util').promisify;

const envconfig = require('../envconfig');
const twit = require('twit');

// Posts messages to Twitter.
const twitterDaemon = async function(yamlDir, semaphore, authPath, accountPath, periodMsec) {
  const auth = yaml.safeLoad(await promisify(fs.readFile)(authPath));
  const accountConfig = yaml.safeLoad(await promisify(fs.readFile)(accountPath));

  let accounts = {};

  for (let ckey in accountConfig) {
    const x = auth.profiles[accountConfig[ckey]];
    const data = x[_.first(_.keys(x))];
    accounts[ckey] = {
      twit: new twit({
        consumer_key:         data.consumer_key,
        consumer_secret:      data.consumer_secret,
        access_token:         data.token,
        access_token_secret:  data.secret,
        timeout_ms:           60*1000,
        strictSSL:            true,
      }),
      name: data.username
    };
    
  }

  const postMedia = async function(twitterAccount, imgPath, altText) {
    try {
      const data = await promisify(twitterAccount.postMediaChunked).bind(twitterAccount)({ file_path: path.resolve(imgPath)});

      const mediaId1 = data.media_id_string;
      // For accessibility.
      const metadata = { media_id: mediaId1, alt_text: { text: altText } };

      await twitterAccount.post('media/metadata/create', metadata);

      return mediaId1;
    } catch (err) {
      console.log(' !!! Could not post image from ' + imgPath);
      console.log(err);
    }
    return null;
  }


  const findThread = async function(twitterAccount, query) {

    const data = await twitterAccount.get('search/tweets', { q: query, count: 10, result_type: 'recent' });

    return data.data.statuses.map(x => {return {id: x.id_str, author: x.user.screen_name};});
  }

  const postLoop = async function() {
    let taken = false;
    await promisify(semaphore.take).bind(semaphore)();
    taken = true;
    const items2 = await promisify(fs.readdir)(yamlDir);
    const items = items2.filter(s => s.endsWith('.yaml'));
    if (items.length == 0) {
      semaphore.leave();
      setTimeout(postLoop, 5300);
      return;
    }
    console.log('@@ Found %d Twitter posts in queue', items.length);
    const p = yamlDir + items[0];
    try {
      const y = await promisify(fs.readFile)(p);
      console.log('@@ Loading %s', p);

      const item = yaml.safeLoad(y);
      const selectors = item.selectors || [];
      selectors.push('other');
      selectors.push('general');
      const twitter = _.first(_.filter(_.map(selectors, s => {return accounts[s];}, s => !!s)));
      const twitterAccount = twitter.twit;
      console.log('@@ Posting for selector "%s" to account https://twitter.com/%s', selectors, twitter.name);

      let allMedia = [];
      if (item.images) {
        allMedia = allMedia.concat(item.images);
      }
      if (item.image1) {
        allMedia.push({path: item.image1, altText: item.image1AltText});
      }
      if (item.image2) {
        allMedia.push({path: item.image2, altText: item.image2AltText});
      }
      if (item.image3) {
        allMedia.push({path: item.image3, altText: item.image3AltText});
      }
      // Upload all media.
      const mediaIds = (await Promise.all(allMedia.map((x) => {
        if (x && x.path) {
          return postMedia(twitterAccount, x.path, x.altText);
        }
        return null;
      }).filter(x => !!x))).filter(x => !!x);

      let replyId = null, replyTo = null;

      if (item.threadQuery) {
        try {
          let thread = await findThread(twitterAccount, item.threadQuery);
          if (thread && thread.length > 0) {
            replyId = thread[0].id;
            replyTo = thread[0].author;
          }
        } catch(err) {
          console.log('@@ Unable to find thread %s', item.threadQuery);
          console.log(err);
          replyId = null;
          replyTo = null;
        }
      }

      let newPost = { 
        status: (replyTo ? ('@' + replyTo + ' ') : '') + item.text,
        media_ids: mediaIds 
      };
      if (replyId) {
        newPost.in_reply_to_status_id = replyId;
      }
      if (item.coords) {
        newPost.display_coordinates = true;
        newPost.lat = item.coords.lat;
        newPost.long = item.coords.long || item.coords.lon;
      }

      let data = undefined;
      try {
        data = await twitterAccount.post('statuses/update', newPost);
      } catch (err) {
        console.log(' !!! Could not statuses/update from ' + p);
        console.log(err);
  
        if (err && err.statusCode == 403 && err.code && err.code == 186) {
          // Use very short text.
          newPost.text = item.shortText;
          if (!newPost.text) {
            newPost.status = item.text.split(' ')[0] + " - Unofficial fire report. See officials for safety info. May be incorrect; disclaimers in images.";
          }
          console.log(' !!! Reattempt:');
          console.log(newPost);
          data = await twitterAccount.post('statuses/update', newPost);
        }
      }

      console.log(' @@ Posted new tweet - https://twitter.com/' + twitter.name + '/status/' + data.data.id_str);
      await promisify(fs.unlink)(p);

      semaphore.leave();
      taken = false;

      setTimeout(postLoop, periodMsec + Math.floor(Math.random() * 5000));
    } catch (err) {
      console.log(' !!! Could not post tweet from ' + p);
      console.log(err);

      if (taken) { semaphore.leave(); taken = false; }
      // If rate limit, wait a while.
      setTimeout(postLoop, (err && err.statusCode == 429) ? 17*60*1000 : (periodMsec + Math.floor(Math.random() * 5000)));
    }
  };
  setTimeout(postLoop, 1000);
};

exports.launchDaemon = function(dir, semaphore, auth, acc, periodMsec) {
  setTimeout(() => twitterDaemon(dir, semaphore, auth, acc, periodMsec), 1000);
};
