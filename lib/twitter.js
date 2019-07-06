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

const logging = require('./logging');
const logger = logging.child({system: 'twitter'});

const Twit = require('twit');

// Posts messages to Twitter.
const twitterDaemon = async function(yamlDir, semaphore, authPath, accountPath, periodMsec, postToFirestore) {
  const auth = yaml.safeLoad(await promisify(fs.readFile)(authPath));
  const accountConfig = yaml.safeLoad(await promisify(fs.readFile)(accountPath));

  let dbCollection = undefined;
  if (postToFirestore) {
    const Firestore = require('@google-cloud/firestore');
    const db = new Firestore();
    dbCollection = db.collection('tweets');
  }

  const accounts = {};

  _.forOwn(accountConfig, (v, ckey) => {
    const x = auth.profiles[v];
    const data = x[_.first(_.keys(x))];
    accounts[ckey] = {
      twit: new Twit({
        consumer_key: data.consumer_key,
        consumer_secret: data.consumer_secret,
        access_token: data.token,
        access_token_secret: data.secret,
        timeout_ms: 60*1000,
        strictSSL: true,
      }),
      name: data.username,
    };
  });

  const postMedia = async function(logger, twitterAccount, imgPath, altText) {
    try {
      const data = await promisify(twitterAccount.postMediaChunked).bind(twitterAccount)({file_path: path.resolve(imgPath)});

      const mediaId1 = data.media_id_string;
      // For accessibility.
      const metadata = {media_id: mediaId1, alt_text: {text: altText}};

      await twitterAccount.post('media/metadata/create', metadata);

      return mediaId1;
    } catch (err) {
      logger.error(' !!! Could not post image from ' + imgPath);
      logger.error(err);
    }
    return null;
  };

  const findThread = async function(twitterAccount, query) {
    const data = await twitterAccount.get('search/tweets', {q: query, count: 10, result_type: 'recent'});

    return data.data.statuses.map((x) => {
      return {id: x.id_str, author: x.user.screen_name};
    });
  };

  const retweet = async function(twitterAccount, name, tweetId) {
    const retweetUrl = 'statuses/retweet/' + tweetId;
    try {
      await twitterAccount.post(retweetUrl, {trim_user: 1});
      logger.info(' @@ Posted retweet of ' + tweetId + ' - https://twitter.com/' + name);
    } catch (err) {
      logger.error(' !!! Could not statuses/retweet from ' + retweetUrl);
      logger.error(err);
    }
  };

  const postLoop = async function() {
    let taken = false;
    await promisify(semaphore.take).bind(semaphore)();
    taken = true;
    const items2 = await promisify(fs.readdir)(yamlDir);
    semaphore.leave();
    const items = items2.filter((s) => s.endsWith('.yaml'));
    logger.debug('@@ Found %d Twitter posts in queue', items.length);
    while (items.length > 0) {
      await promisify(semaphore.take).bind(semaphore)();
      taken = true;
      const p = yamlDir + items.shift();
      const plogger = logger.child({labels: {file: p}});
      try {
        const skipped = await processTweet(plogger, p, accounts, postMedia, findThread, retweet, dbCollection);
        semaphore.leave();
        taken = false;
        if (!skipped) {
          setTimeout(postLoop, periodMsec + Math.floor(Math.random() * 5000));
          return;
        }
      } catch (err) {
        plogger.error(' !!! Could not post tweet from ' + p);
        plogger.error(err);

        if (taken) {
          semaphore.leave(); taken = false;
        }
        // If rate limit, wait a while.
        setTimeout(postLoop, (err && err.statusCode === 429) ? 17*60*1000 : (periodMsec + Math.floor(Math.random() * 5000)));
        return;
      }
    }

    setTimeout(postLoop, 15000);
  };
  setTimeout(postLoop, 1000);
};

exports.launchDaemon = function(dir, semaphore, auth, acc, periodMsec, postToFirestore) {
  setTimeout(() => twitterDaemon(dir, semaphore, auth, acc, periodMsec, postToFirestore), 1000);
};

async function processTweet(logger, p, accounts, postMedia, findThread, retweet, dbCollection) {
  const y = await promisify(fs.readFile)(p);
  const item = yaml.safeLoad(y);
  if (item.embargoUntil && item.embargoUntil > new Date().valueOf()) {
    // Skipped!
    logger.debug('@@ Skipping %s for embargo', p);
    return true;
  }
  logger.info('@@ Processing %s', p);
  const selectors = item.selectors || [];
  selectors.push('other');
  selectors.push('general');
  const twitter = _.first(_.filter(_.map(selectors, (s) => {
    return accounts[s];
  }, (s) => !!s)));
  const twitterAccount = twitter.twit;
  logger.info('@@ Posting for selector "%s" to account https://twitter.com/%s', selectors, twitter.name);
  const retweetSelectors = item.retweetSelectors || [];
  const retwitter = _.first(_.filter(_.map(retweetSelectors, (s) => {
    return accounts[s];
  }, (s) => !!s)));
  const retweetAccount = retwitter ? retwitter.twit : undefined;
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
      return postMedia(logger, twitterAccount, x.path, x.altText);
    }
    return null;
  }).filter((x) => !!x))).filter((x) => !!x);
  let replyId = null;
  let replyTo = null;
  if (item.threadQuery) {
    try {
      const thread = await findThread(twitterAccount, item.threadQuery);
      if (thread && thread.length > 0) {
        replyId = thread[0].id;
        replyTo = thread[0].author;
      }
    } catch (err) {
      logger.error('@@ Unable to find thread %s', item.threadQuery);
      logger.error(err);
      replyId = null;
      replyTo = null;
    }
  }
  const newPost = {
    status: (replyTo ? ('@' + replyTo + ' ') : '') + item.text,
    media_ids: mediaIds,
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
    logger.error(' !!! Could not statuses/update from %s', p, {post: newPost});
    logger.error(err);
    if (err && err.statusCode === 403 && err.code && err.code === 186) {
      // Use very short text.
      newPost.status = item.shortText;
      if (!newPost.status) {
        newPost.status = item.text.split(' ')[0] + ' - Unofficial report. See officials for safety info. May be incorrect; disclaimers in images.';
      }
      logger.info(' !!! Reattempt', {post: newPost});
      try {
        data = await twitterAccount.post('statuses/update', newPost);
      } catch (err2) {
        logger.error(' !!! Could not statuses/update from %s , %o: ', p, {post: newPost});
        logger.error(err2);
      }
    }
  }
  if (data) {
    logger.info(' @@ Posted new tweet - https://twitter.com/' + twitter.name + '/status/' + data.data.id_str, {post: newPost});
  } else {
    logger.warn(' !!! Post %s will be deleted after failing to post', p, {file: p, post: newPost});
  }
  if (data && data.data.id_str && dbCollection) {
    // fire and forget
    dbCollection.doc('t_' + data.data.id_str).set({
      url: 'https://twitter.com/' + twitter.name + '/status/' + data.data.id_str,
      name: p,
      content: item,
      id: data.data.id_str,
      account: twitter.name,
      timestamp: new Date().toISOString(),
    }
    );
  }
  await promisify(fs.unlink)(p);
  if (retweetAccount && retwitter && data.data.id_str) {
    // Retweets are treated as best effort.
    logger.info(' @@ Queued retweet of https://twitter.com/' + twitter.name + '/status/' + data.data.id_str + ' from @' + retwitter.name);
    setTimeout(retweet, 30000, retweetAccount, retwitter.name, data.data.id_str);
  }
  return false;
}

