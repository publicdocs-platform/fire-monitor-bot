# Unofficial wildfire data monitor
Gathers data from public sources, and posts it to Twitter.

![Twitter Follow](https://img.shields.io/twitter/follow/FireUnofficial.svg?style=social)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE) [![Build Status](https://travis-ci.com/publicdocs-platform/fire-monitor-bot.svg?branch=master)](https://travis-ci.com/publicdocs-platform/fire-monitor-bot) [![codecov](https://codecov.io/gh/publicdocs-platform/fire-monitor-bot/branch/master/graph/badge.svg)](https://codecov.io/gh/publicdocs-platform/fire-monitor-bot) [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=publicdocs-platform/fire-monitor-bot)](https://dependabot.com)
 [![Codacy Badge](https://api.codacy.com/project/badge/Grade/f2d4cb425efd4ef58a5926f7b973ea58)](https://app.codacy.com/app/publicdocs-platform/fire-monitor-bot?utm_source=github.com&utm_medium=referral&utm_content=publicdocs-platform/fire-monitor-bot&utm_campaign=Badge_Grade_Dashboard) [![DeepScan grade](https://deepscan.io/api/teams/4040/projects/5843/branches/46602/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=4040&pid=5843&bid=46602) ![GitHub last commit](https://img.shields.io/github/last-commit/publicdocs-platform/fire-monitor-bot.svg)


The original runs at https://twitter.com/FireUnofficial

The generated database is archived and updated at: https://github.com/publicdocs/wildfire-data-archive

The fire information displayed by this app is UNOFFICIAL, FOR INFORMATION ONLY, 
NOT SUITABLE FOR SAFETY/EMERGENCY PURPOSES, 
and MAY BE INCORRECT OR OUT-OF-DATE. USE AT YOUR OWN RISK.


## Features

* Sources fire summary from the National Fire Situational Awareness tool and from GeoMAC
* Sources perimeter info from GeoMAC
* Sources satellite fire detection from MODIS and VIIRS I (NASA/NOAA via Forest Service Active Fire Mapping)
* Creates a multi-layer base map from USGS, US Census Bureau and other federal govt data sets
* Determines location of fire relative to named populated places from the Census Bureau
* Monitors differences in fire information over time, and tweets out the changes (summary, perimeter, and satellite fire readings)
* Includes a one-off mapping tool that displays consistent images given a lat/lon/zoom.


## License

Read the [LICENSE](LICENSE) for details.  
The entire [NOTICE](NOTICE) file serves as the NOTICE that must be included under
Section 4d of the License.

````
The fire-monitor-bot software is available under the license below.
Third-party dependencies not distributed with fire-monitor-bot
and data used during runtime may be under other licenses.

The fire information displayed by this app is
* UNOFFICIAL,
* FOR INFORMATION ONLY, 
* NOT SUITABLE FOR SAFETY/EMERGENCY/EVACUATION PURPOSES, 
* and MAY BE INCORRECT OR OUT-OF-DATE.

USE AT YOUR OWN RISK.  FIRES MAY BE CLOSER THAN THEY APPEAR.

Note that while we may distribute the images and posts generated and
published by our original bot using the disclaimers indicated in the
relevant template files, you must decide for yourself whether
you wish to use the same disclaimers and/or whether those disclaimers meet
your obligations under both our and third-party requirements.
We cannot give any legal advice on that.

No license to use any trademarks is provided.  You are not permitted
to use any of the names of our Twitter accounts in any content you
generate.

=====

fire-monitor-bot (https://github.com/publicdocs-platform/fire-monitor-bot)

Copyright (c) 2018-2019 Advay Mengle <source@madvay.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this software except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
````
