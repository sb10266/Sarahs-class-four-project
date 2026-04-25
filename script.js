mapboxgl.accessToken = 'pk.eyJ1Ijoic2IxMDI2NiIsImEiOiJjbW9lazkybG0wNGM5MnFxYWIxejkxMWZnIn0.yl0e2TIIUjZf-2yOe1q6WQ';

// Some of this code I pulled from my class three assignment, which I did by hand. I also found the geojson file from OpenSource Philadelphia data, and pulled that in myself. I used ChatGPT to help generate a lot of the visuals for this, because I knew exactly how I wanted it to look and wanted help to get it there.

const map = new mapboxgl.Map({
  container: 'map-container',
  style: 'mapbox://styles/mapbox/dark-v11',
  projection: 'mercator',
  zoom: 10.64,
  center: [-75.16071, 39.98169]
});

map.addControl(new mapboxgl.NavigationControl());

let selectedNeighborhood = null;
let selectedRegion = null;

map.on('load', () => {

  fetch('philadelphia-neighborhoods.geojson')
    .then(res => res.json())
    .then(data => {

      const regionColors = {
        northwest: '#355f3a',
        north: '#4c8c4a',
        northeast: '#7fbf7b',
        south: '#a6611a',
        east: '#80cdc1',
        west: '#bf812d',
        central: '#dfc27d'
      };

      // Similar to a comment I made in the HTML, I wanted an earth toned color palette that used a lot of green. I did google best practices for maps to also think about what colors work well together and to help differentiate places. Originally I thought about trying to have every neighborhood be a unique color, but I thought that would be overwhelming, and ultimately decided that differentiating by region would be nice and help users understand the nuances of how Philadelphia is divided

      const center = [-75.1652, 39.9526];

      function getCentroid(coords) {
        let x = 0, y = 0, count = 0;
        coords.forEach(polygon => {
          polygon.forEach(ring => {
            ring.forEach(coord => {
              x += coord[0];
              y += coord[1];
              count++;
            });
          });
        });
        return [x / count, y / count];
      }

// Most of this was done through a combination of watching the course recording, figuring out how I wanted this to look and what I wanted it to do, and then iterating with ChatGPT (or sometimes googling and editing) to get it there. As you look at some of the comments, you'll likely see some of the ones that ChatGPT added as we iterated. For example, there are places where it writes that something was fixed.


      // Assign region + color
      data.features.forEach(feature => {
        const [lng, lat] = getCentroid(feature.geometry.coordinates);

        const latDiff = lat - center[1];
        const lngDiff = lng - center[0];

        let region;

        if (latDiff > 0.02) {
          if (lngDiff < -0.02) region = 'northwest';
          else if (lngDiff > 0.02) region = 'northeast';
          else region = 'north';
        } else if (latDiff < -0.02) {
          region = 'south';
        } else if (lngDiff > 0.02) {
          region = 'east';
        } else if (lngDiff < -0.02) {
          region = 'west';
        } else {
          region = 'central';
        }

        feature.properties.region = region;
        feature.properties.color = regionColors[region];
      });

      map.addSource('neighborhoods', {
        type: 'geojson',
        data: data
      });

      map.addLayer({
        id: 'neighborhoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.9
        }
      });

      map.addLayer({
        id: 'neighborhoods-outline',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#000000',
          'line-width': 1
        }
      });

      map.addLayer({
        id: 'neighborhoods-highlight',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#ffffff',
          'line-width': 4
        },
        filter: ['==', 'LISTNAME', '']
      });

      // 🟡 LEGEND INTERACTIVITY
      Object.keys(regionColors).forEach(region => {
        const el = document.getElementById(`legend-${region}`);
        if (!el) return;

        el.addEventListener('click', (e) => {
          e.stopPropagation(); // ✅ prevent map reset

          // Toggle OFF
          if (selectedRegion === region) {
            selectedRegion = null;

            map.setFilter('neighborhoods-fill', null);
            map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.9);

            document.getElementById('legend-label').innerText =
              'Click a region in the legend to explore neighborhoods, or click directly on the map.';

            document.getElementById('legend-list').innerHTML = '';
            return;
          }

          selectedRegion = region;
          selectedNeighborhood = null;

          // Filter map
          map.setFilter('neighborhoods-fill', ['==', ['get', 'region'], region]);
          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.9);

          // Update label
          const regionLabel = region.charAt(0).toUpperCase() + region.slice(1);
          document.getElementById('legend-label').innerText = `${regionLabel} Philadelphia`;

          // Populate neighborhood list
          const listContainer = document.getElementById('legend-list');
          listContainer.innerHTML = '';

          const neighborhoods = data.features
            .filter(f => f.properties.region === region)
            .map(f => f.properties.LISTNAME)
            .sort();

          neighborhoods.forEach(name => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerText = name;

            item.addEventListener('click', (e) => {
              e.stopPropagation(); // ✅ prevent reset

              selectedNeighborhood = name;

              map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', name]);

              map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
                'case',
                ['==', ['get', 'LISTNAME'], name],
                1,
                0.2
              ]);
            });

            listContainer.appendChild(item);
          });

        });
      });

      // ✅ Map neighborhood click
      map.on('click', 'neighborhoods-fill', (e) => {
        const name = e.features[0].properties.LISTNAME;
        const region = e.features[0].properties.region;

        // Toggle off if same
        if (selectedNeighborhood === name) {
          selectedNeighborhood = null;
          selectedRegion = null;

          map.setFilter('neighborhoods-fill', null);
          map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);
          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.9);

          document.getElementById('legend-label').innerText =
            'Click a region in the legend to explore neighborhoods, or click directly on the map.';

          document.getElementById('legend-list').innerHTML = '';
          return;
        }

        selectedNeighborhood = name;
        selectedRegion = null;

        map.setFilter('neighborhoods-fill', null);

        map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', name]);

        map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'LISTNAME'], name],
          1,
          0.2
        ]);

        const regionLabel = region.charAt(0).toUpperCase() + region.slice(1);

        document.getElementById('legend-label').innerText = name;

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${name}</strong><br/>
            <span style="font-size:12px; opacity:0.8;">
              ${regionLabel} Philadelphia
            </span>
          `)
          .addTo(map);
      });

      // ✅ Background click reset (fixed)
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['neighborhoods-fill']
        });

        if (!features.length && !selectedRegion) {
          selectedNeighborhood = null;

          map.setFilter('neighborhoods-highlight', ['==', 'LISTNAME', '']);
          map.setPaintProperty('neighborhoods-fill', 'fill-opacity', 0.9);

          document.getElementById('legend-label').innerText =
            'Click a region in the legend to explore neighborhoods, or click directly on the map.';

          document.getElementById('legend-list').innerHTML = '';
        }
      });

      map.on('mouseenter', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = '';
      });

    });

});