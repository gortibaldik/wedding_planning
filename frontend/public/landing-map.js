/*
 * Venue map for the landing page.
 *
 * Unlike /landing.css (generated from src/landing.scss by a Vite plugin) this is
 * a hand-written static asset: the landing page is a server-rendered Jinja
 * template with no bundler, so it loads this file as-is.
 *
 * Tiles come from OpenFreeMap - no API key, no registration, no request limit,
 * attribution only. The style below is ours rather than one of their stock ones,
 * hand-rolled against the OpenMapTiles vector schema so the map is drawn in the
 * invitation's palette instead of looking like a generic basemap.
 *
 * The map is progressive enhancement: the template already renders the places as
 * a plain list with links, so a blocked CDN or a browser without WebGL simply
 * leaves that list on its own.
 */
;(() => {
  'use strict'

  // Below this zoom the stops sit too close together for their labels to
  // coexist, so only the numbered pins are drawn.
  const LABEL_MIN_ZOOM = 15

  const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js'
  const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css'

  const TILES = 'https://tiles.openfreemap.org/planet'
  const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
  const ATTRIBUTION =
    '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

  // Mirrors the palette at the top of src/landing.scss; the extra tones are
  // paper/sage shades derived from it so the map reads as part of the page.
  const C = {
    pink: '#ac2746',
    paper: '#f5f1e4',
    paperDim: '#efe9d8',
    greenDark: '#495c23',
    greenPale: '#dde5c4',
    water: '#a9c0c4',
    waterDark: '#71898e',
    building: '#e6dfcb',
    buildingLine: '#dbd2ba',
    roadCasing: '#ded5bd',
    road: '#fffdf5',
    motorway: '#f3e7c5',
    motorwayCasing: '#dcc98f',
    rail: '#cfc6ae',
    boundary: '#b5aa8e'
  }

  const byZoom = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops]

  const buildStyle = legs => ({
    version: 8,
    glyphs: GLYPHS,
    sources: {
      openmaptiles: { type: 'vector', url: TILES, attribution: ATTRIBUTION },
      'venue-legs': { type: 'geojson', data: legs }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': C.paper } },
      {
        id: 'landuse-residential',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'residential'],
        paint: { 'fill-color': C.paperDim }
      },
      {
        id: 'landcover-green',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'grass', 'farmland'], true, false],
        paint: { 'fill-color': C.greenPale, 'fill-opacity': 0.75 }
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': C.greenPale, 'fill-opacity': 0.6 }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': C.water }
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': C.water, 'line-width': byZoom(9, 0.6, 16, 2.4) }
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-color': C.building,
          'fill-outline-color': C.buildingLine,
          'fill-opacity': byZoom(13, 0, 14.5, 1)
        }
      },
      {
        id: 'road-minor-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 13,
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.roadCasing, 'line-width': byZoom(13, 1.4, 18, 10) }
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 13,
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': byZoom(13, 0.6, 18, 8) }
      },
      {
        id: 'road-major-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['primary', 'secondary', 'tertiary', 'trunk'],
          true,
          false
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.roadCasing, 'line-width': byZoom(8, 1.2, 13, 4, 18, 22) }
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'match',
          ['get', 'class'],
          ['primary', 'secondary', 'tertiary', 'trunk'],
          true,
          false
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.road, 'line-width': byZoom(8, 0.6, 13, 2.4, 18, 18) }
      },
      {
        id: 'road-motorway-casing',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.motorwayCasing, 'line-width': byZoom(5, 1.2, 13, 5, 18, 26) }
      },
      {
        id: 'road-motorway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['==', ['get', 'class'], 'motorway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.motorway, 'line-width': byZoom(5, 0.6, 13, 3, 18, 22) }
      },
      {
        id: 'railway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        minzoom: 11,
        filter: ['==', ['get', 'class'], 'rail'],
        paint: {
          'line-color': C.rail,
          'line-width': byZoom(11, 0.6, 18, 2),
          'line-dasharray': [3, 2]
        }
      },
      {
        id: 'boundary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: {
          'line-color': C.boundary,
          'line-width': byZoom(4, 0.6, 12, 1.6),
          'line-dasharray': [4, 3],
          'line-opacity': 0.7
        }
      },
      // The route between the venues. Drawn above the basemap's roads but below
      // its labels, so street names stay readable underneath the itinerary.
      {
        id: 'leg-casing',
        type: 'line',
        source: 'venue-legs',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': C.paper,
          'line-width': byZoom(11, 5, 17, 12),
          'line-opacity': 0.85
        }
      },
      {
        id: 'leg-transit',
        type: 'line',
        source: 'venue-legs',
        filter: ['match', ['get', 'mode'], ['tram', 'bus', 'train', 'metro'], true, false],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.pink, 'line-width': byZoom(11, 2.6, 17, 6) }
      },
      {
        id: 'leg-walk',
        type: 'line',
        source: 'venue-legs',
        filter: ['==', ['get', 'mode'], 'walk'],
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': C.greenDark,
          'line-width': byZoom(11, 2, 17, 4),
          'line-dasharray': [1, 1.6]
        }
      },
      {
        id: 'leg-other',
        type: 'line',
        source: 'venue-legs',
        filter: ['match', ['get', 'mode'], ['walk', 'tram', 'bus', 'train', 'metro'], false, true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.greenDark, 'line-width': byZoom(11, 2.2, 17, 5) }
      },
      {
        id: 'leg-label',
        type: 'symbol',
        source: 'venue-legs',
        filter: ['!=', ['get', 'label'], ''],
        minzoom: 12,
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Bold'],
          'text-size': byZoom(12, 10, 17, 13),
          'text-letter-spacing': 0.02
        },
        paint: { 'text-color': C.greenDark, 'text-halo-color': C.paper, 'text-halo-width': 2.4 }
      },
      {
        id: 'label-road',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': byZoom(14, 9, 18, 12),
          'text-letter-spacing': 0.04
        },
        paint: {
          'text-color': C.greenDark,
          'text-halo-color': C.paper,
          'text-halo-width': 1.4,
          'text-opacity': 0.75
        }
      },
      {
        id: 'label-water',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': 11,
          'text-max-width': 6
        },
        paint: { 'text-color': C.waterDark, 'text-halo-color': C.paper, 'text-halo-width': 1.2 }
      },
      {
        id: 'label-place',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: [
          'match',
          ['get', 'class'],
          ['city', 'town', 'village', 'suburb', 'hamlet'],
          true,
          false
        ],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Bold'],
          'text-size': byZoom(8, 11, 14, 15),
          'text-max-width': 8,
          'text-letter-spacing': 0.06,
          'text-transform': 'uppercase'
        },
        paint: { 'text-color': C.greenDark, 'text-halo-color': C.paper, 'text-halo-width': 1.8 }
      }
    ]
  })

  const googleMapsUrl = place =>
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(`${place.lat},${place.lng}`)

  const hasCoords = place =>
    !!place && typeof place.lat === 'number' && typeof place.lng === 'number'

  /**
   * The itinerary is linear: `legs[i]` joins `places[i]` to `places[i + 1]`.
   * A leg may carry an explicit `path` ([[lng, lat], ...]) traced along the real
   * tram line or footpath; without one it falls back to a straight hop, which is
   * close enough over the short distances involved.
   */
  const legGeoJson = config => {
    const places = config.places || []
    const features = []

    ;(config.legs || []).forEach((leg, i) => {
      let coordinates = leg.path
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        const from = places[i]
        const to = places[i + 1]
        if (!hasCoords(from) || !hasCoords(to)) return
        coordinates = [
          [from.lng, from.lat],
          [to.lng, to.lat]
        ]
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { mode: leg.mode || 'walk', label: leg.label || '' }
      })
    })

    return { type: 'FeatureCollection', features }
  }

  const markerElement = (place, index) => {
    const el = document.createElement('div')
    el.className = 'venue-map-marker'

    const pin = document.createElement('span')
    pin.className = 'venue-map-marker-pin'
    pin.innerHTML =
      '<svg viewBox="0 0 24 32" width="26" height="35" aria-hidden="true">' +
      '<path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"/>' +
      '<circle cx="12" cy="12" r="6.4"/>' +
      `<text x="12" y="12" text-anchor="middle" dominant-baseline="central">${index + 1}</text>` +
      '</svg>'
    el.appendChild(pin)

    if (place.label) {
      const label = document.createElement('a')
      label.className = 'venue-map-marker-label'
      label.href = place.link || googleMapsUrl(place)
      label.target = '_blank'
      label.rel = 'noopener'
      label.textContent = place.label
      el.appendChild(label)
    }
    return el
  }

  // Glyphs for the unnumbered points of interest, keyed by `poi.kind`: markup
  // for the badge, either a letter or an inline SVG. A kind with no glyph here
  // is skipped rather than drawn as a blank badge.
  const POI_GLYPHS = {
    parking: 'P',
    // An engagement ring: a faceted diamond set on a band.
    wedding:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<circle cx="12" cy="16.2" r="5.4" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M8.6 2.5h6.8l2.6 3.2-6 5.6-6-5.6z" fill="currentColor"/>' +
      '<path d="M6 5.7h12M10.3 2.5 9.4 5.7l2.6 5.6 2.6-5.6-.9-3.2" fill="none" ' +
      `stroke="${C.pink}" stroke-width="0.8" stroke-linejoin="round"/>` +
      '</svg>'
  }

  const poiElement = poi => {
    const el = document.createElement('div')
    el.className = `venue-map-poi venue-map-poi--${poi.kind}`
    el.title = poi.label || ''

    const badge = document.createElement('span')
    badge.className = 'venue-map-poi-badge'
    badge.setAttribute('aria-hidden', 'true')
    badge.innerHTML = POI_GLYPHS[poi.kind]
    el.appendChild(badge)
    return el
  }

  // MapLibre spreads this over its English defaults, so a missing string must be
  // left out entirely - an undefined value would replace the default and throw.
  const mapLocale = config => {
    const strings = {
      'CooperativeGesturesHandler.WindowsHelpText': config.gesture_hints?.windows,
      'CooperativeGesturesHandler.MacHelpText': config.gesture_hints?.mac,
      'CooperativeGesturesHandler.MobileHelpText': config.gesture_hints?.mobile,
      'FullscreenControl.Enter': config.fullscreen?.enter,
      'FullscreenControl.Exit': config.fullscreen?.exit
    }
    return Object.fromEntries(Object.entries(strings).filter(([, text]) => text))
  }

  const initMap = (root, config) => {
    const canvas = root.querySelector('.venue-map-canvas')
    const places = (config.places || []).filter(hasCoords)
    const legs = legGeoJson(config)
    const center = config.center || places[0]
    if (!canvas || !center) return

    let map
    try {
      map = new maplibregl.Map({
        container: canvas,
        style: buildStyle(legs),
        center: [center.lng, center.lat],
        zoom: config.zoom || 14,
        attributionControl: { compact: true },
        // A plain scroll (or one-finger swipe) over the map keeps scrolling the
        // page; Ctrl/⌘ + scroll zooms and two fingers pan, with a hint overlay.
        cooperativeGestures: true,
        locale: mapLocale(config),
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false
      })
    } catch (err) {
      // No WebGL, or MapLibre refused the context - the itinerary stands alone.
      console.warn('Venue map unavailable:', err)
      root.classList.add('venue-map--unavailable')
      return
    }

    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    // Expanded, the map is the whole screen and there is no page behind it to
    // scroll, so plain scroll and one-finger drag go back to moving the map.
    // Where the Fullscreen API is missing (iPhone Safari) MapLibre falls back to
    // stretching the container over the window, and fires the same events.
    const fullscreen = new maplibregl.FullscreenControl()
    fullscreen.on('fullscreenstart', () => map.cooperativeGestures.disable())
    fullscreen.on('fullscreenend', () => map.cooperativeGestures.enable())
    map.addControl(fullscreen, 'top-right')
    ;(config.places || []).forEach((place, i) => {
      if (!hasCoords(place)) return
      new maplibregl.Marker({ element: markerElement(place, i), anchor: 'bottom' })
        .setLngLat([place.lng, place.lat])
        .addTo(map)
    })
    // Points of interest go in after the stops so a stop's pin stays on top
    // wherever the two overlap.
    ;(config.pois || []).forEach(poi => {
      if (!hasCoords(poi) || !POI_GLYPHS[poi.kind]) return
      new maplibregl.Marker({ element: poiElement(poi), anchor: 'center' })
        .setLngLat([poi.lng, poi.lat])
        .addTo(map)
    })

    // No hand-picked centre: frame the whole route, legs included, so a detour
    // along an explicit path is not cropped out.
    if (!config.center && places.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      places.forEach(p => bounds.extend([p.lng, p.lat]))
      legs.features.forEach(f => f.geometry.coordinates.forEach(c => bounds.extend(c)))
      map.fitBounds(bounds, { padding: 70, maxZoom: config.zoom || 15, duration: 0 })
    }

    const syncLabels = () =>
      root.classList.toggle('venue-map--compact', map.getZoom() < LABEL_MIN_ZOOM)
    map.on('zoom', syncLabels)
    syncLabels()

    root.classList.add('venue-map--ready')
  }

  const loadOnce = (tag, attrs) =>
    new Promise((resolve, reject) => {
      const el = document.createElement(tag)
      Object.assign(el, attrs)
      el.onload = resolve
      el.onerror = () => reject(new Error(`Failed to load ${attrs.src || attrs.href}`))
      document.head.appendChild(el)
    })

  let maplibreReady = null
  const loadMaplibre = () => {
    if (!maplibreReady) {
      maplibreReady = Promise.all([
        loadOnce('link', { rel: 'stylesheet', href: MAPLIBRE_CSS }),
        loadOnce('script', { src: MAPLIBRE_JS, async: true })
      ])
    }
    return maplibreReady
  }

  const boot = root => {
    const configEl = root.querySelector('.venue-map-config')
    if (!configEl) return

    let config
    try {
      config = JSON.parse(configEl.textContent)
    } catch (err) {
      console.warn('Venue map config is not valid JSON:', err)
      return
    }

    loadMaplibre()
      .then(() => initMap(root, config))
      .catch(err => {
        console.warn('Venue map unavailable:', err)
        root.classList.add('venue-map--unavailable')
      })
  }

  document.addEventListener('DOMContentLoaded', () => {
    const roots = document.querySelectorAll('[data-venue-map]')
    if (!roots.length) return

    // Most visitors never scroll this far; don't spend their data on tiles until
    // the map is actually about to be on screen.
    if (!('IntersectionObserver' in window)) {
      roots.forEach(boot)
      return
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          observer.unobserve(entry.target)
          boot(entry.target)
        })
      },
      { rootMargin: '300px' }
    )
    roots.forEach(root => observer.observe(root))
  })
})()
