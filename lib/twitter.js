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

const envconfig = require('../envconfig');
const twit = require('twit');

// Posts messages to Twitter.
const twitterDaemon = function(yamlDir, semaphore) {

  const twitterAccount = new twit({
    consumer_key:         envconfig.twitterAuth.consumer_key,
    consumer_secret:      envconfig.twitterAuth.consumer_secret,
    access_token:         envconfig.twitterAuth.access_token,
    access_token_secret:  envconfig.twitterAuth.access_token_secret,
    timeout_ms:           60*1000,
    strictSSL:            true,
  });

  const postLoop = function() {
    fs.readdir(yamlDir, function(err, items2) {
        const items = items2.filter(s => s.endsWith('.yaml'));
        if (items.length > 0) {
          console.log('@@ Found %d Twitter posts in queue', items.length);
          const p = yamlDir + items[0];
          const y = fs.readFileSync(p);
          console.log('@@ Loading %s', p);
          const item = yaml.safeLoad(y);
          if (item.image1) {
            semaphore.take(() => {

              twitterAccount.postMediaChunked({ file_path: path.resolve(item.image1)}, function (err, data, resp) {
                if (err) {
                  console.log(' !!! Could not upload image 1 from ' + p);
                  console.log(err);
                  semaphore.leave();
                  setTimeout(postLoop, 5300);
                } else {
                  const mediaId1 = data.media_id_string;
                  // For accessibility.
                  const altText = item.image1AltText;
                  const metadata = { media_id: mediaId1, alt_text: { text: altText } };

                  twitterAccount.post('media/metadata/create', metadata, function (err, data, resp) {
                    if (err) {
                      console.log(' !!! Could not update image 1 metadata from ' + p);
                      console.log(err);
                      semaphore.leave();
                      setTimeout(postLoop, 5300);
                    } else {
                      
                      const postIt = function(media) {
                        let newPost = { status: item.text, media_ids: media };
                        if (item.coords) {
                          newPost.display_coordinates = true;
                          newPost.lat = item.coords.lat;
                          newPost.long = item.coords.long || item.coords.lon;
                        }
                        twitterAccount.post('statuses/update', newPost, function (err, data, resp) {
                          if (err) {
                            console.log(' !!! Could not post tweet from ' + p);
                            console.log(err);
                            semaphore.leave();
                            setTimeout(postLoop, 5300);
                          } else {
                            console.log(' @@ Posted new tweet - https://twitter.com/' +  envconfig.twitterAuth.name + '/status/' + data.id_str);
                            fs.unlinkSync(p);
                            semaphore.leave();
                            setTimeout(postLoop, 177500);
                          }
                        })
                      };

                      if (item.image2) {
                        twitterAccount.postMediaChunked({ file_path: path.resolve(item.image2)}, function (err, data, resp) {
                          if (err) {
                            console.log(' !!! Could not upload image 2 from ' + p);
                            console.log(err);
                            semaphore.leave();
                            setTimeout(postLoop, 5300);
                          } else {
                            const mediaId2 = data.media_id_string;
                            // For accessibility.
                            const altText = item.image2AltText;
                            const metadata = { media_id: mediaId2, alt_text: { text: altText } };
            
                            twitterAccount.post('media/metadata/create', metadata, function (err, data, resp) {
                              if (err) {
                                console.log(' !!! Could not update image 2 metadata from ' + p);
                                console.log(err);
                                semaphore.leave();
                                setTimeout(postLoop, 5300);
                              } else {
                                if (item.image3) {
                                  twitterAccount.postMediaChunked({ file_path: path.resolve(item.image3)}, function (err, data, resp) {
                                    if (err) {
                                      console.log(' !!! Could not upload image 3 from ' + p);
                                      console.log(err);
                                      semaphore.leave();
                                      setTimeout(postLoop, 5300);
                                    } else {
                                      const mediaId3 = data.media_id_string;
                                      // For accessibility.
                                      const altText = item.image3AltText;
                                      const metadata = { media_id: mediaId3, alt_text: { text: altText } };
                      
                                      twitterAccount.post('media/metadata/create', metadata, function (err, data, resp) {
                                        if (err) {
                                          console.log(' !!! Could not update image 3 metadata from ' + p);
                                          console.log(err);
                                          semaphore.leave();
                                          setTimeout(postLoop, 5300);
                                        } else {
                                          postIt([mediaId1, mediaId2, mediaId3]);
                                        }
                                      });
                                    }
                                  });
                                } else {
                                  postIt([mediaId1, mediaId2]);
                                }
                              }
                            });
                          }
                        });

                      } else {
                        postIt([mediaId1]);
                      }

                    }
                  })
                }
              });
            });
          }
        } else {
          setTimeout(postLoop, 5300);
        }
    });
  };
  setTimeout(postLoop, 1000);
};

exports.launchDaemon = function(dir, semaphore) {
  setTimeout(() => twitterDaemon(dir, semaphore), 1000);
};
