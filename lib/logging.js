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

const winston = require('winston');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({stack: true}),
      winston.format.splat(),
      winston.format.json()
  ),
  defaultMeta: {serviceContext: {service: 'fire-monitor-bot'}},
  transports: [
    new winston.transports.File({filename: 'errors.log', level: 'error'}),
    new winston.transports.File({filename: 'combined.log'}),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        winston.format.errors({stack: true}),
        winston.format.splat(),
        winston.format.printf(
            (info) => {
              let ret = `${info.timestamp} - ${info.level}: ${info.message}`;
              if (info.stack) {
                ret = ret + ' ' + info.stack;
              }
              return ret;
            }
        ),
    ),
  }));
}

const version = require('../package.json').version;

if (process.env.FLUENTD_PORT) {
  const {LoggingWinston} = require('@google-cloud/logging-winston');

  logger.add(new LoggingWinston({
    serviceContext: {
      service: 'fire-monitor-bot',
      version: version,
    },
    logName: 'fire_monitor_log',
  }));
}

logger.info('Logging initialized - ' + version);

module.exports=logger;
