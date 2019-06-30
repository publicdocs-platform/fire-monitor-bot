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


const {globalStats, AggregationType, MeasureUnit} = require('@opencensus/core');
const {StackdriverStatsExporter} = require('@opencensus/exporter-stackdriver');

const logger = require('./logging');

const monLastStartMs = globalStats.createMeasureDouble(
    'start_epoch',
    MeasureUnit.MS,
    'Last time the app started'
);

const viewLastStartMs = globalStats.createView(
    'org.publicdocs/fire-monitor-bot/monitoring/last.' + monLastStartMs.name,
    monLastStartMs,
    AggregationType.LAST_VALUE,
    [],
    'Last time the app started',
);

globalStats.registerView(viewLastStartMs);

if (process.env.GOOGLE_PROJECT_ID) {
  const exporter = new StackdriverStatsExporter({
    projectId: process.env.GOOGLE_PROJECT_ID,
    period: (process.env.METRIC_EXPORT_PERIOD_SEC || 60) * 1000,
    onMetricUploadError: (err) => {
      logger.error('Failed to upload Stackdriver stats');
      logger.error(err);
    },
  });

  globalStats.registerExporter(exporter);

  logger.info('Stackdriver exporter registered');
}

globalStats.record([{measure: monLastStartMs, value: new Date().valueOf()}]);

exports.monitorLast = function(path, m) {
  globalStats.registerView(globalStats.createView(
      'org.publicdocs/fire-monitor-bot/' + path + '/last.' + m.name,
      m,
      AggregationType.LAST_VALUE,
      [],
      'Last ' + m.description
  ));
};

exports.monitorSum = function(path, m) {
  globalStats.registerView(globalStats.createView(
      'org.publicdocs/fire-monitor-bot/' + path + '/sum.' + m.name,
      m,
      AggregationType.SUM,
      [],
      'Sum ' + m.description
  ));
};

exports.monitorDist = function(path, m, dist) {
  globalStats.registerView(globalStats.createView(
      'org.publicdocs/fire-monitor-bot/' + path + '/dist.' + m.name,
      m,
      AggregationType.DISTRIBUTION,
      [],
      'Distribution ' + m.description,
      dist
  ));
};
