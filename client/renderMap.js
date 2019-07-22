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

// This function is used in the rendering templates.

/* exported showMap */
function showMap(centerX, centerY, zoom, style, opt, source) {
  const opts = opt || {};
  const detail = style === 'perim';
  const cities = opts.cities || {closest: [], biggest: []};
  const excluded = opts.excluded || [];
  const events = opts.events || [];
  const customLayerCount = opts.customLayerCount || 0;
  let showAll = 'show:';

  QRCode.toCanvas(document.getElementById('qrcode'), opts.qrcode, {errorCorrectionLevel: 'L'}, function(error) {
    $('#qrcode').width(detail ? 75 : 125).height(detail ? 75 : 125);
    if (detail) {
      const gfxContext = document.getElementById('qrcode').getContext('2d');
      // We're going to invert colors by subtracting from white.
      gfxContext.globalCompositeOperation = 'difference';
      gfxContext.fillStyle = 'white';
      gfxContext.fillRect(0, 0, 1000, 1000);
    }
  });

  for (let s = 0; s < 100; s++) {
    showAll = showAll + s + ',';
  }

  const Library = {
    USGS: {
      NatlMap: {
        Blank: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTNMBlank/MapServer',
          attribution: 'USGS The National Map (TNM)',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        HydroNHD: {
          url: 'https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer',
          attribution: 'USGS TNM: NHD',
          params: {layers: 'show:2,3,7,8,9,10', FORMAT: 'PNG32'},
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
          params: {layers: '', FORMAT: 'PNG32'},
        },
        ShadedRelief: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer',
          attribution: ['USGS TNM: 3DEP', 'USGS EROS Center: GMTED2010'],
          params: {layers: '', FORMAT: 'PNG32'},
        },
        Imagery: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer',
          attribution: 'USGS TNM: Orthoimagery',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        ImageryTiled: {
          tiled: true,
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}',
          attribution: 'USGS TNM: Orthoimagery',
          params: {},
        },
        ImageryTopo: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer',
          attribution: 'USGS TNM: Orthoimagery and US Topo',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        NAIPImagery: {
          url: 'https://services.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer',
          attribution: 'USGS TNM: Orthoimagery',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        Topo: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer',
          attribution: [
            'USGS TNM: NBD, 3DEP, GNIS, NHD, NLCD, NSD, NTD',
            'USGS Global Ecosystems',
            'U.S. Census Bureau – TIGER/Line',
            'USFS Road Data',
            'Natural Earth Data',
            'U.S. State Dept Humanitarian Information Unit',
            'NOAA NCEI, U.S. Coastal Relief Model'],
          params: {layers: '', FORMAT: 'PNG32'},
        },
        TopoTiled: {
          url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
          tiled: true,
          attribution: [
            'USGS TNM: NBD, 3DEP, GNIS, NHD, NLCD, NSD, NTD',
            'USGS Global Ecosystems',
            'U.S. Census Bureau – TIGER/Line',
            'USFS Road Data',
            'Natural Earth Data',
            'U.S. State Dept Humanitarian Information Unit',
            'NOAA NCEI, U.S. Coastal Relief Model'],
          params: {layers: '', FORMAT: 'PNG32'},
        },
        Polygons: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/selectable_polygons/MapServer',
          attribution: 'USGS',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        Roads: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: {layers: 'show:13,18,21,22,23,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG32'},
        },
        Contours: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/Contours/MapServer/',
          attribution: ['USGS TNM: 3DEP'],
          params: {layers: 'show:1,2,3,4,5,6,7,8,10,11,15,16,21,25,29,33', FORMAT: 'PNG32'},
        },
        ContoursDetail: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/Contours/MapServer/',
          attribution: ['USGS TNM: 3DEP'],
          params: {layers: 'show:13,18,26,27,34,35', FORMAT: 'PNG32'},
        },
        RoadsMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: {layers: 'show:13,18,25,26,27,28,29,30,31,32,33,34,35,36', FORMAT: 'PNG32'},
        },
        RoadsLowScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: {layers: 'show:13,25,26,36', FORMAT: 'PNG32'},
        },
        TransportNotInCensus: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: {layers: 'show:13,18,19,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG32'},
        },
        TransportNotInCensusMediumScale: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/',
          attribution: ['USGS TNM: NTD', 'U.S. Census Bureau – TIGER/Line', 'U.S. Forest Service'],
          params: {layers: 'show:13,18,25,26,29,30,31,32,33,34,35,36', FORMAT: 'PNG32'},
        },
        GovUnitAreas: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: {layers: 'show:22,23,24,25', FORMAT: 'PNG32'},
        },
        GovUnits: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: {layers: 'exclude:17', FORMAT: 'PNG32'},
        },
        GovUnitsSelectedLabels: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/govunits/MapServer/',
          attribution: 'USGS TNM: NBD',
          params: {layers: 'show:4,5,6,7,16', FORMAT: 'PNG32'},
        },
        Names: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/',
          attribution: 'USGS TNM: GNIS',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        NamesPhysical: {
          url: 'https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/',
          attribution: 'USGS TNM: GNIS',
          params: {layers: 'show:1', FORMAT: 'PNG32'},
        },
      },
      ProtectedAreas: {
        SimpleDesignations: {
          url: 'https://gis1.usgs.gov/arcgis/rest/services/PADUS1_4/SimpleDesignationType/MapServer/tile/{z}/{y}/{x}',
          attribution: 'USGS GAP, PADUS',
          tiled: true,
          params: {layers: '', FORMAT: 'PNG32'},
          opacity: 0.3,
        },
      },
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
          params: {layers: 'show:0,2,4,6,8,10,12,14,15,16', FORMAT: 'PNG32'},
        },
        Roads: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        USLandmass: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/USLandmass/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: '', FORMAT: 'JPEG', TRANSPARENT: 'false'},
        },
        Hydro: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: '', FORMAT: 'PNG32'},
        },
        HydroPaths: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: 'show:0', FORMAT: 'PNG32'},
        },
        HydroBodies: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Hydro/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: 'show:1,2', FORMAT: 'PNG32'},
        },
        Urban: {
          url: 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Urban/MapServer',
          attribution: 'U.S. Census Bureau – TIGER/Line',
          params: {layers: '', FORMAT: 'PNG32'},
        },
      },
    },
  };

  function alphaLayer(config, opacity) {
    const ret = Object.assign({}, config);
    ret.opacity = opacity;
    return ret;
  }

  function perimVectorLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + (opt.perimSourceLayer || '2');
    function styles(feat) {
      const sclr = 'rgba(255,0,0,1)';
      return [new ol.style.Style({
        stroke: new ol.style.Stroke({color: sclr, width: 4}),
      })];
    }
    const source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: styles,
      declutter: false,
    });
  }


  function perimNameLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + (opt.perimSourceLayer || '2');
    function styles(feat) {
      const center = ol.extent.getCenter(feat.getGeometry().getExtent());

      const namedTextStyle = function(feature) {
        const title = feature.get('incidentname');

        return new ol.style.Text({
          font: '17px Roboto',
          text: title,
          fill: new ol.style.Fill({color: '#000000'}),
          stroke: new ol.style.Stroke({color: '#ffffff', width: 2}),
          baseline: 'bottom',
          offsetY: -17,
        });
      };


      const howTextStyle = function(feature) {
        const date = new Date(feature.get('perimeterdatetime')).toISOString().substr(0, 16) + ' UTC';
        const title = date;

        return new ol.style.Text({
          font: '12px Roboto',
          text: title,
          fill: new ol.style.Fill({color: '#000000'}),
          stroke: new ol.style.Stroke({color: '#ffffff', width: 2}),
          baseline: 'top',
          offsetY: 17,
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
    const source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: styles,
      declutter: false,
    });
  }


  function perimFillVectorLayer() {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + (opt.perimSourceLayer || '2');
    function style(feat) {
      const sclr = 'rgba(255,0,0,0.7)';
      const fclr = 'rgba(255,255,0,0.5)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr,
        }),
        stroke: new ol.style.Stroke({color: sclr, width: 2}),

      });
    }
    const source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }


  function cityAreasLayer() {
    const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer' + '/28';
    function style(feat) {
      const fclr = 'rgba(255,220,255,0.4)';
      const sclr = 'rgba(155,120,155,1)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr,
        }),
        stroke: new ol.style.Stroke({color: sclr, width: 0.5}),
      });
    }
    const source = tiledVectorLayer(baseUrl, 1024, ['U.S. Census Bureau – TIGER/Line']);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }


  function unincAreasLayer() {
    const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer' + '/30';
    function style(feat) {
      const fclr = 'rgba(255,230,255,0.4)';
      const sclr = 'rgba(155,130,155,1)';
      return new ol.style.Style({
        fill: new ol.style.Fill({
          color: fclr,
        }),
        stroke: new ol.style.Stroke({color: sclr, width: 0.5}),
      });
    }
    const source = tiledVectorLayer(baseUrl, 1024, ['U.S. Census Bureau – TIGER/Line']);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }

  const whiteTri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAtdJREFUaAXtWCuMWlEUhFLSTTEYDDXgkJiG1GGq0ARHLZq6JpVUo1FNqEUjqnCkDtOGtKKGBoLBtKQhcDtzck+W3X37eHzeh+ZNcvZwz2dmONk1m0jEiC8QXyC+QHyB+AL+XeAdqGcI5qtDBY53CGMz31eDJJyOETSvwTfrV4EmXKrx/cx65JGBw18IMV4oFPa/AP8e2I80PsCdmM7n82Y+nxtmrSGzH1kU4WyNEMP9ft8QzFqzfc5FEgO4ErOVSsXsdjv5Asx8aw+Zc5FDFY7EZDKZNOPxWMzrD75Z1xlkzkcGKTiZIMRgs9lU33cy6zpj57kXCbTgQsxlMhkzm83uGNcH6+zrLDL3QkcWDpYIMdbpdNSvY2ZfZ+0e90NFF+piqlgsmvV67Whci+xzTneQuR8aSlDeIMTQYDBQn66Zc7pj98kTCoZQFTPVatXV9P0m53UXmTyBowZFMZFKpcxkMrnv0fXNee4pBzL5AkMaSlOEGGi1Wq5mH2tyTzksH3kDwVuoiHg2mzXL5fIxj6517nFfuZDJ6ztyUFghRLjb7bqaPNTkvnJZXvL7ih7YRbRUKpnNZnPIo2uf++RRTmTy+4YymLcIERwOh67mvDbJo5yWnzq+YARWEavVal79eZojn3IjU+fiqINRRNLptJlOp56MeR0iH3lVA5l6F8MNmH4iRKDdbnv1ddQceVXD6lH3IngPFiHP5XJmtVodZczrMHnJr1rI1D0bL8DwGyHEvV7Pq5+T5sivWlaX+mfhE7aFtFwum+12e5Ixr0vkp45qIlP/ZLzCpv53zYxGI68+zpqjDnQ1qE8fRyOJjS8IIarX62eZOnaZeqptfdDPAzx9ULktvMHHl/pcLBaJRqOhT98z9fZAH/Tzca928OM3TOxfIezPX50cP3Eq2tp3l14YrR9Ooo6/V3bwOfJrxDOnxYBrf6H3GfEnYN1YLr5AfIH4Av/7Bf4Bjm9OkYzIpvwAAAAASUVORK5CYII=';
  const whiteDot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAylJREFUaAXtmb2O2kAQxw0RBVxxIKWBLlddkAgPELoUKfIM6XiDdLzLSVT0IOVqKPIESChVdNElkAqSBhqEMz+EDbJ314sx+Czxl0Y2s7PzsbvenR0c54rrCJw0ArmTeqs714R9L3QndCtUFFoJ/RP6IfRdaCr0YvBKPPko9CD0JORaEHLI04/+qeBGrH4R+i1k47RO5tdOD/ouhs9i6Y+Qzqk4fPSh96x4LdofheI4aNsH/dhJHO9EI9Nt68gpcs9iB3uRsN2F3oumr0LsKkbk83mn0Wg49XrdqVarTqlUcpbLpTObzZzJZOKMx2Nns9kYdewa2bU+CX2zETbJMBJ/hYwj2mq13G636y4WC9eE+Xy+lUM+SufOrtVMiKwSrEXjsmk2m+5oNDL5rG0bDocu/cWGiVhOsb8J7Qeby+XcTqfjrtdrrYM2DfRHD/oMgeDH0WBLUyotFApur9ez8c9aBn3o1dkU/lFbLIeKcp9npJJ23osSvYaZwB/rw44TVjkaTPc5gX6dbeHjVyTITZTpAR/cqWs+Knj0Gz5sNpTI3IkESzkKcXebKKeD7exOOh+Ej39GPEhrSAH79iVhOCfwz0fef9u/fNi/7t/a7fb+xwXeDPaU/nkucRkJjb6kB5EnbNKzw4mNXZU/wsPPLYIz8NZrOHyS25TL5UPW2d8rlco2p9IYuvf4wQDeeA2HTxKzNGCwy3V1i2AAymyzVvNnzOt3kafBru9nMAAu4CEUi0p2SC5phsGu71AwAKoHIaxWSnZILmkG9wgNfIeCAXCJCGE6TacKwiVIA9/PYADUbULgJpUGDHaVfuJj5s8B1srP4Ghzh+33+0H2WX8PBgPd3Rn/jGs6U7mQahRTz0bJesUxHUVmo5m/DzArmb6REUDm78QEQRVAuQ6zUJUgAJDpuhABZL4yRxAvujZ61uo0+TwpMdksCWFa1WlmATATxkKvtCs/+hj85509eSQLvgnthy1tSQSA/tjVaNtw2WKVtdMTgkAfei8GDrvM/kt5OErkTiRYZLFPQjbLCDnk6Uf/2LDdhY4xwKWIus2dUCb+qT8muKtscAT+A8FCHrHOcDhMAAAAAElFTkSuQmCC';

  const satelliteVectorStyles = {
    'Last 24-48 hrs': {
      sclr: 'rgba(255,255,0,0.4)',
      fclr: 'rgba(255,255,0,0.1)',
      topZindex: -50,
    },
    'Last 12-24 hrs': {
      sclr: 'rgba(255,165,0,0.6)',
      fclr: 'rgba(255,165,0,0.1)',
      topZindex: -25,
    },
    'Last 6-12 hrs': {
      sclr: 'rgba(255,0,0,0.8)',
      fclr: 'rgba(255,0,0,0.1)',
      topZindex: 0,
    },
    'Active Burning': {
      sclr: 'rgba(255,0,0,0.8)',
      fclr: 'rgba(255,0,0,0.1)',
      topZindex: 0,
    },
  };

  function satelliteVectorLayer(l) {
    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + l;
    function style(feat) {
      const time = feat.get('load_stat');
      const s = satelliteVectorStyles[time];
      if (!s) {
        return null;
      }
      const sclr = s.sclr;
      const fclr = s.fclr;
      const topZindex = s.topZindex;
      return [
        new ol.style.Style({
          geometry: feat.getGeometry(),
          zIndex: topZindex,
          fill: zoom > 12.5 ? null : new ol.style.Fill({
            color: fclr,
          }),
          stroke: new ol.style.Stroke({color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash: [3, 3]}),
        }),
      ];
    }

    const modisCredit = 'MODIS (RSAC/USFS/NASA)';
    const viirsCredit = 'VIIRS I (NASA/NOAA S-NPP)';
    const legend = 'Ellipses indicate satellite inferences of &ge;1 fire in area (red: active burn, orange: &le;24hrs, yellow: earlier)';

    const source = tiledVectorLayer(baseUrl, 1024, [Library.GEOMAC.Fires.attribution, modisCredit, viirsCredit, legend], {}, {overlaps: false});
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }


  const namedTextStyle = function(feature) {
    const title = feature.get('gaz_name');
    const geom = feature.getGeometry();
    if (!title || !geom) {
      return null;
    }

    const align = 'center';
    const offsetX = 0;
    const baseline = 'middle';
    const offsetY = 0;

    return new ol.style.Text({
      textAlign: align,
      textBaseline: baseline,
      font: '12px Roboto',
      text: title,
      fill: new ol.style.Fill({color: '#000000'}),
      stroke: new ol.style.Stroke({color: '#ffffff', width: 3}),
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
        image: new ol.style.Icon({size: [48, 48], src: img || whiteDot, color: tint || '#66ff66', scale: 1.0/6.0}),
      });
    }

    const baseUrl = Library.USGS.NatlMap.Names.url + '/' + l;

    const source = tiledVectorLayer(baseUrl, 1024, Library.USGS.NatlMap.Names.attribution, args);
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
              color: 'rgba(255, 0, 0, 0.5)',
            }),
          }),
      });
    }

    const baseUrl = 'https://wildfire.cr.usgs.gov/arcgis/rest/services/geomac_dyn/MapServer/' + l;

    const source = tiledVectorLayer(baseUrl, 1024, Library.GEOMAC.Fires.attribution);
    return new ol.layer.Vector({
      source: source,
      style: style,
      declutter: false,
    });
  }

  function summitsVectorLayer() {
    return geoNamesVectorLayer('1', {where: 'gaz_featureclass=\'Summit\''}, whiteTri, '#dddd22');
  }

  const infraredStyles = {
    'Last 24-48 hrs': {
      sclr: 'rgba(255,255,0,0)',
      fclr: 'rgba(255,255,0,0)',
      topZindex: -50,
    },
    'Last 12-24 hrs': {
      sclr: 'rgba(255,255,0,0.6)',
      fclr: 'rgba(255,255,0,0.1)',
      topZindex: -25,
    },
    'Last 6-12 hrs': {
      sclr: 'rgba(255,0,0,0.8)',
      fclr: 'rgba(255,0,0,0.1)',
      topZindex: 0,
    },
    'Active Burning': {
      sclr: 'rgba(255,50,50,0.8)',
      fclr: 'rgba(255,50,50,0.25)',
      topZindex: 0,
    },
  };

  function infraredStyleRect(time) {
    const s = infraredStyles[time];
    if (!s) {
      return null;
    }
    const sclr = s.sclr;
    const fclr = s.fclr;
    const topZindex = s.topZindex;
    return function(feat) {
      return [
        new ol.style.Style({
          zIndex: topZindex,
          fill: zoom > 12.5 ? null : new ol.style.Fill({
            color: fclr,
          }),
          stroke: new ol.style.Stroke({color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash: [3, 3]}),
        }),
      ];
    };
  }

  function infraredStyleIcon(time) {
    const s = infraredStyles[time];
    if (!s) {
      return null;
    }
    const sclr = s.sclr;
    const fclr = s.fclr;
    const topZindex = s.topZindex;
    return function(feat) {
      const c = ol.extent.getCenter(feat.getGeometry().getExtent());
      return [
        new ol.style.Style({
          // latitude bounds here: https://epsg.io/3857
          // we want northern items 'behind' southern ones
          zIndex: topZindex + (20048966.10-c[1])/(20048966.10*2.0) - 2.1,
          fill: zoom > 12.5 ? null : new ol.style.Fill({
            color: fclr,
          }),
          stroke: new ol.style.Stroke({color: sclr, width: zoom>=12.5 ? 3 : 1, lineDash: [3, 3]}),
        }),
        new ol.style.Style({
          geometry: new ol.geom.Point(c),
          zIndex: topZindex + (20048966.10-c[1])/(20048966.10*2.0) - 1.1,
          image: new ol.style.Icon({src: '/imgs/redfire.png', scale: 1.0/25.0, anchor: [0.5, 0.9]}),
        }),
      ];
    };
  }

  const afmStylesIcons = {
    '00_to_06hr_fire': infraredStyleIcon('Active Burning'),
    '06_to_12hr_fire': infraredStyleIcon('Last 6-12 hrs'),
    '12_to_24hr_fire': infraredStyleRect('Last 12-24 hrs'),
    // 'prev_6_days_fire': infraredStyleRect('Last 24-48 hrs'),
  };

  const afmStyles = afmStylesIcons;

  function kmlStyle(sclr, fclr) {
    return new ol.style.Style({
      fill: new ol.style.Fill({
        color: fclr,
      }),
      stroke: new ol.style.Stroke({color: sclr, width: 2}),
    });
  }
  const kmlStyles = {
    'heat_perimeter': kmlStyle('rgba(255,0,0,255)', 'rgba(0,0,0,0)'),
    'intense_heat': kmlStyle('rgba(255,0,0,0)', 'rgba(255,0,0,0.5)'),
    'scattered_heat': kmlStyle('rgba(255,0,0,0)', 'rgba(255,255,0,0.2)'),
    'noData': kmlStyle('rgba(255,0,0,0)', 'rgba(50,50,50,0.7)'),
    'isolated_heat': new ol.style.Style({
      image: new ol.style.Icon({src: whiteDot, color: '#ff0000', scale: 1.0/6.0}),
    }),
  };

  function afmKmlLayer(url, type) {
    const modisCredit = 'MODIS (RSAC/USFS/NASA)';
    const viirsCredit = 'VIIRS I (NASA/NOAA S-NPP)';
    const legend = 'Rectangles and small fire icons indicate satellite inferences of &ge;1 fire in area (red: &le;12hrs, yellow: &le;24hrs, as of the satellite readings which may be hours and days old)';
    const afmCredit = 'U.S. Forest Service Active Fire Mapping';

    function stylesFunc(feat) {
      const name = feat.get('styleUrl');
      const parts = name.split('/');
      const styleName = parts[parts.length - 1];
      return (afmStyles[styleName] || (() => null))(feat);
    }
    return new ol.layer.Vector({
      style: stylesFunc,
      source: new ol.source.Vector({
        attributions: [modisCredit, viirsCredit, legend, afmCredit],
        url: url,
        format: new ol.format.KML({
          extractStyles: false,
        }),
      }),
    });
  }

  function customGeojsonLayer(url) {
    function stylesFunc(feat) {
      const name = feat.get('styleUrl');

      const parts = name.split('#');
      const styleName = parts[parts.length - 1];
      const base = kmlStyles[styleName] || null;
      return base;
    }
    return new ol.layer.Vector({
      style: stylesFunc,
      source: new ol.source.Vector({
        attributions: [],
        url: url,
        format: new ol.format.GeoJSON({
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:4326',
        }),
      }),
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
        },
      };
    }

    let citiesBest = cities.closest;
    if (!detail) {
      citiesBest = cities.closest.slice(0, 3).concat(cities.biggest.slice(0, 5));
    }

    const allFeats = {
      'type': 'FeatureCollection',
      'crs': {
        'type': 'name',
        'properties': {
          'name': 'EPSG:3857',
        },
      },
      'features': citiesBest.map(cityFeature),
    };
    function style(feat) {
      return new ol.style.Style({
        zIndex: feat.get('dist') < 10 ? (-1000000 + feat.get('dist')): -feat.get('population')/10000.0,
        text: namedTextStyle(feat),
        // image: new ol.style.Icon({src:whiteDot, color: '#66ff66', scale:1.0/6.0}),
      });
    }
    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: (new ol.format.GeoJSON({dataProjection: 'EPSG:3857', featureProjection: 'EPSG:3857'})).readFeatures(allFeats),
        attributions: 'U.S. Census Bureau Gazetteer',
      }),
      style: style,
      declutter: true,
    });
  }

  const globalAttributions = {
    'NFSA': ['NWCG/NFSA'],
    'GEOMAC': ['USGS GeoMAC'],
    'CALFIRE': ['CAL FIRE'],
  };

  function eventsVectorLayer(events) {
    function eventFeature(evt) {
      return {
        'type': 'Feature',
        'properties': {
          'name': evt.name || '',
        },
        'geometry': {
          'type': 'Point',
          'coordinates': ol.proj.fromLonLat([evt.lon, evt.lat]),
        },
      };
    }
    const allFeats = {
      'type': 'FeatureCollection',
      'crs': {
        'type': 'name',
        'properties': {
          'name': 'EPSG:3857',
        },
      },
      'features': events.map(eventFeature),
    };
    function style(feat) {
      return [
        new ol.style.Style({
          // text: namedTextStyle(feat),
          image: new ol.style.Icon({src: '/imgs/fire.png', color: '#ffffff', scale: 1.0/9.0, anchor: [0.5, 0.9]}),
        }),
        new ol.style.Style({
          // text: namedTextStyle(feat),
          image: new ol.style.Icon({src: whiteDot, color: '#ff0000', scale: 1.0/3.0}),
        }),
      ];
    }
    return new ol.layer.Vector({
      source: new ol.source.Vector({
        features: (new ol.format.GeoJSON({dataProjection: 'EPSG:3857', featureProjection: 'EPSG:3857'})).readFeatures(allFeats),
        attributions: globalAttributions[source],
      }),
      style: style,
      declutter: false,
    });
  }

  const ZoomedRoads = zoom < 11.5 ? Library.USGS.NatlMap.RoadsLowScale : (zoom < 12.5 ? Library.USGS.NatlMap.RoadsMediumScale : Library.USGS.NatlMap.Roads);

  const perimLayers = [
    Library.USGS.NatlMap.TopoTiled,
    // Library.Census.Tiger.USLandmass,
    Library.USGS.NatlMap.Blank,
    Library.USGS.NatlMap.ShadedRelief,
    // alphaLayer(Library.USGS.NatlMap.Imagery, Math.max(Math.min( (zoom-10)/(15-10) * 0.5 + 0.4, 0.9), 0.4)),
    // alphaLayer(Library.USGS.ProtectedAreas.SimpleDesignations, 0.8),
    alphaLayer(Library.USGS.NatlMap.GovUnitAreas, 0.23),
    'UnincAreas',
    'CityAreas',
    zoom >= 10 ? Library.USGS.NatlMap.HydroNHD : Library.USGS.NatlMap.Hydro,
    Library.USGS.NatlMap.NAIPImagery,
    // alphaLayer(Library.USGS.NatlMap.ContoursDetail, 0.05),
    // alphaLayer(Library.USGS.NatlMap.Contours, 0.3),
    // Library.USGS.NatlMap.Polygons,
    Library.Census.Tiger.States,
    // alphaLayer(Library.Census.Tiger.HydroBodies, 0.5),
    // alphaLayer(Library.Census.Tiger.HydroPaths, 0.2),
    ZoomedRoads,
    Library.Census.Tiger.Roads,
    // alphaLayer(Library.USGS.NatlMap.TransportNotInCensusMediumScale, 0.3),
    'Perim',
    // 'MODIS',
    'AFM-MODIS',
    'AFM-MODIS-AK',
    // 'VIIRS',
    'AFM-VIIRS-I',
    'AFM-VIIRS-I-AK',
    Library.USGS.NatlMap.GovUnits,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    'Events',
    'Perim-Name',
    // 'Summits',
    zoom > 10.9 ? Library.USGS.NatlMap.Names : 'Cities',
  ];
  const overviewLayers = [
    Library.USGS.NatlMap.Topo,
    Library.USGS.NatlMap.Blank,
    // alphaLayer(Library.USGS.NatlMap.ImageryTiled, 0.1),
    alphaLayer(Library.USGS.ProtectedAreas.SimpleDesignations, 0.25),
    Library.Census.Tiger.States,
    Library.Census.Tiger.Hydro,
    ZoomedRoads,
    Library.Census.Tiger.Roads,
    Library.USGS.NatlMap.GovUnitsSelectedLabels,
    'PerimFill',
    'Fires',
    'Complexes',
    'Events',
    Library.USGS.NatlMap.Names,
    'Cities',
  ];

  let configs = detail ? perimLayers : overviewLayers;

  configs = configs.filter((c) => !excluded.includes(c));

  function configToLayer(config) {
    let source = null;
    let LType = null;
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
      return afmKmlLayer('../kml/modis.kml', 'modis');
    } else if (config === 'AFM-VIIRS-I') {
      return afmKmlLayer('../kml/viirs-i.kml', 'viirs');
    } else if (config === 'AFM-MODIS-AK') {
      return afmKmlLayer('../kml/modis-alaska.kml', 'modis');
    } else if (config === 'AFM-VIIRS-I-AK') {
      return afmKmlLayer('../kml/viirs-i-alaska.kml', 'viirs');
    } else if (config === 'Events') {
      return eventsVectorLayer(events);
    }
    const opts = {
      hidpi: true,
      ratio: 1,
      params: config.params || {},
      url: config.url,
      attributions: config.attribution || null,
    };
    if (config.tiled) {
      LType = ol.layer.Tile;
      source = new ol.source.XYZ(opts);
    } else {
      LType = ol.layer.Image;
      source = new ol.source.ImageArcGISRest(opts);
    }

    return new LType({
      source: source,
      opacity: config.opacity || 1.0,
    });
  }

  const layers = configs.map(configToLayer);

  for (let cl = 0; cl < customLayerCount; cl++) {
    layers.push(customGeojsonLayer('../kml/custom-' + cl + '.kml.geojson'));
  }
  const controls = [];

  controls.push(new ol.control.ScaleLine({units: 'us', minWidth: 70}));

  if (detail) {
    const attribution = new ol.control.Attribution({
      collapsible: false,
      collapsed: false,
    });
    controls.push(attribution);
  }


  const map = new ol.Map({
    controls: controls,
    pixelRatio: 3,
    layers: layers,
    target: 'map',
    view: new ol.View({
      projection: 'EPSG:3857',
      center: ol.proj.fromLonLat([centerX, centerY]),
      zoom: zoom,
    }),
  });


  // Create the grid
  const grid = new ol.Graticule({
    showLabels: true,
    latLabelStyle: new ol.style.Text({
      font: '8px Roboto',
      textAlign: 'end',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,0,1)',
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(255,255,255,1)',
        width: 2,
      }),
    }),
    lonLabelStyle: new ol.style.Text({
      font: '8px Roboto',
      textBaseline: 'bottom',
      fill: new ol.style.Fill({
        color: 'rgba(0,0,0,1)',
      }),
      stroke: new ol.style.Stroke({
        color: 'rgba(255,255,255,1)',
        width: 2,
      }),
    }),
  });
  if (detail) {
    grid.setMap(map);
  }
};

