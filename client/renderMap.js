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

function showMap(centerX, centerY, zoom, style, opts) {
  const opt = opts || {};
  const detail = style == 'perim';
  const cities = opts.cities || { closest: [], biggest: [] };
  const excluded = opts.excluded || [];
  const customLayerCount = opts.customLayerCount || 0;
  let showAll = 'show:';

  for (let s = 0; s < 100; s++) {
    showAll = showAll + s + ',';
  }

  let Library = {
    USGS: {
      NatlMap: {
        Blank: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTNMBlank/MapServer',
          attribution: 'USGS The National Map (TNM)',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        HydroNHD: {
          url: 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer',
          attribution: 'USGS TNM: NHD',
          params: { layers: 'show:2,3,7,8,9,10', FORMAT: 'PNG32' }
        },
        Hydro: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}',
          tiled: true,
          attribution: [
            'USGS TNM: NHD',
            'EPA: NHDPlus Med. Res.',
            'USGS TNM: Small-Scale hydrography',
            'NOAA NCEI: ETOPO1 Global Relief',
          ],
          params: { layers: '', FORMAT: 'PNG32' }
        },
        ShadedRelief: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer',
          attribution: ['USGS TNM: 3DEP', 'USGS EROS Center: GMTED2010'],
          params: { layers: '', FORMAT: 'PNG32' }
        },
        Imagery: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
          attribution: 'USGS TNM: Orthoimagery',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        ImageryTiled: {
          tiled: true,
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
          attribution: 'USGS TNM: Orthoimagery',
          params: {}
        },
        ImageryTopo: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer',
          attribution: 'USGS TNM: Orthoimagery and US Topo',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        Polygons: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/selectable_polygons/MapServer',
          attribution: 'USGS',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        Roads: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: { layers: 'show:13,18,21,22,23,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG32' }
        },
        Contours: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/Contours/MapServer/',
          attribution: ['USGS TNM: 3DEP'],
          params: { layers: 'show:1,2,3,4,5,6,7,8,10,11,15,16,21,25,29,33', FORMAT: 'PNG32' }
        },
        ContoursDetail: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/Contours/MapServer/',
          attribution: ['USGS TNM: 3DEP'],
          params: { layers: 'show:13,18,26,27,34,35', FORMAT: 'PNG32' }
        },
        RoadsMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: { layers: 'show:13,18,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG32' }
        },
        RoadsLowScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: { layers: 'show:13,25,26,36', FORMAT: 'PNG32' }
        },
        TransportNotInCensus: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: { layers: 'show:13,18,19,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG32' }
        },
        TransportNotInCensusMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: { layers: 'show:13,18,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG32' }
        },
        GovUnitAreas: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: { layers: 'show:22,23,24,25', FORMAT: 'PNG32' }
        },
        GovUnits: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: { layers: 'exclude:17', FORMAT: 'PNG32' }
        },
        GovUnitsSelectedLabels: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: { layers: 'show:4,5,6,7,16', FORMAT: 'PNG32' }
        },
        Names: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/',
          attribution: 'USGS TNM: GNIS',
          params: { layers: ''/*'show:0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22'*/, FORMAT: 'PNG32' }
        },
        NamesPhysical: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/',
          attribution: 'USGS TNM: GNIS',
          params: { layers: 'show:1', FORMAT: 'PNG32' }
        },
      },
      ProtectedAreas: {
        SimpleDesignations: {
          url: 'https://gis1.usgs.gov/arcgis/rest/services/PADUS1_4/SimpleDesignationType/MapServer',
          attribution: 'USGS GAP, PADUS',
          params: { layers: '', FORMAT: 'PNG32' },
          opacity: 0.3,
        }
      }
    },
    GEOMAC: {
      Fires: {
        url: 'https://wildfire.cr.usgs.gov/ArcGIS/rest/services/geomac_dyn/MapServer',
        attribution: 'USGS GeoMAC (wildfire.cr.usgs.gov)',
        params: {
          FORMAT: 'PNG32',
          layers: 'show:0,1,2',
        },
        opacity: 0.5,
      },
    },
    Census: {
      Tiger: {
        States: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: 'show:0,2,4,6,8,10,12,14,15,16', FORMAT: 'PNG32' }
        },
        Roads: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        USLandmass: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/USLandmass/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: '', FORMAT: 'JPEG', TRANSPARENT: 'false' /* Need the blue oceans */ }
        },
        Hydro: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: '', FORMAT: 'PNG32' }
        },
        HydroPaths: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: 'show:0', FORMAT: 'PNG32' }
        },
        HydroBodies: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: 'show:1,2', FORMAT: 'PNG32' }
        },
        Urban: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: { layers: '', FORMAT: 'PNG32' }
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
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
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
      }),];
    }
    let source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: styles,
      declutter: false,
    });
  }


  function perimNameLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/2'
    function styles(feat) {
      let center = ol.extent.getCenter(feat.getGeometry().getExtent());

      const namedTextStyle = function (feature) {

        const title = feature.get('incidentname') + '\n' + Math.ceil(feature.get('gisacres')) + ' acres';

        return new ol.style.Text({
          font: '12px Roboto',
          text: title,
          fill: new ol.style.Fill({ color: '#ffff00' }),
          stroke: new ol.style.Stroke({ color: '#000000', width: 2 }),
          baseline: 'bottom',
          offsetY: -15,
        });
      };


      const howTextStyle = function (feature) {
        const method = feature.get('mapmethod');
        const date = new Date(feature.get('perimeterdatetime')).toISOString().substr(0,16) + ' UTC';
        const title = date;// + (method ? ('\n via ' + method) : '');

        return new ol.style.Text({
          font: '10px Roboto',
          text: title,
          fill: new ol.style.Fill({ color: '#ffff00' }),
          stroke: new ol.style.Stroke({ color: '#000000', width: 2 }),
          baseline: 'top',
          offsetY: 15,
        });
      };

      return [
        new ol.style.Style({
          geometry: new ol.geom.Point(center),
          text: namedTextStyle(feat),
        }),
        new ol.style.Style({
          geometry: new ol.geom.Point(center),
          text: howTextStyle(feat),
        })];
    }
    let source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
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
    let source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }



  function cityAreasLayer() {
    const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer' + '/28';
    function style(feat) {
      let fclr = 'rgba(255,220,255,0.2)';
      let sclr = 'rgba(255,255,120,1)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),
      });
    }
    let source = tiledVectorLayer(baseUrl, 1024, ['U.S. Census Bureau – TIGER/Line']);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }


  function unincAreasLayer() {
    const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer' + '/30';
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
    let source = tiledVectorLayer(baseUrl, 1024, ['U.S. Census Bureau – TIGER/Line']);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }

  const whiteTri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAtdJREFUaAXtWCuMWlEUhFLSTTEYDDXgkJiG1GGq0ARHLZq6JpVUo1FNqEUjqnCkDtOGtKKGBoLBtKQhcDtzck+W3X37eHzeh+ZNcvZwz2dmONk1m0jEiC8QXyC+QHyB+AL+XeAdqGcI5qtDBY53CGMz31eDJJyOETSvwTfrV4EmXKrx/cx65JGBw18IMV4oFPa/AP8e2I80PsCdmM7n82Y+nxtmrSGzH1kU4WyNEMP9ft8QzFqzfc5FEgO4ErOVSsXsdjv5Asx8aw+Zc5FDFY7EZDKZNOPxWMzrD75Z1xlkzkcGKTiZIMRgs9lU33cy6zpj57kXCbTgQsxlMhkzm83uGNcH6+zrLDL3QkcWDpYIMdbpdNSvY2ZfZ+0e90NFF+piqlgsmvV67Whci+xzTneQuR8aSlDeIMTQYDBQn66Zc7pj98kTCoZQFTPVatXV9P0m53UXmTyBowZFMZFKpcxkMrnv0fXNee4pBzL5AkMaSlOEGGi1Wq5mH2tyTzksH3kDwVuoiHg2mzXL5fIxj6517nFfuZDJ6ztyUFghRLjb7bqaPNTkvnJZXvL7ih7YRbRUKpnNZnPIo2uf++RRTmTy+4YymLcIERwOh67mvDbJo5yWnzq+YARWEavVal79eZojn3IjU+fiqINRRNLptJlOp56MeR0iH3lVA5l6F8MNmH4iRKDdbnv1ddQceVXD6lH3IngPFiHP5XJmtVodZczrMHnJr1rI1D0bL8DwGyHEvV7Pq5+T5sivWlaX+mfhE7aFtFwum+12e5Ixr0vkp45qIlP/ZLzCpv53zYxGI68+zpqjDnQ1qE8fRyOJjS8IIarX62eZOnaZeqptfdDPAzx9ULktvMHHl/pcLBaJRqOhT98z9fZAH/Tzca928OM3TOxfIezPX50cP3Eq2tp3l14YrR9Ooo6/V3bwOfJrxDOnxYBrf6H3GfEnYN1YLr5AfIH4Av/7Bf4Bjm9OkYzIpvwAAAAASUVORK5CYII=';
  const whiteDot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAylJREFUaAXtmb2O2kAQxw0RBVxxIKWBLlddkAgPELoUKfIM6XiDdLzLSVT0IOVqKPIESChVdNElkAqSBhqEMz+EDbJ314sx+Czxl0Y2s7PzsbvenR0c54rrCJw0ArmTeqs714R9L3QndCtUFFoJ/RP6IfRdaCr0YvBKPPko9CD0JORaEHLI04/+qeBGrH4R+i1k47RO5tdOD/ouhs9i6Y+Qzqk4fPSh96x4LdofheI4aNsH/dhJHO9EI9Nt68gpcs9iB3uRsN2F3oumr0LsKkbk83mn0Wg49XrdqVarTqlUcpbLpTObzZzJZOKMx2Nns9kYdewa2bU+CX2zETbJMBJ/hYwj2mq13G636y4WC9eE+Xy+lUM+SufOrtVMiKwSrEXjsmk2m+5oNDL5rG0bDocu/cWGiVhOsb8J7Qeby+XcTqfjrtdrrYM2DfRHD/oMgeDH0WBLUyotFApur9ez8c9aBn3o1dkU/lFbLIeKcp9npJJ23osSvYaZwB/rw44TVjkaTPc5gX6dbeHjVyTITZTpAR/cqWs+Knj0Gz5sNpTI3IkESzkKcXebKKeD7exOOh+Ej39GPEhrSAH79iVhOCfwz0fef9u/fNi/7t/a7fb+xwXeDPaU/nkucRkJjb6kB5EnbNKzw4mNXZU/wsPPLYIz8NZrOHyS25TL5UPW2d8rlco2p9IYuvf4wQDeeA2HTxKzNGCwy3V1i2AAymyzVvNnzOt3kafBru9nMAAu4CEUi0p2SC5phsGu71AwAKoHIaxWSnZILmkG9wgNfIeCAXCJCGE6TacKwiVIA9/PYADUbULgJpUGDHaVfuJj5s8B1srP4Ghzh+33+0H2WX8PBgPd3Rn/jGs6U7mQahRTz0bJesUxHUVmo5m/DzArmb6REUDm78QEQRVAuQ6zUJUgAJDpuhABZL4yRxAvujZ61uo0+TwpMdksCWFa1WlmATATxkKvtCs/+hj85509eSQLvgnthy1tSQSA/tjVaNtw2WKVtdMTgkAfei8GDrvM/kt5OErkTiRYZLFPQjbLCDnk6Uf/2LDdhY4xwKWIus2dUCb+qT8muKtscAT+A8FCHrHOcDhMAAAAAElFTkSuQmCC';
  
  
  function satelliteVectorLayer(l) {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + l;
    function style(feat) {
      let sclr = 'rgba(255,255,0,0.1)';
      let fclr = 'rgba(255,255,0,0)';
      let topZindex = -100;
      const time = feat.get('load_stat');
      if (time == 'Last 24-48 hrs') {
        sclr = 'rgba(255,255,0,0.4)'
        fclr = 'rgba(255,255,0,0.1)'
        topZindex = -50;
      } else if (time == 'Last 12-24 hrs') {
        sclr = 'rgba(255,165,0,0.6)'
        fclr = 'rgba(255,165,0,0.1)'
        topZindex = -25;
      } else if (time == 'Active Burning') {
        sclr = 'rgba(255,0,0,0.8)'
        fclr = 'rgba(255,0,0,0.1)'
        topZindex = 0;
      } else {
        return null;
      }
      return [
        new ol.style.Style({
          geometry: feat.getGeometry(),
          zIndex: topZindex, //-(feat.get('julian') * 100000 + feat.get('gmt')),
          fill: zoom > 12.5 ? null : new ol.style.Fill({
            color: fclr
          }),
          stroke: new ol.style.Stroke({ color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash:zoom>=12.5?[3,3]:[3,3] }),
        }),
      ]
    }

    const modisCredit = 'MODIS (RSAC/USFS/NASA)';
    const viirsCredit = 'VIIRS I (NASA/NOAA S-NPP)';
    const legend = 'Ellipses indicate satellite inferences of &ge;1 fire in area (red: active burn, orange: &le;24hrs, yellow: earlier)';
    
    let source = tiledVectorLayer(baseUrl, 1024, [Library.GEOMAC.Fires.attribution, modisCredit, viirsCredit, legend], {}, {overlaps: false});
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
      offsetY = 5;
    }

    return new ol.style.Text({
      textAlign: align,
      textBaseline: baseline,
      font: '11px Roboto',
      text: title,
      fill: new ol.style.Fill({ color: '#000000' }),
      stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }),
      offsetX: offsetX,
      offsetY: offsetY,
    });
  };

  function geoNamesVectorLayer(l, args, img, tint) {
    
    function style(feat) {
      return new ol.style.Style({
        zIndex: feat.getGeometry().getPoints()[0][0],
        geometry: feat.getGeometry().getPoints()[0],
        text: namedTextStyle(feat),
        image: new ol.style.Icon({size: [48,48], src:img || whiteDot, color: tint || '#66ff66', scale:1.0/6.0}),
      });
    }

    const baseUrl = Library.USGS.NatlMap.Names.url + '/' + l;
    
    let source = tiledVectorLayer(baseUrl, 1024, Library.USGS.NatlMap.Names.attribution, args);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: img ? true : true,
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
    
    let source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });


  }

  function summitsVectorLayer() {
    return geoNamesVectorLayer('1', {where: 'gaz_featureclass=\'Summit\''}, whiteTri, '#dddd22');
  }


  function infraredStyle(time) {
    let sclr = 'rgba(255,255,0,0.1)';
    let fclr = 'rgba(255,255,0,0)';
    let topZindex = -100;
    if (time == 'Last 24-48 hrs') {
      sclr = 'rgba(255,255,0,0.4)'
      fclr = 'rgba(255,255,0,0.1)'
      topZindex = -50;
    } else if (time == 'Last 12-24 hrs') {
      sclr = 'rgba(255,165,0,0.6)'
      fclr = 'rgba(255,165,0,0.1)'
      topZindex = -25;
    } else if (time == 'Last 6-12 hrs') {
      sclr = 'rgba(255,0,0,0.8)'
      fclr = 'rgba(255,0,0,0.1)'
      topZindex = 0;
    } else if (time == 'Active Burning') {
      sclr = 'rgba(255,50,50,0.8)'
      fclr = 'rgba(255,50,50,0.25)'
      topZindex = 0;
    } else {
      return null;
    }
    return [
      new ol.style.Style({
        zIndex: topZindex,
        fill: zoom > 12.5 ? null : new ol.style.Fill({
          color: fclr
        }),
        stroke: new ol.style.Stroke({ color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash:zoom>=12.5?[3,3]:[3,3] }),
      }),
    ]
  }

  const afmStyles = {
    '12_to_24hr_fire': infraredStyle('Last 12-24 hrs'),
    '06_to_12hr_fire': infraredStyle('Last 6-12 hrs'),
    '00_to_06hr_fire': infraredStyle('Active Burning'),
    'prev_6_days_fire': infraredStyle('Last 24-48 hrs'),
  };

  function kmlStyle(sclr, fclr) {
    return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr
        }),
        stroke: new ol.style.Stroke({ color: sclr, width: 2 }),
      });
  }
  const kmlStyles = {
    'heat_perimeter': kmlStyle('rgba(255,0,0,255)', 'rgba(0,0,0,0)'),
    'intense_heat': kmlStyle('rgba(255,0,0,0)', 'rgba(255,0,0,0.5)'),
    'scattered_heat': kmlStyle('rgba(255,0,0,0)', 'rgba(255,255,0,0.2)'),
    'noData': kmlStyle('rgba(255,0,0,0)', 'rgba(50,50,50,0.7)'),
    'isolated_heat': new ol.style.Style({
      image: new ol.style.Icon({src:whiteDot, color: '#ff0000', scale:1.0/6.0}),
    }),
  };

  function afmKmlLayer(url) {

    const modisCredit = 'MODIS (RSAC/USFS/NASA)';
    const viirsCredit = 'VIIRS I (NASA/NOAA S-NPP)';
    const legend = 'Rectangles indicate satellite inferences of &ge;1 fire in area (red: &le;12hrs, orange: &le;24hrs, yellow: &le;6dy)';
    const afmCredit = 'U.S. Forest Service Active Fire Mapping';

    function stylesFunc(feat) {
      const name = feat.get('styleUrl');
      const parts = name.split('/');
      const styleName = parts[parts.length - 1];
      return afmStyles[styleName] || null;
    }
    return new ol.layer.Vector({
      style: stylesFunc,
      source: new ol.source.Vector({
        attributions: [modisCredit, viirsCredit, legend, afmCredit],
        url: url,
        format: new ol.format.KML({
          extractStyles: false
        }),
      })
    });
  }

  function customKmlLayer(url) {
    function stylesFunc(feat) {
      const name = feat.get('styleUrl');

      const parts = name.split('#');
      const styleName = parts[parts.length - 1];
      console.log(styleName);
      return kmlStyles[styleName] || null;
    }
    return new ol.layer.Vector({
      style: stylesFunc,
      source: new ol.source.Vector({
        attributions: [],
        url: url,
        format: new ol.format.KML({
          extractStyles: false
        }),
      })
    });
  }

  function customGeojsonLayer(url) {
    function stylesFunc(feat) {

      const name = feat.get('styleUrl');

      const parts = name.split('#');
      const styleName = parts[parts.length - 1];
      console.log(styleName);
      const base = kmlStyles[styleName] || null;

      const g = feat.getGeometry();
      if ('GeometryCollection' === g.getType() && base != null) {
        return base;
      } else {
        return base;
      }
    }
    return new ol.layer.Vector({
      style: stylesFunc,
      source: new ol.source.Vector({
        attributions: [],
        url: url,
        format: new ol.format.GeoJSON({
          dataProjection: 'EPSG:4326', 
          featureProjection:'EPSG:4326',
        }),
      })
    });
  }

  function citiesVectorLayer() {
    function cityFeature(city) {

      return {
        'type': 'Feature',
        'properties': {
          'gaz_name': city.name,
          'population': city.population,
          'dist': city.distance,
        },
        'geometry': {
          'type': 'Point',
          'coordinates': ol.proj.fromLonLat([city.lon, city.lat]),
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
          'name': 'EPSG:3857'
        }
      },
      'features': citiesBest.map(cityFeature)
    };
    function style(feat) {
      return new ol.style.Style({
        zIndex: feat.get('dist') < 10 ? (-1000000 + feat.get('dist')): -feat.get('population')/10000.0,
        text: namedTextStyle(feat),
        image: new ol.style.Icon({src:whiteDot, color: '#66ff66', scale:1.0/6.0}),
      });
    }
    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: (new ol.format.GeoJSON({dataProjection: 'EPSG:3857', featureProjection:'EPSG:3857'})).readFeatures(allFeats),
        attributions: 'U.S. Census Bureau Gazetteer',
      }),
      style: style,
      declutter: true,
    });
  }

  let ZoomedRoads = zoom < 11.5 ? Library.USGS.NatlMap.RoadsLowScale : (zoom < 12.5 ? Library.USGS.NatlMap.RoadsMediumScale : Library.USGS.NatlMap.Roads);

  let perimLayers = [
    // Library.Census.Tiger.USLandmass,
    Library.USGS.NatlMap.Blank,
    Library.USGS.NatlMap.ShadedRelief,
    //Alpha(Library.USGS.NatlMap.Imagery, Math.max(Math.min( (zoom-10)/(15-10) * 0.5 + 0.4 ,0.9),0.4)),
    //Alpha(Library.USGS.ProtectedAreas.SimpleDesignations, 0.8),
    Alpha(Library.USGS.NatlMap.GovUnitAreas, 0.23),
    'UnincAreas',
    'CityAreas',
    zoom >= 10 ? Library.USGS.NatlMap.HydroNHD : Library.USGS.NatlMap.Hydro,
    Alpha(Library.USGS.NatlMap.ContoursDetail, 0.05),
    Alpha(Library.USGS.NatlMap.Contours, 0.3),
    //Library.USGS.NatlMap.Polygons,
    Library.Census.Tiger.States,
    //Alpha(Library.Census.Tiger.HydroBodies, 0.5),
    //Alpha(Library.Census.Tiger.HydroPaths, 0.2),
    ZoomedRoads,
    Library.Census.Tiger.Roads,
    //Alpha(Library.USGS.NatlMap.TransportNotInCensusMediumScale, 0.3),
    'Perim',
    //'MODIS',
    'AFM-MODIS',
    //'VIIRS',
    'AFM-VIIRS-I',
    Library.USGS.NatlMap.GovUnits,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    'Perim-Name',
    // 'Summits',
    zoom > 10.5 ? Library.USGS.NatlMap.Names : 'Cities',
  ];
  let overviewLayers = [
    Library.Census.Tiger.USLandmass,
    Library.USGS.NatlMap.Blank,
    //Alpha(Library.USGS.NatlMap.ImageryTiled, 0.1),
    Alpha(Library.USGS.ProtectedAreas.SimpleDesignations, 0.25),
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

  configs = configs.filter(c => !excluded.includes(c));
  
  function configToLayer(config) {
    let source = null;
    let ltype = null;
    if (config === 'VIIRS') {
      return satelliteVectorLayer(5);
    } else if (config === 'MODIS') {
      return satelliteVectorLayer(4);
    } else if (config === 'Perim') {
      return perimVectorLayer();
    } else if (config === 'Perim-Name') {
      return perimNameLayer();
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
    } else if (config === 'Summits') {
      return summitsVectorLayer();
    } else if (config === 'AFM-MODIS') {
      return afmKmlLayer('../kml/modis.kml');
    } else if (config === 'AFM-VIIRS-I') {
      return afmKmlLayer('../kml/viirs-i.kml');
    }
    let opts = {
      hidpi: true,
      ratio: 1,
      params: config.params || {},
      url: config.url,
      attributions: config.attribution || null,
    };
    if (config.tiled) {
      ltype = ol.layer.Tile;
      source = new ol.source.XYZ(opts);
    } else {
      ltype = ol.layer.Image;
      source = new ol.source.ImageArcGISRest(opts);
    }

    return new ltype({
      source: source,
      opacity: config.opacity || 1.0,
    });
  }

  let layers = configs.map(configToLayer);

  for (let cl = 0; cl < customLayerCount; cl++) {
    layers.push(customGeojsonLayer('../kml/custom-' + cl + '.kml.geojson'));
  }
  let controls = [];

  controls.push(new ol.control.ScaleLine({ units: 'us', minWidth: 70 }));

  if (detail) {
    let attribution = new ol.control.Attribution({
      collapsible: false,
      collapsed: false,
    });
    controls.push(attribution);
  }


  let map = new ol.Map({
    controls: controls,
    pixelRatio: detail ? 3 : 3,
    layers: layers,
    target: 'map',
    view: new ol.View({
      projection: 'EPSG:3857',
      //projection: 'EPSG:4326',
      center: ol.proj.fromLonLat([centerX, centerY]),
      zoom: zoom
    })
  });


  // Create the grid
  let grid = new ol.Graticule({
    showLabels: true,
    latLabelStyle: new ol.style.Text({
      font: '8px Roboto',
      textAlign: 'end',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,0,1)'
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(255,255,255,1)',
        width: 2
      })
    }),
    lonLabelStyle: new ol.style.Text({
      font: '8px Roboto',
      textBaseline: 'bottom',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,0,1)'
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(255,255,255,1)',
        width: 2
      })
    })
  });
  if (detail) {
    grid.setMap(map);
  }
}

