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

function showMap(centerX, centerY, zoom, style, cities0) {
  let detail = style == 'perim';
  let cities = cities0 || { closest: [], biggest: [] };
  let showAll = 'show:';

  for (let s = 0; s < 100; s++) {
    showAll = showAll + s + ',';
  }

  let Library = {
    USGS: {
      NatlMap: {
        Blank: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTNMBlank/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        Imagery: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        ImageryTiled: {
          tiled: true,
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
          params: {}
        },
        ImageryTopo: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        Polygons: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/selectable_polygons/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        Roads: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          params: { layers: 'show:13,18,21,22,23,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG' }
        },
        RoadsMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          params: { layers: 'show:13,18,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG' }
        },
        RoadsLowScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          params: { layers: 'show:13,25,26,36', FORMAT: 'PNG' }
        },
        TransportNotInCensus: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          params: { layers: 'show:13,18,19,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG' }
        },
        TransportNotInCensusMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          params: { layers: 'show:13,18,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG' }
        },
        GovUnits: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          params: { layers: 'exclude:17', FORMAT: 'PNG' }
        },
        GovUnitsSelectedLabels: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          params: { layers: 'show:4,5,6,7,16', FORMAT: 'PNG' }
        },
        Names: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/',
          params: { layers: ''/*'show:0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22'*/, FORMAT: 'PNG' }
        },
      },
      ProtectedAreas: {
        SimpleDesignations: {
          url: 'https://gis1.usgs.gov/arcgis/rest/services/PADUS1_4/SimpleDesignationType/MapServer',
          params: { layers: '', FORMAT: 'PNG' },
          opacity: 0.3,
        }
      }
    },
    GEOMAC: {
      Fires: {
        url: 'https://wildfire.cr.usgs.gov/ArcGIS/rest/services/geomac_dyn/MapServer',
        params: {
          FORMAT: 'PNG',
          layers: 'show:0,1,2',
        },
        opacity: 0.5,
      },
    },
    Census: {
      Tiger: {
        States: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer',
          params: { layers: 'show:0,2,4,6,8,10,12,14,15,16', FORMAT: 'PNG' }
        },
        Roads: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        USLandmass: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/USLandmass/MapServer',
          params: { layers: '', FORMAT: 'JPEG', TRANSPARENT: 'false' /* Need the blue oceans */ }
        },
        Hydro: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
        HydroPaths: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          params: { layers: 'show:0', FORMAT: 'PNG' }
        },
        HydroBodies: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          params: { layers: 'show:1,2', FORMAT: 'PNG' }
        },
        Urban: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer',
          params: { layers: '', FORMAT: 'PNG' }
        },
      }
    },
  }

  function Alpha(config, opacity) {
    let ret = Object.assign({}, config);
    ret.opacity = opacity;
    return ret;
  }


  const textStyle = function (feature) {
    return new ol.style.Text({
      textAlign: 'left',
      textBaseline: 'bottom',
      font: '14px Roboto',
      text: feature.get('name'),
      fill: new ol.style.Fill({ color: '#000000' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
      offsetX: 0,
      offsetY: 0,
    });
  };



  function perimVectorLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/2'
    function styles(feat) {
      let sclr = 'rgba(255,0,0,1)';
      let fclr = 'rgba(255,0,0,0.01)';
      let sclr2 = 'rgba(255,160,0,1)';
      return [new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),

        stroke: new ol.style.Stroke({ color: sclr2, width: 2 }),

      }), new ol.style.Style({
        stroke: new ol.style.Stroke({ color: sclr, width: 1 }),
      })];
    }
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: styles,
      declutter: false,
    });
  }


  function perimFillVectorLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/2'
    function style(feat) {
      let sclr = 'rgba(255,0,0,0.7)';
      let fclr = 'rgba(255,255,0,0.5)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),
        stroke: new ol.style.Stroke({ color: sclr, width: 2 }),

      });
    }
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }



  function cityAreasLayer() {
    const baseUrl = Library.USGS.NatlMap.GovUnits.url + '/19';
    function style(feat) {
      let fclr = 'rgba(255,220,255,0.2)';
      let sclr = 'rgba(255,255,120,1)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),
        //stroke: new ol.style.Stroke({ color: sclr, width: 1 }),
      });
    }
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }


  function unincAreasLayer() {
    const baseUrl = Library.USGS.NatlMap.GovUnits.url + '/20';
    function style(feat) {
      let fclr = 'rgba(255,230,255,0.2)';
      let sclr = 'rgba(255,255,120,1)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),
        //stroke: new ol.style.Stroke({ color: sclr, width: 1 }),
      });
    }
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }
  
  function satelliteVectorLayer(l) {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + l;
    function style(feat) {
      let sclr = 'rgba(255,255,0,0.01)';
      let fclr = 'rgba(255,255,0,0)';
      const time = feat.get('load_stat');
      if (time == 'Last 24-48 hrs') {
        sclr = 'rgba(255,255,0,0.1)'
        fclr = 'rgba(255,255,0,0)'
      } else if (time == 'Last 12-24 hrs') {
        sclr = 'rgba(255,165,0,0.2)'
        fclr = 'rgba(255,165,0,0.1)'
      } else if (time == 'Active Burning') {
        sclr = 'rgba(255,0,0,0.4)'
        fclr = 'rgba(255,0,0,0.4)'
      } else {
        return null;
      }
      return new ol.style.Style({
        zIndex: -(feat.get('julian') * 1000000 + feat.get('gmt')),
        fill: zoom > 12.5 ? null : new ol.style.Fill({
          color: fclr
        }),

        stroke: new ol.style.Stroke({ color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash:zoom>=12.5?[3,3]:null }),

      });
    }
    
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });


  }


  const namedTextStyle = function (feature) {

    const title = feature.get('gaz_name');
    const geom = feature.getGeometry();
    if (!title || !geom) {
      return null;
    }

    const featCenter = ol.extent.getCenter(geom.getExtent());

    // TODO: Doesn't work at dateline or poles.
    let align = 'left';
    offsetX = 0;
    if (featCenter[0] > centerX) {
      align = 'right';
      offsetX = -0;
    }

    let baseline = 'bottom';
    let offsetY = -3;
    if (featCenter[1] > centerY) {
      baseline = 'top';
      offsetY = 7;
    }

    return new ol.style.Text({
      textAlign: align,
      textBaseline: baseline,
      font: '11px Roboto',
      text: title,
      fill: new ol.style.Fill({ color: '#000000' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }),
      offsetX: offsetX,
      offsetY: offsetY,
    });
  };


  const greenDot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAAlwSFlzAAAhOAAAITgBRZYxYAAAA99JREFUaAXtWU1rE1EUPZMvIymVGrWtKBRCRbrya+FacOFS3LhwIbrS/+DK36H4D/wBontF0Y1FKkVBsVYs1Wo0bdqM9yQ2mXm5d5I0M2MjPTDJfLx3z7lv3te9A+xhrwWGagFvqNqdyiVUMjdR8y+jhhNylLHh57GJlv0cfBS8OopYkWMBRe8hFhv3pHq1Y+JfnFVwFVOZ18hhS+j9gY681GFd2kgds7iCsrc8kOAoB2mLNhPHBA5gOvtceBqxie841mjaJkciqOACxrxfCQgPdz1ykCtWVHAdhR30807rhkX2uk8ucvaB3rMQDb3HfTEZXZZPpzLAZBaYkIuSnBf+KtiQ/6r0ulXxY1nG+2c5p0tRyEqJGdzAIh5EFYsWxVf5AY+wAVFjIC/3Z3NARY590ebaFtZF/eIm8FaOevtu90lBxtpxXBQnnnQ/bN2xGTmY6t4Sfvr7rco4Jq19Sjwo2mbMunxQE0deiQcfOQsbGPN+I+9PYxXftRJ2yxazjyPFnxbh56WP7FQ81bAubdCWBTYgtRjQHeCcvLR1xqjTImWXiQu0RUcsUIuxTujvfsL7IgPusGqPrRWn+CAJx8VLY1CURdOKPxkszvPuN8Cl3RLPPp+UeKqhbXJoWPGPaNuObgeqmTtafbCbcsAmDXJYNIo214ESvjZOqho5VQ4zYFWjyk1ykEvDSlNbKfgo7AC3xJtKt+JISbLrBBXxnFza6KyLNmoMIOwA9/MauML2u0hp9Qe9Ry5yanA0hksxGNHA7UHasDgdja4DZVUn9zZpw+JktBdA2AGGgRq4MUsbFqejMaxsO4Z1xUYskm7R2K4tTkdj2IHY2NMzFHaA2QMN3M+nDYvT0Rh2gKkPDQxG0obF6WgMO8C8jQZGUmnD4nQ0ug4sqDoZBqYNi5OJsQAcByRjpoExLMPAtEAucmpgVi8Ad4UqyU5wTeLUsGOsMCf7kzl9mQjYi+d0XobivMQGLvISI9cxLrfbKUlXaBXlzBu3XvOaAThj2KRBDnJpaGlri2cR1wFJhzTuanWb2QMG4EmDHBaNos3tQi15Ix1S0oVD/i351fsLY9aoNEirCQb/pU0rHqaWg/5tzaj+BliSSdylrbNapea9OIP7qGC+peWFaDmnabEdGJHElh2p1LCOGTzFD1wz86Jr0sveyYzBKXtc5oOc3R6h1uM8vyD1nsmG55veU5vlmVo8ikv4BH1mlEK9GXd5cjfUMObFLk6vm5q7Hoz0B45tb0b6E9O2E/xnopWLXa8vLf0+py0jeRukjf98mM+s/DQbw2fW3rNQf26P6Ifu/pzbK/Vft8Af9uH7DWvWvj0AAAAASUVORK5CYII=';
  function geoNamesVectorLayer(l) {
    
    function style(feat) {
      return new ol.style.Style({
        zIndex: feat.getGeometry().getPoints()[0][0],
        geometry: feat.getGeometry().getPoints()[0],
        text: namedTextStyle(feat),
        image:
          new ol.style.Circle({
            radius: 3,
            fill: new ol.style.Fill({
              color: 'rgba(0, 0, 0, 1)'
            }),
          })
      });
    }

    const baseUrl = Library.USGS.NatlMap.Names.url + '/' + l;
    
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: true,
    });
  }

  function fireVectorLayer(l) {

    function style(feat) {
      return new ol.style.Style({
        image:
          new ol.style.Circle({
            radius: 3,
            fill: new ol.style.Fill({
              color: 'rgba(255, 0, 0, 0.5)'
            }),
          })
      });
    }

    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + l;
    
    let source = tiledVectorLayer(baseUrl, 1024);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });


  }

  function citiesVectorLayer() {
    function cityFeature(city) {

      return {
        'type': 'Feature',
        'properties': {
          'gaz_name': city.name,
          'population': city.population,
        },
        'geometry': {
          'type': 'Point',
          'coordinates': [city.lon, city.lat],
        }
      };
    }

    let citiesBest = cities.closest;
    if (!detail) {
      citiesBest = cities.closest.slice(0, 3).concat(cities.biggest.slice(0, 5));
    }

    let allFeats = {
      'type': 'FeatureCollection',
      'crs': {
        'type': 'name',
        'properties': {
          'name': 'EPSG:4326'
        }
      },
      'features': citiesBest.map(cityFeature)
    };
    function style(feat) {
      return new ol.style.Style({
        zIndex: -feat.get('population'),
        text: namedTextStyle(feat),
        image:
          new ol.style.Circle({
            radius: 3,
            fill: new ol.style.Fill({
              color: 'rgba(0, 0, 0, 1)'
            }),
          })
      });
    }
    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: (new ol.format.GeoJSON()).readFeatures(allFeats),
      }),
      style: style,
      declutter: true,
    });
  }

  let ZoomedRoads = zoom < 11.5 ? Library.USGS.NatlMap.RoadsLowScale : (zoom < 12.5 ? Library.USGS.NatlMap.RoadsMediumScale : Library.USGS.NatlMap.Roads);

  let perimLayers = [
    // Library.Census.Tiger.USLandmass,
    Library.USGS.NatlMap.Blank,
    Alpha(Library.USGS.NatlMap.Imagery, 1.0),
    //Alpha(Library.USGS.ProtectedAreas.SimpleDesignations, 0.3),
    //'UnincAreas',
    //'CityAreas',
    //Library.USGS.NatlMap.Polygons,
    Library.Census.Tiger.States,
    //Alpha(Library.Census.Tiger.HydroBodies, 0.5),
    //Alpha(Library.Census.Tiger.HydroPaths, 0.2),
    ZoomedRoads,
    //Alpha(Library.USGS.NatlMap.TransportNotInCensusMediumScale, 0.3),
    'Perim',
    'VIIRS',
    'MODIS',
    Library.USGS.NatlMap.GovUnits,
    Library.Census.Tiger.Roads,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    zoom > 10.5 ? Library.USGS.NatlMap.Names : 'Cities',
  ];
  let overviewLayers = [
    Library.Census.Tiger.USLandmass,
    Library.USGS.NatlMap.Blank,
    Alpha(Library.USGS.NatlMap.ImageryTiled, 0.1),
    Alpha(Library.USGS.ProtectedAreas.SimpleDesignations, 0.1),
    Library.Census.Tiger.States,
    Library.Census.Tiger.Hydro,
    ZoomedRoads,
    Library.Census.Tiger.Roads,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    'PerimFill',
    'Fires',
    'Complexes',
    Library.USGS.NatlMap.Names,
    'Cities',
  ];

  let configs = detail ? perimLayers : overviewLayers;
  
  function configToLayer(config) {
    let source = null;
    let ltype = null;
    if (config === 'VIIRS') {
      return satelliteVectorLayer(5);
    } else if (config === 'MODIS') {
      return satelliteVectorLayer(4);
    } else if (config === 'Perim') {
      return perimVectorLayer();
    } else if (config === 'PerimFill') {
      return perimFillVectorLayer();
    } else if (config === 'Cities') {
      return citiesVectorLayer();
    } else if (config === 'Fires') {
      return fireVectorLayer(0);
    } else if (config === 'Complexes') {
      return fireVectorLayer(1);
    } else if (config === 'TNM-Cities') {
      return geoNamesVectorLayer(18);
    } else if (config === 'CityAreas') {
      return cityAreasLayer();
    } else if (config === 'UnincAreas') {
      return unincAreasLayer();
    }
    if (config.tiled) {
      ltype = ol.layer.Tile;
      source = new ol.source.XYZ({
        hidpi: detail || true,
        ratio: 1,
        params: config.params || {},
        url: config.url,
      });
    } else {
      ltype = ol.layer.Image;
      source = new ol.source.ImageArcGISRest({
        hidpi: detail || true,
        ratio: 1,
        params: config.params || {},
        url: config.url,
      });
    }

    return new ltype({
      source: source,
      opacity: config.opacity || 1.0,
    });
  }

  let layers = configs.map(configToLayer);
  let controls = [];

  controls.push(new ol.control.ScaleLine({ units: 'us', minWidth: 70 }));


  let map = new ol.Map({
    controls: controls,
    pixelRatio: detail ? 3 : 3,
    layers: layers,
    target: 'map',
    view: new ol.View({
      projection: 'EPSG:4326',
      center: [centerX, centerY],
      zoom: zoom
    })
  });
}

