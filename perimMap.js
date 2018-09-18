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

function showMap(centerX, centerY, zoom, detail, cities0) {
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
      let fclr = 'rgba(255,0,0,0.03)';
      let sclr2 = 'rgba(255,160,0,1)';
      return [new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),

        stroke: new ol.style.Stroke({ color: sclr2, width: 3 }),

      }), new ol.style.Style({
        stroke: new ol.style.Stroke({ color: sclr, width: 2 }),
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

  function fireVectorLayer(l) {

    const textStyle = function (feature) {
      return new ol.style.Text({
        textAlign: 'center',
        textBaseline: 'bottom',
        font: '15px Roboto',
        text: feature.get('incidentname'),
        fill: new ol.style.Fill({ color: '#000000' }),
        stroke: new ol.style.Stroke({ color: '#ff0000', width: 3 }),
        offsetX: 0,
        offsetY: 0,
      });
    };
    
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
          'name': city.name,
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
        text: textStyle(feat),
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
    Alpha(Library.USGS.NatlMap.ImageryTiled, 0.1),
    Alpha(Library.USGS.ProtectedAreas.SimpleDesignations, 0.1),
    //Library.USGS.NatlMap.Polygons,
    Library.Census.Tiger.States,
    Library.Census.Tiger.HydroBodies,
    //Alpha(Library.Census.Tiger.HydroPaths, 0.2),
    ZoomedRoads,
    'Perim',
    'VIIRS',
    'MODIS',
    Library.USGS.NatlMap.GovUnits,
    Library.Census.Tiger.Roads,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    Library.USGS.NatlMap.Names,
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

