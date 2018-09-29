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

// Load .env files.
require('dotenv').config()

// To configure Twit.
exports.twitterAuth = {
  // This is for the user.
  name: process.env.TWITTER_NAME,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,

  // This is for the app.
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
};

exports.ui = {
  disclaimer_url: process.env.FIREMON_DISCLAIMER_URL,
  system_url: process.env.FIREMON_URL,
};

exports.gfx = {
  use_im: process.env.USE_IMAGEMAGICK,
};
