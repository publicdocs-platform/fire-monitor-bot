## [3.1.2](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v3.1.1...v3.1.2) (2019-07-24)


### Bug Fixes

* **map:** update openlayers and jquery in rendering ([0e065dd](https://github.com/publicdocs-platform/fire-monitor-bot/commit/0e065dd))

## [3.1.1](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v3.1.0...v3.1.1) (2019-07-24)


### Bug Fixes

* **build:** make sure package.json version is being updated by semantic-release ([bc44c25](https://github.com/publicdocs-platform/fire-monitor-bot/commit/bc44c25))

# [3.1.0](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v3.0.2...v3.1.0) (2019-07-24)


### Bug Fixes

* **build:** fix version numbers in package.json ([0e3b7e3](https://github.com/publicdocs-platform/fire-monitor-bot/commit/0e3b7e3))
* **cli:** correct package.json main ([719bb0c](https://github.com/publicdocs-platform/fire-monitor-bot/commit/719bb0c))


### Features

* **cli:** install main as a binary ([e2fad48](https://github.com/publicdocs-platform/fire-monitor-bot/commit/e2fad48))

## [3.0.2](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v3.0.1...v3.0.2) (2019-07-24)


### Bug Fixes

* **deps:** remove spurious deps - @opencensus/exporter-zpages , @opencensus/nodejs , @google-cloud/tasks ([54e0b36](https://github.com/publicdocs-platform/fire-monitor-bot/commit/54e0b36))

## [3.0.1](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v3.0.0...v3.0.1) (2019-07-24)


### Bug Fixes

* **deps:** remove spurious moment-timezone dep ([d040812](https://github.com/publicdocs-platform/fire-monitor-bot/commit/d040812))

# [3.0.0](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.7.2...v3.0.0) (2019-07-23)


### Features

* **cli:** add --browser-timeout-sec argument, default 10min ([e6b3e19](https://github.com/publicdocs-platform/fire-monitor-bot/commit/e6b3e19))
* **map:** remove the `map` command ([2135e7c](https://github.com/publicdocs-platform/fire-monitor-bot/commit/2135e7c))


### BREAKING CHANGES

* **map:** the `map` CLI command has been removed- it wasn't maintained anyway.

## [2.7.2](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.7.1...v2.7.2) (2019-07-22)


### Bug Fixes

* **filters:** ignore NFSA complexes - which appear spurious ([7ea8e8e](https://github.com/publicdocs-platform/fire-monitor-bot/commit/7ea8e8e)), closes [#113](https://github.com/publicdocs-platform/fire-monitor-bot/issues/113)
* **filters:** reduce minimum population filter to 100 ([5be723c](https://github.com/publicdocs-platform/fire-monitor-bot/commit/5be723c))

## [2.7.1](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.7.0...v2.7.1) (2019-07-22)


### Bug Fixes

* **map:** use tile server for PADUS layer ([52d9b32](https://github.com/publicdocs-platform/fire-monitor-bot/commit/52d9b32)), closes [#112](https://github.com/publicdocs-platform/fire-monitor-bot/issues/112)

# [2.7.0](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.6.2...v2.7.0) (2019-07-20)


### Features

* **map:** show pct. fire acreage beyond perimeter acreage ([#111](https://github.com/publicdocs-platform/fire-monitor-bot/issues/111)) ([5d2a3a1](https://github.com/publicdocs-platform/fire-monitor-bot/commit/5d2a3a1))

## [2.6.2](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.6.1...v2.6.2) (2019-07-18)


### Bug Fixes

* **deps:** upgrade to --latest deps ([20dfe74](https://github.com/publicdocs-platform/fire-monitor-bot/commit/20dfe74))

## [2.6.1](https://github.com/publicdocs-platform/fire-monitor-bot/compare/v2.6.0...v2.6.1) (2019-07-18)


### Bug Fixes

* **build:** add CHANGELOG to semantic-release ([f89f578](https://github.com/publicdocs-platform/fire-monitor-bot/commit/f89f578))
